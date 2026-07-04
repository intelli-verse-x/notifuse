"""Async HTTP client for the Notifuse API used by the MCP tools."""

from __future__ import annotations

import contextvars
import hashlib
import hmac
import json
import time
from typing import Any

import httpx

from .config import Config
from .endpoints import Endpoint

# Per-request bearer token. In the HTTP transport this is populated from the
# incoming ``Authorization`` header so each caller authenticates with their own
# Notifuse token instead of a shared, ambient credential. It always takes
# precedence over any process-level token.
request_token: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "notifuse_request_token", default=None
)


class NotifuseError(Exception):
    """Raised when the Notifuse API returns a non-2xx response."""


class NotifuseClient:
    def __init__(self, config: Config):
        self.config = config
        # Active bearer token. Starts from the configured API key but can be
        # replaced at runtime by sign-in / root-signin / create-api-key tools so
        # the whole auth flow can be performed from chat.
        self._token: str | None = config.api_key
        self._client = httpx.AsyncClient(
            base_url=config.base_url,
            timeout=config.timeout,
            verify=config.verify_tls,
            headers={"User-Agent": "notifuse-mcp/0.1"},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    # -- token management ---------------------------------------------------
    def set_token(self, token: str) -> None:
        self._token = token

    def has_token(self) -> bool:
        return bool(request_token.get() or self._token)

    def _active_token(self) -> str | None:
        # A per-request header token always wins over the process-level token so
        # the shared HTTP deployment never leaks one caller's token to another.
        return request_token.get() or self._token

    def _auth_headers(self, auth_required: bool) -> dict[str, str]:
        token = self._active_token()
        if auth_required and token:
            return {"Authorization": f"Bearer {token}"}
        return {}

    # -- low-level request --------------------------------------------------
    async def request(
        self,
        method: str,
        path: str,
        *,
        query: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
        auth: bool = True,
    ) -> Any:
        headers = self._auth_headers(auth)
        params = _clean_query(query)
        kwargs: dict[str, Any] = {"params": params, "headers": headers}
        if method.upper() != "GET" and body is not None:
            kwargs["json"] = body
        resp = await self._client.request(method.upper(), path, **kwargs)
        return _parse_response(resp)

    # -- endpoint dispatch --------------------------------------------------
    async def call_endpoint(self, ep: Endpoint, arguments: dict[str, Any]) -> Any:
        query, body = self._split_args(ep, dict(arguments or {}))
        # Auto-capture tokens returned by auth endpoints so subsequent calls work.
        result = await self.request(
            ep.method, ep.path, query=query, body=body or None, auth=ep.auth
        )
        self._maybe_capture_token(ep, result)
        return result

    def _split_args(self, ep: Endpoint, args: dict[str, Any]) -> tuple[dict, dict]:
        qnames = {p.name for p in ep.query}
        bnames = {p.name for p in ep.body}

        # Inject default workspace_id when the endpoint expects one.
        if "workspace_id" in (qnames | bnames) and not args.get("workspace_id"):
            if self.config.workspace_id:
                args["workspace_id"] = self.config.workspace_id

        query: dict[str, Any] = {}
        body: dict[str, Any] = {}
        for key, value in args.items():
            if value is None:
                continue
            if key in qnames:
                query[key] = value
            elif key in bnames:
                body[key] = value
            elif ep.method.upper() == "GET":
                query[key] = value
            else:
                body[key] = value
        return query, body

    def _maybe_capture_token(self, ep: Endpoint, result: Any) -> None:
        if not isinstance(result, dict):
            return
        if ep.name in ("user_verify", "user_root_signin", "workspaces_create_api_key"):
            token = result.get("token")
            if isinstance(token, str) and token:
                self.set_token(token)

    # -- helpers ------------------------------------------------------------
    async def root_signin(self, email: str) -> Any:
        """Compute the HMAC signature and perform a programmatic root sign-in."""
        if not self.config.secret_key:
            raise NotifuseError(
                "NOTIFUSE_SECRET_KEY is not configured; cannot compute the root sign-in signature."
            )
        timestamp = int(time.time())
        message = f"{email}:{timestamp}".encode()
        signature = hmac.new(
            self.config.secret_key.encode(), message, hashlib.sha256
        ).hexdigest()
        result = await self.request(
            "POST",
            "/api/user.rootSignin",
            body={"email": email, "timestamp": timestamp, "signature": signature},
            auth=False,
        )
        if isinstance(result, dict) and isinstance(result.get("token"), str):
            self.set_token(result["token"])
        return result


def _clean_query(query: dict[str, Any] | None) -> dict[str, Any] | None:
    if not query:
        return None
    out: dict[str, Any] = {}
    for key, value in query.items():
        if value is None:
            continue
        if isinstance(value, bool):
            out[key] = "true" if value else "false"
        elif isinstance(value, (list, tuple)):
            # Repeated query params (?segments=a&segments=b) handled by httpx lists.
            out[key] = [str(v) for v in value]
        elif isinstance(value, (dict,)):
            out[key] = json.dumps(value)
        else:
            out[key] = str(value)
    return out


def _parse_response(resp: httpx.Response) -> Any:
    content_type = resp.headers.get("content-type", "")

    # Redirects (e.g. /visit click tracking) are expected, not errors.
    if resp.is_redirect or 300 <= resp.status_code < 400:
        return {
            "status_code": resp.status_code,
            "redirect_to": resp.headers.get("location"),
        }

    if resp.is_success:
        # Binary payloads (e.g. the /opens tracking pixel): summarize instead of
        # dumping raw bytes into the chat. SVG is treated as text below.
        if content_type.startswith(("image/", "application/octet-stream")) and not content_type.startswith("image/svg"):
            return {
                "status_code": resp.status_code,
                "content_type": content_type,
                "bytes": len(resp.content),
            }
        # Many Notifuse handlers return JSON with a sniffed text/plain content
        # type, so always attempt to parse JSON first and fall back to raw text.
        try:
            return resp.json()
        except (json.JSONDecodeError, ValueError):
            return resp.text

    text = resp.text
    message = None
    try:
        payload = resp.json()
        if isinstance(payload, dict):
            message = payload.get("error") or payload.get("message")
    except (json.JSONDecodeError, ValueError):
        pass
    raise NotifuseError(
        f"HTTP {resp.status_code} {resp.reason_phrase} for {resp.request.method} "
        f"{resp.request.url.path}: {message or (text[:500] if text else '<empty body>')}"
    )

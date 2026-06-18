"""Streamable-HTTP transport for the Notifuse MCP server.

Exposes the same tools as the stdio server over HTTP so the server can be
deployed remotely (e.g. behind an ALB) and shared by multiple chat clients.

Security model: the server holds **no ambient Notifuse credential**. Every
request authenticates with its own bearer token supplied via the incoming
``Authorization`` header, which is forwarded to the Notifuse API for that
request only. This keeps a publicly reachable deployment safe by default.

Routes:
  * ``POST /mcp``  - MCP streamable HTTP endpoint (also handles GET/DELETE).
  * ``GET  /healthz`` - liveness/readiness probe.
"""

from __future__ import annotations

import contextlib
import os
from collections.abc import AsyncIterator

import uvicorn
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Mount, Route

from .client import NotifuseClient, request_token
from .config import Config
from .server import build_server


def _extract_bearer(scope) -> str | None:
    for key, value in scope.get("headers") or []:
        if key == b"authorization":
            raw = value.decode("latin-1")
            if raw.lower().startswith("bearer "):
                return raw[7:].strip() or None
            return raw.strip() or None
    return None


def build_app() -> Starlette:
    config = Config.from_env()
    client = NotifuseClient(config)
    server = build_server(client)

    # json_response=True returns plain JSON instead of SSE streams, which proxies
    # cleanly through an ALB (no streaming/buffering quirks).
    session_manager = StreamableHTTPSessionManager(
        app=server,
        json_response=True,
        stateless=True,
    )

    async def handle_mcp(scope, receive, send) -> None:
        # Bind the caller's token to this request's context before the MCP
        # session (and therefore the tool dispatch) runs.
        token = _extract_bearer(scope)
        reset = request_token.set(token)
        try:
            await session_manager.handle_request(scope, receive, send)
        finally:
            request_token.reset(reset)

    async def healthz(_request: Request) -> Response:
        return JSONResponse({"status": "ok", "service": "notifuse-mcp"})

    async def index(_request: Request) -> Response:
        return JSONResponse(
            {
                "service": "notifuse-mcp",
                "mcp_endpoint": "/mcp",
                "health": "/healthz",
                "auth": "Send your Notifuse API key as 'Authorization: Bearer <token>'.",
            }
        )

    @contextlib.asynccontextmanager
    async def lifespan(_app: Starlette) -> AsyncIterator[None]:
        async with session_manager.run():
            try:
                yield
            finally:
                await client.aclose()

    app = Starlette(
        routes=[
            Route("/", index, methods=["GET"]),
            Route("/healthz", healthz, methods=["GET"]),
            Mount("/mcp", app=handle_mcp),
        ],
        lifespan=lifespan,
    )

    # Normalize a bare "/mcp" to "/mcp/" at the ASGI layer so the request is served
    # directly by the mount instead of triggering a 307 redirect (which clients
    # won't follow across a TLS-terminating proxy). This avoids any redirect.
    async def normalized(scope, receive, send):
        if scope.get("type") == "http" and scope.get("path") == "/mcp":
            scope = dict(scope)
            scope["path"] = "/mcp/"
            scope["raw_path"] = b"/mcp/"
        await app(scope, receive, send)

    return normalized


def serve_http() -> None:
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "3030"))
    # proxy_headers + forwarded_allow_ips let uvicorn honor X-Forwarded-Proto from
    # the ALB so any generated URLs use https and never downgrade the scheme.
    uvicorn.run(
        build_app(),
        host=host,
        port=port,
        log_level=os.environ.get("LOG_LEVEL", "info"),
        proxy_headers=True,
        forwarded_allow_ips="*",
    )

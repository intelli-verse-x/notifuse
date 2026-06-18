"""Notifuse MCP server.

Builds one MCP tool per Notifuse endpoint (from :mod:`notifuse_mcp.endpoints`)
plus a few meta-tools, and dispatches tool calls to the Notifuse HTTP API.
"""

from __future__ import annotations

import json
from typing import Any

import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from .client import NotifuseClient, NotifuseError
from .config import Config
from .endpoints import ENDPOINTS, ENDPOINTS_BY_NAME, Endpoint

TOOL_PREFIX = "notifuse_"

META_LIST_ENDPOINTS = f"{TOOL_PREFIX}list_endpoints"
META_REQUEST = f"{TOOL_PREFIX}request"
META_ROOT_SIGNIN = f"{TOOL_PREFIX}root_signin"
META_USE_TOKEN = f"{TOOL_PREFIX}use_token"
META_AUTH_STATUS = f"{TOOL_PREFIX}auth_status"


def _input_schema(ep: Endpoint) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    required: list[str] = []
    for param in (*ep.query, *ep.body):
        properties[param.name] = param.schema()
        if param.required:
            required.append(param.name)
    schema: dict[str, Any] = {
        "type": "object",
        "properties": properties,
        "additionalProperties": bool(ep.freeform),
    }
    if required:
        schema["required"] = required
    return schema


def _endpoint_tool(ep: Endpoint) -> types.Tool:
    auth_note = "" if ep.auth else " (no auth required)"
    description = f"[{ep.method} {ep.path}]{auth_note} {ep.summary}"
    return types.Tool(
        name=f"{TOOL_PREFIX}{ep.name}",
        description=description,
        inputSchema=_input_schema(ep),
    )


def _meta_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name=META_AUTH_STATUS,
            description="Show the configured Notifuse base URL, default workspace and "
            "whether an auth token is currently active.",
            inputSchema={"type": "object", "properties": {}, "additionalProperties": False},
        ),
        types.Tool(
            name=META_LIST_ENDPOINTS,
            description="List every available Notifuse endpoint/tool, optionally filtered "
            "by tag or substring. Useful to discover capabilities.",
            inputSchema={
                "type": "object",
                "properties": {
                    "tag": {"type": "string", "description": "Filter by resource tag (e.g. contacts, broadcasts)."},
                    "search": {"type": "string", "description": "Case-insensitive substring filter on name/summary."},
                },
                "additionalProperties": False,
            },
        ),
        types.Tool(
            name=META_USE_TOKEN,
            description="Set the active bearer token (API key or user JWT) used for "
            "authenticated requests for the rest of this session.",
            inputSchema={
                "type": "object",
                "properties": {"token": {"type": "string", "description": "Bearer token to use."}},
                "required": ["token"],
                "additionalProperties": False,
            },
        ),
        types.Tool(
            name=META_ROOT_SIGNIN,
            description="Programmatic root sign-in. Computes the HMAC-SHA256 signature from "
            "the email + current timestamp using NOTIFUSE_SECRET_KEY, signs in, and stores "
            "the returned token as the active token.",
            inputSchema={
                "type": "object",
                "properties": {
                    "email": {"type": "string", "description": "Root email (defaults to NOTIFUSE_ROOT_EMAIL)."}
                },
                "additionalProperties": False,
            },
        ),
        types.Tool(
            name=META_REQUEST,
            description="Escape hatch: call ANY Notifuse endpoint directly. Use only when a "
            "dedicated tool does not exist. Provide method, path, and optional query/body.",
            inputSchema={
                "type": "object",
                "properties": {
                    "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"]},
                    "path": {"type": "string", "description": "API path beginning with '/', e.g. /api/contacts.list"},
                    "query": {"type": "object", "additionalProperties": True},
                    "body": {"type": "object", "additionalProperties": True},
                    "auth": {"type": "boolean", "description": "Send the auth header (default true)."},
                },
                "required": ["method", "path"],
                "additionalProperties": False,
            },
        ),
    ]


def _as_text(payload: Any) -> list[types.TextContent]:
    if isinstance(payload, str):
        text = payload
    else:
        text = json.dumps(payload, indent=2, ensure_ascii=False, default=str)
    return [types.TextContent(type="text", text=text)]


def build_server(client: NotifuseClient) -> Server:
    server = Server("notifuse")

    @server.list_tools()
    async def list_tools() -> list[types.Tool]:
        return _meta_tools() + [_endpoint_tool(ep) for ep in ENDPOINTS]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any] | None) -> list[types.TextContent]:
        arguments = arguments or {}
        try:
            return await _dispatch(client, name, arguments)
        except NotifuseError as exc:
            return [types.TextContent(type="text", text=f"Notifuse API error: {exc}")]
        except Exception as exc:  # noqa: BLE001 - surface any failure to the model
            return [types.TextContent(type="text", text=f"Error: {type(exc).__name__}: {exc}")]

    return server


async def _dispatch(
    client: NotifuseClient, name: str, arguments: dict[str, Any]
) -> list[types.TextContent]:
    if name == META_AUTH_STATUS:
        return _as_text(
            {
                "base_url": client.config.base_url,
                "default_workspace_id": client.config.workspace_id,
                "has_active_token": client.has_token(),
                "secret_key_configured": bool(client.config.secret_key),
            }
        )

    if name == META_LIST_ENDPOINTS:
        tag = (arguments.get("tag") or "").lower()
        search = (arguments.get("search") or "").lower()
        items = []
        for ep in ENDPOINTS:
            if tag and ep.tag.lower() != tag:
                continue
            if search and search not in ep.name.lower() and search not in ep.summary.lower():
                continue
            items.append(
                {
                    "tool": f"{TOOL_PREFIX}{ep.name}",
                    "method": ep.method,
                    "path": ep.path,
                    "tag": ep.tag,
                    "auth": ep.auth,
                    "summary": ep.summary,
                }
            )
        return _as_text({"count": len(items), "endpoints": items})

    if name == META_USE_TOKEN:
        token = arguments.get("token")
        if not token:
            raise NotifuseError("token is required")
        client.set_token(token)
        return _as_text({"ok": True, "message": "Active token updated."})

    if name == META_ROOT_SIGNIN:
        email = arguments.get("email") or client.config.root_email
        if not email:
            raise NotifuseError("email is required (or set NOTIFUSE_ROOT_EMAIL).")
        return _as_text(await client.root_signin(email))

    if name == META_REQUEST:
        return _as_text(
            await client.request(
                arguments["method"],
                arguments["path"],
                query=arguments.get("query"),
                body=arguments.get("body"),
                auth=arguments.get("auth", True),
            )
        )

    if not name.startswith(TOOL_PREFIX):
        raise NotifuseError(f"Unknown tool: {name}")

    endpoint_name = name[len(TOOL_PREFIX):]
    ep = ENDPOINTS_BY_NAME.get(endpoint_name)
    if ep is None:
        raise NotifuseError(f"Unknown tool: {name}")

    return _as_text(await client.call_endpoint(ep, arguments))


async def serve() -> None:
    config = Config.from_env()
    client = NotifuseClient(config)
    server = build_server(client)
    try:
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                server.create_initialization_options(),
            )
    finally:
        await client.aclose()

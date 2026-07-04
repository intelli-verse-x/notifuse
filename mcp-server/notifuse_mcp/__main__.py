"""Entry points for the Notifuse MCP server.

Transport is selected via the ``MCP_TRANSPORT`` env var (``stdio`` default,
``http`` for the deployed/streamable-HTTP server).
"""

from __future__ import annotations

import asyncio
import os

from .server import serve


def run() -> None:
    transport = os.environ.get("MCP_TRANSPORT", "stdio").lower()
    if transport in ("http", "streamable-http", "streamable_http"):
        run_http()
        return
    asyncio.run(serve())


def run_http() -> None:
    from .http_server import serve_http

    serve_http()


if __name__ == "__main__":
    run()

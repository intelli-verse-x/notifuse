"""Runtime configuration for the Notifuse MCP server.

All configuration comes from environment variables so the server stays stateless
and easy to wire into an MCP client config block.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


@dataclass
class Config:
    """Resolved configuration for talking to a Notifuse instance."""

    base_url: str
    api_key: str | None
    workspace_id: str | None
    secret_key: str | None
    root_email: str | None
    timeout: float
    verify_tls: bool

    @classmethod
    def from_env(cls) -> "Config":
        base_url = _clean(os.environ.get("NOTIFUSE_API_URL")) or "http://localhost:8080"
        base_url = base_url.rstrip("/")

        timeout_raw = _clean(os.environ.get("NOTIFUSE_TIMEOUT"))
        try:
            timeout = float(timeout_raw) if timeout_raw else 60.0
        except ValueError:
            timeout = 60.0

        verify_raw = _clean(os.environ.get("NOTIFUSE_VERIFY_TLS"))
        verify_tls = (verify_raw or "true").lower() not in ("0", "false", "no")

        return cls(
            base_url=base_url,
            api_key=_clean(os.environ.get("NOTIFUSE_API_KEY")),
            workspace_id=_clean(os.environ.get("NOTIFUSE_WORKSPACE_ID")),
            secret_key=_clean(os.environ.get("NOTIFUSE_SECRET_KEY")),
            root_email=_clean(os.environ.get("NOTIFUSE_ROOT_EMAIL")),
            timeout=timeout,
            verify_tls=verify_tls,
        )

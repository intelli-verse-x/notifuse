# Notifuse MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the
**complete Notifuse API** as chat tools. Once connected, an MCP client (Cursor,
Claude Desktop, etc.) can drive every Notifuse operation — contacts, lists,
segments, templates, broadcasts, transactional sends, automations, analytics,
webhooks, blog, tasks, workspace administration and more — directly from chat.

## Coverage

The server registers **one tool per Notifuse endpoint** (~110 endpoints across
30+ resources), plus a few meta-tools. Coverage is data-driven from
[`notifuse_mcp/endpoints.py`](notifuse_mcp/endpoints.py), so it is easy to audit
and extend.

| Resource | Tools |
| --- | --- |
| Setup | `notifuse_setup_status`, `notifuse_setup_initialize`, `notifuse_setup_test_smtp` |
| Auth / users | `notifuse_user_signin`, `notifuse_user_verify`, `notifuse_user_root_signin`, `notifuse_user_me`, `notifuse_user_logout` |
| Workspaces | `notifuse_workspaces_*` (list/get/create/update/delete, members, invitations, API keys, integrations) |
| Contacts | `notifuse_contacts_*` (list/count/get/upsert/import/delete) |
| Contact lists | `notifuse_contact_lists_*` |
| Lists | `notifuse_lists_*` |
| Segments | `notifuse_segments_*` |
| Templates | `notifuse_templates_*`, `notifuse_template_blocks_*` |
| Broadcasts | `notifuse_broadcasts_*` (incl. schedule, pause/resume/cancel, A/B winner) |
| Transactional | `notifuse_transactional_*` (incl. `send`) |
| Custom events | `notifuse_custom_events_*` |
| Automations | `notifuse_automations_*` |
| Messages | `notifuse_messages_*` |
| Timeline | `notifuse_timeline_list` |
| Analytics | `notifuse_analytics_query`, `notifuse_analytics_schemas` |
| Webhooks | `notifuse_webhook_subscriptions_*`, `notifuse_webhooks_*`, `notifuse_inbound_webhook_events_list` |
| Email | `notifuse_email_test_provider` |
| Blog | `notifuse_blog_categories_*`, `notifuse_blog_posts_*`, `notifuse_blog_themes_*` |
| Tasks / cron | `notifuse_tasks_*`, `notifuse_cron`, `notifuse_cron_status` |
| LLM | `notifuse_llm_chat` |
| Public | `notifuse_subscribe`, `notifuse_preferences_*`, `notifuse_unsubscribe_oneclick`, `notifuse_detect_favicon` |
| System | `notifuse_health`, `notifuse_healthz` |

### Meta-tools

| Tool | Purpose |
| --- | --- |
| `notifuse_auth_status` | Show base URL, default workspace and whether a token is active. |
| `notifuse_list_endpoints` | Discover/search all endpoints (filter by `tag` or `search`). |
| `notifuse_use_token` | Set the active bearer token for the session. |
| `notifuse_root_signin` | Programmatic HMAC root sign-in (needs `NOTIFUSE_SECRET_KEY`). |
| `notifuse_request` | Escape hatch to call any endpoint/method directly. |

## Configuration

The server is configured entirely via environment variables:

| Variable | Required | Description |
| --- | --- | --- |
| `NOTIFUSE_API_URL` | recommended | Base URL of your Notifuse instance. Defaults to `http://localhost:8080`. |
| `NOTIFUSE_API_KEY` | recommended | Bearer token (workspace API key or user JWT) used for authenticated calls. |
| `NOTIFUSE_WORKSPACE_ID` | optional | Default `workspace_id` injected when a tool needs one and you omit it. |
| `NOTIFUSE_SECRET_KEY` | optional | Instance `SECRET_KEY`; enables `notifuse_root_signin`. |
| `NOTIFUSE_ROOT_EMAIL` | optional | Default email for `notifuse_root_signin`. |
| `NOTIFUSE_TIMEOUT` | optional | HTTP timeout in seconds (default `60`). |
| `NOTIFUSE_VERIFY_TLS` | optional | Set to `false` to skip TLS verification (self-signed dev certs). |

### Getting a token from chat

You can bootstrap auth without any pre-set key:

- `notifuse_root_signin` — if `NOTIFUSE_SECRET_KEY` is set, computes the HMAC and
  signs in as root, storing the returned token automatically.
- `notifuse_user_signin` + `notifuse_user_verify` — magic-code login; the verified
  JWT is stored automatically.
- `notifuse_workspaces_create_api_key` — the returned API key becomes the active token.
- `notifuse_use_token` — paste an existing token directly.

## Install & run

Requires Python 3.10+.

```bash
cd mcp-server
python3 -m venv .venv && source .venv/bin/activate
pip install -e .

# Run over stdio
NOTIFUSE_API_URL=https://notifuse.example.com \
NOTIFUSE_API_KEY=your_api_key \
NOTIFUSE_WORKSPACE_ID=your_workspace \
notifuse-mcp
```

## Connect to Cursor

Add to `~/.cursor/mcp.json` (or the project's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "notifuse": {
      "command": "notifuse-mcp",
      "env": {
        "NOTIFUSE_API_URL": "https://notifuse.example.com",
        "NOTIFUSE_API_KEY": "your_api_key",
        "NOTIFUSE_WORKSPACE_ID": "your_workspace"
      }
    }
  }
}
```

If you are not installing the package globally, point `command` at the venv binary,
e.g. `"command": "/path/to/notifuse/mcp-server/.venv/bin/notifuse-mcp"`.

## Remote / HTTP deployment (streamable HTTP)

The server also runs as a remote HTTP MCP server (one shared endpoint for many
clients). Set `MCP_TRANSPORT=http` (the Docker image defaults to this) and it
serves:

- `POST /mcp` — MCP streamable HTTP endpoint (JSON responses).
- `GET /healthz` — health probe.

In HTTP mode it holds **no baked credential**; each request authenticates with
its own `Authorization: Bearer <token>` header, forwarded to Notifuse per request.

A live instance is deployed on the cluster at
`https://notifuse-mcp.intelli-verse-x.ai/mcp` (manifests in
`intelli-verse-kube-infra/notifuse-mcp/`). Connect with:

```json
{
  "mcpServers": {
    "notifuse": {
      "url": "https://notifuse-mcp.intelli-verse-x.ai/mcp",
      "headers": { "Authorization": "Bearer YOUR_NOTIFUSE_API_KEY" }
    }
  }
}
```

Build/push the image:

```bash
REG=970547373533.dkr.ecr.us-east-1.amazonaws.com
docker buildx build --platform linux/amd64 -t $REG/notifuse-mcp:<tag> --push .
```

## Connect to Claude Desktop

Add the same block to `claude_desktop_config.json`
(`~/Library/Application Support/Claude/` on macOS).

## Notes

- GET endpoints send parameters as query string; POST endpoints send a JSON body
  (blog endpoints additionally take `workspace_id` in the query string — handled
  automatically).
- Complex nested values (contact objects, MJML email blocks, segment trees,
  automation definitions, analytics queries) are passed through as JSON objects.
  Every tool accepts extra properties, so newer fields remain callable.
- `notifuse_llm_chat` returns the raw SSE stream text collected into one response.

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    MCP_TRANSPORT=http \
    HOST=0.0.0.0 \
    PORT=3030

WORKDIR /app

# Install dependencies first for better layer caching.
COPY pyproject.toml README.md ./
COPY notifuse_mcp ./notifuse_mcp
RUN pip install --upgrade pip && pip install .

# Run as a non-root user.
RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 3030

# MCP_TRANSPORT=http makes the entry point launch the streamable-HTTP server.
CMD ["notifuse-mcp"]

#!/bin/sh
set -e

# Fail loudly and specifically rather than serving an app that 500s on the first
# chat message. `docker compose up` with an unfilled .env should say why.
missing=""
[ -z "$ANTHROPIC_API_KEY" ] && missing="$missing ANTHROPIC_API_KEY"
[ -z "$AUTH_SECRET" ] && missing="$missing AUTH_SECRET"
[ -z "$DATABASE_URL" ] && missing="$missing DATABASE_URL"

if [ -n "$missing" ]; then
  echo "[desker] Missing required environment variable(s):$missing" >&2
  echo "[desker] Copy .env.example to .env and fill them in, then re-run docker compose up." >&2
  echo "[desker] Generate AUTH_SECRET with: openssl rand -base64 32" >&2
  exit 1
fi

# The schema is applied by the `migrate` service before this container starts -
# see docker-compose.yml. The runtime image is a slim standalone bundle without
# the Prisma CLI's dependency tree, and shipping that tree just to run one
# command at boot would roughly double the image.
echo "[desker] starting server on port ${PORT:-3000}..."
exec "$@"

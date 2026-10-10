#!/bin/sh
set -e

echo "🔒 Fixing permissions for data..."
[ -e /app/lavamusic.db ] && chown bun:bun /app/lavamusic.db || true
[ -d /app/lavamusic-pgdata ] && chown -R bun:bun /app/lavamusic-pgdata || true
[ -d /app/data ] && chown -R bun:bun /app/data || true

echo "🚀 Starting Lavamusic container..."

if echo "$DATABASE_URL" | grep -qE "^sqlite:|file:.*\.db$|file:.*\.sqlite$|\.db$|\.sqlite$"; then
  echo "📂 Detected SQLite database configuration."
  echo "🔄 Synchronizing SQLite schema..."

  su-exec 1000:1000 bun run db:push:sqlite
else
  echo "🐘 Detected PostgreSQL / PGLite configuration."
  echo "🔄 Synchronizing PostgreSQL schema..."

  su-exec 1000:1000 bun run db:push
fi

echo "✅ Database is ready"
echo "🎵 Starting Lavamusic..."

exec su-exec 1000:1000 "$@"

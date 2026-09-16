#!/bin/sh
set -e

echo "Running database migrations..."
DATABASE_URL="${DATABASE_URL:-file:./prisma/dev.db}" npx prisma migrate deploy

echo "Seeding achievements (idempotent — creates missing catalog rows only)..."
node prisma/seed.cjs

echo "Starting server..."
exec node server.js

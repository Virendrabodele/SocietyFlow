#!/usr/bin/env sh
set -eu

MAX_RETRIES="${DB_MIGRATION_MAX_RETRIES:-5}"
RETRY_DELAY_SECONDS="${DB_MIGRATION_RETRY_DELAY_SECONDS:-5}"
APP_PORT="${PORT:-10000}"

shutdown() {
  if [ -n "${UVICORN_PID:-}" ] && kill -0 "$UVICORN_PID" 2>/dev/null; then
    echo "[startup] Stopping API server (pid: ${UVICORN_PID})..."
    kill "$UVICORN_PID" 2>/dev/null || true
  fi
}

trap shutdown INT TERM EXIT

echo "[startup] Starting API server on port ${APP_PORT}..."
uvicorn main:app --host 0.0.0.0 --port "$APP_PORT" &
UVICORN_PID=$!

echo "[startup] API server started (pid: ${UVICORN_PID}). Running migrations in parallel..."
attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  echo "[startup] Running alembic migrations (attempt ${attempt}/${MAX_RETRIES})..."
  if alembic upgrade head; then
    echo "[startup] Migrations completed successfully."
    break
  fi

  if [ "$attempt" -eq "$MAX_RETRIES" ]; then
    echo "[startup] Migration failed after ${MAX_RETRIES} attempts. Exiting."
    exit 1
  fi

  echo "[startup] Migration attempt failed. Retrying in ${RETRY_DELAY_SECONDS}s..."
  sleep "$RETRY_DELAY_SECONDS"
  attempt=$((attempt + 1))
done

# Keep container alive with uvicorn as the long-running process.
wait "$UVICORN_PID"

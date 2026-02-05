#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v uv >/dev/null 2>&1; then
  if [ -x "/Users/brianmcmaster/.local/bin/uv" ]; then
    export PATH="/Users/brianmcmaster/.local/bin:$PATH"
  fi
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but not found in PATH."
  exit 1
fi

export OPENAI_INSTRUCTIONS="${OPENAI_INSTRUCTIONS:-comedy_performer}"
LOG_FILE="/tmp/briai-local-server.log"
PID_FILE="/tmp/briai-launcher.pid"
PORT="${PORT:-8080}"

if [ -f "$PID_FILE" ]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" >/dev/null 2>&1; then
    echo "Launcher already running with PID $EXISTING_PID"
    exit 0
  fi
fi

echo "$$" > "$PID_FILE"
trap 'rm -f "$PID_FILE"' EXIT

echo "Starting BriAI local server launcher"
echo "Project: $ROOT_DIR"
echo "Agent: $OPENAI_INSTRUCTIONS"
echo "Log: $LOG_FILE"

echo "$(date '+%Y-%m-%d %H:%M:%S') [launcher] starting" >> "$LOG_FILE"

while true; do
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') [launcher] port $PORT already in use; waiting 3s" >> "$LOG_FILE"
    sleep 3
    continue
  fi

  echo "$(date '+%Y-%m-%d %H:%M:%S') [launcher] launching server" >> "$LOG_FILE"
  uv run python -u src/main.py >> "$LOG_FILE" 2>&1
  exit_code=$?
  echo "$(date '+%Y-%m-%d %H:%M:%S') [launcher] server exited with code $exit_code; restarting in 2s" >> "$LOG_FILE"
  sleep 2
done

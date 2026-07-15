#!/bin/bash
set -euo pipefail

if [ ! -d ".atomic" ]; then
  exit 0
fi

if ! command -v atomic &>/dev/null; then
  exit 0
fi

SESSION_FILE=".atomic/kilo_session"
SESSION_ID=$(head -1 "$SESSION_FILE" 2>/dev/null || echo "kilo-unknown")

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CWD=$(pwd)
TOOL_NAME="${1:-${TOOL_NAME:-}}"

printf '{"session_id":"%s","cwd":"%s","timestamp":"%s","tool_name":"%s"}' \
  "$SESSION_ID" "$CWD" "$TIMESTAMP" "$TOOL_NAME" \
  | atomic agent hooks kilo post-tool-use 2>/dev/null || true

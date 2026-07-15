#!/bin/bash
# Hook: Prompt Submit
# Trigger: When the user submits a prompt in Kilo Code
# Action: Shell Command
#
# Setup in Kilo:
#   Add to kilo.jsonc or .kilo/agents/atomic.md hooks configuration
#
# Environment:
#   USER_PROMPT - The user's prompt text (provided by Kilo)

set -euo pipefail

# Ensure we're in an atomic repository
if [ ! -d ".atomic" ]; then
  exit 0
fi

# Ensure atomic is available
if ! command -v atomic &>/dev/null; then
  exit 0
fi

# Resolve a stable session ID for this Kilo window.
# Stored in .atomic/kilo_session so all hooks share the same session.
SESSION_FILE=".atomic/kilo_session"
KILO_SID="${KILO_SESSION_ID:-}"

if [ -n "$KILO_SID" ] && [ -f "$SESSION_FILE" ]; then
  STORED_KILO_SID=$(grep "^KILO_SID=" "$SESSION_FILE" 2>/dev/null | cut -d= -f2 || true)
  if [ "$KILO_SID" != "$STORED_KILO_SID" ]; then
    # New Kilo session — create a new atomic session
    rm -f "$SESSION_FILE"
  fi
fi

if [ -f "$SESSION_FILE" ]; then
  SESSION_ID=$(head -1 "$SESSION_FILE")
else
  # Use hex timestamp so extract_session_short produces a unique 4-char tag
  HEX=$(printf '%08x' "$(date +%s)")
  SESSION_ID="${HEX}-kilo"
  echo "$SESSION_ID" > "$SESSION_FILE"
  if [ -n "$KILO_SID" ]; then
    echo "KILO_SID=$KILO_SID" >> "$SESSION_FILE"
  fi
fi

# Build JSON payload for the orchestrator
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CWD=$(pwd)
PROMPT="${USER_PROMPT:-}"

# Pipe JSON to stdin — orchestrator handles view creation on first call
printf '{"session_id":"%s","cwd":"%s","timestamp":"%s","model":"kilo","prompt":"%s"}' \
  "$SESSION_ID" "$CWD" "$TIMESTAMP" "$PROMPT" \
  | atomic agent hooks kilo prompt-submit 2>/dev/null || true

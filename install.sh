#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(pwd)"

# 1. Check for atomic CLI
if ! command -v atomic &>/dev/null; then
  echo "Warning: 'atomic' not found on PATH. Install Atomic VCS so the hooks work at runtime."
fi

# 2. Write .kilo/rules/ into the current project directory
RULES_DIR="$(pwd)/.kilo/rules"
mkdir -p "$RULES_DIR"

if [ -f "$SCRIPT_DIR/rules/atomic.md" ]; then
  cp "$SCRIPT_DIR/rules/atomic.md" "$RULES_DIR/atomic.md"
  echo "  rules: copied atomic.md → $RULES_DIR/"
fi

# 3. Write .kilo/agents/ into the current project directory
AGENTS_DIR="$(pwd)/.kilo/agents"
mkdir -p "$AGENTS_DIR"

if [ -f "$SCRIPT_DIR/agents/atomic.md" ]; then
  cp "$SCRIPT_DIR/agents/atomic.md" "$AGENTS_DIR/atomic.md"
  echo "  agents: copied atomic.md → $AGENTS_DIR/"
fi

# 4. Update kilo.jsonc to reference the rules
KILO_CONFIG="$(pwd)/kilo.jsonc"
if [ ! -f "$KILO_CONFIG" ]; then
  cat > "$KILO_CONFIG" <<'JSONC'
{
  // Kilo Code configuration — see https://kilo.ai/docs/customize
  "instructions": [
    ".kilo/rules/*.md",
    "AGENTS.md"
  ]
}
JSONC
  echo "  config: created kilo.jsonc"
else
  echo "  config: kilo.jsonc already exists (add .kilo/rules/*.md to instructions manually)"
fi

# 5. Make hook scripts executable
chmod +x "$SCRIPT_DIR"/hooks/*.sh 2>/dev/null || true

echo "  hooks: made executable → $SCRIPT_DIR/hooks/"

cat <<EOF

───────────────────────────────────────────────────────────
✓ Installed atomic-kilo
───────────────────────────────────────────────────────────

What was installed:
  • Rules          .kilo/rules/atomic.md (project rules for Kilo Code)
  • Agent          .kilo/agents/atomic.md (Atomic-aware agent mode)
  • Config         kilo.jsonc (if it didn't already exist)
  • Hooks          $SCRIPT_DIR/hooks/ (made executable)

Manual steps to finish:
  1. Copy the agent prompt to the project root (Kilo auto-discovers it):
       cp "${SCRIPT_DIR}/AGENTS.md" "${PROJECT_DIR}/"
  2. Ensure the project is an Atomic repo (one-time):
       cd "${PROJECT_DIR}" && atomic init
  3. Install the Kilo Code extension if not already:
       code --install-extension kilocode.kilo-code

Verify:
  • Rules:    ls .kilo/rules/
  • Agent:    ls .kilo/agents/
  • Config:   cat kilo.jsonc
  • Hooks:    ls "$SCRIPT_DIR/hooks/"

Uninstall:
  ./install.sh is install-only; to remove run:
    node install.js --uninstall
───────────────────────────────────────────────────────────
EOF

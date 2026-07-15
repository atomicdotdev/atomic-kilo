#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
Usage: ./install.sh [OPTIONS]

Install atomic-kilo globally and/or into a specific project.

OPTIONS:
  --global              Install rules, agent mode, and AGENTS.md into
                        ~/.config/kilo/ so they apply to every project.
  --project <path>      Set up a specific project directory:
                        copies AGENTS.md, creates kilo.jsonc, and runs
                        'atomic agent enable --agent kilo'.
  --help                Show this help message.

With no flags, runs --global automatically.

EXAMPLES:
  # One-time global setup (run once after cloning)
  ./install.sh

  # Set up a specific project
  ./install.sh --project /path/to/my-project

  # Both at once
  ./install.sh --global --project /path/to/my-project
EOF
  exit 0
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
DO_GLOBAL=false
DO_PROJECT=false
PROJECT_PATH=""

if [ $# -eq 0 ]; then
  DO_GLOBAL=true
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --global)
      DO_GLOBAL=true
      shift
      ;;
    --project)
      DO_PROJECT=true
      PROJECT_PATH="$2"
      if [ -z "$PROJECT_PATH" ]; then
        echo "Error: --project requires a path argument."
        exit 1
      fi
      shift 2
      ;;
    --help|-h)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run './install.sh --help' for usage."
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Global install → ~/.config/kilo/
# ---------------------------------------------------------------------------
do_global() {
  echo "Installing atomic-kilo globally..."

  KILO_CONFIG_DIR="$HOME/.config/kilo"

  # 1. Symlink rules → ~/.config/kilo/rules/
  RULES_TARGET="$KILO_CONFIG_DIR/rules"
  mkdir -p "$RULES_TARGET"

  rules_linked=0
  for rule_file in "$SCRIPT_DIR"/rules/*.md; do
    [ -f "$rule_file" ] || continue
    name="$(basename "$rule_file")"
    dst="$RULES_TARGET/$name"
    if [ -L "$dst" ] || [ ! -f "$dst" ]; then
      ln -sf "$rule_file" "$dst"
      rules_linked=$((rules_linked + 1))
    fi
  done
  echo "  rules:  $rules_linked symlinked → $RULES_TARGET/"

  # 2. Symlink agent mode → ~/.config/kilo/agent/
  AGENT_TARGET="$KILO_CONFIG_DIR/agent"
  mkdir -p "$AGENT_TARGET"

  agents_linked=0
  for agent_file in "$SCRIPT_DIR"/agents/*.md; do
    [ -f "$agent_file" ] || continue
    name="$(basename "$agent_file")"
    dst="$AGENT_TARGET/$name"
    if [ -L "$dst" ] || [ ! -f "$dst" ]; then
      ln -sf "$agent_file" "$dst"
      agents_linked=$((agents_linked + 1))
    fi
  done
  echo "  agents: $agents_linked symlinked → $AGENT_TARGET/"

  # 3. Copy AGENTS.md → ~/.config/kilo/AGENTS.md (global instructions)
  #
  # We copy instead of symlink because Kilo's findUp follows symlinks and
  # walks the resolved target's parent directories. A symlink into the
  # atomic-kilo checkout (~/Projects/agents/...) causes findUp to traverse
  # all the way to ~/ where it discovers ~/.agents/skills/ and fails to
  # parse Zed-specific SKILL.md files. Copying keeps the file rooted in
  # ~/.config/kilo/ so findUp stays within the config directory.
  AGENTS_DST="$KILO_CONFIG_DIR/AGENTS.md"
  if [ -L "$AGENTS_DST" ]; then
    # Replace old symlink from a previous install
    rm -f "$AGENTS_DST"
  fi
  if [ ! -f "$AGENTS_DST" ]; then
    cp "$SCRIPT_DIR/AGENTS.md" "$AGENTS_DST"
    echo "  prompt: AGENTS.md copied → $AGENTS_DST"
  else
    echo "  prompt: $AGENTS_DST already exists (not overwriting)"
  fi

  # 4. Symlink plugin → ~/.config/kilo/plugin/ (singular, per Kilo docs)
  PLUGIN_TARGET="$KILO_CONFIG_DIR/plugin"
  mkdir -p "$PLUGIN_TARGET"

  plugin_src="$SCRIPT_DIR/plugins/atomic-hooks.ts"
  plugin_dst="$PLUGIN_TARGET/atomic-hooks.ts"
  if [ -L "$plugin_dst" ] || [ ! -f "$plugin_dst" ]; then
    ln -sf "$plugin_src" "$plugin_dst"
    echo "  plugin: atomic-hooks.ts symlinked → $PLUGIN_TARGET/"
  else
    echo "  plugin: $plugin_dst already exists (not overwriting)"
  fi

  # 5. Install plugin dependency
  if command -v bun &>/dev/null && [ -f "$SCRIPT_DIR/package.json" ]; then
    (cd "$KILO_CONFIG_DIR" 2>/dev/null && \
      ln -sf "$SCRIPT_DIR/package.json" package.json 2>/dev/null && \
      bun install --no-progress 2>/dev/null) || true
    echo "  deps:   @kilocode/plugin installed"
  fi

  # 6. Make hook scripts executable (fallback for CLI mode)
  chmod +x "$SCRIPT_DIR"/hooks/*.sh 2>/dev/null || true
  echo "  hooks:  made executable → $SCRIPT_DIR/hooks/"

  cat <<EOF

───────────────────────────────────────────────────────────
✓ Global install complete
───────────────────────────────────────────────────────────

Rules and agent mode are symlinked back into this checkout:
  ${SCRIPT_DIR}
Keep this directory in place; moving or deleting it breaks the links.
AGENTS.md is copied (not symlinked) to avoid Kilo findUp issues.

Global files (loaded by Kilo Code for every project):
  ~/.config/kilo/rules/atomic.md         Atomic VCS rules     (symlink)
  ~/.config/kilo/agent/atomic.md         Atomic agent mode    (symlink)
  ~/.config/kilo/plugin/atomic-hooks.ts  Turn-level recording (symlink)
  ~/.config/kilo/AGENTS.md               Agent instructions   (copy)

Enable Atomic recording in a project:
  cd /path/to/your/project
  atomic init                         # create .atomic/ repo
  atomic agent enable --agent kilo    # enable hook recording

Optional: override global config for a specific project:
  ./install.sh --project /path/to/your/project
───────────────────────────────────────────────────────────
EOF
}

# ---------------------------------------------------------------------------
# Project install → <project>/.kilo/, AGENTS.md, atomic agent enable
# ---------------------------------------------------------------------------
do_project() {
  local proj="$1"

  # Resolve to absolute path
  proj="$(cd "$proj" 2>/dev/null && pwd)" || {
    echo "Error: directory '$1' does not exist."
    exit 1
  }

  echo "Setting up project: $proj"

  # 1. Copy AGENTS.md to project root (Kilo auto-discovers it)
  if [ ! -f "$proj/AGENTS.md" ]; then
    cp "$SCRIPT_DIR/AGENTS.md" "$proj/AGENTS.md"
    echo "  prompt: copied AGENTS.md → $proj/"
  else
    echo "  prompt: AGENTS.md already exists (not overwriting)"
  fi

  # 2. Create kilo.jsonc if it doesn't exist
  KILO_CONFIG="$proj/kilo.jsonc"
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
    echo "  config: kilo.jsonc already exists"
  fi

  # 3. Run atomic agent enable --agent kilo (creates .atomic/sessions/ etc.)
  if command -v atomic &>/dev/null; then
    if [ -d "$proj/.atomic" ]; then
      (cd "$proj" && atomic agent enable --agent kilo 2>&1) || true
    else
      echo "  hooks:  no .atomic/ directory — run 'atomic init' first, then:"
      echo "          cd $proj && atomic agent enable --agent kilo"
    fi
  else
    echo "  hooks:  'atomic' not on PATH — after installing Atomic VCS, run:"
    echo "          cd $proj && atomic agent enable --agent kilo"
  fi

  cat <<EOF

───────────────────────────────────────────────────────────
✓ Project setup complete: $proj
───────────────────────────────────────────────────────────

Project files:
  $proj/AGENTS.md            Agent prompt (auto-discovered by Kilo)
  $proj/kilo.jsonc           Kilo configuration

To finish (if not already done):
  cd $proj
  atomic init                         # create .atomic/ repo
  atomic agent enable --agent kilo    # enable Atomic hook recording
───────────────────────────────────────────────────────────
EOF
}

# ---------------------------------------------------------------------------
# Execute
# ---------------------------------------------------------------------------
if $DO_GLOBAL; then
  do_global
fi

if $DO_PROJECT; then
  do_project "$PROJECT_PATH"
fi

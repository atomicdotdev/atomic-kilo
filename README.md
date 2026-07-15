# atomic-kilo

[Atomic VCS](https://atomic.dev) integration for [Kilo Code](https://kilo.ai).

Automatic turn recording with AI provenance, intent tracking, and knowledge graph skills.

## What it does

- **1 session = 1 view** — a draft view is created automatically when you start a session
- **Every turn records with provenance** — model, vendor, session, turn number, causal decision graph
- **Tool executions tracked** — reads, edits, shell calls captured in a provenance graph
- **Intent workflow** — AGENTS.md prompt guides problem-first development with vault intents
- **Custom agent mode** — `.kilo/agents/atomic.md` provides an Atomic-aware agent in Kilo

## Install

### Quick start

```bash
# Clone and install
git clone https://github.com/atomicdotdev/atomic-kilo
cd atomic-kilo
./install.sh

# Copy the agent prompt into your project
cp AGENTS.md /path/to/your/project/
```

### From npm (once published)

```bash
npx atomic-kilo
```

### What install does

1. **Rules** — copies `atomic.md` into `.kilo/rules/` in the current project
2. **Agent mode** — copies `atomic.md` into `.kilo/agents/` for the Atomic agent
3. **Config** — creates `kilo.jsonc` if it doesn't exist (references rules + AGENTS.md)
4. **AGENTS.md** — must be copied to each project root manually (Kilo auto-discovers it)

## Prerequisites

- [Atomic VCS](https://atomic.dev) installed and on your PATH (`atomic --version`)
- A project with an `.atomic/` repository (`atomic init`)
- [Kilo Code](https://kilo.ai) installed in VS Code, JetBrains, or via CLI

## Usage

```bash
cd my-project
atomic init              # if not already an atomic repo
cp /path/to/atomic-kilo/AGENTS.md .  # copy agent prompt
# Open the project in your IDE with Kilo Code — the agent activates automatically
```

## IDE vs CLI

atomic-kilo works in both the Kilo Code IDE extension and the Kilo CLI. The session model is the same — one view per session, one intent and one recorded change per turn — but how hooks fire differs.

| | Kilo IDE (VS Code / JetBrains) | Kilo CLI |
|---|---|---|
| Session start | Hook scripts write session ID, orchestrator creates view | Agent writes session ID to `.atomic/kilo_session`, calls `prompt-submit` hook |
| Turn start | Hook fires automatically | Agent calls `atomic agent hooks kilo prompt-submit` |
| Tool tracking | Hook scripts fire per tool call | Not available (no hook mechanism in CLI) |
| Turn end | Hook fires automatically | Agent calls `atomic agent hooks kilo agent-stop` |
| Recording | Orchestrator runs `atomic add -A` + `atomic record` | Same — orchestrator handles it via hook call |
| Provenance graph | goal + tool nodes + patch proposal | goal + patch proposal (no tool nodes) |

The `AGENTS.md` prompt handles both paths — it detects the environment and follows the appropriate steps.

## How hooks work

```
Kilo Code session
  │
  ├── User sends prompt
  │   ├── prompt-submit.sh → Rust creates haikunator-named draft view
  │   ├── Agent works (file reads, writes, commands)
  │   │   ├── pre-tool-use.sh → Rust logs tool start in provenance graph
  │   │   └── post-tool-use.sh → Rust logs tool result in provenance graph
  │   └── agent-stop.sh → Rust records all changes with provenance
  │
  └── User sends another prompt → repeat
```

## Viewing provenance

```bash
# Show the causal decision graph (goals → tool calls → patch)
atomic change -p <hash>

# Show inline AI attestation (model, tokens, cost)
atomic change -a <hash>

# Show session-level attestations
atomic agent attest
```

## What's in the package

| File/Directory | Purpose |
|---|---|
| `AGENTS.md` | Agent prompt — copy to project roots for intent-per-turn workflow |
| `rules/atomic.md` | Project rules for Kilo Code's rule system |
| `agents/atomic.md` | Custom Kilo agent mode with Atomic VCS awareness |
| `skills/atomic-vault/` | Vault workflow skill |
| `skills/atomic-vcs/` | Repository inspection skill — status, log, change, diff |
| `skills/code-intelligence/` | KG query patterns |
| `hooks/` | Shell scripts for hook triggers |
| `install.js` | Installs rules + agent into project's `.kilo/` |
| `install.sh` | Development install |

## Differences from other integrations

| Feature | atomic-cline | atomic-kiro | atomic-kilo |
|---|---|---|---|
| Agent prompt | `.clinerules/atomic.md` | `AGENTS.md` | `AGENTS.md` + `.kilo/rules/` + `.kilo/agents/` |
| Skills location | `~/Documents/Cline/Workflows/` | `~/.kiro/skills/` | Bundled in package |
| Config | `.clinerules/` | `.kiro/hooks/*.kiro.hook` | `kilo.jsonc` |
| Hook mechanism | Executable scripts in `~/Documents/Cline/Hooks/` | Shell scripts + IDE configuration | Shell scripts + `kilo.jsonc` |
| Agent modes | N/A | N/A | `.kilo/agents/atomic.md` |
| CLI support | N/A | Via AGENTS.md manual hook calls | Via AGENTS.md manual hook calls |

## Uninstall

```bash
npx atomic-kilo --uninstall
```

Or manually:

```bash
# Remove project files
rm .kilo/rules/atomic.md
rm .kilo/agents/atomic.md
```

AGENTS.md and kilo.jsonc in project roots must be removed manually.

## License

Apache-2.0 — same as [Atomic VCS](https://github.com/atomicdotdev/atomic).

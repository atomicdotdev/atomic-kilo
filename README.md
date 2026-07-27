# atomic-kilo

[Atomic VCS](https://atomic.dev) integration for [Kilo Code](https://kilo.ai).

Automatic turn recording with AI provenance, intent tracking, and knowledge graph skills.

> **Definitive source:** this repository lives on Atomic storage at `https://atomic.atomic.storage/workspaces/oss/projects/atomic-kilo/code`. The GitHub repo is a mirror.

## What it does

- **1 session = 1 view** — a draft view is created automatically when you start a session
- **Every turn records with provenance** — model, vendor, session, turn number, causal decision graph
- **Tool executions tracked** — reads, edits, shell calls captured in a provenance graph
- **Intent workflow** — AGENTS.md prompt guides problem-first development with vault intents
- **Custom agent mode** — global `~/.config/kilo/agent/atomic.md` provides an Atomic-aware agent in Kilo

## Install

### 1. Global setup (once)

Requires the [Atomic VCS](https://atomic.dev) CLI on your PATH. Then:

```bash
atomic agent enable --agent kilo
```

The enable command syncs the package from Atomic storage and symlinks the rules, agent mode, AGENTS.md, and plugin into `~/.config/kilo/` so they apply to **every** project.

### 2. Per-project setup

Set up a specific project with AGENTS.md, kilo.jsonc, and Atomic hooks:

```bash
cd /path/to/my-project
atomic init                         # create .atomic/ repo (if not done)
atomic agent enable --agent kilo    # enable Atomic hook recording
```

Then copy `AGENTS.md` to the project root (Kilo auto-discovers it) and create `kilo.jsonc` if it doesn't exist.

### Development install

From a local checkout:

```bash
git clone https://github.com/atomicdotdev/atomic-kilo
cd atomic-kilo
atomic agent enable --agent kilo --from .
```

Or the legacy script path:

```bash
./install.sh                                          # global setup
./install.sh --project /path/to/my-project            # per-project setup
./install.sh --global --project /path/to/my-project   # both at once
```

The per-project script copies `AGENTS.md` to the project root, creates `kilo.jsonc` if it doesn't exist, and runs `atomic agent enable --agent kilo` to wire up hook recording.

### What global install does

| Target | What | Location |
|---|---|---|
| Rules | Symlinks `atomic.md` | `~/.config/kilo/rules/atomic.md` |
| Agent mode | Symlinks `atomic.md` | `~/.config/kilo/agent/atomic.md` |
| **Plugin** | **Symlinks `atomic-hooks.ts`** | **`~/.config/kilo/plugins/atomic-hooks.ts`** |
| Instructions | Copies `AGENTS.md` | `~/.config/kilo/AGENTS.md` |
| Dependencies | Installs `@opencode-ai/plugin` | `~/.config/kilo/node_modules/` |

Symlinks point back into the checkout — keep the directory in place.

### What project setup does

| Step | What | Command |
|---|---|---|
| Agent prompt | Copies `AGENTS.md` to project root | (auto-discovered by Kilo) |
| Config | Creates `kilo.jsonc` | References `.kilo/rules/*.md` + `AGENTS.md` |
| Hooks | Enables Atomic recording | `atomic agent enable --agent kilo` |

## Prerequisites

- [Atomic VCS](https://atomic.dev) installed and on your PATH (`atomic --version`)
- A project with an `.atomic/` repository (`atomic init`)
- [Kilo Code](https://kilo.ai) installed in VS Code, JetBrains, or via CLI

## Usage

```bash
cd my-project
atomic init                         # if not already an atomic repo
atomic agent enable --agent kilo    # enable hook recording
# Open the project in your IDE with Kilo Code — the agent activates automatically
```

## How it works

Kilo's CLI runtime is built on OpenCode's architecture and supports the same **plugin system**. The `atomic-hooks.ts` plugin hooks into session lifecycle, chat messages, and every tool execution to provide full turn-level provenance:

```
Kilo Code session
  │
  ├── session.created  → atomic agent hooks kilo session-start
  │                       (creates haikunator-named draft view)
  │
  ├── User sends prompt
  │   ├── chat.message         → atomic agent hooks kilo user-prompt
  │   ├── tool.execute.before  → atomic agent hooks kilo before-tool
  │   ├── (agent runs tool)
  │   ├── tool.execute.after   → atomic agent hooks kilo after-tool
  │   ├──   ... more tools ...
  │   └── session.idle          → atomic agent hooks kilo stop
  │                               (records change with provenance)
  ├── User sends another prompt → repeat
  │
  └── session.deleted  → atomic agent hooks kilo session-end
```

Every tool call (file read, write, edit, bash, etc.) appears as a node in the provenance DAG, giving you a full causal decision graph per turn.

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
| `AGENTS.md` | Agent prompt — globally symlinked + copied to project roots |
| `rules/atomic.md` | Project rules for Kilo Code's rule system |
| `agents/atomic.md` | Custom Kilo agent mode with Atomic VCS awareness |
| `skills/atomic-vault/` | Vault workflow skill |
| `skills/atomic-vcs/` | Repository inspection skill — status, log, change, diff |
| `skills/code-intelligence/` | KG query patterns |
| `plugins/atomic-hooks.ts` | Turn-level recording plugin (session, tool, chat events) |
| `hooks/` | Shell scripts (CLI fallback when plugin isn't available) |
| `install.js` | Global + project install/uninstall |
| `install.sh` | Shell-based install with `--global` and `--project` flags |

## Differences from other integrations

| Feature | atomic-cline | atomic-kiro | atomic-kilo |
|---|---|---|---|
| Agent prompt | `.clinerules/atomic.md` | `AGENTS.md` | `AGENTS.md` (global + project) |
| Global config | `~/Documents/Cline/Hooks/` | `~/.kiro/skills/` | `~/.config/kilo/` |
| Project config | `.clinerules/` | `.kiro/hooks/*.kiro.hook` | `kilo.jsonc` |
| Hook mechanism | Executables in Hooks dir | Shell scripts + IDE | **Plugin** (`atomic-hooks.ts`) |
| Tool tracking | ✅ PreToolUse / PostToolUse | ✅ preToolUse / postToolUse | ✅ tool.execute.before / after |
| Agent modes | N/A | N/A | `~/.config/kilo/agent/atomic.md` |
| Enable command | `atomic agent enable --agent cline` | IDE panel | `atomic agent enable --agent kilo` |

## Uninstall

### Global

```bash
atomic agent disable --agent kilo
```

### Per-project

```bash
cd /path/to/my-project
atomic agent disable --agent kilo
rm AGENTS.md kilo.jsonc
```

## License

Apache-2.0 — same as [Atomic VCS](https://github.com/atomicdotdev/atomic).

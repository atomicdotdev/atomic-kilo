---
name: atomic-vault
description: Teaches the Atomic vault workflow for goals, intents, memory, and the development cycle.
---

# Atomic Vault Workflow

The vault is Atomic's built-in project management and context system. It tracks **goals** (work sessions), **intents** (units of work), and **memory** (persistent knowledge). Always use vault commands to stay organized.

## Core Concepts

- **Intent**: A unit of work (like a ticket). Has an ID, title, status, and a deliverable markdown file.
- **Goal**: A focused work session tied to one or more intents. Tracks what you're actively doing.
- **Memory**: Persistent knowledge entries the vault retains across sessions.

## Intent Commands

```bash
atomic vault intent list                # List all intents (CHECK THIS FIRST)
atomic vault intent create "title"      # Create a new intent
atomic vault intent show <id>           # Show intent details
atomic vault intent update <id> --status <status>  # Update intent status
atomic vault intent link <id> --goal <goal>         # Link intent to a goal
```

### Intent Statuses

`backlog` → `planned` → `in-progress` → `review` → `done`

### CRITICAL RULE: Always Check Before Creating

Before creating any intent, run `atomic vault intent list` first. Duplicate intents cause confusion and waste effort. Only create a new intent if no existing one covers the work.

## Goal Commands

```bash
atomic vault goal start "goal name"     # Start a new work session
atomic vault goal stop                  # Stop the current goal
atomic vault goal resume <name>         # Resume a suspended goal
atomic vault goal list                  # List all goals
```

### Goal Statuses

- **active** — Currently being worked on
- **suspended** — Paused (via `goal stop`), can be resumed
- **completed** — Finished

## Memory Commands

```bash
atomic vault memory list                # List all memory entries
atomic vault memory show <key>          # Show a specific memory entry
echo "value" | atomic vault memory write <key>   # Write a memory entry
echo "value" | atomic vault memory write <key> --type feedback  # Write feedback memory
```

## The Intent File Is the Deliverable

Each intent has a markdown file at `.vault/intents/<id>/intent.md`. This file IS the deliverable — fill it in completely:

```markdown
## Description
What this intent accomplishes and why.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Files to Modify
- `path/to/file.rs` — what changes and why

## Approach
Step-by-step plan for implementation.

## Test Strategy
How to verify the work is correct.

## Notes
Any additional context, decisions, or open questions.
```

After editing intent markdown files, run `atomic vault sync` to persist changes back to the vault database. Always `atomic vault sync` **before** `atomic vault intent show`/`update` — the CLI reads from the vault database, not the file, so an unsynced `show` renders the stale placeholder template and `update` re-materializes the database copy over the file, clobbering your edits. `sync` is not `atomic record`/`add` and is required in both IDE and CLI mode; hooks do not do it for you.

## Full Workflow (End to End)

Follow this sequence for every piece of work:

### 1. Check existing intents

```bash
atomic vault intent list
```

Look for an existing intent that matches your task. Do NOT create duplicates.

### 2. Create ONE intent (if needed)

```bash
atomic vault intent create --title "Implement user authentication"
```

Create exactly one intent per unit of work. Fill in the intent file at `.vault/intents/<id>/intent.md`.

### 3. Start a goal

```bash
atomic vault goal start --name "auth-implementation"
atomic vault intent link <intent-id> --goal auth-implementation
```

### 4. Get into the session view

How the draft view is set up depends on the environment:

- **IDE (hooks active):** nothing to do. Session start automatically forks a haikunator-named draft view (e.g. `early-ridge-ffd9`) from your current view and switches into it. Your whole session runs inside it, and session end switches back. Do **not** create or switch views.
- **CLI `[CLI only]`:** create and switch into a draft view yourself:
  ```bash
  atomic view create auth-feature --draft
  atomic view switch auth-feature
  ```
  Draft views are isolated workspaces — create one for new work.

### 5. Do the work, check off TODOs, and record changes

Write code and iterate. As each TODO is completed, verify it meets its criteria, then mark it done in the intent file using your **file editing tool** (not Python, not bash, not sed — use the agent's native edit capability):

```
# In the intent file, change:
- [ ] `PROJ-1/1` Scaffold package.json
# to:
- [x] `PROJ-1/1` Scaffold package.json
```

Also check off the corresponding acceptance criteria when all criteria for that TODO are satisfied. After every edit to the intent file, run `atomic vault sync` to persist to the database.

**Verify before checking off.** Run the actual commands or tests that prove the TODO is done. Do not mark a TODO complete speculatively.

**Never use Python, bash scripts, or sed to edit intent files.** Use your agent's native file editing tool. Raw file manipulation bypasses the vault's integrity guarantees.

How changes get recorded depends on the environment:

- **IDE (hooks active):** you do **not** run `atomic add` or `atomic record`. Turn end records automatically — the hook runs `status` → `add` (tracks new files) → `record --all` with full AI provenance (model, tokens, cost, session, decision graph). To review what the hooks recorded, use the `atomic-vcs` skill: `atomic log -f oneline`, then `atomic change -p -a`.
- **CLI `[CLI only]`:** track and record manually. Record frequently — small, focused changes are better than large ones:
  ```bash
  atomic add src/auth.rs
  atomic add src/auth_test.rs
  atomic record -m "feat: add user authentication module"
  ```

### 6. Complete the intent

When all TODOs are checked off:

1. **Verify** every acceptance criterion by running the actual commands/tests.
2. **Check off** all acceptance criteria in the intent file using your file editing tool.
3. **Sync** to persist your edits:
   ```bash
   atomic vault sync
   ```
4. **Mark done:**
   ```bash
   atomic vault intent update <id> --status done
   ```

Always `atomic vault sync` before `intent update` — `update` re-materializes the database copy over the file, so an unsynced update discards your edits. This applies in both IDE and CLI mode.

### 7. Stop the goal when done

```bash
atomic vault goal stop
atomic vault sync
atomic vault intent update <id> --status done
```

### 8. Sync vault state

```bash
atomic vault sync
```

A final sync ensures every vault edit is in the database. In IDE mode it also guarantees your edits are captured by the turn's automatic record.

## Resuming Work

If you stopped a goal and need to come back:

```bash
atomic vault goal list                  # Find the suspended goal
atomic vault goal resume "auth-implementation"
atomic view switch auth-feature         # [CLI only] switch back to the draft view
# Continue working...
```

In IDE mode, skip the `atomic view switch` — the hooks manage the session view for you; just resume the goal and continue.

## Learning from Redirected Prompts

When a user cancels, redirects, or corrects your approach mid-turn, treat it as a learning signal. Write a memory entry so the same mistake isn't repeated in future sessions.

### When to write a redirect memory

- User says "no, that's not what I meant" or "stop, do it differently"
- User cancels a tool call or asks you to undo an action
- User corrects an assumption you made about their codebase, workflow, or preferences
- User redirects the approach after seeing your plan

### How to write it

```bash
echo "<what was tried> -> <why it was wrong> -> <what to do instead>" \
  | atomic vault memory write "redirect/<short-slug>" --type feedback
```

**Examples:**

```bash
# User corrected a wrong tool choice
echo "Used grep to search code -> user prefers atomic vault query -> always try atomic query first" \
  | atomic vault memory write "redirect/no-grep-use-atomic" --type feedback

# User redirected an architectural decision
echo "Added a new abstraction layer -> user wants minimal code -> match existing patterns only" \
  | atomic vault memory write "redirect/no-new-abstractions" --type feedback

# User cancelled a destructive action
echo "Attempted to delete files without asking -> always confirm before any destructive operation" \
  | atomic vault memory write "redirect/confirm-before-delete" --type feedback
```

### Key naming convention

Use `redirect/<slug>` as the key so redirect memories are grouped and easy to scan:

```bash
atomic vault memory list | grep redirect/
```

### Check redirect memories at session start

At the start of a new session, scan for redirect memories to apply learned preferences:

```bash
atomic vault memory list
```

Look for any `redirect/` entries relevant to the current task and apply them proactively.

## Tips

- One intent per unit of work — keep them focused
- Start every session by checking `atomic vault intent list` and `atomic vault goal list`
- Fill in the intent markdown completely before starting implementation
- Run `atomic vault sync` after editing any vault markdown file, and before every `show`/`update` — in both IDE and CLI mode
- Draft views keep your work isolated until it's ready to insert into a shared view. In IDE mode the hooks fork the draft view at session start, record at turn end, and restore your view at session end — you don't manage views or recording. **`[CLI only]`** create and switch into a draft view yourself before starting new work.
- Inspect what was recorded — diff, provenance, AI attestation — with the `atomic-vcs` skill
- Write `redirect/` memories immediately when a user corrects your approach — don't wait until end of turn

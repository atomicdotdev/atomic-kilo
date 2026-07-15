# Atomic VCS Agent

You use **Atomic VCS** as the primary version control system. Git may coexist in the repository — never delete or modify the `.git` folder.

## Environment detection

Check once at session start:

```bash
atomic agent status 2>/dev/null | grep -q "kilo.*hooks installed" && echo "IDE" || echo "CLI"
```

- **IDE (hooks active):** Views and recording are automatic. Skip steps marked `[CLI only]`.
- **CLI:** You must manage views and recording manually. Follow all steps.

## Session model

```
1 session == 1 view → many intents && many turns (atomic record with provenance)
```

A session view is created once at the start of the session and reused for every turn. Each turn creates one intent and one `atomic record`. The view is only inserted back to the parent when the session is fully complete.

## Session start `[CLI only]`

Run this once at the beginning of a new session. Skip if `.atomic/kilo_session` already exists from a previous turn.

```bash
HEX=$(printf '%08x' "$(date +%s)")
SESSION_ID="${HEX}-kilo"
echo "$SESSION_ID" > .atomic/kilo_session
```

The orchestrator creates and switches to a haikunator-named draft view automatically when the first `prompt-submit` fires.

To resume an existing session:

```bash
# .atomic/kilo_session already has the session ID — just continue
cat .atomic/kilo_session
```

## Every prompt is a turn. Every turn follows this sequence.

### 1. Signal turn start `[CLI only]`

```bash
SESSION_ID=$(cat .atomic/kilo_session)
printf '{"session_id":"%s","cwd":"%s","model":"kilo","prompt":"%s"}' \
  "$SESSION_ID" "$(pwd)" "<user prompt summary>" \
  | atomic agent hooks kilo prompt-submit
```

### 2. Create an intent

```bash
atomic vault intent create --title "<short title>"
```

### 3. Define the problem

The user's prompt is usually a **solution** ("build me X"). Reframe it as a **problem statement**.

Ask clarifying questions if the problem is ambiguous. Do not guess — ask.

Once the problem is clear, define:

- **Problem statement** — what problem are we solving and why
- **Success criteria** — concrete, testable conditions that mean "done"
- **Tasks** — ordered list of work items

Write all of this into the intent file. Replace every REPLACE placeholder.

Then run `atomic vault sync` to persist your edits into the vault database. The intent file lives on disk, but `atomic vault intent show`/`update` read from the database — without `sync` they see the original placeholder template, and `update` re-materializes the database copy over the file, clobbering your edits. `atomic vault sync` is NOT `atomic record`/`add`: it only moves your `.vault/` edits into the vault database, and you must run it yourself even in IDE mode where hooks handle recording.

### 3b. Run the simplification guard

Before you finalize the intent, audit every choice that is *simpler than* or *diverges from* a reference (the standard library, an existing implementation, a spec, or a prior version). The simpler choice almost always **drops a behavior the reference guaranteed** — and an intent that never names the dropped behavior produces code *and* tests that share the same blind spot.

For each such decision: **name the reference**, **enumerate what the simpler choice drops** (interrupted/partial operations, error or panic states, round-trip fidelity, ordering, resource cleanup, concurrency, overflow/empty/boundary inputs), then for each dropped behavior either **pin it** as an acceptance criterion, **drop it on purpose** under Scope — Out with the consequence stated, or **ask the user**. A decision about API *shape* is not a decision about *behavior*. Re-run `atomic vault sync` after recording anything new.

### 3c. Execute the tasks

Work through the TODOs in order. After completing each one:

1. **Verify** it meets its criteria — run the commands or checks specified in the TODO.
2. **Edit the intent file** using your file editing tool to mark it done:
   ```
   - [ ] `PROJ-1/1` ...   →   - [x] `PROJ-1/1` ...
   ```
   Also check off any acceptance criteria that are now satisfied.
3. **Sync** so the database stays current:
   ```bash
   atomic vault sync
   ```

**Use your file editing tool to check off tasks — not bash, not Python, not sed.** Raw file manipulation bypasses the vault.

### 4. Update the intent

```bash
atomic vault sync                          # persist file edits to the database first
atomic vault intent update <ID> --status done
```

Always `atomic vault sync` before `atomic vault intent show`/`update` — the CLI reads from the database, not the file, so an unsynced `show` renders the stale placeholder template and `update` re-materializes the database copy over the file, clobbering your edits. This is still required in IDE mode; `sync` is not `atomic record`/`add`, and hooks do not do it for you.

### 5. Signal turn end — records with full provenance `[CLI only]`

```bash
SESSION_ID=$(cat .atomic/kilo_session)
printf '{"session_id":"%s","cwd":"%s"}' "$SESSION_ID" "$(pwd)" \
  | atomic agent hooks kilo agent-stop
```

This triggers the orchestrator to run `atomic add -A` and `atomic record` with the full causal decision graph (tool uses, goals, patch proposal) and session envelope. In the IDE this fires automatically via the agent-stop hook.

## Session end `[CLI only]`

Only when the session is fully complete, insert back to the parent view:

```bash
VIEW=$(atomic agent status --json 2>/dev/null | python3 -c "import sys,json; s=json.load(sys.stdin); print(s['sessions'][0]['view_name'])" 2>/dev/null || atomic view list | grep "^\*" | awk '{print $2}')
atomic insert from-view "$VIEW" --to-view dev
atomic view switch dev
rm .atomic/kilo_session
```

## Learning from Redirects

When a user cancels, corrects, or redirects your approach, immediately write a vault memory:

```bash
echo "<what was tried> -> <why it was wrong> -> <what to do instead>" \
  | atomic vault memory write "redirect/<slug>" --type feedback
```

Do this **before** continuing with the corrected approach. At the start of each session, scan `atomic vault memory list` for `redirect/` entries and apply them proactively.

## Rules

- **One intent per turn.** Every prompt gets its own intent.
- **One view per session.** Create the view once at session start; reuse it for every turn.
- **Problem first.** Reframe solution-requests as problems. Ask questions if unclear.
- **Write the intent file before coding.** The plan goes in the file, not just in chat.
- **Sync after editing any `.vault/` file, and before every `show`/`update`.** `atomic vault sync` deflates your on-disk edits into the vault database. The CLI reads the database, not the file: an unsynced `show` renders the stale placeholder and `update` re-materializes the database copy over the file, clobbering your edits. `sync` is not `atomic record`/`add` and is required in both IDE and CLI mode — hooks do not do it for you mid-turn.
- **Guard against silent simplification.** When you choose an approach simpler than or divergent from a reference (std, an existing impl, a spec, a prior version), name the behavior it drops — interrupted operations, error states, round-trip fidelity, ordering, boundaries — and pin each as an acceptance criterion, record it in Scope — Out with the consequence, or ask the user. Never leave it unstated. A decision about API shape is not a decision about behavior.
- **Use Atomic for code discovery.** Before using grep, find, or similar filesystem search tools, first try the Atomic knowledge graph and content index:
  - Source text: `atomic vault query code "pattern" -t <type>`
  - Structure: `atomic vault query search "term"`
  - Relationships: `atomic vault query neighbors <node_id>`
  - File outline: `atomic vault query entities <path>`
- **Only fall back to grep/find if Atomic query commands fail**, the repository has no content index/KG yet, or you need to inspect files that are not tracked/indexed by Atomic. If results are sparse, run `atomic vault query enrich` before falling back.
- **In the IDE:** Do not run `atomic add`, `atomic record`, or manage views — hooks handle everything.
- **In the CLI:** Always create a draft view at session start, signal turn start/end via `atomic agent hooks kilo`, and insert back to the parent view only when the session is done.
- **Do not run `atomic agent enable`.** The integration is already configured globally.
- **Preserve `.git` if it exists.** Never delete, move, or modify the `.git` folder. Atomic is preferred for all VCS operations (recording, views, intents), but git history must remain intact. Do not run `git` commands to commit, branch, or push — use Atomic instead.

## Skills

Use these for detailed reference when needed:

- `/atomic-vault` — intent and goal lifecycle, memory operations
- `/atomic-vcs` — inspect repository state and history: `status`, `log`, `change` (`-p` provenance, `-a` AI attestation), `diff`
- `/code-intelligence` — knowledge graph queries for code exploration

# Atomic VCS Agent

You use **Atomic VCS** (not git). A draft view is created for each session automatically by the plugin.

## Version control rules

- **Never use `git` for repository operations.** Use the **Atomic CLI** instead:
  - `atomic status` instead of `git status`
  - `atomic diff` instead of `git diff`
  - `atomic log` instead of `git log`
  - `atomic change <hash>` instead of `git show <hash>`
  - `atomic view list` instead of `git branch`
  - `atomic pull` / `atomic push` instead of `git pull` / `git push`
- **Do not run `atomic add`, `atomic record`, or manage views.** The plugin records each turn automatically with full AI provenance (model, vendor, tokens, cost, causal decision graph).
- **Preserve `.git` if it exists.** Never delete, move, or modify the `.git` folder.

## Every prompt is a turn. Every turn follows this sequence.

### 1. Create an intent

```bash
atomic vault intent create --title "<short title>"
```

This gives you an intent ID (e.g., HELL-4) and a file path.

### 2. Define the problem

The user's prompt is usually a **solution** ("build me X"). Reframe it as a **problem statement**.

Ask clarifying questions if the problem is ambiguous. Do not guess — ask.

Once the problem is clear, define:

- **Problem statement** — what problem are we solving and why
- **Success criteria** — concrete, testable conditions that mean "done"
- **Tasks** — ordered list of work items

Write all of this into the intent file. Replace every REPLACE placeholder.

Then run `atomic vault sync` to persist the file into the vault database. The intent file lives on disk, but `atomic vault intent show`/`update` read from the database — without `sync` they see the original placeholder template, and `update` re-materializes the database copy over the file, clobbering your edits. `atomic vault sync` is NOT `atomic record`/`add`: it only moves your `.vault/` edits into the vault database.

### 2b. Run the simplification guard

Before you finalize the intent, audit every choice that is *simpler than* or *diverges from* a reference (the standard library, an existing implementation, a spec, or a prior version). The simpler choice almost always **drops a behavior the reference guaranteed**.

For each such decision: **name the reference**, **enumerate what the simpler choice drops** (interrupted/partial operations, error or panic states, round-trip fidelity, ordering, resource cleanup, concurrency, overflow/empty/boundary inputs), then for each dropped behavior either **pin it** as an acceptance criterion, **drop it on purpose** under Scope — Out with the consequence stated, or **ask the user**. Re-run `atomic vault sync` after recording anything new.

### 3. Execute the tasks

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

Always `atomic vault sync` before `atomic vault intent show`/`update` — the CLI reads from the database, not the file.

## Rules

- **One intent per turn.** Every prompt gets its own intent.
- **Problem first.** Reframe solution-requests as problems. Ask questions if unclear.
- **Write the intent file before coding.** The plan goes in the file, not just in chat.
- **Simplification guard.** When you pick an approach simpler than or divergent from a reference, name the behavior it drops and resolve each gap explicitly.
- **Do run `atomic vault sync` after editing any `.vault/` file**, and before `atomic vault intent show`/`update`.
- **Do not run `atomic add` or `atomic record`.** The plugin handles recording with provenance.
- **Do not create or switch views.** The session view is created automatically by the plugin.
- **Do not run `atomic agent enable`.** The integration is configured globally.
- **Do not manage `.atomic/kilo_session` or call `atomic agent hooks` manually.** The plugin handles all session lifecycle events.

## Skills

Use these for detailed reference when needed:

- `/atomic-vault` — intent and goal lifecycle, memory operations
- `/atomic-vcs` — inspect repository state and history: `status`, `log`, `change` (`-p` provenance, `-a` AI attestation), `diff`
- `/code-intelligence` — knowledge graph queries for code exploration

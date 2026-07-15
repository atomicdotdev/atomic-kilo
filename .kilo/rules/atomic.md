# Atomic VCS Agent

You use **Atomic VCS** (not git). A draft view is created for each task automatically.

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

Then run `atomic vault sync` to persist the file into the vault database. The intent file lives on disk, but `atomic vault intent show`/`update` read from the database — not the file. Without `sync` they see the original placeholder template, and `update` will overwrite your file edits with it. **`atomic vault sync` is NOT `atomic record`** — it only deflates your `.vault/` edits into the vault database, and it is still required even though hooks handle recording.

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

Always `atomic vault sync` before `intent show` and before `intent update` — an unsynced `show` renders the stale placeholder template, and `update` re-materializes the database copy over the file, clobbering your edits.

**Do NOT run `atomic add` or `atomic record`.** The hook system records your changes automatically with full AI provenance (model, tokens, session, timing) when the task ends. (`atomic vault sync` is not `record` — it only moves your `.vault/` edits into the vault database, and you must run it yourself.)

## Rules

- **One intent per turn.** Every prompt gets its own intent.
- **Problem first.** Reframe solution-requests as problems. Ask questions if unclear.
- **Write the intent file before coding.** The plan goes in the file, not just in chat.
- **Simplification guard.** When you pick an approach that is simpler than, or diverges from, a reference (the standard library, an existing implementation, a spec, or a prior version), the simpler choice almost always drops a behavior the reference guaranteed. Name the dropped behavior explicitly — common culprits are interrupted/partial operations, error or panic states, round-trip fidelity, ordering, and overflow/empty/boundary inputs — and for each one either pin it as an acceptance criterion, record it as explicitly out-of-scope with the consequence stated, or ask the user. Never leave it unstated. A decision about API *shape* is not a decision about *behavior*: the same signature can be implemented correctly or incorrectly, so call those out as separate items.
- **Do run `atomic vault sync` after editing any `.vault/` file**, and before `atomic vault intent show`/`update`. It deflates your on-disk edits into the vault database; it is not `record`, and hooks do not do it for you mid-task.
- **Do not run `atomic add` or `atomic record`.** Hooks handle this with provenance.
- **Do not create or switch views.** The session view is created automatically.

## Skills

Use these for detailed reference when needed:

- `/atomic-vault` — intent and goal lifecycle, memory operations
- `/atomic-vcs` — inspect repository state and history: `status`, `log`, `change` (`-p` provenance, `-a` AI attestation), `diff`
- `/code-intelligence` — knowledge graph queries for code exploration

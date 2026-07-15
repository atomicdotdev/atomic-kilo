---
description: Atomic VCS agent with provenance tracking, intent-per-turn workflow, and knowledge graph skills
mode: primary
color: "#10B981"
---

You use **Atomic VCS** as the primary version control system. A draft view is created for each task automatically.

Every prompt is a turn. Each turn creates one intent, executes it, and records with full AI provenance (model, vendor, tokens, cost, causal decision graph).

## Workflow

1. Create an intent: `atomic vault intent create --title "<title>"`
2. Define the problem — reframe solution-requests as problems
3. Write the plan into the intent file, then `atomic vault sync`
4. Execute tasks, checking them off and syncing after each
5. Update intent: `atomic vault sync && atomic vault intent update <ID> --status done`

Recording is automatic — do not run `atomic add` or `atomic record`.

## Key commands

```bash
atomic status                    # Working copy status
atomic log                       # View history
atomic vault intent list         # List intents
atomic vault intent create "t"   # Create intent
atomic vault sync                # Persist vault edits
atomic diff                      # Show differences
```

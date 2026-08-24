# Brief: chat-background-tasks-visible — a background task the agent arms (Monitor) is visible in the chat panel

You are the AUTHOR of one PR in the olai repo, in a fresh worktree (`.worktrees/chat-background-tasks`, branch `chat-background-tasks`) of `/home/srid/code/olai`. The human is present today: STOP AND ASK works — use it when genuinely blocked.

## The roadmap item (roadmap/features.olai → Chat panel → `chat-background-tasks-visible`)

- The motivating incident: the orchestrator armed `kolu watch --states waiting,awaiting --held-for 60s --nag 10m` as a persistent Monitor and supervised a whole dispatch off its events — and the chat panel showed none of it: no spawn, no event stream, no liveness, no death. The human had to ask "how do you know you are babysitting right now?"; the answer (pid, event cadence) lived only in prose.
- **What to draw:** a background task gets a lane/row of its own (the chat-subagent-lanes precedent, #193): its description ("kolu fleet watch…"), armed-since, each event as it streams, and its END — exit code on death, since a monitor's death is precisely the fact the human must not miss. tool-elapsed-face (#324) already ticks elapsed time on anything the wire honestly calls running.
- **The honest limit is upstream, and must be said per layer** (the mcp-roster-visible pattern): #324's filing established the Claude adapter completes background calls at launch (claude-agent-acp issue #865); PR #941 covers Agent/Task only, not Monitor/background Bash. Draw what the wire carries; where it carries nothing, the adapter must learn to carry it.
- Scope note: per-conversation, like everything on the chat cell; a task outliving the pane's conversation is out of scope until the wire says otherwise.

## RULED by the human (2026-08-24 ~10:35): the implementation USES THE LINKED PR

The adapter half builds ON claude-agent-acp PR #941 (the linked PR on issue #865): take its approach/branch as the basis and EXTEND its coverage to Monitor (and background Bash) so those calls stay open on the wire and their events reach the session. Concretely: read issue #865 and PR #941 first (gh works); apply/extend against the adapter olai pins; record exactly what you took from #941 and what you added, so the pin's story is auditable. If extending it requires an ACTION ON THE UPSTREAM REPO (opening a PR there, pushing a branch), STOP and ASK here first — never act on another repo without the human's ratification.

## Pipeline for THIS lane (differs from the usual — the human ruled it)

1. Implement + open the PR (never merge). Post-implementation refactor passes as usual (architecture-first-principles; hickey+lowy together; /simplify), isolated commits.
2. Local bar: typecheck, unit, touched e2e features. Do NOT run full CI yet.
3. Produce evidence: a video (real browser; a real Monitor armed by a real agent turn if at all achievable — the kolu watch itself is the perfect subject) showing the task row appear with its description, events streaming into it, and the death face with exit code. Screenshots for each face, scripted via evidence.ts so they reproduce. Upload via the uploads endpoint; never commit assets.
4. Report here: PR URL + head, what shipped per layer (panel-drawn vs adapter-extended vs honestly-absent), suite counts, evidence links, `No deferrals.` (or stop-and-ask).
5. THEN THE LANE PAUSES: the orchestrator frame-verifies your evidence, and the HUMAN TESTS MANUALLY before any review is spawned. Address whatever the human finds; the review round comes after their word.

## Ground rules

- Read `HACKING.md` and `CLAUDE.md` at the repo root in FULL before writing code.
- Keep docs up to date where they speak of what you change.
- **No deferrals.** Fold everything or STOP and ASK. `## Deferrals` says `No deferrals.` Flaky master tests you don't own: `## Observed` with the reproduction (the ledger is freshly emptied — new flakes are news).
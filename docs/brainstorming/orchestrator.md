# The orchestrator: give it a real home

Status: brainstorming, opened 2026-08-13, rewritten 2026-08-15; the direction was ratified the same day. The phased work is on the roadmap, as todo children of `orchestrator-in-chat` wired with `after` edges. The long version with all receipts is in git history; the apm spike is `apm-spike.md`.

Lesson that opened this file: anything the orchestrator knows that is not in a file is a failure waiting to happen (wiped memory, the Fable model burn).

## The organizing idea: orchestration is outlines

Three kinds of nodes, all in `.olai` files, all edited in the app and read by every launcher:

- **agents** — who. One node per agent; its note carries the exact launch command. A missing node refuses loudly; no default can win again.
- **workflows** — how. The pipeline every lane walks as a TEMPLATE subtree: each step a `todo` node, dependencies as `after` edges. The DAG is drawn by the app for free — blocked vs ready already renders.
- **lanes** — what's live. Dispatching a task CLONES the workflow template under the lane's node (real copies via `add_node`, not mirrors — each lane's steps carry their own marks). Progress is marks flipping todo → doing → done; terminal id, PR, evidence links live in the step descs. The orchestrator's memory becomes the outline; it survives anything.

No new olai features are needed to start: marks, `after`, `add_node`, descs.

### Example: one task, dispatched

The `fix-caret` workflow template, cloned under a lane when dispatched:

    lanes
      fix-caret  (todo, desc: repo, brief, agent → agents/claude-opus)
        implement + open PR      (doing, desc: terminal 9f2c, PR #180)
        refactor passes          (todo, after: implement)
        review: grok             (todo, after: refactor)
        review: opencode         (todo, after: refactor)
        rebase onto master       (todo, after: both reviews)
        address findings         (todo, after: both reviews)
        CI green at head         (todo, after: rebase, address)
        evidence verified        (todo, after: CI)
        merge                    (todo, after: evidence)

The two reviews are ready together the moment refactor is done — the fan-out is just two `after` edges — and "address" stays blocked until both finish. What you see in the app IS the dispatch state; nothing else needs asking.

Template rule the edges encode: a step that MUTATES the worktree sits `after` every step that READS it — readers fan out, writers wait. Dispatch is `set_doing` on a step, so the day `set_doing` refuses on a blocked node, "instructed a rebase under live reviewers" (a real 2026-08-15 incident) stops being a discipline and becomes a refusal.

## Decided (2026-08-15, the human)

- **Home: olai itself.** Operated from olai chat — the chat agent already holds kolu's MCP tools (worktree-cutting `lifecycle_create` shipped in kolu #2167). The terminal orchestrator is temporary labor until parity.
- **Agents outline: now.** Drafted (uncommitted, under review); launchers read it before every spawn. Kolu growing a structured launch spec (`{model: opus}` → argv) is the later upgrade.
- **Workflow template: one shared place.** A single orchestration outline; every repo's lanes clone from the same template.
- **Cross-repo progress: the orchestration outline records it.** Repo roadmaps keep their own items; the lane's step-marks live centrally.
- **Babysitting transport: kolu MCP.** The blocking waits as tool calls (`wait_agentState` / `wait_outputSettled`), not shell — schema-validated arguments, no quoting to mangle. Upstream ask stands: block-forever default.
- **`.olai` replaces `.jsonl`** — rename PR in flight.
- **`apm run` is out of the launch path** — the wrapper blinds kolu (measured; see apm-spike.md). At most a prompt compiler.
- **Rejected: Claude-native push** (Claude Code "channels" — a server pushing events into a session). Claude-only, and it can only reach a session that is already open: no MCP notification can wake an idle agent. Fails the works-from-grok/codex/opencode test.

## Waking the chat agent (the babysitting gap, and its answer)

An idle chat agent cannot be woken by any MCP notification, and in-turn blocking waits hold a turn open into the host's timeout. But the subscriber does not have to be the agent: **olai's server is the ACP client — the party that starts turns.** Kolu MCP already exposes subscribable resources with snapshots (`urgency` — who needs attention; `terminals` — per-terminal agent state). So the wake path is: olai holds a kolu-MCP subscription, and when a lane's agent settles, olai starts a chat turn saying so. That is the `olai-subscribes` roadmap item; until it lands, mark-flipping and babysitting stay the terminal orchestrator's hand.

## Still open

1. When `olai-subscribes` gets built (it is on the roadmap, `after` lane-cloning and mcp-bridge) — sequencing, not whether.
2. Kolu's `urgency`/`terminals` resources have not been driven from olai yet; the first subscription probe may find sharp edges (the activity stream already has a recorded one).

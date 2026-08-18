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
        deferrals ruled #human   (todo, after: evidence — SKIPPED when the report says "no deferrals")
        merge                    (todo, after: deferrals ruled)
        retire terminals         (todo, after: merge — kill the author (reviewers die with the merge itself); executed in the SAME action block as the merge, never deferred to a future settle)

The two reviews are ready together the moment refactor is done — the fan-out is just two `after` edges — and "address" stays blocked until both finish. What you see in the app IS the dispatch state; nothing else needs asking.

Template rule the edges encode: a step that MUTATES the worktree sits `after` every step that READS it — readers fan out, writers wait. Dispatch is `set_doing` on a step, so the day `set_doing` refuses on a blocked node, "instructed a rebase under live reviewers" (a real 2026-08-15 incident) stops being a discipline and becomes a refusal. (`set_doing` refuses on blocked since PR #181.)

The `deferrals ruled` step is a HUMAN gate (ruled 2026-08-15): a PR whose report carries deferred items merges only on the human's explicit word — each deferral becomes a roadmap node first. A report that says "no deferrals" in so many words skips the gate.

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

## Challenges seen in practice (root causes, from the 2026-08-16 lapse)

The incident: with eight lanes live, the human caught the orchestrator sitting on two unprocessed debriefs (grok's #207 delta answer; #209's refactor report) with several author terminals left unwatched. Root-cause analysis, written down so the real home fixes it by design:

**Root cause: the orchestrator's only event queue is its own attention.** A watcher firing is an interrupt — a one-shot notification pointing at an output file. If a hotter thread (usually a human message; today they came minutes apart) preempts the turn, nothing anywhere records "this debrief landed and awaits processing." The board cannot serve as the queue: a lane step marked `doing` looks identical whether its debrief is still cooking or has been sitting unread for an hour. The debt is invisible, so it silently ages until a human smells it.

Contributing causes, each observed today:

1. **Preemption without a resume protocol.** Correctly prioritizing the human's message displaces the interrupt, but there is no list to return to — resuming depends on remembering, and memory is the thing this file exists to distrust (see the lesson at the top).
2. **Re-arming is coupled to processing.** The standing rule — re-arm the watcher after every processed debrief — has a hole: a debrief that is never processed never triggers a re-arm, so the lapse compounds (unread debrief AND unwatched terminal).
3. **Write-behind board discipline.** The orchestrator updates the board *while* processing, not *when the event lands* — so the board is always slightly behind reality, and auditing it against `kolu ls` is a manual habit rather than a property.

What fixes it in the current (terminal-orchestrator) regime:

- **Land the event before working it.** The moment a debrief notification arrives, one cheap board write (a `debrief=landed` property on the lane step) before anything else — then the queue is durable and `prop:debrief=landed` lists the debt.
- **Turn-end sweep.** No turn ends while an unread task output or an unwatched live author exists; the audit (`kolu ls` × armed watchers × landed-unprocessed debriefs) is part of ending a turn, not a thing the human requests.
- **Decouple re-arm from processing.** Re-arm at notification time, not at processing time, so a deferred debrief never costs the watcher too.

**Second lapse, same day (the idle-but-owing agent).** A lane's author sat idle for hours with unblocked pipeline steps owed (refactor, reviews), and the orchestrator did housekeeping around it without advancing it — caught by the human, again. Two causes: an external CI wait was mentally filed under the *implement* step when it belonged to the *CI-green* step, which made every downstream step read as blocked; and once the terminal's settles were classified as noise, the classification stuck to the TERMINAL, so later events were dismissed without re-asking the one question every settle owes: *what does this lane owe next?* Rules added: a dismissal applies to an event, never to a lane; and the turn-end sweep gains a third check — an idle lane agent whose lane holds an unblocked, non-#human todo step is a defect to fix in that turn. The board can answer this query mechanically; nothing was asking it.

**Third lapse (2026-08-17, the overnight run): twelve zombie terminals.** Every merged lane's reviewers were killed in the same action block as the merge and never leaked; every author was told "remove your worktree, report done — this terminal will be retired after that" and NONE were ever killed. The retirement lived only as a sentence in a message — not a board step — so once the lane was marked done, the turn-end sweep (which asks "does any lane hold an unblocked owed step?") saw nothing owed, and the debt was invisible to the only queue that is trusted. Worse than idle waste: the authors had deleted their own cwd on instruction, so the leaked PTYs sat in dead directories, and kolu's split-from-tile (which seeds the child with the parent's cwd) failed against every one — the leak manufactured a user-facing bug. Rules added (ruled by the human): the lane template gains a `retire terminals` step after `merge`, and the author's kill is executed in the SAME action block as the merge — a kill deferred to a future settle is the attention-shaped queue again. The general law all three lapses share: an action that exists only inside a sent message does not exist.

**Fourth lapse (2026-08-17, same day): the queue went unread for ~460 events.** Two supervision paths exist — the durable `watch_next` queue (complete by construction, acknowledged, survives restarts) and a Monitor process whose only job is to be a *doorbell*. The orchestrator inverted them: it treated the doorbell's payload as the list of terminals worth looking at, and stopped draining the queue entirely, reading each named terminal with `wait_agentState` instead. The cursor sat at 94 while the queue reached 554. The failure surfaced when two terminals in a THIRD repo finished and nothing rang: the doorbell's command grepped `olai·|kolu·`, so any lane outside those two repos was structurally invisible — but the queue had both events, unread. Rules: the doorbell carries no information beyond "something happened"; every wake drains `watch_next` and acks, and a turn does not end with an unacked event. The doorbell's filter must never be narrower than the subscription. The general law, now with four witnesses: **anything the orchestrator knows only through its own attention — a promise in a message, a terminal it remembers, a payload it trusts — is a queue that will silently lose an entry.**

**Fifth lapse (2026-08-18, the second overnight): three authors parked mid-pipeline for hours, and the human caught it — again.** Three of seven dispatched authors ended their turn after the implement report ("Next I'll run the refactor passes") and never continued; one sat idle 2.5 hours. A wedged reviewer compounded it. Three causes stacked: (1) the dispatch brief itself licensed the gap — "report here when the PR is open, and again after refactor" invites a turn end at the checkpoint, and whether an agent continues in-turn is luck (4 of 7 did); (2) the orchestrator overrode the machine with prose — each settle arrived as a literal `kind: "finished"` event and was classified as work-in-progress because the debrief's last sentence was future tense; (3) the doorbell is edge-triggered with dedup, so a terminal that settles once and stays idle is structurally silent forever — under load (6–10 lanes) that certainty-of-a-miss arrived. Rules added: a brief states the ONE point the agent may end its turn at ("do not end your turn until review-ready"); a debrief is classified by the event's kind and the terminal's agent state, never by its closing sentence; and the level-triggered ring (kolu-watch-next-cli — settled terminals nag until worked, snoozed, or killed) is the structural fix this lapse re-argues — the fourth witness law already named it: an edge the orchestrator must remember is a queue that will silently lose an entry.

What fixes it for real (the argument this section adds to the file's thesis): **events must become nodes.** The wake-path design above (`olai-subscribes`) already says olai's server should start turns when a lane's agent settles; this incident sharpens it — the settle-event should also *write the board itself* (step gains `debrief=landed` mechanically), so the queue exists whether or not any orchestrator is awake to hear the interrupt. An attention-shaped queue was the bug; an outline-shaped queue is the fix, which is this document's organizing idea applied to its own operator.

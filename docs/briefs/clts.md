# Brief: compact-lost-to-steer — sends queue by default, steering becomes the explicit gesture

You are the AUTHOR of one PR in the olai repo, in a fresh worktree (`.worktrees/compact-lost-to-steer`, branch `compact-lost-to-steer`) of `/home/srid/code/olai`. The human is present: STOP AND ASK works.

## The roadmap item (roadmap/bugs.olai → Chat panel → `compact-lost-to-steer`) — read it in the vault too; it is fully ruled

- **Not a compaction bug.** The panel supports QUEUING; with queuing as the default the /compact abort becomes impossible without the panel ever learning what compaction is.
- **The symptom:** `/compact` → mid-compaction send steered → `_session/steering` aborted the compaction ("API Error: Request was aborted. Compaction canceled."), turn proceeded uncompacted. Steering pre-empts by design (packages/chat/src/agents/claude.ts:283).
- **History:** the panel HAD a queue; #194 (`chat-steer-on-send`) deleted it for the right reasons (client-side queue held words invisibly; cancel's dropQueue destroyed them) but over-corrected: pre-emption became the only delivery.
- **Upstream (confirmed):** core ACP has no promptQueueing; the pinned adapter queues for real — turnQueue FIFO (src/acp-agent.ts:447), advertised as `agentCapabilities._meta.claudeCode.promptQueueing: true`, steering beside it (`_meta.steering.supported`). The queue olai needs is the adapter's own; the capability bit is what a leg reads.

**The human's rulings (implement exactly these):**
1. **Send = plain `session/prompt`, always** — busy or idle, one verb, one code path. Idle starts the turn; busy is held by the adapter's FIFO. No client-side queue state, no compaction awareness anywhere.
2. **Steering stays as a modifier on send** — Alt+Enter-shaped (a deliberate variant on phone); plain Enter queues, the modifier steers. Interruption is always on purpose. Only where the capability advertises it.
3. **Cancel stops the turn and nothing else** — queued messages survive at the adapter and run next, in order.
4. **UX:** send anytime; the row lands in the transcript at once wearing a "queued" hint while the agent is busy; the hint clears when the agent takes it.
- opencode's leg already lives in this world (every send is a prompt, no steering, -32601): converging the claude leg makes the two legs one story, steering the claude leg's extra gesture where advertised.

## Ground rules

- Read `HACKING.md` and `CLAUDE.md` in FULL first. Open a PR; NEVER merge. Keep docs current (#194's story in the docs must gain this chapter, not lose its own).
- **No deferrals** — fold or STOP and ASK. `## Deferrals` says `No deferrals.` New flakes on master: `## Observed` with the reproduction.
- Local bar at report: typecheck, unit, touched e2e features. Post-implementation refactor passes (architecture-first-principles; hickey+lowy; /simplify), isolated commits. CI comes after review — the orchestrator says when.

## Evidence — the auto-merge gate

The human pre-authorized AUTO-MERGE on the orchestrator's frame verification. Show, in a real browser against a real agent:
1. A send while the agent is busy: the row lands at once wearing the queued hint; the agent finishes its work and takes the queued message in order; the hint clears.
2. The modifier send steering into a running turn (the deliberate interruption).
3. Cancel mid-turn with a message queued: the turn stops, the queued words SURVIVE and run next.
4. The symptom retired: /compact, then a plain send while compacting — compaction completes, the message runs after. (The exact abort from the screenshot, now impossible.)
Video preferred (address bar in frame), screenshots per face, scripted via evidence.ts. Upload via the uploads endpoint; never commit assets.

## When done

Report here: PR URL + head, what shipped per ruling, suite counts, evidence links, `No deferrals.` Reviewers (grok and pi) come next; stand by to address both.
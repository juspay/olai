# The patches this pin carries

## What the pin is for

Two patches apply to the pinned `@agentclientprotocol/claude-agent-acp`
0.66.0 — to its **compiled** `dist/acp-agent.js`, because npm is the only
channel the adapter ships through (`nix/acp-agent.nix` says why that pin is
npm-shaped). They are applied by that derivation's `postInstall`, so every
documented way of starting olai — `nix run`, the packaged binary, `just
serve`, `just run`, the e2e suite's `OLAI_BIN` — gets the same agent.

---

# `background-tasks-visible.patch` — a background task lives past its launch

## What it is for

A background task the agent arms — a `Monitor`, a `Bash(run_in_background)`,
an async `Agent` — reports its launch and then lives on. On the ACP wire, its
tool call reached **`completed` at launch**: the acknowledgement was read as
the call's result. So an armed watch was indistinguishable from a finished
one, nothing ticked, and its DEATH — the fact a person supervising off a
monitor must not miss — was never on the wire at all
(agentclientprotocol/claude-agent-acp#865).

## What came from upstream PR #941, and what olai added

[PR #941](https://github.com/agentclientprotocol/claude-agent-acp/pull/941)
(open, unmerged, 0 reviews) is the linked PR on #865. **Its approach is the
basis here** and its scope is not: by its own summary it keeps *async
Agent/Task* calls in progress and "background Bash retain their existing
behavior", and it never touches `background_tasks_changed`.

Taken from #941:

- **the shape of the fix** — a launch acknowledgement must not settle the
  call; the call stays `in_progress` until the harness reports a real terminal
  state, with the launch's own output still riding the card;
- **the mapping** — `completed` → `completed`, and `failed` / `killed` /
  `stopped` → ACP's `failed`, with the provider's own word preserved in
  `_meta.claudeCode.taskStatus` (ACP has four statuses and the harness has
  more);
- **the discipline for reading a tool's structured answer** — trust it only
  when the CACHED TOOL NAME says which tool answered, so a similarly shaped
  output from an MCP server can never arm a call (`backgroundLaunchIn`, which
  is #941's `readAsyncAgentLaunch` generalised);
- **the ordering races it names** — a terminal that arrives before the launch
  acknowledgement is held and replayed, duplicates are idempotent, and a call
  whose `tool_use` was dropped by a cancelled turn is still resolved.
  The hold MERGES rather than replaces, which #941 has no equivalent of
  because it has one bookend to hold: both of ours can beat the arming result
  and only the notification carries the sentence, so a last-write-wins hold
  would settle a shell that exited 3 without mentioning the 3 (review SHOULD 3,
  grok at 71daeb9f).

Added here, and not in #941:

- **coverage of the background-launching tools, as a table rather than a
  branch** (`BACKGROUND_LAUNCHES`): a `Monitor` (`{ taskId, … }`), a
  `Bash(run_in_background)` (`{ backgroundTaskId, … }`) and an async `Agent` /
  `Task` (`{ status: "async_launched", agentId }`). **That table is the gate on
  every arming**, and it is worth being plain about what that means: a tool it
  does not name — a new one, a renamed one, a renamed answer field — keeps the
  lifecycle it has always had and completes at launch, which is the unpatched
  behaviour and the direction this is safe to fail in. Nothing here can invent
  a live face for a call the harness never registered a task for, and nothing
  guards against the vocabulary drifting: what would catch that is a run of
  `packages/tests/tasks.ts`, which prints the timeline for a real `Monitor` and
  a real background shell;
- **correlation and metadata off `task_started.tool_use_id`**. The harness
  names the arming tool use on that frame, and it also names the task's KIND
  (`task_type`) and the DESCRIPTION it was armed with — none of which the
  structured answer carries. The ARMING DECISION is still the answer's, as in
  #941 (see the table above); what `task_started` adds is who the task belongs
  to and what to call it, and a runtime that omits the tool use there loses the
  metadata rather than the lifecycle;
- **`_meta.claudeCode.backgroundTask`** on every frame about such a call —
  `{ taskId, taskType, description }` when it is armed, plus `{ status,
  summary }` when it settles — so a client can draw the task rather than
  infer one from a status. (olai itself reads all of that except `taskType`,
  which says `local_bash` for a monitor and a background shell alike; it is
  stamped because it is the harness's own word and #865's proposal carries
  it, not because anything here draws it.)
- **the settle carries the harness's own SUMMARY** as tool-call content. That
  sentence is where a background shell's EXIT CODE is: *Background command
  "…" failed with exit code 3*. `task_updated` is the guaranteed half of the
  bookend and carries no summary, so it settles the call and the
  `task_notification` beside it refines the same call with the sentence —
  which is ACP's own upsert rule rather than a second mechanism;
- **`background_tasks_changed` as the bound** on the record above: a task that
  has both settled and left the live set is forgotten. It is never read as a
  settle in itself — the level carries no status, and closing a call on an
  absence would invent the one fact this exists to report. (#865's own
  proposal is to forward that level to the client; this patch does not, and
  olai draws none of it.)

## What is still NOT on the wire, at the layer below

**A monitor's individual EVENTS are not in the SDK stream at all.** Measured
2026-08-24 against this pin with `emitRawSDKMessages: true` (the probe in the
PR): a `Monitor` whose command printed five lines produced `task_started`,
one `background_tasks_changed` at each end, `task_updated` and
`task_notification` — and not one frame carrying `tick-1`. The lines reach the
model (it answers about them, and that answer does reach the client as
ordinary agent prose) and they reach the task's `output_file` on disk. So the
adapter has nothing to forward per event, and this patch does not pretend
otherwise: what it carries is the task's LIFE — armed, still running, and how
it ended. Per-event streaming is a change one layer further down, in the CLI.

---

# `session-list-info.patch` — what a stored conversation holds, and which one a `/clear` moved you to

## What it is for

Two questions about an agent's stored conversations that `session/list`
cannot answer today:

- **How big is the conversation?** The wire carries an id, a title,
  timestamps, and a file size — and nothing that says how many messages a
  conversation holds. Two sessions can share a title and an hour; three
  versus three hundred messages is usually the difference the person reading
  the picker means.
- **Which conversation did `/clear` move you into?** The CLI starts a fresh
  session for the same directory and leaves no pointer connecting the two,
  so the picker shows the pair as twins and cannot say which row the reader
  is in. A session that *opens* with the `/clear` local-command replaces the
  one last touched at that moment.

The patch answers both by stamping each listed session's `_meta.claudeCode`
(the protocol's extension point for exactly this) when `session/list` replies:

- `messageCount: number`, read from the transcript; and
- `supersededBy: <sessionId>` on the OLDER of a `/clear` pair.

The link is **inference, said without guessing**: candidates that tie at the
cleared second, or a missing one, mean the field is absent rather than a best
pick — a wrong link is worse than no link on the row somebody is about to
click. The asking that follows from that is written up in
[claude-agent-acp#ISSUE](https://github.com/agentclientprotocol/claude-agent-acp/issues/ISSUE),
which also asks whether the CLI can stop making it an inference question at
all (a session that replaced another knows it did).

The cost is held the way the SDK gauges its own listings: `getSessionMessages`
once per session in the cwd, under a memo keyed by session id, file size, and
mtime — so the common second list of a busy directory costs a cache lookup —
in a sequential scan rather than a `Promise.all` (a busy directory is not
allowed to become a storm), and one unreadable transcript costs that row's
stamp, not the list.

## What neither patch gets you

The CLI's own `/resume` picker still shows file size. The link never becomes
anything but inferred while the harness does not write it. An agent that is
not this adapter — opencode — has no stamp, and olai's picker's answer for
an unstamped row is to say nothing rather than invent a count for it.

---

## Upstreaming

**`background-tasks-visible.patch` — asked, not sent**:
[claude-agent-acp#1038](https://github.com/agentclientprotocol/claude-agent-acp/issues/1038)
describes this extension, links to this patch, and asks the maintainers whether
a PR of it would be welcome. That issue is the whole of what has been done on
that repo on it — no branch, no PR — and it was opened on the human's own
narrow ratification, because acting on somebody else's repository is theirs to
allow and never this lane's to assume.

**`session-list-info.patch` — asked, not sent**:
[claude-agent-acp#ISSUE](https://github.com/agentclientprotocol/claude-agent-acp/issues/ISSUE),
same shape: what the two stamps are, why, and a pointer at this patch, ending
in the same two questions — would a PR be welcome, and could the CLI make the
link a fact rather than an inference. That issue was opened under the same
narrow ratification, and naming the ratification here is what keeps both
issues from looking like an editorial habit.

Both patches are written against the compiled output because that is what the
pin ships; against `src/acp-agent.ts` the same change is a mechanical
translation, which is what a PR would carry if the answers are yes.

## When the pin moves

`patch -p1` fails the build if the context has moved, which is the point: a
version bump makes this loud rather than silently dropping the behaviour. The
fix is to re-apply the edits against the new `dist/acp-agent.js` — the
anchors in `background-tasks-visible.patch` are all in `toAcpNotifications`'
tool-result branch and in the SDK-message switch's `task_*` cases; the anchors
in `session-list-info.patch` are `listSessions` and the module surface above
it — or to drop a patch upstream has landed, and say so here.

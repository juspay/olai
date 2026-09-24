# The patches THIS ENGINE'S adapter carries

## Where these live, and why here

Two patches apply to the pinned `@agentclientprotocol/claude-agent-acp`
0.81.2 — to its **compiled** `dist/acp-agent.js`, because npm is the only
channel the adapter ships through (`default.nix` beside this plugin reaches
`@olai/plugin-kit`'s `npm-adapter.nix` for exactly the reason that pin is
npm-shaped). They are applied by that derivation's `postInstall`, so every
documented way of starting olai — `nix run`, the packaged binary,
`just serve`, `just run`, the e2e suite's `OLAI_BIN` — gets the same agent.

**They sit in this plugin's directory rather than beside the shim**, and that
is the isolation phase: an engine is a plugin now, with its own release clock
— this adapter's pin moved five times in a month and no other engine's did —
so its patches, their sources, and the npm SHIM all travel with it. This
engine's shim is `acp/shim/` (`acp/shim/package.json` + its lockfile), its own
because the engines now share no lockfile: `default.nix` beside this file
names that shim in its call to `@olai/plugin-kit`'s `npm-adapter.nix`, and the
adapter's one fixed-output derivation comes from it. The pi adapter's one
patch and its own shim are one directory over in `packages/plugins/pi/acp/`.
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
was closed on 2026-09-23 as superseded by [#1017](https://github.com/agentclientprotocol/claude-agent-acp/pull/1017).
[#865](https://github.com/agentclientprotocol/claude-agent-acp/issues/865) was closed the same day as fixed by #1017. **#941's approach is the
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
  `packages/tests/tasks.ts`, which prints the timeline for a real `Monitor`, a
  real background shell and a real subagent sent more work;
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
- **an async agent's REPORT is not a person speaking.** The harness injects
  the completion as a user-role turn (`origin.kind: "task-notification"`, a
  `<task-notification>` XML block carrying the whole result). Unpatched, and
  patched until this, that turn is forwarded as `user_message_chunk`, so the
  panel drew the report RAW in the column. The patch reads the discriminator
  (`origin.kind`, falling back to the XML wrapper **only when origin is
  missing** — a replay of an older store — and only when the trimmed
  payload starts and ends with the tags, so a human prompt the pin stamps
  `origin: human` is never this, even if they pasted the XML) and files
  the `<result>` onto the spawning call as
  `_meta.claudeCode.backgroundTask.report` instead — the same stamp the
  ending already uses, not a second field. Live and on `session/load`.
  Measured by `packages/tests/tasks.ts` `KIND=agent`: a forwarded
  task-notification prints `TASK-NOTIFICATION FORWARDED AS USER SPEECH`,
  and the day one does, that line is how anybody finds out;
- **a task's SECOND LIFE** (`reopenBackgroundTask`, `taskOrigins`), which is
  a subagent's: an agent that has reported can be sent more work, and the
  harness starts the SAME task again. Measured against this pin
  (`packages/tests/tasks.ts`, `KIND=resume`): the second `task_started` carries
  the same `task_id` and a DIFFERENT `tool_use_id` — the `SendMessage` that
  woke the agent — while every frame the agent then produces goes on naming the
  call that SPAWNED it as its parent. Unpatched, and patched until this, the
  wire said nothing at all about that: the spawning call completed at the first
  report and nothing reopened it, the waking call completes at DELIVERY
  (seconds before the work it delivered), and the task's own bookends are SDK
  frames a client never sees. So a client had a running agent it could not draw
  and no way to learn otherwise — the panel this was written for showed nothing
  but a monitor while an agent worked for twenty minutes.

  What it does is reopen the SPAWNING call — `status: in_progress` on the id
  the client already knows — and let the settle bookends above close it again.
  Never the waking call: a resume is not a second agent, and a second face for
  one agent is a strip that counts two of everybody.

  **THE REOPEN SAYS NOTHING ABOUT ARMING AND THE SETTLE SAYS EVERYTHING IT
  ALWAYS DID**, which is one rule rather than two: `backgroundTask` is what a
  LAUNCH says about itself and a resume registers no new task, so the reopen
  carries a status and no more — but the settle of a reopened call is an
  ENDING, not a launch restated, and a client that draws a task's death from
  that stamp would otherwise hear about the first outing's and never about the
  second's (and the sentence that lands a beat later would have no line to
  refine). So the settle stamps `{ status, summary }` exactly as it does on a
  first life.

  **AS LOUDLY AS ITS OWN LAUNCH, and no louder** (`quiet` on the record,
  `armed` on the origin). An ASYNCHRONOUS `Agent` launch told the client it had
  armed a task, so every ending of that task is news the same way. A
  SYNCHRONOUS one told it nothing — under this pin that is every `Agent` call,
  measured: no launch answers `async_launched`, so no `backgroundTask` appears
  on any of their frames — and a resume is not the moment to start, because a
  subagent whose second return was announced while its first was silent is the
  same asymmetry this bullet is about, mirrored. Which of the two a call was is
  read off what this adapter actually emitted for it, never guessed from the
  tool: the origin is marked when a settle for it is emitted, which only a
  record the arming acknowledgement launched can reach.

  `taskOrigins` is the one record here that survives a settle, because it is
  what says a task starting again is an old call going round again rather than
  a new one — and, with `armed`, how loudly it may end. One task id, one tool
  use id and one flag per task the session ever started, the order of memory
  `toolUseCache` already keeps per call.
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
  so a picker shows the pair as twins and cannot say which row the reader
  is in.

The patch answers both by stamping each listed session's `_meta.claudeCode`
(the protocol's extension point for exactly this) when `session/list` replies:

- `messageCount: number`, read from the transcript; and
- `supersededBy: <sessionId>` on the OLDER of a `/clear` pair.

The asking that follows from that is written up in
[claude-agent-acp#1052](https://github.com/agentclientprotocol/claude-agent-acp/issues/1052),
which also asks whether the CLI can stop making it an inference question at
all (a session that replaced another knows it did).

The pairing and the scanning rules are vendored OUT of this file and into
[`session-list-info/`](../session-list-info/README.md): the patch is
GENERATED from that source (`bash packages/plugins/claude/acp/session-list-info/regenerate.sh`,
with the hunks computed by `diff -u` against the pristine npm extract — one
generation of hand-numbered hunks failed at `-F0` on the pristine corpus and
that was the argument). The suite in `facts.test.js` is why each rule below
is a claimed edge and not a hope. The patch remains diff-shaped because the
build must stay LOUD: `patch -p1 -F0` in `@olai/plugin-kit`'s
`npm-adapter.nix` is what
makes a pin bump fail rather than silently drop the behaviour — one reviewer
had it as the promise, one as evidence it was not yet keeping itself; both
hunters are now bound the same way: loudly, by construction.

## Where the reading's honesty comes from

**There is no "empty transcript" that reads as zero.** `getSessionMessages`
answers `[]` for an unreadable file the same as for a genuine empty one, and
a row drawing `0 messages` for an EACCES would erase the failure the whole
stamp exists to catch. When the messages call answers empty, the patch calls
`getSessionInfo` with the same dir — and `info` answers `undefined` on
every loss window the messages call swallows (unlocatable, zero-byte,
unopenable) — and THIS is the arbiter: nothing comes back, the row carries
NO stamps and a logged line, SOMETHING comes back and the zero is earned.
Failure is UNDATED too: a row that lost its read drops out of the pairing
alongside its count. Failure is not MEMOIZED either: a transient read
failure is retried on the next list, never remembered for the process's
life; the cache remembers only successful facts, capped at 2000 entries,
oldest evicted. (The cache's key is the row's own `(fileSize, lastModified)`
— under a sessionStore the former is `undefined` and the key collapses to
mtime: the notes say so, because anything else would be a claim.)

**The pairing says no rather than any of the ways it could pick a wrong
one.** Its rules, each an edge the suite asserts:

- a candidate's `lastModified` may equal the command's timestamp — mtime
  and stamps share a domain, and excluding the boundary walks past a
  same-moment predecessor; two candidates AT the maximum are no answer;
- an heir that claims a predecessor already claimed is no answer FOR
  EITHER — the first version's overwrite was the way in;
- the candidate's touch must lie within one week of the command: a longer
  reach names whatever row existed back then with identical confidence,
  which is the begging-a-question the first version did in code;
- a session the listing's own IDE-parity rule excludes (headless or
  daemon-written: `includeProgrammatic: false`, asked of the CANDIDATE
  set only — olai's visible list keeps the same shape, because hiding a
  conversation to protect a link guess would be the wrong friend), is not
  a predecessor a person reading the list can see in front of them — the
  case olai's own scripted drivers would manufacture otherwise;
- and the walk's own limit, said rather than kept quiet: an EARLIER
  opener that made NO claim (its transcript unreadable or undated) carries
  no protection for its predecessor — a LATER opener can still link that
  predecessor alone. Same shape of the answer this whole pairing is
  refusing to risk, one step rarer; the limit is named in the docstring
  alongside, not guarded, because the honest walk's refusal of one wrong
  case is not the coach for guarding the next possible mistake against
  rules we do not have about undated requests.

**`timestamp` is an undocumented passthrough of the SDK's `SessionMessage`,**
not a manufactured value like `sessionId`: a pin bump that drops it turns
the pairing into silent nothing. `clearOpenedAtOf` reports that shape
separately from "not a clear" (`sawClear`, no `at`), and the first process
to meet one logs it ONCE — the same shape as the row: nothing drawn where
nothing was said, but always said where something was tried.

## Numbers it costs

Measured on the developer's own directory (32 sessions, ~410 MB,
2026-08-28): cold list against a stopped adapter (the picker's own
booted-for-a-minute shape) ~1.6 s, against the warm one inside an attached
panel ~24 ms; the scan is per session sequential on purpose, a ready
`Promise.all`'s storm: it trades fifty ms on a cold row-ask for not
walling the machine. Every failure mode names itself once on the logger
rather than the row.

## What this patch does NOT do

- ANSWER BEYOND the seven-day window: a real reader returning weeks later
  then sees no link, where the notes once presented a months-old sibling
  with the same confidence as the conversation the reader was just in —
  the narrow direction this picks is saying nothing rather than guessing.
- Make tool stops read as conversation turns: the count is the transcript's
  length (both directions of the SDK drain), not the chat's own turn count
  — `docs/chat.md` says the same, in the measure the screen shows you.
- Claim anything beyond ONE agent's listing for ONE directory: the id a
  stamp references is scoped there — the same id in another listing is a
  different row (and the picker's own map of the names a successor points
  at is keyed by the owner precisely so one cannot drift into another).

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
a PR of it would be welcome. As of 2026-09-23 it remains open, unanswered
by maintainers, with one comment from another client author carrying a
similar patch. That issue is the whole of what has been done on
that repo on it — no branch, no PR — and it was opened on the human's own
narrow ratification, because acting on somebody else's repository is theirs to
allow and never this lane's to assume.

**`session-list-info.patch` — asked, not sent**:
[claude-agent-acp#1052](https://github.com/agentclientprotocol/claude-agent-acp/issues/1052),
still open as of 2026-09-23, with no comments;
same shape: what the two stamps are, why, and a pointer at this patch, ending
in the same two questions — would a PR be welcome, and could the CLI make the
link a fact rather than an inference. That issue was opened under the same
narrow ratification, and naming the ratification here is what keeps both
issues from looking like an editorial habit.

Both patches are written against the compiled output because that is what the
pin ships; against `src/acp-agent.ts` the same change is a mechanical
translation, which is what a PR would carry if the answers are yes.

## When the pin moves

`patch -p1 -F0` fails the build if the context has moved, which is the point:
a version bump makes this loud rather than silently dropping the behaviour —
the `-F0` is the audible half, because patch's default fuzz would land a hunk
up to two lines from where its context said it belonged, and one reviewer's
"this is the promise" and the other's "it was true" were both right and
both mattered. The fix for a move is to re-apply the edits against the new
`dist/acp-agent.js` — the anchors in `background-tasks-visible.patch` are
all in `toAcpNotifications`' tool-result branch, in the session-state
literal, in the SDK-message switch's `task_*` cases (the `task_started`
case now decides between reopening and registering), and in the live
consumer and `replaySessionHistory` user-message paths (`taskNotificationUpdate`); the anchors in `session-list-info.patch` are
`listSessions` and the module surface above it — or to drop a patch
upstream has landed, and say so here.

**TWO things about `session-list-info` are NOT a hunk context and both of
them must survive a bump standing alone**

1. `message.timestamp` — an UNDOCUMENTED passthrough of the SDK's
   `SessionMessage`: the day it stops arriving, `patch` still applies
   cleanly and every supersession link just disappears, rows wearing the
   finest possible health. Look for the adapter's log telling you exactly
   the scene's name: the pairing reports the case (`sawClear`, without a
   `at`) and the harness names the line.
2. The pairing rules, period: they are the tests mattered the most at and
   the change any port of the rest MUST carry unchanged. The shape to
   transplant is `session-list-info/facts.js`, not the diff: run
   `bash packages/plugins/claude/acp/session-list-info/regenerate.sh` and the diff that follows
   is itself the sign the port is the same one the suite validated.

### What the move to 0.70.0 found (2026-09-01)

The first time this section was walked rather than promised. **Both patches
were RE-APPLIED and neither was retired**, and the evidence for that is what
follows — because "re-applied" is the answer a habit gives too.

- **`background-tasks-visible` is still needed.** Upstream PR #941 was subsequently
  closed on 2026-09-23 as superseded by #1017 (#865 closed that day as
  fixed by #1017). The whole 0.66.0→0.70.0 diff of
  `dist/acp-agent.js` (1572 lines, 81 hunks) contains **no line at all**
  matching `task_`, `backgroundTask`, `liveBackgroundTasks` or
  `background_tasks_changed`: the lifecycle this patch is about was not
  touched. Nine of its ten hunks re-applied at `-F0` with their context
  unchanged; the tenth is the helper block, whose TRAILING context moved
  because 0.70.0 inserts a session-failure controller between `sendUpdate`
  and `resetTurnScratch`. Re-anchored there and regenerated by `diff -u`, so
  the patch's added lines are byte-identical to the ones the reviews passed.
- **`session-list-info` is still needed.** `bash
  packages/plugins/claude/acp/session-list-info/regenerate.sh` against the new pin produced a patch
  whose only change is its two hunk headers — `listSessions` and the module
  surface above it are untouched upstream, and #1052 is unanswered.
- **The two things that are NOT hunk context, checked rather than assumed.**
  `message.timestamp` still arrives: a live `session/list` against a real
  directory with a `/clear` pair answered `messageCount: 4` on the heir and
  `messageCount: 3` plus `supersededBy: <the heir>` on the predecessor. The
  `supersededBy` is the half that proves the passthrough — `clearOpenedAtOf`
  is the only producer of `clearedAt` and `pairSupersessions` skips a row
  without one, so a dropped timestamp is a link that silently never appears. And
  the background-task vocabulary still holds: `packages/tests/tasks.ts` was
  run against the built pin for all three kinds — a `Monitor` (armed
  `in_progress`, settled `completed` with the harness's summary), a
  background `Bash` (settled `failed`, *…failed with exit code 3*), and a
  resumed subagent (`KIND=resume`: same `task_id`, a different `tool_use_id`,
  the SPAWNING call reopened `in_progress` and closed again, quietly, because
  its launch was synchronous).
- **THE LAYER UNDER THE ADAPTER, which no diff of `dist/acp-agent.js` can
  see.** The lockfile moves `@anthropic-ai/claude-agent-sdk` 0.3.220 → 0.3.232
  along with the adapter, and every "the dist diff contains no `task_` line"
  argument above is blind to it: the vocabulary those patches read is the
  SDK's, not the adapter's. Closed in review (pi) and re-checked here:
  `SDKTaskStartedMessage`, `...Updated`, `...Notification` (with its
  `summary` — the exit-code sentence's channel), `...Progress` and
  `SDKBackgroundTasksChangedMessage` are byte-identical between the two, and
  `timestamp: e.timestamp` is still in the `SessionMessage` mapper of both
  while the declared type still omits it. **The undocumented passthrough is
  alive in the library that owns it**, which is a stronger statement than one
  live run. A future bump owes this layer its own look: the lockfile can move
  it without the adapter's dist changing a line.
- **What the panel does with all of it** is `packages/tests/panel-live.ts`,
  the driver added with this bump: 25 claims printed on a passing run, through
  a real browser panel against the real adapter, all passing. (There are 26
  `ok(` sites; the twenty-sixth is the hang-stop inside `idle`, which prints
  only when a turn never ends.)

### What the move to 0.73.0 found (2026-09-02)

The second time this section was walked. **Both Claude-adapter patches were
RE-APPLIED and neither was retired.** `pi-mcp-servers.patch` is untouched: the
`pi-acp` pin does not move here, and it still applies at `-F0`.

- **`background-tasks-visible` is still needed.** Upstream PR #941 was
  closed on 2026-09-23 as superseded by #1017 (#865 closed that day as
  fixed by #1017). 0.71.0 landed [PR
  #1017](https://github.com/agentclientprotocol/claude-agent-acp/pull/1017)
  (`14d192d`) — native subagents and AIR async tasks — which is **not** this
  patch absorbed. That work publishes a Monitor / background Bash / workflow
  lifecycle only to a client that advertised the `asyncTasks` AIR capability;
  olai's Claude leg does not; its Codex leg has since [olai PR #553](https://github.com/juspay/olai/pull/553). The 0.73.0 dist says so in so many words
  (`backgroundedBashToolCall`: a client without that capability "is never sent
  that lifecycle", so the AIR marker is withheld rather than promising a card
  state it cannot resolve). The olai patch still keeps the arming **tool call**
  `in_progress` and stamps `_meta.claudeCode.backgroundTask` for a client that
  speaks none of AIR. The 0.70.0 → 0.73.0 dist diff is large (128 hunks, ~2000
  lines) and *does* mention `task_` / `liveBackgroundTasks` / `asyncTasks` —
  because #1017 extracted that work into `dist/async-tasks.js` and routed it
  from the same `task_*` cases. The helpers were re-anchored onto that new
  consumer (`sendUpdate` now routes through native subagents; the `task_*`
  cases call `asyncTasks.*` beside the live-background registry) and
  regenerated by `diff -u`. The added lines are byte-identical to the reviewed
  ones; `completeHookCallback` (new in 0.73.0, right after the
  `emittedToolCalls` delete) is kept, not gated. [#1038](https://github.com/agentclientprotocol/claude-agent-acp/issues/1038)
  is still unanswered by maintainers (one comment from another client author).
- **`session-list-info` is still needed.** `bash
  packages/plugins/claude/acp/session-list-info/regenerate.sh` against the new pin produced a patch
  whose listSessions body is the same rules. One new hunk: 0.73.0 moved
  `getSessionInfo` out of `acp-agent.js` (session-titles is the remaining
  caller), and the empty-transcript arbiter still needs it, so the regen
  restores the named import. `listSessions` and the module surface above the
  class are otherwise untouched. [#1052](https://github.com/agentclientprotocol/claude-agent-acp/issues/1052)
  is unanswered.
- **The two things that are NOT hunk context, checked rather than assumed.**
  `message.timestamp` is still an undocumented passthrough of
  `SessionMessage`. That type is byte-identical between 0.3.232 and 0.3.257
  — `{ type, uuid, session_id, message, parent_tool_use_id, parent_agent_id }`
  — and declares no `timestamp` in either. 0.3.257's four `timestamp?: string`
  declarations sit on the *streamed* types (`SDKAssistantMessage`,
  `SDKUserMessage`, `SDKUserMessageReplay`) and on `SessionStoreEntry`, and
  all four were already in 0.3.232. `getSessionMessages` still returns
  `SessionMessage[]`, so `facts.js`'s `Date.parse(message.timestamp ?? "")`
  is exactly as undocumented as it was at 0.70.0, and the `timestampLoss` /
  `sayTimestampLossOnce` guard this bump re-ships stays load-bearing.
  `getSessionInfo` is still exported. The pairing rules are unchanged —
  they live in `facts.js`, which this bump did not edit. The background-task
  vocabulary (`SDKTaskStarted/Updated/Notification/Progress`,
  `SDKBackgroundTasksChanged`) is still in that SDK.
- **The layer under the adapter.** The lockfile moves
  `@anthropic-ai/claude-agent-sdk` 0.3.232 → **0.3.257** and
  `@agentclientprotocol/sdk` 1.3.0 → **1.4.0** with the adapter.
- **What 0.73.0 opened that is inert here.** #1017's native subagents and AIR
  async tasks, plus `sessionCapabilities.subagents`, are gated on capabilities
  olai's Claude leg does not advertise (Codex has since PR #553). `claudeCodeMetaFromToolUse` kept `subagent: true`.
  #1065 (`a04d354`, in v0.72.0) replaces #958's settle heuristic with
  `user_message_uuid` attribution — the candidate cure this bump exists to
  ship; live verification is after deploy.

### What an AIR client gets from #1017 (2026-09-23)

**Measured against both 0.73.0 adapters, not inferred from the PR.** The
patched executable was built with `nix build .#claude-agent --no-link
--print-out-paths` (the old `.#acp-agent` alias is absent on this branch),
store output `8yb9hmwy46fkh320n4i2b1n562m2m95p-olai-acp-claude-0.73.0`.
Pristine was installed with `npm install --prefix
/tmp/air-measure-1017/pristine @agentclientprotocol/claude-agent-acp@0.73.0`.
Both drove the built pin's SDK Claude executable through
`CLAUDE_CODE_EXECUTABLE`, with self-updates disabled, so the CLI was held
constant. Each run used a separate scratch working directory, the driver's
unchanged prompts, `RAW=1`, and its full 45-second after-turn window.

**The handshake matters.** Sending the requested AIR object only in
`session/new._meta.jetbrains.air` produced **zero AIR notifications** in all
eight AIR-on controls. 0.73.0 reads
`initialize.clientCapabilities._meta.jetbrains.air`. The driver now puts
`{ version: 1, capabilities: ["nativeSubagentSessions", "asyncTasks"] }`
there as well as in `session/new`; this matches where olai's Codex path
actually negotiates. The table is the fresh sixteen-run matrix with that
correction: patched/pristine × monitor/bash/agent/resume × AIR off/on.
All sixteen runs authenticated, returned `end_turn` (twice for resume),
and completed the listening window with exit status 0.

Raw evidence is retained locally in `/tmp/air-measure-1017/`: each
`negotiated-<patched|pristine>-<KIND>-air<0|1>` has `.timeline`,
`.requests.ndjson`, `.wire.ndjson`, `.stderr` and `.exit` files. The initial
session-only controls have the same names without `negotiated-`.
`air0` means no AIR advertisement. The wire capture is untruncated, including
initialize replies and child-session text that the existing timeline does
not print. These are local scratch files, not portable links or fixtures.

| KIND | AIR channel, both adapters with AIR on | Patch's stamps / tool rows | Pristine without AIR |
|---|---|---|---|
| `monitor` | `async_task_spawned`: `asyncTaskId`, `name`, `taskType: "shell"`, `description`, `showInTranscript: false`, `canStop: true`. `async_task_progress` adds `toolCallId`. State updates: `stopped`, then `completed`, then completed metadata with `outputFilePath`; no `summary`. | AIR off/on: arming row stays `in_progress`; `backgroundTask` has `taskId`, `taskType: "local_bash"`, `description`, then `status: "completed"` and `summary: Monitor "tick watch" stream ended`. | No AIR or stamps; Monitor row completes at launch. SDK diagnostics still expose its later ending. |
| `bash` | Same spawn fields; progress carries `toolCallId` and `outputFilePath`. State updates: `stopped`, then `failed`; no exit-code `summary`. | AIR off/on: launch stays `in_progress`; same stamp fields, then `status: "failed"` and the harness's `…failed with exit code 3` summary. | No AIR or stamps; Bash row completes at launch, with no later failed tool-row update. |
| `agent` | `subagent_spawned`: `subagentSessionId`, `name`, `task`, `capabilities: {}`; `subagent_state_update`: same child id, `state: "completed"`. No `async_task_*`. Report text is `agent_message_chunk` on the child. | AIR off: async launch and terminal stamps on the Agent row, including the report as terminal `summary`. AIR on: no Agent control row or background-task stamps escape the native child routing. | Agent row completes at async launch. No task-notification user chunk in this run; SDK diagnostic summary contains the report. |
| `resume` | Two `subagent_spawned` / completed pairs: original child, then `<id>:generation:2`. Same fields as `agent`, no `asyncTaskId`, `toolCallId`, or explicit predecessor field. | AIR off: original synchronous Agent row reopens `in_progress` on the second outing and closes again, without background-task stamps. AIR on: un-stamped reopen/settle updates still escape on the original raw tool id, although its initial Agent row was suppressed. | Original row stays completed; SendMessage completes at delivery. No lifecycle update reopens the original row. |

**Failed background shell — no, AIR did not carry the exit-code sentence.**
In `negotiated-pristine-bash-air1`, task `bn08r2sev` launched at 2.7s,
its tool row completed at 2.7s, and AIR emitted `state: "stopped"` then
`state: "failed"` at 10.7s. Neither update has a `summary`. The subsequent
SDK `task_notification` says `Background command "Run sleep and exit 3 in
background" failed with exit code 3`. In `negotiated-patched-bash-air1`,
task `b7kwpxwgw` gets that sentence in the patch's terminal stamp while AIR
still omits it. This is a measured ordering limitation, not a claim that
AIR has no summary field: `async-tasks.js`'s `finish` ignores a later terminal
summary once an event, rather than a level reconciliation, settled the task.

**Resumed subagent — a new child generation, with no explicit AIR link.**
`negotiated-pristine-resume-air1` spawns `af632bdaa7bef5014` at 3.0s and
completes it at 5.1s; at 11.3s it spawns
`af632bdaa7bef5014:generation:2` and immediately completes that child.
The id string shares its prefix, but neither spawn names a predecessor or
spawning `toolCallId`, and no async task is emitted. The diagnostic SDK
frames prove continuity: both `task_started` frames use
`task_id: "af632bdaa7bef5014"`; the first names
`toolu_01U6U64u2CBSAmisABBbhFKC`, the second the SendMessage call
`toolu_01Psu8qSzEQxjWppyxupsfAw`. The second outing's SDK Bash result still
has the first call as `parent_tool_use_id`. In this run the second child's
Bash and `TWO` text are visible in SDK diagnostics but have no child-session
ACP transcript frames; the second spawn is only announced at settlement.
`negotiated-patched-resume-air1` has the same generation split and missing
second-child transcript. It additionally leaks the patch's reopen/settle
updates for `toolu_018kroFqu5F5t2t9jn32yDhB`, whose initial Agent row was
suppressed by native routing; no `backgroundTask` stamps accompany them.

**Async agent report — child-session prose, not a lifecycle summary.**
`negotiated-pristine-agent-air1` returns `async_launched` for
`a17eec2f9ab69c77a`. The full wire then carries
`sessionId: "a17eec2f9ab69c77a"`, `sessionUpdate: "agent_message_chunk"`,
`content.text: "ONE\n\n# Findings"`. The parent receives
`subagent_state_update` with `state: "completed"` at 14.9s and no report
field. No `<task-notification>` was forwarded as `user_message_chunk` in
this run (or its AIR-off control); the SDK delivered a system
`task_notification` with that report as `summary`. Thus this run does not
exercise suppression of a user-role XML report, and cannot establish that
the patch's XML handling is redundant.

**Child controls and launch completion.** Agent calls do produce native
children; their spawn advertises `capabilities: {}`, with neither child
`cancel` nor `close`. Initialize reports `sessionCapabilities.subagents: {}`;
its root-session `close: {}` is not a child close capability. These are
advertisements, not attempted cancellation/close operations. Pristine AIR-on
Monitor and Bash calls still complete at launch (for example the Bash call
above, eight seconds before failure). With native subagents negotiated, the
Agent control row is replaced by child lifecycle events rather than exposed
as a completed arming row.

**What this means for the switch.** AIR supplies shell lifecycle and native
child sessions, but these captures lose the shell's terminal summary and
represent a resumed agent as a new child generation. Child report prose and
patch terminal stamps are different channels. The Claude leg remains
unchanged. In `packages/plugins/chat/src/agent.ts`, `leg.nativeActivity`
creates `Activity` (around line 517), re-keys tool rows by session in
`onUpdate`, and installs the native stream reader (around line 1324);
`packages/plugins/chat/src/calls.ts` does the same for call facts (around
line 172). The Claude-only `parentToolUse` reader and the task-notification
`notice.onto.toolUseId` still carry raw tool-use ids. Flipping the leg changes
that identity boundary; the existing readers do not perform the corresponding
translation. This measurement changes no product ownership or lifetime.

### What the move to 0.81.2 found (2026-09-24)

**Both patches stay; the Claude leg still does not negotiate AIR.** Pristine
npm extracts of 0.73.0 and 0.81.2 were compared under
`/tmp/air-measure-1017/phase2/{old,new}`. The recursive `dist/` diff is
7,114 lines / 262 hunks; `acp-agent.js` alone is 4,346 lines / 139 hunks.
`dist-relevant.diff` records the search for `task_`, `backgroundTask`,
`liveBackgroundTasks`, `background_tasks_changed`, `asyncTasks`,
`listSessions`, `getSessionInfo`, and `getSessionMessages`. This is not an
empty lifecycle diff: async tasks gain optional notice support, the consumer
changes settlement bookkeeping for CLI 2.1.270's trailing idle, and replay
can receive already-loaded messages. None supplies the non-AIR tool-row
stamps, spawning-call reopen, XML report filing, or session-list facts that
these patches add. **No hunk was retired.**

- **Background tasks:** twelve of thirteen hunks applied at `-F0` with only
  line offsets. The session-state hunk moved into the initializer's new
  `try` block; its indentation changed by four spaces, beside
  `liveBackgroundTasks` and the native-subagent maps. Regenerated with
  `diff -u`; all 508 added lines are identical after removing indentation.
  The live consumer, terminal refinement, replay guard and tool-result
  ownership stay where they were logically. Both maps still belong to the
  session; no live dependency or lifetime moves across a package boundary.
- **Session list:** regenerated by
  `bash packages/plugins/claude/acp/session-list-info/regenerate.sh`.
  The import restoration and pairing/scanning code remain. Hunk positions
  and trailing context moved; two generated comments now spell the generator's
  current repository path. The fact rules were not edited.
- **Build:** `nix build .#claude-agent --no-link --print-out-paths` passed,
  applying both patches with `patch -p1 -F0`, without fuzz. The measured
  binary is `/nix/store/d02i9ls2qsbgy8p9j6l1mfag1k73hdq3-olai-acp-claude-0.81.2/bin/claude-agent-acp`.
  Its dependency hash was recomputed after retaining unrelated lockfile
  versions, including MCP SDK 1.30.0. The root Bun lock and `bun.nix` do not
  list this adapter and did not change. pi-acp's registry version remains
  0.0.33; its pin did not change.
- **The SDK underneath:** Claude Agent SDK **0.3.257 → 0.3.280**, ACP SDK
  **1.4.0 → 1.5.0**. All five declarations remain:
  `SDKTaskStartedMessage`, `SDKTaskUpdatedMessage`,
  `SDKTaskNotificationMessage`, `SDKTaskProgressMessage`,
  `SDKBackgroundTasksChangedMessage`. `task_updated.patch.status` still
  includes `completed`, `failed`, and `killed`; `task_notification` still
  declares `summary: string`. The latter adds `reason?: 'worker_restart'`;
  progress-summary and ambient-task comments also change. The streamed
  vocabulary did not disappear. The minified `SessionMessage` mapper still
  contains `timestamp:e.timestamp` (now followed by `...r&&{origin:r}`),
  while the declared `SessionMessage` still has no timestamp field.
  `getSessionInfo` remains exported. The undocumented timestamp dependency
  therefore remains, rather than becoming a declared guarantee.

**Eight real task runs**, all exit 0, authenticated, with the full 45-second
post-turn window and no RPC errors. Evidence is
`/tmp/air-measure-1017/bumped-<KIND>-air<0|1>.{timeline,wire.ndjson,requests.ndjson,stderr,exit}`.
Same prompts and capture method as phase 1; this time the built wrapper uses
its new SDK's Claude executable, not phase 1's held-constant CLI.

| KIND | AIR off: retained client behaviour | AIR on: change from phase 1 |
|---|---|---|
| `monitor` | `bula264ls`: launch `in_progress`, `{taskId, taskType: "local_bash", description}`; terminal `completed` refined with `Monitor "tick watch" stream ended`. | Same shell spawn/progress/state channel; terminal summary still absent. |
| `bash` | `bi7xqnwg4`: launch held, terminal `failed` refined with the harness's `…failed with exit code 3` sentence. | `bqy83efun`: `stopped` then `failed` at 11.1s, neither with `summary`; patch stamp beside AIR does carry the sentence. |
| `agent` | Async launch for `ae330740d50a3b914` stays `in_progress`, with `taskType: "local_agent"`, description and id; completed stamp's summary is `ONE\n\n# Findings`. | Native child `acc7cea9bfa65e0bb` carries that text as `agent_message_chunk`, followed by a completed child event without report content. No user-role task-notification XML appeared. |
| `resume` | Both SDK starts name `a47c25553d045b75a`; the second names SendMessage, while original Agent call `toolu_011KStUXqciBBgFD4nyYyxhf` reopens `in_progress` and settles again. The synchronous origin stays quiet, without launch stamps. | Child `a5be1cb35a7718ecb`, then `a5be1cb35a7718ecb:generation:2`; still no explicit predecessor or spawning-call field on the child event. No second-child ACP transcript; the patch still emits raw-id reopen/settle frames alongside native routing. |

**The XML report guard is preserved, but not exercised by the real CLI in
these runs.** The runtime emits a system `task_notification` summary instead.
`phase2/xml-report.mjs` separately checked the built `taskNotificationUpdate`
with six constructed inputs: explicit origin, human-origin exclusion,
origin-less wrapped fallback, embedded-wrapper exclusion, missing ids and
non-user messages. The real built `replaySessionHistory` was then called with
a constructed user-role report: its only output was a `tool_call_update`
containing `backgroundTask: { taskId: "task-1", report: "ONE\n\n# Findings" }`
on `spawn-1`, with zero `user_message_chunk`s. The live consumer retains the
same helper-and-break guard unchanged. This is compatibility-path testing,
not a claim that the live harness emitted XML it did not emit.

**Session list, from real stored history.** `phase2/session-list.ndjson` is a
read of `/tmp/cleartest`: predecessor
`145c623c-f45d-4829-b12b-3ab2249d78b9` has `messageCount: 3` and
`supersededBy: "bbd7be41-80d5-4149-897e-70cfa5f5eecc"`; that heir has
`messageCount: 4`. Nothing was fabricated or rewritten in that directory.

**Panel and steering.** `bash packages/tests/panel-live.sh` (from its
`packages/tests` working directory inside `nix develop .#e2e`) passed all
25 claims against the new binary in 30.2s; `phase2/panel-4.log` and
`phase2/panel-shots-4/` retain the output and screenshots. The driver needed
its obsolete chat-toggle and unassigned-list entry points replaced with the
current new-chat entry and the node's history after a fresh start. It waits
for the replacement session id before opening history. No product UI was
changed to satisfy the probe.
The issue #1039 reproduction was run with its essay, six-second steering
delay, and 240-second observation bound, varying only the earlier history
(and selecting bypass mode for the Monitor). Fresh: steer injected at
6.849s, prompt returned `end_turn` at 8.359s. Monitor-history: arm returned
at 7.418s, steer injected at 13.421s, prompt returned `end_turn` at 14.949s.
Both answered PINEAPPLE. Logs are `phase2/steer-{fresh,monitor}.log`.
The 0.81.2 column below records only these two measured cases; it does not
claim the queued-turn trigger or a controlled live/dead Monitor comparison
was retested. The chat plugin's guard is unchanged.

**Remote checks:** `just typecheck-fast-remote`, `just test-fast-remote`,
and `just e2e-fast-remote` all passed. The full browser run covered 1,905
scenarios / 22,698 steps, including Codex activity and steering. The first
unit run caught capture filenames using the repository's retired outline
suffix; the evidence now also has NDJSON-named copies and these references
use them. The extension guard was not relaxed. `just ci` was not run.

### The steering hang has a second trigger, and the guard does not cover it

**THE ONE PLACE THIS IS WRITTEN DOWN.** It is a fact about the pinned adapter,
so it lives with the pin; `packages/plugins/chat`'s `queuedHere` and
`packages/tests/panel-live.ts` each say what it costs THEM and point here for
the measurement. Six copies of one measurement is five that go stale at the
next bump.

`docs/chat.md` is the exception and deliberately so: it says what a person
SEES and how to recover, and KEEPS NO MEASUREMENT — so there is nothing there
to go stale. That is the same rule kept by having no copy rather than by
pointing at this one, and it is the whole of what the rule needs. (It does
cite this file, at the paragraph about what the wire carries; an earlier draft
of this sentence claimed it cited no source at all, which was false and is
exactly the kind of claim this section exists to stop.)

[claude-agent-acp#1039](https://github.com/agentclientprotocol/claude-agent-acp/issues/1039)
— a `_session/steering` into a session that has once held a QUEUED prompt
leaves that turn's `session/prompt` unanswered forever — is what olai's
`queuedHere` latch guards (`packages/plugins/chat/src/chat.ts`). Found while proving
the panel on this bump: **a session in which a turn armed a `Monitor` hangs
the same way, with nothing ever queued** — so the latch is still open and the
panel still offers the interruption that will hang it.

Measured with the issue's own reproduction script, varying only the session's
history before the steer. **What the script controls is the history TURN, not
the task's liveness**: it waits for the arming prompt to return, and a task
armed in that turn may or may not still be running when the steer lands. The
rows say which reading each one was taken under, because "a task is running"
and "a task once existed in this session" are different claims and only one of
them is what a latch would have to be shaped around.

| the session before the steer | 0.66.0 | 0.70.0 | pristine 0.70.0, patches lifted off | 0.81.2 (2026-09-24) |
|---|---|---|---|---|
| fresh, or four plain turns | settles | settles | — | settles (fresh only) |
| one turn that spawned a subagent | settles | settles | — | not remeasured |
| one turn that ran a background `Bash`, liveness uncontrolled | settles | settles | — | not remeasured |
| ...and one **still running** at the steer (`sleep 900`) | — | settles | — | not remeasured |
| one turn that armed a `Monitor`, liveness uncontrolled | **hangs** | **hangs** | **hangs** | settles |
| one queued turn (#1039 as filed) | **hangs** | **hangs** | — | not remeasured |

The still-running `Bash` row is not this lane's: it was measured in review
(pi, 2026-09-01) against the pinned store binary — the call visibly
`in_progress`, the steer landing 13.7s into the second turn, the steered
prompt settling `end_turn` at 15.3s. It matters because it is the row the
ruling actually needs: the negative holds on the liveness reading a latch
would be shaped around, not only on a finished task.

**STILL UNMEASURED, and it is the ruling's question rather than this PR's:**
the `Monitor` row under the same control — a watch that has DIED but was once
armed. `chat.ts`'s latch reads session-permanent; `docs/chat.md` describes the
live-watch case. Those are different guards, and which one the defect actually
needs is what nobody has measured yet.

The pristine column is the one that decides whose bug it is: **upstream's**,
and older than this pin — not the bump's and not these patches'. The
background-`Bash` row is why the latch was not simply widened to "a task was
armed": the trigger is narrower than that, and a guess at its shape would cost
the interruption in conversations that never needed to lose it. Widening it
changes what the panel OFFERS, which is a ruling rather than a bump; it is in
the human's queue.

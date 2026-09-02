# The patches this pin carries

## What the pin is for

Two patches apply to the pinned `@agentclientprotocol/claude-agent-acp`
0.73.0 — to its **compiled** `dist/acp-agent.js`, because npm is the only
channel the adapter ships through (`nix/acp-agent.nix` says why that pin is
npm-shaped), and one patch applies to the pinned `pi-acp` 0.0.33 — to its
**compiled** `dist/index.js`, the same reason. They are applied by that
derivation's `postInstall`, so every documented way of starting olai —
`nix run`, the packaged binary, `just serve`, `just run`, the e2e suite's
`OLAI_BIN` — gets the same agents.

---

# `pi-mcp-servers.patch` — the session pi-acp was handed its servers to

Route A of the host's MCP bridge (proposed and chosen in juspay/olai#422):
this pin is olai's own answer to *pi has no MCP client* — which is by
the harness's own design decision (its README says so in so many words),
not an accident to wait out upstream of anyone.

## What it patches, and what it never touches

pi-acp 0.0.33 (its `dist/index.js` was read, not guessed at):

- `session/new` *and* `session/load` receive the ACP request's
  `mcpServers` and **store them on the session** — and then the field is
  never read anywhere else in the file. The adapter *advertises its own
  empty piece of this answer*: `mcpCapabilities` in the `initialize`
  response answers `{ http: false, sse: false }` — which pi-acp never
  raises when something does answer.
- `PiRpcProcess.spawn` runs pi as `pi --mode rpc --no-themes`, one process
  per session, `env: process.env` — the whole injection seam, and one a
  patch can't spoil because it is so small.

The patch therefore has two halves, one small each:

1. **The spawn hands over what the request handed.** When the env wrapper
   (see `nix/acp-agent.nix`) armed `PI_ACP_MCP_EXTENSION` and the request
   came with `mcpServers` — both, never one — the spawn becomes
   `pi --mode rpc --no-themes -e <bridge>` and the child's env gains
   `PI_ACP_MCP_SERVERS`, the request's own JSON. No servers, no
   extension, no change: the unpinned wire stays the unpinned wire.
2. **`mcpCapabilities` answers the arming, not the adapter's boast.**
   `http`/`sse` are true when the env named a bridge, false when it named
   nothing — so a foreign `OLAI_ACP_PI` is asked the question it can
   answer rather than read off whatever this pin's README claimed.

## The bridge is the pin's own extension, not pi's file

The `-e` target is `acp/mcp-bridge/` installed alongside the pinned tree —
`extension.mjs`, **bundled by esbuild in the derivation** because pi loads
extensions through jiti from inside a bun-compiled binary whose module
resolution cannot trace a node_modules tree by the relative-URL discipline
the source file is written in. (The bare evidence: that loader reaches
`@modelcontextprotocol/sdk`'s `client/sse.js` and THEN cannot find
`eventsource`, which is right there — a bundled pi's embedded loader
questions are why the answer is one self-contained file, not the file the
reviewer reads.)

Inside the bridge:

- one SDK client per server, from `PI_ACP_MCP_SERVERS` — stdio entries by
  command, `http`/`sse` entries by url;
- every listed tool `pi.registerTool`ed as `${server}_${tool}`, the name
  olai's panel already reads (`olai_read_node`, `kolu_list_terminals`),
  with the MCP `inputSchema` converted to the TypeBox `pi.registerTool`
  demands (`naming.js`'s `schemaToTypebox`, the way its tests assert);
- a server that declines its attach says so in the transcript — spoken
  from `ctx.ui.notify` — a server's failure being ITS sentence, never a
  mute banner.

## Where its round trip is proven

- `bun test acp/mcp-bridge` — `roundtrip.test.js` crosses it over an
  in-memory pair with the real SDK: tools listed, registered under the
  panel's names, called through pi's own definitions, errors surfaced.
- The experiment this pin ships for is proven live in #422's evidence: a
  real pi, kimi-k3 answering, the `olai_*` / `kolu_*` rows in the
  transcript answering back.
- pi-acp upstream has no MCP wiring work as of this writing — the closest
  adjacent ask is svkozak/pi-acp#38 (extra CLI args), and the Bridge's
  shape stands on this pin until upstream chooses one (Route B stays
  gated, per this lane's instructions).

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
[`acp/session-list-info/`](../session-list-info/README.md): the patch is
GENERATED from that source (`bash acp/session-list-info/regenerate.sh`,
with the hunks computed by `diff -u` against the pristine npm extract — one
generation of hand-numbered hunks failed at `-F0` on the pristine corpus and
that was the argument). The suite in `facts.test.js` is why each rule below
is a claimed edge and not a hope. The patch remains diff-shaped because the
build must stay LOUD: `patch -p1 -F0` at `nix/acp-agent.nix:81-82` is what
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
a PR of it would be welcome. That issue is the whole of what has been done on
that repo on it — no branch, no PR — and it was opened on the human's own
narrow ratification, because acting on somebody else's repository is theirs to
allow and never this lane's to assume.

**`session-list-info.patch` — asked, not sent**:
[claude-agent-acp#1052](https://github.com/agentclientprotocol/claude-agent-acp/issues/1052),
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
   transplant is `acp/session-list-info/facts.js`, not the diff: run
   `bash acp/session-list-info/regenerate.sh` and the diff that follows
   is itself the sign the port is the same one the suite validated.

### What the move to 0.70.0 found (2026-09-01)

The first time this section was walked rather than promised. **Both patches
were RE-APPLIED and neither was retired**, and the evidence for that is what
follows — because "re-applied" is the answer a habit gives too.

- **`background-tasks-visible` is still needed.** Upstream PR #941 is still
  open, unmerged and unreviewed, and the whole 0.66.0→0.70.0 diff of
  `dist/acp-agent.js` (1572 lines, 81 hunks) contains **no line at all**
  matching `task_`, `backgroundTask`, `liveBackgroundTasks` or
  `background_tasks_changed`: the lifecycle this patch is about was not
  touched. Nine of its ten hunks re-applied at `-F0` with their context
  unchanged; the tenth is the helper block, whose TRAILING context moved
  because 0.70.0 inserts a session-failure controller between `sendUpdate`
  and `resetTurnScratch`. Re-anchored there and regenerated by `diff -u`, so
  the patch's added lines are byte-identical to the ones the reviews passed.
- **`session-list-info` is still needed.** `bash
  acp/session-list-info/regenerate.sh` against the new pin produced a patch
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

- **`background-tasks-visible` is still needed.** Upstream PR #941 is still
  open. 0.71.0 landed [PR
  #1017](https://github.com/agentclientprotocol/claude-agent-acp/pull/1017)
  (`14d192d`) — native subagents and AIR async tasks — which is **not** this
  patch absorbed. That work publishes a Monitor / background Bash / workflow
  lifecycle only to a client that advertised the `asyncTasks` AIR capability;
  olai does not, and the 0.73.0 dist says so in so many words
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
  is still unanswered.
- **`session-list-info` is still needed.** `bash
  acp/session-list-info/regenerate.sh` against the new pin produced a patch
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
  olai does not advertise. `claudeCodeMetaFromToolUse` kept `subagent: true`.
  #1065 (`a04d354`, in v0.72.0) replaces #958's settle heuristic with
  `user_message_uuid` attribution — the candidate cure this bump exists to
  ship; live verification is after deploy.

### The steering hang has a second trigger, and the guard does not cover it

**THE ONE PLACE THIS IS WRITTEN DOWN.** It is a fact about the pinned adapter,
so it lives with the pin; `packages/chat`'s `queuedHere` and
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
`queuedHere` latch guards (`packages/chat/src/chat.ts`). Found while proving
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

| the session before the steer | 0.66.0 | 0.70.0 | pristine 0.70.0, patches lifted off |
|---|---|---|---|
| fresh, or four plain turns | settles | settles | — |
| one turn that spawned a subagent | settles | settles | — |
| one turn that ran a background `Bash`, liveness uncontrolled | settles | settles | — |
| ...and one **still running** at the steer (`sleep 900`) | — | settles | — |
| one turn that armed a `Monitor`, liveness uncontrolled | **hangs** | **hangs** | **hangs** |
| one queued turn (#1039 as filed) | **hangs** | **hangs** | — |

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

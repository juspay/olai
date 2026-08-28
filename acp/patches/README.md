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
  one agent is a strip that counts two of everybody. It says NOTHING about
  arming in either direction: `backgroundTask` is what a launch says about
  itself, a resume registers nothing new, and the settle of a reopened call
  drops the stamp accordingly — so a client's reading of the launch stays
  exactly as true as the launch made it. `taskOrigins` is the one record here
  that survives a settle, because it is what says a task starting again is an
  old call going round again rather than a new one; it is one pair of ids per
  task the session ever started, the order of memory `toolUseCache` already
  keeps per call.
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
literal, and in the SDK-message switch's `task_*` cases (the `task_started`
case now decides between reopening and registering); the anchors in `session-list-info.patch` are
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

/**
 * What the Claude Code adapter MEANS by what it sends — olai's first leg
 * ({@link ./leg.ts}), meaning unchanged from the day it was the only one.
 *
 * This is the part of {@link ../agent.ts} that would be wrong if somebody
 * pointed olai at a different agent: a `_meta` extension one adapter writes, a
 * tool-naming convention one CLI uses, a message one wrapper forwards because
 * we asked it to. The protocol proper is read where it is spoken; the VALUES
 * that are only true of THIS agent are read here, which is what made adding a
 * second one ({@link ./opencode.ts}) a file rather than a search for the
 * assumptions.
 *
 * Every bet is safe to lose in one direction only, and that is the direction it
 * loses in: an agent that says none of this matches nothing here, and what
 * happens then is that a person is asked. **Nothing is ever approved by failing
 * to recognise it.**
 *
 * Everything is a PURE function over a payload — `@olai/acp`'s pattern, for
 * the reason that pattern exists: the rule that stops this panel approving
 * its own permissions is a function with unit tests rather than a branch
 * reachable only by starting a subprocess and talking it into asking. Which
 * side of that package boundary a new reader belongs on is not which payload
 * it reads but WHO has to have sent it: `@olai/acp` reads the protocol's own
 * shapes, true of any agent — which is why it is a package and this is not —
 * and this is the file that is wrong about a different one.
 *
 * What is NOT here, and cannot be: the things `agent.ts` assumes this adapter
 * DOES rather than says — that a `tool_call` is announced before the permission
 * request that references it, and that `session/list` answers by cwd prefix
 * rather than exactly. Those are shapes of the conversation rather than values
 * in a payload, and they are named where they are relied on. The MODEL PICKER
 * is not here either, and that is a move rather than an omission: both agents
 * put the model in ACP's own `configOptions`, so reading one is
 * {@link ./models.ts}'s.
 */

import type { PermissionOption } from "@agentclientprotocol/sdk"

import {
  allowingOurs,
  type Background,
  type Leg,
  type ListedFacts,
  type Meta,
  type Reported,
  type Spawn,
  type TaskNotice,
} from "./leg.ts"

// ── which permissions are answered without asking ──────────────────────

/** The permission mode a session is asked for, in the adapter's own
 *  vocabulary: ACP leaves mode ids to the agent, and this is what the Claude
 *  Code adapter calls the one that stops it asking about tools it has been told
 *  are allowed. An agent with no such mode refuses the request, which costs a
 *  round trip per tool call and nothing else — {@link allowedWithoutAsking} is
 *  the backstop either way, and is why a refusal is not a boot failure. */
export const BYPASS_MODE = "bypassPermissions"

/**
 * The option a permission request is answered with WITHOUT asking a person, or
 * `null` when it is a person's to answer.
 *
 * Bypass mode is the design (resolved 2026-08-09), so a call to one of the MCP
 * servers WE handed this session — olai's mediated ops, plus whatever optional
 * server answered this session's probe — is
 * allowed immediately: those tools are already mediated and already validated,
 * and a click per write is not a permission model. The adapter usually never
 * asks about them at all, having been asked for `bypassPermissions`; this is
 * the path for a session whose bypass request was refused.
 *
 * Everything else is a person's, and THAT direction is the load-bearing one.
 * The adapter maps plan mode's "Ready to code?" onto a permission request whose
 * first allow-flavoured option switches the session to `auto` — so a client
 * that answered every request with the first allow it found was silently saying
 * "yes, and stop asking me" on somebody's behalf, every time. The rule is
 * POSITIVE RECOGNITION: the tool is named, and the name is one of ours, or
 * nothing is bypassed.
 *
 * `mcp__<server>__<tool>` is the Claude Code CLI's own naming for the tools an
 * MCP server contributes, and reading it is a bet on that adapter exactly as
 * {@link toolNameIn} is. An agent that names its MCP tools some other way
 * matches nothing here and every request goes to a person, which is the losing
 * direction this can afford.
 *
 * @param tool the programmatic name of the tool being asked about, or `null`
 *   when nothing named it — a name we do not know is answered by ASKING
 * @param given the MCP servers this conversation was handed, by name
 * @param options the request's own options, in the agent's own order
 */
export const allowedWithoutAsking = allowingOurs((server) => `mcp__${server}__`)

// ── which tool a call is ───────────────────────────────────────────────

/**
 * The programmatic name of a tool, out of a `_meta` the Claude Code adapter
 * puts it in.
 *
 * Read out of an agent-specific `_meta` extension because the protocol proper
 * does not carry it where it is needed: a
 * `session/request_permission` describes the call it is about with a DISPLAY
 * title, and "which tool is this" is the question the answer turns on. Every
 * `tool_call` the adapter emits carries the name here, and the adapter emits
 * one before it asks — so the pair is enough.
 *
 * An agent that is not that adapter says nothing here, and nothing here guesses
 * on its behalf: an unknown tool is one a person is asked about.
 */
export const toolNameIn = (meta: Meta): string | null => stringIn(meta, "toolName")

// ── which agent made a call ────────────────────────────────────────────

/**
 * The Agent call a tool call was made INSIDE — by the id of the `Agent`/`Task`
 * call that spawned the subagent — or `null` for a call the main agent made
 * itself.
 *
 * The second thing read out of that `_meta`, and it is there for the same
 * reason the first one is: the protocol proper carries no notion of WHO made a
 * call. Every `tool_call` arrives on one flat feed, so a subagent's `Bash` and
 * the main agent's `Bash` are the same frame with the same shape — and a panel
 * drawing them in one column is saying something false about the conversation,
 * namely that one agent did all of it.
 *
 * The adapter knows better, and says so: it keeps a registry of the tasks it
 * has seen start (`liveBackgroundTasks`, keyed by the subagent's own agent id)
 * and stamps the spawning call's id onto every frame that comes out of one —
 * the streamed `tool_call`, the `tool_call_update` that completes it, the
 * permission request in between.
 *
 * A frame that says nothing here is the main agent's own, which is the losing
 * direction this can afford: an agent that is not that adapter has no
 * subagents as far as this panel is concerned, and the transcript looks exactly
 * as it did before anything was read.
 */
export const parentToolUseIn = (meta: Meta): string | null =>
  stringIn(meta, "parentToolUseId")

// ── which call STARTED an agent ────────────────────────────────────────

/**
 * What this frame says about an agent this call STARTED, or `null` for a frame
 * that says nothing about one — which is nearly all of them.
 *
 * The other side of {@link parentToolUseIn}, and the half that was missing: the
 * parent stamp says a call CAME OUT of a subagent, which is a thing nothing can
 * say until the subagent has made a call. A spawned agent that is still reading
 * its instructions has made none, so a panel with only that stamp to read has
 * nothing at all to draw for the agent it is waiting on — the reader sees a
 * pending row with an ordinary title and no reason to think anybody was sent
 * anywhere.
 *
 * TWO FIELDS, AND ONE OF THEM IS A GATE:
 *
 *   - **the spawn's own flag.** The adapter stamps `subagent: true` beside the
 *     tool name on every frame it builds for an `Agent`/`Task` call
 *     (`claudeCodeMetaFromToolUse`, adapter 0.70.0), and that frame is emitted
 *     when the tool use starts — so it arrives at the moment the agent is sent
 *     out rather than at the moment it reports back. The FLAG rather than the
 *     tool NAME, which the same corner also carries: the name is a word one
 *     CLI's tool table happens to use, and the adapter maps two of them onto
 *     this one boolean. Reading the boolean is reading the adapter's own answer
 *     instead of re-deriving it from a list that is somebody else's to extend.
 *   - **the call's own INPUT.** `subagent_type` is a field of the `Agent`
 *     tool's arguments (the SDK's `AgentInput`), so it rides the `rawInput` of
 *     the frame that announces the spawn — the first thing anybody hears about
 *     the agent. It is optional there: a spawn that named no kind has none.
 *
 * WHAT IS DELIBERATELY NOT READ, and this is the important half, because it is
 * the reading a future reader will find in the payload and re-add:
 * `toolResponse.subagentType`. The adapter's `tool_progress` forwarding really
 * does put an Agent call's kind there while the call runs, and reading it
 * looked like free redundancy. It is not free, because `_meta.claudeCode
 * .toolResponse` is not one thing: on the `tool_progress` path the adapter
 * builds it, and on the PostToolUse path it forwards **the tool's own response
 * object, verbatim, for any tool** (`onPostToolUseHook`, which spreads
 * `toolResponse` straight into the `_meta` of a `tool_call_update`). So that
 * field is reachable by anything a session can call — an MCP server olai never
 * handed this conversation has only to answer with a `subagentType` in its
 * structured output to be drawn as an agent somebody spawned, with a live rail
 * under it. Gating it on the flag would not save it either: the beat frames
 * carry no flag, so a gate makes the read dead.
 *
 * And nothing is lost by dropping it. The kind rides the arguments of the
 * flagged frame that announces the spawn and of the flagged one that refines
 * it, and the transcript holds it sticky from there
 * ({@link ./transcript.ts}) — so by the time any beat could speak, the answer
 * is already on the row. The only case a beat could have answered alone is a
 * spawn whose arguments never named a kind, and a task with no `subagent_type`
 * in its input has none to report in a beat either.
 *
 * NOTHING IS ACCUMULATED HERE. The input arrives incrementally — the adapter
 * emits the `tool_call` as the tool use starts and refines it with a
 * `tool_call_update` as the arguments finish parsing — and the flag, the kind
 * and the completion land on different frames. So a frame answers about the
 * frame: `{}` is an honest "a spawn, and nobody has said which kind", and an
 * absent `kind` reads as "unchanged" to the one thing that holds a row together
 * across frames ({@link ./transcript.ts}), which is the rule every other field
 * on a tool row already follows.
 *
 * Structural rather than `@olai/surface`'s `Spawned`, which is what a caller
 * assigns this to: everything in this file is a pure function over a payload
 * and none of them knows what a transcript is.
 */
export const spawnedIn = (meta: Meta, input: unknown): Spawn | null => {
  // THE FLAG IS THE ONLY THING THAT OPENS THIS DOOR — except the report, which
  // arrives on a later frame that is not the spawn's announcement. An async
  // agent's completion is stamped `subagentReport` onto the spawning call
  // (`acp/patches/README.md`) without repeating `subagent: true`, and requiring
  // the flag there would drop the one place those words are allowed to live.
  const report = wordIn(claudeIn(meta), "subagentReport")
  if (claudeIn(meta)?.["subagent"] !== true) {
    return report === null ? null : { report }
  }
  // ... and then the kind, off the `Agent` tool's own arguments. `rawInput` is
  // the tool's payload rather than the adapter's word, which is exactly why it
  // may not be read on its own: `subagent_type` is a name ONE tool gives one
  // of its arguments, the tools on a session are not a closed set, and an MCP
  // server olai never handed this conversation is free to take an argument by
  // that name. Requiring the flag costs nothing — the adapter builds both into
  // the same frames (`claudeCodeMetaFromToolUse` rides every announcement and
  // every refinement of an Agent call).
  const args = input as
    | { readonly subagent_type?: unknown; readonly description?: unknown }
    | null
    | undefined
  const asked = args?.subagent_type
  // ... and WHAT IT WAS SENT TO DO, out of the same arguments and through the
  // same gate. The `Agent` tool takes a short description beside the prompt,
  // and it is the only thing anywhere that tells one agent of a fan-out from
  // another: the call's TITLE is the tool's name, so four agents dispatched in
  // one message reach a panel as four rows reading `Task`. That was survivable
  // while a subagent's work was drawn under the row that spawned it — you read
  // downwards and found out — and it stopped being survivable when the work
  // moved onto a strip and behind a door, because the strip is then a row of
  // four identical buttons.
  //
  // Read here rather than left to the row's title for the reason the title
  // cannot be moved: it is PINNED at the first frame that carries one
  // ({@link ../transcript.ts}'s `#named`), deliberately, so that a call cannot
  // rename itself twice while somebody is reading it.
  const said = args?.description
  return {
    ...(typeof asked === "string" && asked !== "" ? { kind: asked } : {}),
    ...(typeof said === "string" && said !== "" ? { said } : {}),
    ...(report === null ? {} : { report }),
  }
}

// ── a task-notification is not a person speaking ───────────────────────

/**
 * Whether this user-message text is a harness-injected task-notification,
 * and if so the spawning call it belongs to and the report it carries.
 *
 * TWO DOORS, either enough:
 *
 *   - **`origin.kind: "task-notification"`** in `_meta.claudeCode` — the
 *     discriminator the session JSONL already stamps, forwarded onto ACP
 *     when the adapter keeps the chunk (or when a fixture stamps it);
 *   - **the `<task-notification>` wrapper** — what the injected user turn
 *     actually contains, and what arrives on ACP when the adapter forwards
 *     the message without the origin.
 *
 * A payload that is neither is `null`, which is a person speaking. A
 * payload that is one but names no `tool-use-id` is still a notification
 * (`toolUseId` empty): it must not become a user bubble, and it has no
 * row to file the report under.
 */
export const taskNotificationIn = (text: string, meta: Meta): TaskNotice | null => {
  const kind = wordIn(fieldIn(claudeIn(meta), "origin"), "kind")
  const xml = text.trim()
  const wrapped = xml.startsWith("<task-notification>") && xml.includes("</task-notification>")
  if (kind !== "task-notification" && !wrapped) return null
  const toolUseId = (xml.match(/<tool-use-id>([^<]*)<\/tool-use-id>/u)?.[1] ?? "").trim()
  const result = xml.match(/<result>([\s\S]*)<\/result>/u)?.[1] ?? ""
  return { toolUseId, result }
}

// ── which call ARMED A BACKGROUND TASK ─────────────────────────────────

/**
 * What this frame says about a background task this call armed, or `null` for
 * a frame that says nothing about one — which is nearly every frame.
 *
 * THE THIRD READING of that same `_meta` corner, and the one that is not in
 * the adapter as it ships: `_meta.claudeCode.backgroundTask` is written by the
 * patch olai carries on its pin (`acp/patches/README.md`), which is PR #941's
 * approach extended to every task the harness registers. Without it the wire
 * says a `Monitor` COMPLETED at the instant it started — the acknowledgement
 * read as the result — so an armed watch and a finished one are the same row,
 * and the death that a person supervising off a monitor must not miss is on no
 * frame at all.
 *
 * ONE FIELD, READ WHOLE. Unlike {@link spawnedIn} there is no gate-plus-input
 * pair to assemble here, and that is the point of reading this corner rather
 * than the tool's own answer: `taskId` is a name the `Monitor` tool gives one
 * of ITS results and `backgroundTaskId` is what `Bash` gives one of its own,
 * so a reader that trusted either off a `rawOutput` would arm a live face on
 * any MCP server that answered with a field by that name. The adapter is the
 * thing that knows a task was registered, and this reads its answer.
 *
 * WHAT EACH FRAME SAYS is deliberately partial, and the union of them is never
 * assembled here: the arming frame names the task, its kind and the description
 * it was armed with; the settling frame names the task and how it ENDED. A
 * frame answers about itself, an absent field reads as "unchanged", and
 * {@link ../transcript.ts} is what holds the row together — which is the rule
 * every other field on a tool row already follows.
 *
 * An agent that is not this adapter says nothing here and gets nothing: its
 * background work is drawn exactly as it was, as a call that completed at the
 * moment it started, which is the losing direction this bet is safe in.
 */
export const backgroundTaskIn = (meta: Meta): Background | null => {
  const said = claudeIn(meta)?.["backgroundTask"]
  if (typeof said !== "object" || said === null) return null
  const task = said as { readonly [field: string]: unknown }
  const id = wordIn(task, "taskId")
  // NO TASK ID, NO TASK. The id is the one field every frame about a task
  // carries, and a row that armed something nobody can name is not a fact
  // worth drawing a live face out of.
  if (id === null) return null
  const description = wordIn(task, "description")
  // HOW IT ENDED, in the harness's own word — `completed`, `failed`,
  // `killed`, `stopped`. ACP folds the last three into one status, and a
  // monitor somebody STOPPED is not a monitor that failed, so the word
  // travels beside the status rather than being re-derived from it.
  const ended = wordIn(task, "status")
  return {
    task: id,
    ...(description === null ? {} : { description }),
    ...(ended === null ? {} : { ended }),
  }
}

/*
 * What is deliberately NOT read off a background task, for the reason nothing
 * else here is read without a reader: **`taskType`**, the harness's own kind.
 * It is on the frame — the patch stamps what `task_started` said, which is
 * #865's own proposal shape — and it says `local_bash` for a `Monitor` and for
 * a background shell alike, so it cannot tell a person which kind of thing is
 * out. What can is the DESCRIPTION, which is what a person armed the task
 * with. A field carried onto a row that nothing draws is a field that is wrong
 * the first time somebody draws it.
 */

/*
 * What is deliberately NOT read off a spawn, and why, because the next person
 * to open this file will find it in the payload and wonder:
 *
 *   - **`toolResponse.elapsedTimeSeconds`**, which the heartbeat carries. It is
 *     the agent's own clock and it is honest, but it only moves when a beat
 *     arrives — so a subagent that has actually WEDGED reports the age it had
 *     at its last beat, forever. A number that under-states how long something
 *     has been stuck is worse in exactly the direction a person consults it
 *     for, and the panel already says the true thing (it is running, and here
 *     is every call it has made) without one.
 *   - **`toolResponse.subagentRetry`**, the SDK's rate-limit retry counters,
 *     forwarded so a client can say why a spawn looks stalled. Worth drawing
 *     one day; it is a shape nothing in this repo has ever seen arrive, and a
 *     row that renders a payload nobody has observed is a row that is wrong the
 *     first time it is right.
 *   - **the subagent's own PROSE**. The adapter strips a subagent's text and
 *     thinking blocks from the feed unless the client declares
 *     `subagent-transcript` in its `initialize` capabilities
 *     (`supportsSubagentTranscript`) — so olai, which does not, cannot receive
 *     it and cannot have it leak into the main agent's voice either. Drawing a
 *     subagent's narration is a feature with a switch to throw, not a `_meta`
 *     to read, and it is not this one.
 */

/** One OBJECT-valued field of an object, or `undefined` for anything else — a
 *  missing field, a field of some other type, a value that is not an object at
 *  all.
 *
 *  The whole of the narrowing every reader in this file does, written once:
 *  everything read here is nested somewhere inside somebody else's payload, and
 *  each level of the nesting is a place a shape can change under us. `_meta`,
 *  `claudeCode` and a handshake's capabilities are all the same step. */
const fieldIn = (
  value: unknown,
  field: string,
): { readonly [key: string]: unknown } | undefined => {
  if (typeof value !== "object" || value === null) return undefined
  const found = (value as { readonly [key: string]: unknown })[field]
  return typeof found === "object" && found !== null
    ? found as { readonly [key: string]: unknown }
    : undefined
}

/** ... and the one field of it every advertisement hangs off. Named because
 *  `_meta` is the protocol's own word for "an extension said something here",
 *  and both handshake readers start by asking for one. */
const metaOf = (value: unknown) => fieldIn(value, "_meta")

/** The adapter's own corner of a `_meta`, or `undefined` when there is none —
 *  an absent `_meta`, an absent `claudeCode`, one that is not an object. Every
 *  reader here starts by asking for it, and it is {@link fieldIn} under the one
 *  name this file reads everything out of. */
const claudeIn = (meta: Meta) => fieldIn(meta, "claudeCode")

/** One field of that corner, when it is a non-empty string and `null` for
 *  everything else — a field of some other type, the empty string. The two
 *  readers above are the same narrowing over two names, and a frame carries
 *  either, both or neither: a subagent's terminal output arrives with a
 *  `claudeCode` holding only the parent, and a plan exit's with only the
 *  name. */
const stringIn = (meta: Meta, field: string): string | null =>
  wordIn(claudeIn(meta), field)

/** ... over any record, which is the half {@link backgroundTaskIn} needs: its
 *  fields are a level deeper than the corner above, and re-spelling the
 *  narrowing there made it the fourth copy of a rule this file already names. */
const wordIn = (
  said: { readonly [field: string]: unknown } | undefined,
  field: string,
): string | null => {
  const value = said?.[field]
  return typeof value === "string" && value !== "" ? value : null
}

// ── what `session/list` says about one conversation ────────────────────

/**
 * What the adapter's `session/list` says about ONE conversation beyond the
 * protocol's four fields — how many messages it holds, and which session's
 * clearing produced the one listed — out of the entry's own `_meta.claudeCode`.
 *
 * The SECOND reading of this corner that comes from the patch olai carries on
 * its pin (the first is {@link backgroundTaskIn}): that the list has anything
 * more to say at all is the patch's own news (`acp/patches/README.md`),
 * because ACP's `SessionInfo` answers `{sessionId, cwd, title, updatedAt}`
 * and stops, and the picker's per-row count and `superseded by` pair had
 * nothing to read ({@link ../events.ts}'s `Stored` is where the two land).
 *
 * Each fact is said for itself, the way the patch attaches it: an entry whose
 * transcript never yielded a count still has every protocol field, and an
 * absent `supersededBy` is a conversation nothing replaced. So the answer is
 * `null` for a corner saying nothing, and `null` per field inside it — the
 * corners between (a count and no link) being the ordinary case of them all.
 */
export const listedIn = (meta: Meta): ListedFacts | null => {
  const said = claudeIn(meta)
  const supersededBy = wordIn(said, "supersededBy")
  const count = said?.["messageCount"]
  // The count is one the adapter reports or it is NOTHING at all: a fraction
  // like 3.5 is forfeited with the same weight as a string — a row drawing
  // `3.5 messages` (the review's catch) is the stamp announcing a reader
  // that trusted anything with a decimal point, which is the other side of
  // what the strict `=== 3` case in the test exists to pin.
  const messageCount = typeof count === "number" && Number.isInteger(count) && count >= 0
    ? count
    : null
  return messageCount === null && supersededBy === null
    ? null
    : { messageCount, supersededBy }
}

// ── what the adapter says it can do, at the handshake ──────────────────

/**
 * Whether this agent HOLDS a prompt sent while it is busy, out of what it
 * advertised at `initialize`.
 *
 * THE BIT THE DEFAULT RESTS ON. Core ACP's schema has no such capability — it
 * neither defines nor forbids a mid-turn `session/prompt` — so what happens to
 * one is a fact about the agent, and this adapter volunteers it: a `turnQueue`
 * FIFO, in order, said in `agentCapabilities._meta`. Verified on the wire
 * (2026-08-24): a prompt sent 1.5s into a 35-second `/compact` waited, the
 * compaction completed, and the message ran after it.
 *
 * It gates NOTHING about delivery — every send is a plain prompt, on this wire
 * and on the other one, because there is nowhere else for a message to go that
 * is not the queue #194 deleted. What it gates is what the composer may PROMISE
 * about an agent that is working ({@link ./leg.ts}'s `queues`).
 *
 * Read POSITIVELY, like everything else here: an agent that says nothing is one
 * this panel makes no promise for, which is the direction this is safe to lose
 * in.
 */
export const QUEUES_WHEN_BUSY = (initialized: unknown): boolean =>
  claudeIn(metaOf(fieldIn(initialized, "agentCapabilities")))?.["promptQueueing"] === true

// ── steering a turn that is already running ────────────────────────────

/**
 * The request that puts a message INTO the turn already in flight, rather than
 * behind it.
 *
 * A `session/prompt` sent while a turn runs is not this, and that is now the
 * ORDINARY path rather than the fallback: the adapter enqueues it and the agent
 * reaches it when the running turn is over ({@link QUEUES_WHEN_BUSY}). This one
 * is delivered at the SDK's `now` priority — it pre-empts the current
 * generation and lands between the turn's own steps — so what a person typed
 * reaches the model that is working.
 *
 * PRE-EMPTING MEANS ABORTING, which is why it stopped being the default: the
 * interrupted cycle is torn down, and a turn whose work cannot survive being
 * torn down loses it. `/compact` is exactly such a turn — the human's
 * screenshot is `Compacting failed: API Error: Request was aborted` under a
 * message that only meant to be next in line. So interruption is a gesture
 * somebody makes on purpose now, and this is the request behind it.
 *
 * An EXTENSION, hence the leading underscore, and named for the agreed ACP
 * steering wire protocol rather than for one adapter — but it is read here
 * with everything else that is a bet on the agent, because a bet it is. The
 * losing direction is the safe one and is the only one it loses in: an agent
 * without this refuses the method, which is a refusal a caller already has to
 * handle (a dead pipe, a deadline) and which reaches a person as the row
 * keeping their words.
 */
export const STEER_METHOD = "_session/steering"

/**
 * Whether this agent SAID it takes one, out of the handshake — in a top-level
 * `_meta`, beside `agentCapabilities` rather than inside it, which is where the
 * steering extension's own contract puts it.
 *
 * WHAT CHANGED, and it is worth spelling out because this file used to argue
 * the other way. While every mid-turn send was a steer, reading the
 * advertisement would have been predicting what the request was about to prove:
 * the message was going out regardless, and an agent that refused the method
 * answered for itself. Now the advertisement decides whether a person is
 * offered an INTERRUPT at all — a control has to be drawn before anybody can
 * press it, and the only honest input to that is what the agent said about
 * itself. The request is still the proof: a steer that goes out and is refused
 * still comes back as the row keeping its words.
 *
 * Read POSITIVELY. An agent that says nothing gets no button, and its person
 * loses nothing but the interruption — what they type still goes, still at
 * once, and the agent still gets to it.
 */
export const STEERING_ADVERTISED = (initialized: unknown): boolean =>
  (metaOf(initialized)?.["steering"] as { readonly supported?: unknown } | undefined)
    ?.supported === true

/**
 * How a steer that found NOTHING RUNNING should behave, in the request's own
 * `_meta`.
 *
 * The default is for the agent to start a fresh turn of its own, detached —
 * which would be a turn olai never asked for, never tracked and could not
 * cancel, reporting through the transcript from nowhere. `promptRequired`
 * hands the message BACK instead ("nothing to steer; send it yourself"), which
 * is the only outcome a client that owns its turns can use. Olai only steers
 * while it believes a turn is running, so this is the answer to the race
 * rather than the ordinary path: the adapter settled while the send was on its
 * way, and it says so instead of inventing a turn.
 */
export const STEER_WHEN_IDLE = {
  steering: { idleBehavior: "promptRequired" },
}

/**
 * How long a steer may go unanswered before the words go back to the person
 * who typed them.
 *
 * HERE and not beside the transport's other deadlines, because its warrant is
 * a claim about this extension rather than about a pipe. `boot` and `load` are
 * bounded on "the process did not answer", which is true of any agent; this
 * one rests on what the adapter DOES with a steer — it answers as soon as the
 * message is on the SDK's input, long before the turn does anything with it —
 * so silence past this is not a slow turn but an agent that stopped listening.
 * An agent that answered steers late would be one file's problem, and this is
 * the file.
 *
 * A prompt, by contrast, gets no deadline at all: that one really is a person
 * waiting on a language model.
 */
export const STEER_TIMEOUT = "30 seconds"

/**
 * Whether the steer went INTO the running turn, out of what the agent
 * answered.
 *
 * Read POSITIVELY, and this is the one reading here whose losing direction is
 * worth spelling out because it is not the usual one. `injected` is the only
 * outcome that counts as taken; `promptRequired`, a legacy `startedNewTurn`,
 * and anything a future version of the extension answers all read as NOT
 * taken, which sends the message again as an ordinary prompt. The worst case
 * of that is a message the agent hears twice; the worst case of reading an
 * unknown outcome as taken is a message nobody has, and between a duplicate
 * and a disappearance there is no contest.
 *
 * Here rather than at the call site for the reason {@link liveModelIn} is: it
 * is a value one adapter's extension chose, and the file that is wrong about a
 * different agent should be the file that names it. The REQUEST's spellings
 * are already above; leaving the RESPONSE's in the caller was the same bet
 * read in two places.
 */
export const steerTaken = (answered: unknown): boolean =>
  (answered as { readonly outcome?: unknown } | null | undefined)?.outcome === "injected"

// ── which model a turn is running on ───────────────────────────────────

/** What OPENING a session asks the Claude Code adapter to forward, and why: the
 *  adapter handles a `/model` slash command inside the wrapped CLI, so it never
 *  sees a config change and its `configOptions` keep naming the model the
 *  session started on. The CLI's own `system`/`init` message carries the live
 *  one. An agent that is not that adapter ignores `_meta` and nothing changes —
 *  the config option is still read, and still enough.
 *
 *  Sent with `session/load` as well as `session/new`, and that is not
 *  belt-and-braces: the adapter reads this off the `_meta` of whichever call
 *  made the session, and a load makes one (`loadSession` hands its own `_meta`
 *  to `createSession`, defaulting the flag to false). Asked only at `new`, the
 *  running model went unreported for the life of every RESTORED conversation —
 *  which is every conversation after a restart, and exactly the ones the panel
 *  now has to hear a `/model` in ({@link ../memory.ts}). */
export const OPEN_SESSION_META = {
  claudeCode: {
    emitRawSDKMessages: [{ type: "system", subtype: "init" }],
  },
}

/** The notification the Claude Code adapter forwards its wrapped CLI's own
 *  messages under, having been asked to by {@link OPEN_SESSION_META}. */
export const SDK_MESSAGE = "_claude/sdkMessage"

/**
 * The model a turn is actually running on, out of the CLI message the adapter
 * forwarded.
 *
 * TWO fields of one message kind are read, and this is one of them
 * ({@link liveServersIn} is the other). Everything else `init` carries — the
 * tool list, the permission mode, the slash commands, the CLI version — is
 * learned from the protocol proper or not at all, because a panel that believed
 * a wrapped CLI's private message about any of it would be reading around the
 * protocol it speaks.
 */
export const liveModelIn = (params: unknown): string | null => {
  const model = initIn(params)?.["model"]
  return typeof model === "string" && model !== "" ? model : null
}

/**
 * ... and what the CLI says about its connection to each MCP server of this
 * conversation.
 *
 * THE SECOND FIELD READ HERE, and it needs its own paragraph because the rule
 * above says why there is not a third: everything the protocol carries is read
 * where the protocol is spoken, and this is the one thing on `init` the
 * protocol has no place for at all. ACP's `session/new` takes `mcpServers` and
 * answers with a session id — whether the agent reached any of them is never on
 * the wire — so #140 could report only the failures olai's own probe found
 * BEFORE handing anything over, and said so in its own docs. This is the other
 * half arriving, from the one agent that volunteers it.
 *
 * The MODEL is why the subscription exists and the SERVERS ride it: the
 * adapter forwards `system`/`init` because {@link OPEN_SESSION_META} asked for
 * that message and no other, and it carries both. So this costs one more read
 * of a message already being read, on a channel already open, and an agent
 * that stops sending the field answers `null` — which leaves every row exactly
 * where the client put it ({@link ../servers.ts}).
 *
 * `mcp_servers` is `{ name, status }[]` on the SDK's own `SDKSystemMessage`,
 * where `status` is typed as a bare `string`: an OPEN SET, whose members today
 * are `connected`, `failed`, `needs-auth`, `pending` and `disabled`. WHICH OF
 * THEM MEANS YES is decided here and nowhere else ({@link CONNECTED}), because
 * it is a fact about this CLI in exactly the way `mcp__<server>__` is: read one
 * layer up, one adapter's vocabulary would be the leg-neutral roster's, and the
 * next agent to report per-server status would have to spell its own words this
 * one's way. The WORD ITSELF travels beside the verdict, so a person reads
 * `needs-auth` rather than a category this file would have to keep in step with
 * somebody else's releases.
 *
 * ENTRIES ARE DROPPED, NEVER REPAIRED. A row without a name is a row about
 * nothing, and a row without a status word is one with nothing to say — either
 * one coerced into a default would be this file inventing the fact it exists to
 * report. Dropped, they leave the roster row at `handed`, which is what it
 * already says.
 */
export const liveServersIn = (params: unknown): ReadonlyArray<Reported> | null => {
  const servers = initIn(params)?.["mcp_servers"]
  if (!Array.isArray(servers)) return null
  return servers.flatMap((entry): ReadonlyArray<Reported> => {
    const shape = entry as { readonly name?: unknown; readonly status?: unknown } | null
    const name = shape?.name
    const said = shape?.status
    return typeof name === "string" && name !== ""
        && typeof said === "string" && said !== ""
      ? [{ name, attached: said === CONNECTED, said }]
      : []
  })
}

/** The one word this CLI's `init` uses for a server it has. Matched POSITIVELY
 *  and never widened: every other word it could send — a failure, a
 *  `needs-auth`, one no version has emitted yet — is read as "not attached",
 *  which is the direction this bet is safe to lose in. A tick over tools that
 *  are not there is the direction it may not. */
const CONNECTED = "connected"

/** The CLI's own `system`/`init` out of a forwarded message, or `undefined` for
 *  any other message — the adapter forwards what it was asked for and nothing
 *  says a future version will not be asked for more. Both readers above start
 *  by asking for it, so the shape test is written once: two copies of "is this
 *  the init message" is one place for a subtype to be checked and another for
 *  it to be forgotten. */
const initIn = (params: unknown): { readonly [key: string]: unknown } | undefined => {
  const message = (params as { readonly message?: unknown } | null)?.message
  if (typeof message !== "object" || message === null) return undefined
  const shape = message as { readonly [key: string]: unknown }
  if (shape["type"] !== "system" || shape["subtype"] !== "init") return undefined
  return shape
}

// ── the leg ────────────────────────────────────────────────────────────

/**
 * Everything above, as the one shape {@link ../agent.ts} talks to.
 *
 * A VALUE assembled at the bottom rather than a class or a namespace, because
 * every member is already a pure function or a constant and this is the list of
 * them: a reader comparing two agents reads two of these side by side and sees
 * exactly where they differ ({@link ./opencode.ts}).
 *
 * `toolName` takes the call id and ignores it. That is not an accident of the
 * interface: the adapter says the name in its own `_meta`, and reading the id
 * as well would be a second answer to a question that already has one — and the
 * ONE that could be wrong, since a Claude call id is an opaque `toolu_…`.
 */
export const CLAUDE: Leg = {
  toolNameIn,
  // Nothing: a Claude call id is an opaque `toolu_…` and says nothing about
  // the tool. Reading it would answer for a call nothing has named, which is
  // the one direction this file may not fail in.
  toolNameOf: () => null,
  allowedWithoutAsking,
  parentToolUse: parentToolUseIn,
  spawned: spawnedIn,
  backgroundTask: backgroundTaskIn,
  taskNotification: taskNotificationIn,
  listedIn,
  // No doubling on this wire: the adapter's `session/new` answers with a
  // session id and `configOptions` and never announces a chunk in advance.
  prologueIn: () => null,
  bypassMode: BYPASS_MODE,
  steering: {
    method: STEER_METHOD,
    meta: STEER_WHEN_IDLE,
    timeout: STEER_TIMEOUT,
    taken: steerTaken,
    advertised: STEERING_ADVERTISED,
  },
  queues: QUEUES_WHEN_BUSY,
  rawMessages: {
    openMeta: OPEN_SESSION_META,
    method: SDK_MESSAGE,
    modelIn: liveModelIn,
    serversIn: liveServersIn,
  },
}

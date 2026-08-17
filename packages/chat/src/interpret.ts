/**
 * What the Claude Code adapter MEANS by what it sends.
 *
 * `OLAI_ACP_AGENT` ({@link ./adapter.ts}) is the override, and this file is the
 * part of {@link ./agent.ts} that would be wrong if somebody used it: a `_meta`
 * extension one adapter writes, a tool-naming convention one CLI uses, a
 * message one wrapper forwards because we asked it to. The protocol proper is
 * read where it is spoken; the VALUES that are only true of one agent are read
 * here, so pointing olai at another one starts with a file rather than a search
 * for the assumptions.
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
 * in a payload, and they are named where they are relied on.
 */

import type { PermissionOption, SessionConfigOption } from "@agentclientprotocol/sdk"

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
 * servers WE handed this session — olai's mediated ops, kolu's terminals — is
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
export const allowedWithoutAsking = (
  tool: string | null,
  given: ReadonlyArray<string>,
  options: ReadonlyArray<PermissionOption>,
): string | null => {
  const ours = tool !== null &&
    given.some((server) => tool.startsWith(`mcp__${server}__`))
  if (!ours) return null
  // Allow-FLAVOURED, rather than first: the options arrive in the order the
  // agent wants them read, and its ordinary list for a tool call leads with the
  // refusal. A request for one of ours that offers no allow at all is left to a
  // person like anything else this cannot answer.
  return options.find((option) => option.kind.startsWith("allow"))?.optionId ?? null
}

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
export const toolNameIn = (
  meta: { readonly [key: string]: unknown } | null | undefined,
): string | null => stringIn(meta, "toolName")

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
export const parentToolUseIn = (
  meta: { readonly [key: string]: unknown } | null | undefined,
): string | null => stringIn(meta, "parentToolUseId")

// ── which call STARTED an agent ────────────────────────────────────────

/**
 * Whether this call spawned an agent of its own.
 *
 * The other side of {@link parentToolUseIn}, and the half that was missing: the
 * parent stamp says a call CAME OUT of a subagent, which is a thing nothing can
 * say until the subagent has made a call. A spawned agent that is still reading
 * its instructions has made none, so a panel with only that stamp to read has
 * nothing at all to draw for the agent it is waiting on — the reader sees a
 * pending row with an ordinary title and no reason to think anybody was sent
 * anywhere.
 *
 * The adapter says so at the spawn itself. It stamps `subagent: true` beside
 * the tool name on every frame it builds for an `Agent`/`Task` call
 * (`claudeCodeMetaFromToolUse`, adapter 0.66.0), and that frame is emitted when
 * the tool use starts — so it arrives at the moment the agent is sent out
 * rather than at the moment it reports back.
 *
 * A BOOLEAN in the `_meta` rather than the tool NAME, which the same corner
 * also carries: the name is a word one CLI's tool table happens to use, and the
 * adapter maps two of them (`Agent` and `Task`) onto the one flag. Reading the
 * flag is reading the adapter's own answer to the question instead of
 * re-deriving it from a list of names that is somebody else's to extend.
 *
 * Positive recognition, failing the way everything here fails: a frame that
 * does not say this spawned nobody as far as the panel is concerned, and an
 * agent that is not this adapter draws exactly what it drew before.
 */
export const spawnsAgentIn = (
  meta: { readonly [key: string]: unknown } | null | undefined,
): boolean => claudeIn(meta)?.["subagent"] === true

/**
 * WHICH KIND of agent a spawn started — `Explore`, `general-purpose`, whatever
 * the person running this agent has defined — or `null` when nothing said.
 *
 * TWO SOURCES, read as one, because they are one fact arriving on two frames
 * and a caller that took either would be right half the time:
 *
 *   - the call's own INPUT. `subagent_type` is a field of the `Agent` tool's
 *     arguments (the SDK's `AgentInput`), so it rides the `rawInput` of the
 *     frame that announces the spawn — which is the first thing anybody hears
 *     about the agent, and therefore the one that matters. It is optional
 *     there: a spawn that named no type has none, and `null` is the answer.
 *   - the adapter's HEARTBEAT. While a call runs the SDK emits `tool_progress`
 *     beats, and the adapter forwards each as a `tool_call_update` carrying
 *     `toolResponse.subagentType` for an Agent call. Those frames carry no
 *     `rawInput` at all, so a reader of the input alone would answer `null` for
 *     every one of them.
 *
 * The input is asked FIRST, and the order is the honest one rather than an
 * arbitrary tie-break: a spawn's arguments are what the agent asked for, and
 * the beat is a report about the task those arguments started. They do not
 * disagree in practice; if they ever did, what was asked for is the answer a
 * person reading the row is owed.
 *
 * The input arrives incrementally — the adapter emits the `tool_call` as the
 * tool use starts and refines it with a `tool_call_update` as the arguments
 * finish parsing — so an early frame can honestly answer `null` about a spawn
 * whose type is known one frame later. Nothing here waits for that: the
 * transcript's own stickiness is what carries a kind forward
 * ({@link ./transcript.ts}), which is the rule every other field on a tool row
 * already follows.
 */
export const agentKindIn = (
  meta: { readonly [key: string]: unknown } | null | undefined,
  input: unknown,
): string | null => {
  const asked = (input as { readonly subagent_type?: unknown } | null | undefined)
    ?.subagent_type
  if (typeof asked === "string" && asked !== "") return asked
  const response = claudeIn(meta)?.["toolResponse"] as
    | { readonly [key: string]: unknown }
    | null
    | undefined
  const beat = response?.["subagentType"]
  return typeof beat === "string" && beat !== "" ? beat : null
}

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

/** The adapter's own corner of a `_meta`, or `undefined` when there is none —
 *  an absent `_meta`, an absent `claudeCode`, one that is not an object. Every
 *  reader here starts by asking for it. */
const claudeIn = (
  meta: { readonly [key: string]: unknown } | null | undefined,
): { readonly [key: string]: unknown } | undefined => {
  const claude = meta?.["claudeCode"]
  return typeof claude === "object" && claude !== null
    ? claude as { readonly [key: string]: unknown }
    : undefined
}

/** One field of that corner, when it is a non-empty string and `null` for
 *  everything else — a field of some other type, the empty string. The two
 *  readers above are the same narrowing over two names, and a frame carries
 *  either, both or neither: a subagent's terminal output arrives with a
 *  `claudeCode` holding only the parent, and a plan exit's with only the
 *  name. */
const stringIn = (
  meta: { readonly [key: string]: unknown } | null | undefined,
  field: string,
): string | null => {
  const value = claudeIn(meta)?.[field]
  return typeof value === "string" && value !== "" ? value : null
}

// ── steering a turn that is already running ────────────────────────────

/**
 * The request that puts a message INTO the turn already in flight, rather than
 * behind it.
 *
 * A `session/prompt` sent while a turn runs is not this: the adapter enqueues
 * it and the agent reaches it when the running turn is over, which is the same
 * waiting olai used to do for itself with the same words held out of sight.
 * This one is delivered at the SDK's `now` priority — it pre-empts the current
 * generation and lands between the turn's own steps — so what a person typed
 * reaches the model that is working, which is the whole point of typing it
 * then.
 *
 * An EXTENSION, hence the leading underscore, and named for the agreed ACP
 * steering wire protocol rather than for one adapter — but it is read here
 * with everything else that is a bet on the agent, because a bet it is. The
 * losing direction is the safe one and is the only one it loses in: an agent
 * without this refuses the method, which is a refusal a caller already has to
 * handle (a dead pipe, a deadline) and which reaches a person as the row
 * keeping their words. `initialize` also ADVERTISES the extension, in a
 * top-level `_meta`; reading that would be predicting what the request proves,
 * so nothing here does.
 */
export const STEER_METHOD = "_session/steering"

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
 * ONE field of one message kind is read. Everything else `init` carries — the
 * tool list, the MCP servers, the permission mode, the slash commands, the CLI
 * version — is learned from the protocol proper or not at all, because a panel
 * that believed a wrapped CLI's private message about any of it would be
 * reading around the protocol it speaks.
 */
export const liveModelIn = (params: unknown): string | null => {
  const message = (params as { readonly message?: unknown } | null)?.message
  if (typeof message !== "object" || message === null) return null
  const shape = message as {
    readonly type?: unknown
    readonly subtype?: unknown
    readonly model?: unknown
  }
  if (shape.type !== "system" || shape.subtype !== "init") return null
  return typeof shape.model === "string" && shape.model !== "" ? shape.model : null
}

/** The model picker, as read: what is PICKED in it, and what the agent calls
 *  each of the values it offers. */
export interface Picker {
  readonly picked: string | null
  readonly labels: ReadonlyMap<string, string>
}

/**
 * The context lane a model string carries, as the adapter spells it.
 *
 * Two spellings for one thing — `opus[1m]` in a picker value, `-1m` glued to an
 * id — and the adapter treats them as the same string (its own
 * `canonicalizeModelId`). A live id carries NEITHER: the CLI reports the
 * concrete API id with the hint dropped, which is the whole reason
 * {@link modelNameIn} has to do any work at all.
 */
const CONTEXT_HINT = /(?:\[(\d+m)\]|-(\d+m))$/i

/** A model id with its context lane taken off, lowercased — the spelling in
 *  which two of the adapter's names for one model are comparable. */
const withoutLane = (id: string): string => id.trim().toLowerCase().replace(CONTEXT_HINT, "")

/** The context lane a model string states, in ONE spelling whichever way it was
 *  written, or `null` for a string that states none. A live id is always the
 *  latter — which is exactly why a row that states one may not answer for it. */
const laneOf = (id: string): string | null => {
  const found = CONTEXT_HINT.exec(id.trim().toLowerCase())
  return (found?.[1] ?? found?.[2] ?? null)
}

/**
 * What the agent calls the model with this id, out of its own picker — or
 * `null` when the picker does not name it and the caller should say the id raw.
 *
 * THE TWO VOCABULARIES. The picker's values are the adapter's *aliases* —
 * `default`, `opus[1m]`, `sonnet`, `haiku` — and the live id the CLI reports is
 * the concrete API id: `claude-sonnet-5`. So the obvious lookup, `labels.get`
 * on a live id, misses on every alias row the default install ships, and a
 * header that followed the running model could only ever say `claude-sonnet-5`
 * where the picker beside it said "Sonnet". Captured off the real adapter
 * (0.66.0) — the picker offered `default`, `opus[1m]`, `claude-fable-5[1m]`,
 * `sonnet`, `haiku` while `system`/`init` reported `claude-fable-5`, then
 * `claude-sonnet-5`. Not one of the five ever matched.
 *
 * Three tiers, and every one of them is an EXACT comparison. This is not the
 * fuzzy match the picker's own note refuses, and the difference is worth
 * naming: the adapter resolves in exactly this direction itself
 * (`resolveModelPreference`, `matchResumedModel`) and resolves it to decide
 * BEHAVIOUR — which context window, which capabilities. What is decided here is
 * a word on a screen, and it is decided more strictly than the adapter does it:
 * no scoring, no version fuzz, no nearest row.
 *
 *   1. the id IS a picker value. The picked value always lands here;
 *   2. the same model in the adapter's two spellings of a context lane —
 *      `claude-fable-5` is the `claude-fable-5[1m]` row;
 *   3. an ALIAS row: a value that is one bare word naming a FAMILY, against an
 *      id that is that family and a version and nothing else.
 *      `claude-sonnet-5` is the `sonnet` row because "sonnet" is literally
 *      what that id says it is.
 *
 * Tier 3 answers for a family and a version — `claude-sonnet-5`,
 * `claude-haiku-4-5` — and for nothing more decorated than that. A dated or
 * otherwise pinned id (`claude-opus-4-5-20260101`) names something more
 * specific than any alias claims to cover, and gets the raw id: an alias row
 * that answered for it would be saying the picker offers a model it does not.
 *
 * And every tier that could answer twice answers `null` instead. Tier 3 in
 * particular takes a UNIQUE hit or none: two alias rows for one family — a
 * `sonnet` and a `sonnet[1m]` — are a question this cannot answer, and the raw
 * id is the truthful thing to say about a question nobody answered.
 *
 * `default` is never a match. It is the adapter's word for "whichever model the
 * CLI recommends today", so it names no model at all — and it is a bare word
 * that would otherwise sit in tier 3 matching nothing on purpose.
 *
 * AND A FAMILY ALIAS MAY NOT LEND A CONTEXT LANE. A live id states no lane —
 * the CLI drops it — so `claude-opus-5` against a lone `opus[1m]` row was
 * answered "Opus (1M context)", and a session actually running Opus at 200k
 * said so in the header for the rest of its life. That is a lie about the one
 * number a person reads this header to decide `/compact` by, and it is worse
 * than the raw id it replaced, which claimed nothing. So tier 3 requires the
 * LANES TO AGREE: laneless id, laneless row. `sonnet` and `haiku` still answer
 * because they state no lane either; a lane-pinned row does not answer for an
 * id that never mentioned one, and the header says `claude-opus-5`.
 *
 * TIER 2 IS NOT THAT, and the difference is identity. `claude-fable-5` against
 * the `claude-fable-5[1m]` row is one id in the adapter's own two spellings of
 * it (`canonicalizeModelId` is the adapter's equality, not a rule invented
 * here) — the SAME model, so the row's name for it is its name. A family alias
 * is not an identity: `opus` is whichever Opus, and a row that has pinned
 * itself to a lane is not the one a laneless id belongs to.
 */
export const modelNameIn = (
  labels: ReadonlyMap<string, string>,
  id: string,
): string | null => {
  const exact = labels.get(id)
  if (exact !== undefined) return exact

  const wanted = withoutLane(id)
  if (wanted === "") return null

  const named = (only: (value: string) => boolean): string | null => {
    const hits = [...labels].filter(([value]) => value !== "default" && only(value))
    return hits.length === 1 ? hits[0]?.[1] ?? null : null
  }

  const lane = named((value) => withoutLane(value) === wanted)
  if (lane !== null) return lane

  // `claude-` is the vendor and says nothing about which model this is; what
  // follows is a family and, optionally, the version of it. Anything else in
  // there — a date, a build — is a pin no family alias covers.
  const words = wanted.split("-")
  const [family, ...version] = words[0] === "claude" ? words.slice(1) : words
  if (family === undefined || !version.every((part) => /^\d{1,2}$/.test(part))) return null
  // ... and the lanes have to agree, which for a live id means both are absent:
  // a family alias names a family, and may not throw in a context window the
  // thing it is naming never claimed.
  const lanes = laneOf(id)
  return named((value) => withoutLane(value) === family && laneOf(value) === lanes)
}

/**
 * The model picker out of a session's `configOptions`, or `null` when there is
 * none to read.
 *
 * WHICH ENTRY is the model is the adapter's own answer and not the protocol's:
 * ACP's `SessionConfigId` is a free-form string, and its one reserved hint —
 * `category: "model"` — is documented as UX-only, optional, and never required
 * for correctness. So `id === "model"` is a bet of exactly the kind everything
 * else here is, and it belongs beside them rather than inside the session that
 * uses it: an agent that spells its picker differently loses the model name in
 * the header and nothing else.
 */
export const modelPickerIn = (
  configOptions: ReadonlyArray<SessionConfigOption> | null | undefined,
): Picker | null => {
  const entry = (configOptions ?? []).find((option) => option.id === MODEL_CONFIG)
  if (entry === undefined || entry.type !== "select") return null
  return { picked: entry.currentValue ?? null, labels: labelsOf(entry) }
}

/** The picker's own id, which is also what a `session/set_config_option`
 *  naming the model has to be addressed to — READ in one place and WRITTEN in
 *  another, so it is spelled once. The bet it embodies is
 *  {@link modelPickerIn}'s. */
export const MODEL_CONFIG = "model"

/**
 * Whether two model strings name the model, as far as anything here can tell.
 *
 * Asked by the one caller that has to decide whether to say anything at all:
 * the panel puts a restored conversation back on the model it was running
 * ({@link ./agent.ts}'s `restore`), and a session that already came up on it
 * needs no such request. The two strings reach that question in DIFFERENT
 * vocabularies — the picker's own value (`sonnet`) against whatever the panel
 * last knew it was running, which is a live API id (`claude-sonnet-5`) as often
 * as not — so string equality answers only the easy half.
 *
 * Resolved through {@link modelNameIn}, which is the bridge between those two
 * vocabularies and already the header's: two strings the picker gives ONE name
 * are one model, because a picker never names two rows alike. A string the
 * picker cannot name answers for itself, so two unnameable ones agree only when
 * they are the same string — which is the truthful answer for a model nobody
 * here has a vocabulary for, and the reason the equal-strings case needs no
 * line of its own.
 */
export const sameModel = (
  labels: ReadonlyMap<string, string>,
  one: string,
  other: string,
): boolean => (modelNameIn(labels, one) ?? one) === (modelNameIn(labels, other) ?? other)

/**
 * The picker's OWN word for a model, when it has one.
 *
 * The other direction of the same bridge, and the one a request has to cross.
 * What the panel remembers a conversation running is, in practice, always the
 * live API id the CLI reported (`claude-sonnet-5`) — that is the only source a
 * `/model` ever reaches olai through — while the picker offers aliases
 * (`sonnet`). A `session/set_config_option` carries a picker VALUE, so asking
 * in the remembered spelling is asking with a word the picker never offered:
 * the pinned adapter would resolve it (its `resolveModelPreference` matches a
 * row's resolved id), and an agent that simply checked its own list would
 * refuse — leaving the conversation on the pin, which is the whole bug.
 *
 * So the id is translated back through the labels first: the row this model is
 * NAMED by is the row to ask for. `null` when no row answers, or when two do —
 * the caller then asks in the words it has, which is what it would have done
 * anyway, and an agent that can resolve them still does.
 */
export const pickerValueFor = (
  labels: ReadonlyMap<string, string>,
  model: string,
): string | null => {
  if (labels.has(model)) return model
  const name = modelNameIn(labels, model)
  if (name === null) return null
  const rows = [...labels].filter(([, label]) => label === name)
  return rows.length === 1 ? rows[0]?.[0] ?? null : null
}

/** The picker as value → label ("sonnet" → "Sonnet"), which is what the agent
 *  calls its own models. Exactly what the picker said and nothing more — the
 *  vocabulary gap between a picker VALUE and a live API id is
 *  {@link modelNameIn}'s to bridge, and only it may answer `null`.
 *
 *  The picker is a flat list of options or a list of GROUPS of them, and the
 *  protocol tells the two apart by shape rather than by a tag. */
const labelsOf = (
  entry: Extract<SessionConfigOption, { type: "select" }>,
): ReadonlyMap<string, string> => {
  const labels = new Map<string, string>()
  for (const item of entry.options) {
    if ("value" in item) {
      labels.set(item.value, item.name)
      continue
    }
    for (const option of item.options) labels.set(option.value, option.name)
  }
  return labels
}

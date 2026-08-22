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

import type { Leg, Meta, Spawn } from "./leg.ts"

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
 *     (`claudeCodeMetaFromToolUse`, adapter 0.66.0), and that frame is emitted
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
  // THE FLAG IS THE ONLY THING THAT OPENS THIS DOOR. Everything below is read
  // off a frame the adapter itself said was an Agent call, and a frame that
  // does not say so is answered `null` however suggestively it is shaped.
  if (claudeIn(meta)?.["subagent"] !== true) return null
  // ... and then the kind, off the `Agent` tool's own arguments. `rawInput` is
  // the tool's payload rather than the adapter's word, which is exactly why it
  // may not be read on its own: `subagent_type` is a name ONE tool gives one
  // of its arguments, the tools on a session are not a closed set, and an MCP
  // server olai never handed this conversation is free to take an argument by
  // that name. Requiring the flag costs nothing — the adapter builds both into
  // the same frames (`claudeCodeMetaFromToolUse` rides every announcement and
  // every refinement of an Agent call).
  const asked = (input as { readonly subagent_type?: unknown } | null | undefined)
    ?.subagent_type
  return typeof asked === "string" && asked !== "" ? { kind: asked } : {}
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
const claudeIn = (meta: Meta): { readonly [key: string]: unknown } | undefined => {
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
const stringIn = (meta: Meta, field: string): string | null => {
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
  id: "claude",
  toolName: (meta) => toolNameIn(meta),
  allowedWithoutAsking,
  parentToolUse: parentToolUseIn,
  spawned: spawnedIn,
  bypassMode: BYPASS_MODE,
  steering: {
    method: STEER_METHOD,
    meta: STEER_WHEN_IDLE,
    timeout: STEER_TIMEOUT,
    taken: steerTaken,
  },
  rawMessages: {
    openMeta: OPEN_SESSION_META,
    method: SDK_MESSAGE,
    modelIn: liveModelIn,
  },
}

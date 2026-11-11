/**
 * What OPENCODE means by what it sends — the second leg (`@olai/acp/engine`'s
 * `Leg`).
 *
 * Every reading here was captured live against **opencode 2.2.7** running
 * `opencode acp` (2026-11-11). It is plain ACP over stdio and most of it needs
 * nothing said: the sessions, the MCP handing, the permission round trip and
 * the model picker are the protocol's own and are read where the protocol is
 * read.
 *
 * **OPENCODE 1.x IS NOT THIS WIRE AND IS NOT SUPPORTED.** The 1.17.9 line put
 * the tool's name at the head of the call id (`bash:0`), announced every MCP
 * tool as `<server>_<tool>`, carried no `_meta` anywhere, had no steering and
 * held a mid-turn prompt behind the running turn. Every one of those five is
 * false on 2.x, and three of them are false in the direction that would make a
 * 1.x reading WRONG rather than merely blind — so there is no dual leg here
 * and no shim. An `opencode acp` from the old line matches nothing below,
 * which means every call is unnamed, every permission reaches a person, and
 * nothing is ever auto-approved. That is the direction this file fails in.
 *
 * FIVE THINGS ARE THIS FILE, and they are the five the protocol does not say:
 *
 *   - **the tool's name is a FIELD ON THE FRAME** (`name: "shell"`,
 *     `"execute"`, `"subagent"`), and the `toolCallId` is opaque
 *     (`chatcmpl-tool-a27391eb035485a2`). The id said the name once; it does
 *     not any more, and a reader still splitting it would name a call
 *     `chatcmpl-tool-a27391eb035485a2` after nothing.
 *   - **olai's own tools never arrive as tool calls at all.** opencode 2 hands
 *     every MCP tool to the model as CODE MODE: one `execute` call whose
 *     `rawInput.code` is JavaScript against a `tools.<server>.<tool>` object,
 *     and whose completion reports what it ran in
 *     `rawOutput.metadata.toolCalls`. {@link mcpCall} and
 *     {@link allowedWithoutAsking} are both written over that, and the second
 *     of them is the one thing in this file that must not be written loosely.
 *   - **the reply is in the CONTENT, not the output.** `execute` returns the
 *     script's value as a text block; `rawOutput` is the run's bookkeeping.
 *   - **steering exists and queueing does not**, which is the pair that has to
 *     be read together. `_session/steering` answers `{outcome:"injected"}`
 *     mid-turn, and a second `session/prompt` while a turn runs is REFUSED
 *     (`-32603 Session already has an active ACP prompt: <id>`). On 1.17.9 it
 *     was exactly the other way round.
 *   - **subagents are real child sessions with a channel of their own**
 *     ({@link ./activity.ts}), so a fan-out draws in lanes and a child's
 *     permission question is asked in the child's name.
 *
 * And one that is deliberately nothing: **there is still no bypass mode.**
 * `session/set_mode "bypassPermissions"` is refused (`-32602 mode not found`;
 * the modes are `build` and `plan`), so {@link Leg.bypassMode} is `null` here
 * rather than a request that fails. Unattended auto-approval for opencode
 * lives in its own `opencode.json` — olai answers what it is asked and never
 * widens what it answers.
 */

import { allowFlavoured, type Leg, namedExactly } from "@olai/acp/engine"

import { CHILD_SESSIONS } from "./activity.ts"
import { type Called, toolsCalledIn } from "./script.ts"

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined

// ── which tool a call is ───────────────────────────────────────────────

/**
 * The programmatic name of a tool, out of the FIELD the frame carries it in.
 *
 * `tool_call`, `tool_call_update` and the `toolCall` of a
 * `session/request_permission` all carry `name` beside `title` on opencode 2,
 * and the three agree. The TITLE is not it and never was: opencode rewrites a
 * call's title over its life — `shell` while it starts, `sleep 20` once the
 * command is known, and a child's titles are prefixed with the child's own
 * (`Summarise note.txt: read`) — so a client reading the title has a different
 * answer depending on when it looked.
 *
 * TAKES WHAT THE CALLER WAS GIVEN AND BELIEVES ONLY A NON-EMPTY STRING. A
 * frame with no `name` is a call this cannot name, which is a call a person is
 * asked about ({@link Leg.toolNameIn}). The `_meta` argument is unread: the
 * only corner on this wire is the child-session stamp, which names a session
 * rather than a tool.
 */
export const toolNameIn = (_meta: unknown, named?: string | null): string | null =>
  typeof named === "string" && named !== "" ? named : null

// ── an olai call, out of the script that dispatched it ─────────────────

/** The builtin every MCP tool arrives inside. opencode 2's Code Mode: the
 *  model writes JavaScript, the script calls the tools, and ONE call id covers
 *  however many of them it ran. */
const EXECUTE = "execute"

/** ... and the builtin a SPAWN arrives as: `name: "subagent"`, kind `think`. */
const SUBAGENT = "subagent"

/** ... and every one the COMPLETION reported, which is the agent's own account
 *  of what the script actually ran (`rawOutput.metadata.toolCalls`, entries
 *  `{ tool: "<server>.<tool>", status, input? }`). `null` for a frame carrying
 *  no such list — an announcement, or a call that is not an `execute`. */
export const toolsRanIn = (rawOutput: unknown): ReadonlyArray<Called> | null => {
  const ran = record(record(rawOutput)?.["metadata"])?.["toolCalls"]
  if (!Array.isArray(ran)) return null
  const called: Called[] = []
  for (const entry of ran) {
    const name = record(entry)?.["tool"]
    if (typeof name !== "string") return null
    const dot = name.indexOf(".")
    if (dot <= 0 || dot === name.length - 1) return null
    called.push({ server: name.slice(0, dot), tool: name.slice(dot + 1) })
  }
  return called
}

/**
 * Which of olai's tools this frame is about — every one of them, in the order
 * the script ran them, and empty for a call that is not one of ours.
 *
 * DISPLAY ONLY. {@link allowedWithoutAsking} is the approval rule and is asked
 * a different question; this one decides what a row is CALLED and which
 * outline it links. A call nothing here recognises is drawn as the ordinary
 * `execute` it looks like, with its script as the row's detail, which is the
 * losing direction this can afford.
 *
 * EVERY CALL, not the first of them: a model batching three `tools.olai.*`
 * calls into one script is an ordinary thing to see, and the row that used to
 * answer `null` for it lost the friendly title, the outline link and the write
 * story for the commonest case there is. The caller composes one row out of
 * however many this answers (`olai-plugin-chat`'s `agent.ts`) and draws a
 * structured reply only for a row that ran exactly one — the script returns
 * ONE value, and which of three calls it belongs to is not on the wire.
 *
 * ALL OF THEM OR NONE: a script this cannot read in full answers nothing at
 * all rather than the part of it that looked familiar, which is the same rule
 * the approval below is held to and for the same reason — a row naming two of
 * the three calls a script made is a row claiming the third did not happen.
 *
 * WHAT IT REPORTED BEATS WHAT IT SAID IT WOULD DO, for the same reason a frame
 * beats a guess: `rawOutput.metadata.toolCalls` is the agent's record of what
 * ran, and the script is the model's statement of intent. Where a completion
 * carries the list, it is read — including for a script the grammar below
 * cannot parse, which is how a `Promise.allSettled` batch still gets its name
 * once it is over.
 */
export const mcpCall: Leg["mcpCall"] = (frame, servers) => {
  if (frame.name !== EXECUTE) return []
  const code = record(frame.rawInput)?.["code"]
  const called = toolsRanIn(frame.rawOutput)
    ?? (typeof code === "string" ? toolsCalledIn(code) : null)
  if (called === null || called.length === 0) return []
  return called.every((one) => servers.includes(one.server)) ? called : []
}

// ── what an olai call answered ─────────────────────────────────────────

/**
 * What one of olai's tools answered, out of the completion of the `execute`
 * that dispatched it — or `undefined` for a frame that carries no such thing.
 *
 * THE SCRIPT'S VALUE IS THE REPLY, and it is in the CONTENT. `execute`
 * completes with one `content` block holding its return value — pretty-printed
 * JSON for an object, the raw string for a string — while `rawOutput` holds
 * only `metadata`: which tools ran, whether anything errored, whether the
 * output was truncated. There is no `structuredContent` and no `output` on
 * this wire; both were 1.17.9's and reading them now answers `undefined`
 * forever.
 *
 * ONLY EVER ASKED FOR A FRAME {@link mcpCall} RECOGNISED, which is what makes
 * "the script's value is the tool's answer" true rather than a guess: that
 * frame ran exactly one of olai's tools, and `tools.<server>.<tool>()` answers
 * with the tool's structured content. A script that wrapped it, logged it or
 * returned something else of its own is a script whose value is not a record
 * olai's faces can draw — and parses to something that is not one, which is
 * `undefined` here.
 *
 * Read POSITIVELY at every step, like every reader in this file: a shape that
 * is not the one this expects answers `undefined` rather than a guess.
 */
export function replyIn(_rawOutput: unknown, content?: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(content)) return undefined
  for (const block of content) {
    const outer = record(block)
    if (outer?.["type"] !== "content") continue
    const inner = record(outer["content"])
    if (inner?.["type"] !== "text" || typeof inner["text"] !== "string") continue
    try {
      return record(JSON.parse(inner["text"]))
    } catch {
      return undefined
    }
  }
  return undefined
}

// ── which permissions are answered without asking ──────────────────────

/**
 * The option a permission request is answered with WITHOUT asking a person, or
 * `null` when it is a person's to answer.
 *
 * THE ONE THING IN THIS FILE THAT MUST NOT BE WRITTEN LOOSELY, and opencode 2
 * makes it harder than every other wire olai speaks, because the request does
 * not say which tool it is about. Every MCP tool — olai's own, a foreign
 * server's, and opencode's own builtins under `tools.opencode.*` — is
 * dispatched through one `execute`, so the `name` on the request is `execute`
 * for all three and the only thing that tells them apart is the SCRIPT.
 *
 * ONE APPROVAL COVERS THE WHOLE SCRIPT. opencode asks once per inner tool
 * call and sends THE SAME FRAME each time — the three requests a three-call
 * script produced were byte-identical in every field, differing only in the
 * JSON-RPC request id (captured against 2.2.7, 2026-11-11). Nothing says
 * WHICH call a request is about, so answering one of them is answering all of
 * them, and this rule may only answer for a script it has read IN FULL.
 *
 * FOUR CONDITIONS, every one of them positive:
 *
 *   1. the request is about an `execute` — a `shell`, a `subagent`, a `read`,
 *      an unnamed call, anything else, is a person's;
 *   2. its `rawInput.code` PARSES under the closed grammar in
 *      {@link ./script.ts}, where the only thing a script may do is call
 *      `tools.<server>.<tool>` with literal arguments, bind the results and
 *      return them. A script with a comment in it, a variable argument, an
 *      operator, a `Promise.allSettled`, a template, a property read — any
 *      token the grammar has no rule for — is a script this has NOT read, and
 *      is a person's. Scanning for what looks familiar was tried and is
 *      unsound: `./script.ts` says what it let through;
 *   3. it calls at least one tool, and EVERY server it names is one WE handed
 *      this session — olai's own, plus whatever optional server answered this
 *      session's probe. `tools.opencode.*` is opencode's own builtins and is
 *      never one of those;
 *   4. the request offers an allow-flavoured option.
 *
 * Any one of the four missing and a person is asked. A future reader widening
 * any of them is doing the one thing this file must not do.
 *
 * ALLOW-FLAVOURED, NEVER FIRST: opencode's options are allow-first
 * (`once`/`allow_once`, `always`/`allow_always`, `reject`/`reject_once`),
 * where the Claude adapter's ordinary list leads with the refusal. One rule,
 * read off the option's own `kind`, is right on both.
 *
 * THE FRAME IS OPTIONAL IN THE CONTRACT AND DECISIVE HERE, which is safe in
 * exactly one direction and that is the direction it is: a caller that hands
 * no frame leaves this unable to recognise anything, so it recognises nothing,
 * so a person is asked.
 */
export const allowedWithoutAsking: Leg["allowedWithoutAsking"] = (tool, given, options, asked) => {
  if (tool !== EXECUTE || asked === undefined) return null
  const code = record(asked.rawInput)?.["code"]
  if (typeof code !== "string") return null
  const called = toolsCalledIn(code)
  if (called === null || called.length === 0) return null
  if (!called.every((one) => given.includes(one.server))) return null
  return allowFlavoured(options)
}

// ── what a call SPAWNED ────────────────────────────────────────────────

/**
 * What this frame says about an agent this call started, or `null`.
 *
 * opencode's spawn is a `subagent` call of kind `think` whose `rawInput` is
 * `{ agent, description, prompt }` — `agent` being which of opencode's own
 * agents was sent (`explore`, `general`), `description` the one line it was
 * sent to do, which is also the title the child session arrives under. Both
 * are read, so the row that STARTED a fan-out says so from its first titled
 * frame, which is the whole stretch a person watches a fan-out through before
 * the child has made a call.
 *
 * The child's own work is NOT this: it arrives on the child-session channel
 * and is drawn in its own lane ({@link ./activity.ts}).
 *
 * GATED ON THE CALL BEING A `subagent`, which is what makes this positive
 * recognition rather than a guess: `agent` and `description` are ordinary
 * words, and a reader that answered for any call whose arguments carried one
 * would draw `shell { command: "ls", description: "List files" }` as having
 * sent an agent out — a rail, a door and a strip entry for an agent nobody
 * started. The name is on the frame on this wire, so it is asked for.
 */
export const spawned: Leg["spawned"] = (_meta, input, named) => {
  if (named !== SUBAGENT) return null
  const args = record(input)
  if (args === undefined) return null
  const kind = args["agent"], said = args["description"]
  if (typeof kind !== "string" && typeof said !== "string") return null
  return {
    ...(typeof kind === "string" ? { kind } : {}),
    ...(typeof said === "string" ? { said } : {}),
  }
}

// ── the leg ────────────────────────────────────────────────────────────

/**
 * Opencode's answers, beside `olai-plugin-claude`'s so the difference can be
 * read in one screen.
 *
 * What used to be four `null`s and a constant is now a wire with three
 * extensions on it, and the two that moved are the two a person feels: a
 * message sent mid-turn now INTERRUPTS rather than queueing, and a fan-out
 * draws in lanes rather than flat. Both are read off what the handshake said
 * about itself, never off a request that might fail.
 */
export const OPENCODE: Leg = {
  // Carried structurally rather than by prefix: an MCP tool's name is a path
  // inside a script (`tools.<server>.<tool>`), not a word at the head of a
  // call's own name, so there is no spelling to hand anybody.
  spelling: null,
  mcpCall,
  replyIn,
  nativeActivity: CHILD_SESSIONS,
  // ITS SIGN-IN NAMES A PROGRAM, NOT A PATH. opencode's `terminal` method
  // writes `{ command: "opencode", args: ["auth","login"] }` into its own
  // `_meta` corner, and olai is the one process that must not run that as
  // written: an engine found through `OLAI_AGENT_PATH` is on a search path the
  // SERVER's own `PATH` has never heard of, so the word resolves to nothing
  // and a person pressing sign-in gets `Executable not found in $PATH:
  // "opencode"` for the binary olai is talking to. The protocol's own
  // spelling has no such hole — `args: ["--login"]` against the agent binary,
  // which is `opencode acp --login` and is a real verb (`if (e.login) return
  // auth login`, 2.2.7) — so that is the one read.
  terminalAuth: "agentBinary",
  toolNameIn,
  // The id said the tool's name on 1.17.9 and says nothing on 2.x: it is an
  // opaque `chatcmpl-tool-<hex>`, and a child's is that behind its session id.
  // Reading either would name a call after a hash.
  toolNameOf: () => null,
  allowedWithoutAsking,
  // Attribution is the child-session channel's, not a frame's: the stamp
  // opencode puts on a child's frames names the child SESSION, and the lane a
  // row belongs in is decided from the session it arrived on
  // (`olai-plugin-chat`'s `agent.ts`).
  parentToolUse: () => null,
  spawned,
  // Nothing says a call left something RUNNING behind it. opencode's own
  // background work, if it grows any, will need a fact on this wire before the
  // panel can draw one: a client that inferred a live task from a tool's name
  // would be putting a ticking clock on somebody's ordinary call.
  backgroundTask: () => null,
  // ... nor a harness-injected task-notification: a subagent reports through
  // its own session and the spawning call's result, never as a user turn, so a
  // user chunk on this wire is a person speaking.
  taskNotification: () => null,
  // ... and its `session/list` rows carry no `_meta` corner — `sessionId`,
  // `cwd`, `title`, `updatedAt` and a paging cursor is the whole of it — so
  // its rows say as much about a conversation as the protocol alone says.
  listedIn: () => null,
  // ... and its `session/new` says nothing it will repeat as a chunk: an
  // answer on this wire is a row and a field, never both.
  prologueIn: () => null,
  // Refused (`-32602 mode not found`): the modes are `build` and `plan`.
  bypassMode: null,
  steering: {
    method: "_session/steering",
    meta: { steering: { idleBehavior: "promptRequired" } },
    timeout: "30 seconds",
    // ONE OUTCOME MEANS TAKEN and the other does not, which is the whole list:
    // opencode answers `{outcome:"injected"}` when the words went into the
    // running turn and `{outcome:"promptRequired",reason:"noRunningTurn"}`
    // when there was no turn to put them in. The second falls back to an
    // ordinary prompt, which is exactly right — there is no turn running, so
    // an ordinary prompt is what the person meant. Anything unrecognised is
    // NOT taken: a message the agent hears twice is recoverable, a message
    // nobody has is not.
    taken: (answered) => record(answered)?.["outcome"] === "injected",
    // Read off the handshake's own top-level corner, `_meta.steering.supported`.
    advertised: (initialized) =>
      record(record(record(initialized)?.["_meta"])?.["steering"])?.["supported"] === true,
  },
  // NO, AND THIS IS THE READING THAT FLIPPED. opencode 1.17.9 took one
  // `session/prompt` at a time and answered them in the order they arrived;
  // 2.2.7 REFUSES the second outright — `-32603 "Session already has an active
  // ACP prompt: <sessionId>"` — so a composer promising that a mid-turn
  // message waits its turn would be promising something this agent now does
  // the opposite of. What a person gets instead is the gesture above: a
  // mid-turn send steers, and the words reach the turn in flight.
  queues: () => false,
  // Opencode forwards no CLI messages and needs no subscription: what the
  // model is, is in `configOptions` — the reading below — and a change comes
  // back in the method RESPONSE rather than as a pushed update. Its `mode`
  // entry answers the same way, and is an ordinary session setting the panel
  // already draws.
  rawMessages: null,
  // THE PICKER, READ EXACTLY. opencode puts the model in the entry every agent
  // olai talks to puts it in, and its picker offers THE IDS IT REPORTS
  // (`opencode/claude-sonnet-5` under the label `opencode/Claude Sonnet 5`) —
  // so the alias arithmetic one engine over (`olai-plugin-claude`'s
  // `models.ts`) is not this adapter's.
  models: { config: "model", nameIn: namedExactly },
}

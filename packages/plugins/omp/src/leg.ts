/**
 * What OH-MY-PI means by what it sends — the fifth leg (`@olai/acp/engine`'s
 * `Leg`).
 *
 * Every reading here was captured live against **omp 18.1.21** running
 * `omp --approval-mode yolo acp` (the spike, 2026-09-14: the handshake,
 * `session/new`, `session/list`, `session/set_mode`, `_session/steering`, and
 * one real turn through a stub `olai` MCP server). It is plain ACP over stdio
 * and most of it needs nothing said: the sessions, the permission round trip
 * and the model picker are the protocol's own and are read where the protocol
 * is read — and the terminals are the protocol's too, on the CLIENT'S side of
 * it: because olai advertises `terminal: true`, a `bash` call is announced with
 * a `{ type: "terminal", terminalId }` block naming a handle omp asked the
 * client for (`terminal/create`), so a command's output is olai's own process
 * drawing itself. What this wire does NOT do is write the `_meta.terminal_*`
 * corner pi's adapter writes, so this leg declares no `terminalOutput` — with
 * it, `olai-plugin-chat`'s `agent.ts` would advertise
 * `_meta.terminal_output: true` for an extension nobody answers.
 *
 * THREE THINGS ARE NOT, and they are this file:
 *
 *   - **olai's MCP tools are DISPATCHED THROUGH THIS AGENT'S OWN `write`
 *     TOOL.** omp mints an MCP server's tools as `mcp__<server>_<tool>` —
 *     lowercase, `[^a-z_]` folded to `_`, a tool whose own name starts
 *     `<server>_` stripped of that prefix, capped at 64 characters with a hash
 *     — and with its default `tools.xdev: true` it exposes them discoverably
 *     and CALLS them by writing to an `xd://` pseudo-path:
 *     `tool_call { toolCallId: "write:0", title: <intent>, kind: "execute",
 *     rawInput: { path: "xd://mcp__olai_outlines_read", content: "{\"id\":…}" } }`.
 *     So a call of ours is named by its PATH rather than by its title ({@link
 *     mcpCall}), and what it answered is nested inside the `write` tool's own
 *     result ({@link replyIn}). Both readers take the other shape as well — a
 *     session with `tools.xdev: false` announces the bare
 *     `mcp__<server>_<tool>:<n>` call with the args as its `rawInput` and answers
 *     top-level — because which of the two a wire is is a setting on somebody
 *     else's machine.
 *   - **`_meta` never appears on any frame.** So the two questions the Claude
 *     leg answers out of one — which tool, and whose call — have to be answered
 *     some other way or not at all. The first is the call id below; the second
 *     is not answerable, and says so.
 *   - **there is no bypass mode and no steering**, and there IS a refusal worth
 *     reading: `session/set_mode "bypassPermissions"` answers `-32603
 *     "Unsupported ACP mode"` (the modes are `default` and `plan`),
 *     `_session/steering` answers `-32603 "Unknown ACP ext method"`, and a
 *     `session/prompt` that arrives during an AUTONOMOUS omp turn — one no
 *     client prompt owns — answers `-32000 session_busy`. All three are `null`
 *     or `false` here rather than requests that fail, so olai sends none of
 *     them: the first would cost a refusal per session and the second a
 *     person's words on every mid-turn message.
 *
 * And one that is a LIVE DEFECT in the arrangement rather than a gap: **a busy
 * send CANCELS the turn in flight.** omp's `prompt()` begins a cancel cleanup
 * when `record.session.isStreaming`, so a message typed while a turn runs does
 * not queue behind it — it replaces it. There is no capability to read and no
 * method to call that would make it otherwise, which is what {@link Leg.queues}
 * answering `false` is FOR: the composer promises nothing, and the plain
 * statement of what a mid-turn message does is `docs.md`'s. The turn that was
 * cancelled ends `stopReason: "cancelled"`, which is a stop reason and not an
 * error, so the panel draws it the way it draws any stopped turn.
 *
 * And one that is deliberately nothing: omp's **fan-outs carry no parent
 * attribution** — nothing on any of its frames names who spawned what — so
 * {@link Leg.parentToolUse} and {@link Leg.spawned} answer `null` for
 * everything and a fan-out renders flat. That is the losing direction this can
 * afford, and it is the direction it loses in: a call drawn in the main agent's
 * column is a call nobody is misattributed for, and no permission form is drawn
 * in a subagent's name that is not one.
 */

import {
  allowingOurs,
  mcpCallBy,
  type Leg,
  type ListedFacts,
  type Meta,
  namedExactly,
} from "@olai/acp/engine"

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

// ── which tool a call is ───────────────────────────────────────────────

/** What separates a tool's name from the rest of a call id. omp mints
 *  `<tool>:<n>` — `write:0`, `bash:3` — and the number is the call's, not the
 *  tool's. */
const AT = ":"

/**
 * The programmatic name of a tool, out of the head of its own call id.
 *
 * THE STABLE NAME, and the reason the title is not it: omp's `write` call is
 * announced with the INTENT as its title — a sentence the model wrote about
 * what it is doing — and rewrites that title while the call runs, so a client
 * reading the title has a different answer depending on when it looked. The id
 * is minted once and never moves.
 *
 * NOTHING IS READ OFF A FRAME, and unlike the other legs this one has nothing
 * to read even if it wanted to: there is no `_meta` on any frame this agent
 * sends.
 *
 * A `null` here is the same `null` the other legs' is: a call nobody named is
 * a call a person is asked about ({@link Leg.toolNameOf}). It is answered for an
 * id with no separator in it — and for an id whose name half is empty (`:0`).
 * Neither guesses; a name this cannot read is a name it does not have.
 *
 * The FIRST separator, not the last: a tool whose own name contained a colon
 * would be one this under-reads rather than over-reads, and under-reading a
 * name costs a question where over-reading one could cost an approval.
 */
export const toolNameOf = (toolCallId: string): string | null => {
  const at = toolCallId.indexOf(AT)
  if (at <= 0) return null
  return toolCallId.slice(0, at)
}

// ── an olai call, out of the door this engine dispatches it through ────

/** The pseudo-scheme omp's `write` tool takes as a dispatch door. A path under
 *  it names an INTERNAL tool rather than a file, which is why it is the one
 *  string on this wire that may be believed. */
const XD = "xd://"

/**
 * The programmatic prefix an MCP server's tools carry on this wire.
 *
 * `mcp__<server>_<tool>` — and the shape is worth reading carefully, because
 * the two halves are separated differently: a DOUBLE underscore after `mcp`,
 * and a SINGLE one between the server and the tool. `mcp__olai_outlines_read`
 * is olai's `outlines_read`; the server name is the name olai itself handed
 * over, never one a person or an agent chose.
 *
 * omp FOLDS the name it mints — lowercase, anything outside `[a-z_]` becomes
 * `_`, a tool whose own name already begins `<server>_` has that prefix
 * stripped, and the whole thing is capped at 64 characters with a hash — which
 * is why this is spelled as a prefix on the SERVER rather than derived from the
 * tool's own name. Every server olai hands is already lowercase, and the tool
 * names olai contributes are already lowercase with underscores, so the folding
 * is the identity on everything this rule is about.
 */
export const spelling = (server: string) => `mcp__${server}_`

/** The shared rule, read for what a frame NAMES a call — the programmatic name
 *  it carries (the `tools.xdev: false` shape) or its title. */
const byName = mcpCallBy(spelling)

/**
 * Which of olai's tools this frame is about, or `null` for a call that is not
 * one of ours — the question the panel's TITLE, OUTLINE and REPLY all hang off.
 *
 * DISPLAY ONLY. {@link allowedWithoutAsking} is the approval rule and is asked
 * a different question; this one decides what a row is CALLED. A tool nothing
 * here recognises is drawn as the ordinary call it looks like, which is the
 * losing direction this can afford.
 *
 * TWO SHAPES, and both are omp's:
 *
 *   - **the `xd://` path**, which is the DEFAULT one — omp's own `tools.xdev`
 *     on — and the reason this is not just `mcpCallBy`. The call is a `write`,
 *     its `toolCallId` says `write:0`, and the thing actually being called is
 *     named only inside `rawInput.path`.
 *   - **the programmatic name**, which is what a session with `tools.xdev: false`
 *     sends instead: a top-level `mcp__olai_outlines_read:0` whose `rawInput` is
 *     the tool's arguments. That is the same shape the shared rule reads, so it
 *     is spelled once, in `@olai/acp/engine`, and read here.
 *
 * The path is asked FIRST and the name second, so a `write` whose intent text
 * happens to begin like one of our tool names is still read as the tool its
 * path points at. The path is MINTED BY THE AGENT rather than written by the
 * model — `write` takes `{ path, content }`, and the `xd://` prefix is omp's
 * own dispatch convention — while a title is display text the model composes,
 * which is why the structural half goes first. Both readers require the name to
 * CONTINUE past the prefix (`mcp__olai_` alone names no tool) and to be a
 * PREFIX rather than a substring (`elsewhere_mcp__olai_x` is not ours), so
 * nothing is recognised loosely in either direction. A call whose path is not a
 * string, or names nothing after the scheme, is a call nothing has named.
 */
export const mcpCall: Leg["mcpCall"] = (frame, servers) => {
  const path = record(frame.rawInput)?.["path"]
  const aimed = typeof path === "string" && path.startsWith(XD) ? path.slice(XD.length) : null
  return (aimed === null ? null : byName({ title: aimed }, servers)) ?? byName(frame, servers)
}

// ── what an olai call answered ─────────────────────────────────────────

/**
 * What one of olai's tools answered, out of the completion frame of the `write`
 * call that dispatched it — or `undefined` for a frame that carries no such
 * thing.
 *
 * THE NESTING IS THE PRICE OF THE DISPATCH. What a person sees as one call is
 * two tools at the far end: omp's `write`, and the MCP tool its `xd://` path
 * named. The result comes back wearing both, and the reply a panel draws is the
 * INNERMOST text block:
 *
 *   `rawOutput.details.xdev.inner.rawContent[0].text`
 *
 * with `details.rawContent[0].text` as the fallback for the `tools.xdev: false`
 * shape, where the call is top-level and there is no `write` to wrap it.
 *
 * The text is PARSED AS JSON because olai's own MCP server publishes every
 * answer twice: `structuredContent` is the data and the text block beside it is
 * that same object serialized. A server that answers in prose — a foreign one,
 * or one of ours refusing — has no JSON here, and this answers `undefined`,
 * which is the honest reading: a reply this cannot parse is a reply the row
 * does not draw.
 *
 * Read POSITIVELY at every step for the reason every reader here is: a shape
 * that is not the one this expects answers `undefined` rather than a guess.
 */
export function replyIn(rawOutput: unknown): Record<string, unknown> | undefined {
  const details = record(record(rawOutput)?.["details"])
  const inner = record(record(details?.["xdev"])?.["inner"])
  const blocks = inner?.["rawContent"] ?? details?.["rawContent"]
  const text = Array.isArray(blocks) ? record(blocks[0])?.["text"] : undefined
  if (typeof text !== "string") return undefined
  try {
    return record(JSON.parse(text))
  } catch {
    return undefined
  }
}

// ── which permissions are answered without asking ──────────────────────

/**
 * The option a permission request is answered with WITHOUT asking a person, or
 * `null` when it is a person's to answer.
 *
 * The shared rule in omp's spelling, and nothing more: the tool is named, the
 * name begins `mcp__<server>_` for one of the MCP servers WE handed this
 * session, and the request offers an allow-flavoured option. Any of those three
 * missing and a person is asked.
 *
 * `mcp__<server>_` is a strong separator and this rule leans on that: unlike
 * opencode's `_`, a builtin would have to be called `mcp__olai_something` to
 * collide, and the server half is olai's own name rather than a tool's. The
 * bounds every leg keeps are nevertheless kept here: the match is a PREFIX
 * rather than a contains, and the server names are the ones olai itself handed
 * over — olai's own and whatever a probe answered with, never a name a person
 * or an agent chose.
 *
 * ALLOW-FLAVOURED, NEVER FIRST. omp's own options lead with an allow
 * (`allow_once`, `allow_always`, `reject_once`, `reject_always`), so a client
 * that took "the first option" would deny every one of olai's tools here — one
 * rule, read off the option's own `kind`, is right on every wire olai speaks.
 *
 * IN PRACTICE A PERSON IS RARELY ASKED ON THIS WIRE AT ALL, and that is not
 * this rule's doing: olai starts omp with `--approval-mode yolo`, which skips
 * omp's ACP permission gate for everything but `bash`, `edit`, `delete` and
 * `move` — and olai's MCP tools are none of those. But this is not dead code
 * either, and the shape it is live for is worth being exact about: a request
 * that DOES arrive for a call dispatched through `write` arrives under the name
 * `write` ({@link toolNameOf} reads the id head), which is nobody's MCP tool
 * and therefore a person's question. What this rule can still answer is the
 * `tools.xdev: false` shape, where the call id head IS the minted
 * `mcp__<server>_<tool>` name — plus any other olai engine's request, which is
 * not this leg's to read. Writing it for the default shape anyway is the
 * point rather than an oversight: the rule is the leg's declaration about what
 * an approval may be granted on, and it must not depend on which of an agent's
 * settings a person happens to have.
 */
export const allowedWithoutAsking = allowingOurs(spelling)

// ── what a stored conversation says about itself ───────────────────────

/**
 * The two facts a `session/list` entry carries about its conversation, off the
 * entry's own `_meta` corner.
 *
 * omp stamps `{ messageCount, size }` there, and the count is a REAL count
 * rather than an inference — which is why the picker's row can say how long a
 * stored conversation is without opening it. The successor half is `null`:
 * this agent supersedes nothing in a listing, and a `/clear`-shaped pair is a
 * fact only one adapter's patch has ever reported.
 *
 * A row with no corner answers `null` — the picker's own signal of a question
 * the agent did not answer, which draws nothing rather than a zero.
 */
export const listedIn = (meta: Meta): ListedFacts | null => {
  const corner = record(meta)
  if (corner === undefined) return null
  const count = corner["messageCount"]
  return { messageCount: typeof count === "number" ? count : null, supersededBy: null }
}

// ── the leg ────────────────────────────────────────────────────────────

/**
 * omp's answers, beside `olai-plugin-opencode`'s so the difference can be read
 * in one screen — and the difference is entirely INSIDE two readers, because
 * the two rows are otherwise the same shape: found rather than shipped, plain
 * ACP, the same call-id mint, the same two refused extensions.
 *
 * Every `null` here was a request that would otherwise be sent and refused, and
 * every one of them is the losing direction this can afford: a
 * `session/set_mode` refused per session, a `_session/steering` refused per
 * deliberate interruption, a `_meta` subscription nothing subscribes to.
 *
 * `queues: () => false` is the one that is not merely an absence, and it is
 * answering from the wire rather than from a handshake: omp advertises no
 * queueing capability and its `prompt()` CANCELS the running turn when a second
 * prompt arrives. A composer that promised a queue here would be promising
 * something this agent does the opposite of — see the file header and
 * `docs.md`.
 */
export const OMP: Leg = {
  spelling,
  mcpCall,
  replyIn,
  // NOTHING is read off a frame — there is no `_meta` on this wire at all, and
  // the `title` moves — so nothing about a call is remembered either: the name
  // is in the key the question arrives under (`olai-plugin-chat`'s `calls.ts`).
  toolNameIn: () => null,
  toolNameOf,
  allowedWithoutAsking,
  // Nothing on an omp frame says who made a call, so nothing here says it
  // either. A fan-out renders flat.
  parentToolUse: () => null,
  spawned: () => null,
  // ... nor whether a call left something RUNNING behind it. omp's own
  // background work, if it grows any, will need a fact on this wire before the
  // panel can draw one: a client that inferred a live task from a tool's name
  // would be putting a ticking clock on somebody's ordinary call.
  backgroundTask: () => null,
  // ... nor a harness-injected task-notification: omp has no such turns, so a
  // user chunk on this wire is a person speaking.
  taskNotification: () => null,
  listedIn,
  // ... and its `session/new` says nothing it will repeat as a chunk. What an
  // open DOES send is `available_commands_update` and then
  // `session_info_update`, after a short race-guard delay — an update about the
  // session, never the session's own words arriving twice.
  prologueIn: () => null,
  // `-32603 "Unsupported ACP mode"`: the modes are `default` and `plan`, and
  // `plan` is offered only where omp's own `plan.enabled` says so. Unattended
  // approval for omp is the `--approval-mode yolo` on its command line
  // (`./server.ts`), which olai chose at SPAWN time — not something this end
  // widens at session time.
  bypassMode: null,
  // `-32603 "Unknown ACP ext method"`, so there is no interrupting gesture to
  // offer here. A mid-turn message is still a plain `session/prompt` — and on
  // this wire that is not a queued message but a REPLACEMENT of the turn in
  // flight, which is what `queues: false` below stops the composer promising
  // anything about.
  steering: null,
  // NO. A `session/prompt` arriving while a turn streams makes omp cancel that
  // turn and run the new prompt (`acp-agent.ts`'s `prompt()`), and no
  // capability in its `initialize` says otherwise. So the composer promises
  // nothing about a mid-turn message and `docs.md` says what actually happens;
  // what a person gets on this wire is the first row stopped and the second
  // one answered.
  queues: () => false,
  // omp forwards no agent-private channel, so there is nothing about its own
  // MCP connections to read off one. A server that fails to connect fails
  // `session/new` OUTRIGHT, which is a different and louder answer than a
  // per-server report: the servers strip stays at *handed* for every row.
  rawMessages: null,
  // THE PICKER, READ EXACTLY. omp puts the model in the entry every agent olai
  // talks to puts it in, its values ARE the `provider/id` strings it reports,
  // and the row's display name is the picker's own label — so the alias
  // arithmetic one engine over (`olai-plugin-claude`'s `models.ts`) is not this
  // adapter's. A change comes back as a `config_option_update`, and
  // `session/set_mode` mirrors `current_mode_update`.
  models: { config: "model", nameIn: namedExactly },
}

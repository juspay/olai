/**
 * What OPENCODE means by what it sends — the second leg ({@link ./leg.ts}).
 *
 * Every reading here was captured live against **opencode 1.17.9** running
 * `opencode acp --cwd <dir>` (the spike, 2026-08-21; the wire facts and their
 * consequences are written up in `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/opencode-chat.md`). It is
 * plain ACP over stdio and most of it needs nothing said: the sessions, the
 * MCP handing, the permission round trip and the model picker are the
 * protocol's own and are read where the protocol is read.
 *
 * FOUR THINGS ARE NOT, and they are this file:
 *
 *   - **`_meta` never appears on any frame.** So the two questions the Claude
 *     leg answers out of one — which tool, and whose call — have to be answered
 *     some other way or not at all. The first is answered below; the second is
 *     not answerable, and says so.
 *   - **the programmatic tool name is the `toolCallId` PREFIX**: `bash:0`,
 *     `olaiprobe_ping:0`. It is also the only key correlating a permission
 *     request to the announcement that named the call, which is the shape olai
 *     already relies on.
 *   - **MCP tools are named `<server>_<tool>`**, not `mcp__server__tool`. So
 *     the auto-allow rule gets a spelling of its own, and it is the one thing
 *     in this file that must not be written loosely.
 *   - **there is no bypass mode and no steering.** `session/set_mode
 *     "bypassPermissions"` is refused (`-32602`; the modes are `build` and
 *     `plan`), and `_session/steering` does not exist (`-32601`). Both are
 *     `null` here rather than requests that fail, so olai asks for neither: the
 *     first would cost a refusal per session, and the second would cost a
 *     person their words on every mid-turn message. What the absence of
 *     steering COSTS is said out loud in the composer instead.
 *
 * And one that is deliberately nothing: opencode's **subagents carry no parent
 * attribution** — a `task` tool of kind `think`, with nothing on its frames
 * naming who spawned what — so {@link Leg.parentToolUse} and
 * {@link Leg.spawned} answer `null` for everything and a fan-out renders flat.
 * That is the losing direction this can afford, and it is the direction it
 * loses in: a call drawn in the main agent's column is a call nobody is
 * misattributed for, and no permission form is drawn in a subagent's name that
 * is not one.
 */

import { allowingOurs, type Leg } from "./leg.ts"

// ── which tool a call is ───────────────────────────────────────────────

/** What separates a tool's name from the rest of a call id. Opencode mints
 *  `<tool>:<n>` — `bash:0`, `read:3` — and the number is the call's, not the
 *  tool's. */
const AT = ":"

/**
 * The programmatic name of a tool, out of the head of its own call id.
 *
 * THE STABLE NAME, and the reason the title is not it: opencode rewrites a
 * call's `title` over its life — the tool's name while it starts, a sentence
 * about what it is doing while it runs, and back to the tool's name when it
 * fails — so a client reading the title has a different answer depending on
 * when it looked. The id is minted once and never moves.
 *
 * A `null` here is the same `null` the other leg's is: a call nobody named is
 * a call a person is asked about ({@link Leg.toolNameOf}). It is answered for an
 * id with no separator in it — which is not a shape opencode has been seen to
 * send, and is exactly the shape a future version could — and for an id whose
 * name half is empty (`:0`). Neither guesses; a name this cannot read is a
 * name it does not have.
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

// ── which permissions are answered without asking ──────────────────────

/**
 * The option a permission request is answered with WITHOUT asking a person, or
 * `null` when it is a person's to answer.
 *
 * The Claude leg's rule in opencode's spelling, and nothing more: the tool is
 * named, the name begins `<server>_` for one of the MCP servers WE handed this
 * session — olai's mediated ops, kolu's terminals — and the request offers an
 * allow-flavoured option. Any of those three missing and a person is asked.
 *
 * `_` IS A WEAK SEPARATOR and that is the whole of the risk here. `mcp__x__y`
 * could not collide with anything; `olai_read_node` and a hypothetical builtin
 * called `olai_something` are told apart by nothing but the server's name, so a
 * session handed a server called `bash` would bypass a builtin `bash_…`. Three
 * things bound it, and they are why the rule is written as narrowly as it is:
 * the server names are OLAI'S OWN (it hands over `olai` and `kolu`, never a
 * name a person or an agent chose), the prefix is required to be followed by
 * something (`startsWith(`${server}_`)` on the bare server name would match the
 * server name itself), and the match is a PREFIX rather than a contains. A
 * future reader widening any of the three is doing the one thing this file must
 * not do.
 *
 * ALLOW-FLAVOURED, NEVER FIRST, and on this wire it matters for the opposite
 * reason it does on the other one: opencode's options are **allow-first**
 * (`allow_once`, `allow_always`, `reject_once`), where the Claude adapter's
 * ordinary list leads with the refusal. A client that took "the first option"
 * would be denying every one of olai's own tools here and approving somebody's
 * plan-mode exit there — one rule, read off the option's own `kind`, is right
 * on both.
 */
export const allowedWithoutAsking = allowingOurs((server) => `${server}_`)

// ── the leg ────────────────────────────────────────────────────────────

/**
 * Opencode's answers, beside {@link ./claude.ts}'s so the difference can be
 * read in one screen.
 *
 * FOUR `null`S AND A CONSTANT, which is what a leg for an agent that speaks
 * plain ACP mostly is. Each of them was a request that would otherwise be sent
 * and refused, and a refusal answered by nobody is the shape of the bug this
 * whole split exists to stop: `session/set_mode` refused per session,
 * `_session/steering` refused per mid-turn message with a person's words on the
 * floor, a `_meta` subscription nothing subscribes to.
 */
export const OPENCODE: Leg = {
  // NOTHING is read off a frame — there is no `_meta` on this wire, and the
  // `title` moves — so nothing about a call is remembered either: the name is
  // in the key the question arrives under ({@link ../calls.ts}).
  toolNameIn: () => null,
  toolNameOf,
  allowedWithoutAsking,
  // Nothing on an opencode frame says who made a call, so nothing here says it
  // either. A fan-out renders flat.
  parentToolUse: () => null,
  spawned: () => null,
  // ... nor whether a call left something RUNNING behind it. opencode's own
  // background work, if it grows any, will need a fact on this wire before the
  // panel can draw one: a client that inferred a live task from a tool's name
  // would be putting a ticking clock on somebody's ordinary call.
  backgroundTask: () => null,
  // ... and its `session/list` carries no `_meta` corner, so its rows say as
  // much about a conversation as the protocol alone says.
  listedIn: () => null,
  // Refused (`-32602`): the modes are `build` and `plan`. Unattended
  // auto-approval for opencode lives in its own `opencode.json`, outside ACP —
  // olai answers what it is asked and never widens what it answers.
  bypassMode: null,
  // Refused (`-32601`), so there is no interrupting gesture to offer here —
  // and, since `compact-lost-to-steer`, nothing else missing either: a message
  // sent while opencode is working is a plain prompt it takes in order, which
  // is what a message sent to ANY agent while it is working now is. This leg
  // was the odd one out and is the one the other converged on.
  steering: null,
  // YES, and this is the leg answering from what it KNOWS rather than from what
  // the handshake said — which is the one place the two legs differ on this
  // fact and not on the behaviour. Opencode advertises no capability either
  // way; what it does is take one `session/prompt` at a time and answer them in
  // the order they arrived (verified against 1.17.9, and the fake in the e2e
  // suite is built to that shape). That is exactly the kind of thing this file
  // exists to record — a fact about ONE agent, established once, read as a
  // value — and it is the same standard the spawn command and the permission
  // spelling above are held to.
  queues: () => true,
  // Opencode forwards no CLI messages and needs no subscription: what the model
  // is, is in `configOptions` ({@link ./models.ts}), and a change comes back in
  // the method RESPONSE rather than as a pushed update.
  rawMessages: null,
}

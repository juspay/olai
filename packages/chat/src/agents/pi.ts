/**
 * What PI-ACP means by what it sends — the third leg ({@link ./leg.ts}).
 *
 * Every reading here was captured live against **pi-acp 0.0.33**
 * (svkozak/pi-acp @ d1cffc047ab37a096ee70ca39cfc1de463db8d12 — two commits
 * past the v0.0.33 tag, and the delta is `README.md` alone, so the revision
 * this file was spiked against and the 0.0.33 the pin ships ARE the same
 * wire) driving **pi 0.84.2** as `pi --mode rpc
 * --no-themes` (the spike, 2026-08-28: the adapter was spawned over stdio and
 * spoken to the way olai speaks — `fs` off, no terminal capability, a plain
 * `session/prompt` stream, a held turn, a mid-turn message, a `session/list`,
 * a `session/load`). It is ACP over stdio with the standard frame kinds and
 * most of it needs nothing said: the sessions, the model picker, the edits and
 * the queueing are the protocol's own and are read where the protocol is read.
 * THESE ARE NOT, and they are this file:
 *
 *   - **olai's MCP servers never reach pi.** `session/new`'s `mcpServers` are
 *     accepted and stored and wired to NOTHING ("Pi doesn't support
 *     mcpServers, but we accept and store"): pi does its I/O with its own
 *     tools, and no `olai_*` tool ever exists on this wire. So nothing here is
 *     ever answered without asking — there is no spelling of "ours" to match
 *     — and the one permission path that exists is a person's every time.
 *   - **the programmatic tool name is the `toolCallId` PREFIX, exactly as on
 *     the opencode wire**: `bash:0`, `edit:1`. Nothing on any frame says it —
 *     a bash call's `_meta` corners are its terminal bookkeeping
 *     (`terminal_info`, `terminal_output`, `terminal_exit`), and the name is
 *     minted into the id and never moves.
 *   - **there is no bypass mode and no steering.** `session/set_mode`
 *     `"bypassPermissions"` is refused (`-32602`; the modes are the thinking
 *     levels `off`…`xhigh`), and `_session/steering` does not exist
 *     (`-32601`). Both are `null` here rather than requests that fail.
 *   - **a session's open DOUBLES its prologue as utterance.** `session/new`
 *     answers `_meta.piAcp.startupInfo` — a banner for an editor (pi's
 *     version, a "New version available" nag; a Zed block by the adapter's own
 *     README) — and then emits THE SAME TEXT as one ordinary
 *     `agent_message_chunk`, so that clients that draw no such block still
 *     show it. The caller drops the doubled chunk ({@link Leg.prologueIn}); the
 *     response's own field is what makes the match exact rather than a guess
 *     at prose.
 *
 * And the floors the spike established, which the capability claims below are
 * the shape of:
 *
 *   - **queueing is real and client-visible — and it is the word, not a
 *     stand-in for the interruption this adapter has no verb for.** A
 *     `session/prompt` sent while a turn runs is accepted and held in the
 *     adapter's own turn queue: it announces "Queued message (position 1)."
 *     and a `session_info_update` carrying `_meta.piAcp.{queueDepth,
 *     running}`, and the REQUEST answers when its turn comes — verified with
 *     a 12-second held turn, the message run after it, in order. Not
 *     advertised at `initialize` anywhere; established against 0.0.33 the
 *     way opencode's was against 1.17.9. Nothing on this wire will steer a
 *     running turn: see `steering: null` below, and `docs/chat.md` for the
 *     statement a person gets.
 *   - **an error inside a turn is silent.** A provider pi cannot reach maps to
 *     `stopReason: "end_turn"` with not one frame — no prose, no tool, and no
 *     usage either (pi-acp never sends `usage_update`). Olai's silence arm is
 *     the whole of what a person gets, which is the other half of why the
 *     prologue may not render: it would be the one chunk a silent first turn
 *     "said".
 *   - **bash output stays in a corner olai does not read.** A command's
 *     content is a `terminal` block and its output an extension `_meta`; the
 *     standard fields the transcript draws from (progress, diffs) say nothing
 *     about it. pi's EDITS arrive as structured `diff` blocks with
 *     `path:line` locations and draw fully; the floor is the command's output.
 *   - **`session/list` is exact-cwd and says nothing extra.** The request's
 *     `cwd` is honoured by string equality (olai's client-side narrowing
 *     still reads the same rows), rows are the protocol's four fields and
 *     `_meta` is an empty object at response level, never a corner on a row.
 *     Titles are pi's own: the first user message. PAGINATION the spike saw
 *     only one end of: a directory with one stored conversation answers it
 *     and a `null` cursor; the page size is the adapter's own word
 *     (`PAGE_SIZE = 50` in the pin's source, with `nextCursor` a real offset
 *     thereafter), not a wire observation of this repo's, and olai sends no
 *     limit and follows no cursor — a directory with more than fifty stored
 *     pi conversations draws the newest page and loses the rest. That is the
 *     AGREED posture, not a follow-up parked in code: the picker's promise is
 *     how-one-reaches-recent-conversations, and `docs/chat.md` answers the
 *     size-of-the-page question the way the other pi characteristics live
 *     there.
 *   - **`session/load` replays — by the adapter's own map, not pi's store.**
 *     pi-acp keeps a session map of its own (`~/.pi/pi-acp/session-map.json`)
 *     and PREFERS it, spawning a fresh `pi --session <file>` at the mapped
 *     path sight-unseen: a map hit whose file is gone (a deleted session, a
 *     moved store) is the adapter failing to start pi, which olai draws with
 *     its generic refusal face — what pi's store would have said about it
 *     never gets asked (unspiked; the scripted adapter always replays). A
 *     live load replays user and agent messages and completed tool rows, then
 *     answers with `configOptions` and a `null` prologue. The ids are pi's
 *     uuids; the memory's note is what a boot follows.
 *   - **nothing says whose a call was, or that one went BACKGROUND.** pi has
 *     no subagent stamp and no task registry on this wire, so {@link
 *     Leg.parentToolUse}, {@link Leg.spawned} and {@link Leg.backgroundTask}
 *     answer `null` for everything — the losing direction, as it is on the
 *     opencode wire.
 *
 * Two quirks of the adapter's authentication worth a reader's time, both
 * established on the wire rather than read off its README: an unauthenticated
 * pi is refused AT `session/new` (`-32000`, "Authentication required") — the
 * panel's refused-conversation face, with `reopen` — and `initialize`
 * advertises a terminal `authMethods` (`pi-acp --terminal-login`), which olai
 * neither draws nor needs: pi is configured in a terminal, and this panel
 * inherits that the way it inherits opencode's `opencode.json`.
 */

import type { Leg } from "./leg.ts"

// ── which tool a call is ───────────────────────────────────────────────

/**
 * The programmatic name of a tool, out of the head of its own call id.
 *
 * THE SAME MINT AS THE OPENCODE WIRE, and the two files keep their own copies
 * of these four lines on purpose: each is written against its own spike, and a
 * shared helper would make pi-acp's facts quietly depend on what opencode
 * 1.17.9 was seen to do. What is true of both is said in each: the id is
 * minted once and never moves; the TITLE is a display string a client may not
 * name a row by (`bash:0`'s title is the COMMAND, `edit:1`'s the tool's bare
 * name); and the FIRST separator is taken, so a name with a colon in it
 * under-reads rather than over-reads — the split is the same one {@link
 * ./opencode.ts} argues, at the same weight, for the same reason.
 *
 * A `null` here is the same `null` the other legs' is: an extension UI request
 * (`pi-ui-<n>`, the only permission request this adapter makes) carries no
 * name in its id, and a call nobody named is a call a person is asked about
 * ({@link Leg.toolNameOf}).
 */
export const toolNameOf = (toolCallId: string): string | null => {
  const at = toolCallId.indexOf(":")
  if (at <= 0) return null
  return toolCallId.slice(0, at)
}

// ── which permissions are answered without asking ──────────────────────

/**
 * NONE, and that is a wire fact rather than a rule this panel wrote.
 *
 * `allowedWithoutAsking` is the fail-safe's allow half: the tool is named, the
 * name begins with one of the MCP servers WE handed this session, the request
 * offers an allow-flavoured option. On this wire those can never be true,
 * because pi-acp DOES NOT WIRE the servers it is handed — the tools olai
 * mediates are unreachable for pi, and a request that positively names one of
 * ours is a shape this adapter has never sent. What remains is the fail-safe
 * read of what DOES arrive: pi's extension UI (`pi-ui-<n>` ids, so unnamed)
 * and nothing else, and all of it is a person's.
 *
 * A bare `null` and not a spelling that matches nothing: the spelling is the
 * variable that would have to be guessed — pi has no MCP tools today and
 * nobody knows which prefix it would mint the day it grows one, and an allow
 * keyed on a guessed prefix is the one failure this file exists to stop. The
 * day the adapter wires servers through, this line is re-answered in a diff
 * somebody reads, which is exactly where the rule's un-widening is kept.
 */
export const allowedWithoutAsking: Leg["allowedWithoutAsking"] = () => null

// ── the prologue ───────────────────────────────────────────────────────

/** The adapter's own corner of an open response's `_meta`, or `undefined`. */
const piAcpIn = (opened: unknown): { readonly [key: string]: unknown } | undefined => {
  if (typeof opened !== "object" || opened === null) return undefined
  const meta = (opened as { readonly _meta?: unknown })._meta
  if (typeof meta !== "object" || meta === null) return undefined
  const corner = (meta as { readonly piAcp?: unknown }).piAcp
  return typeof corner === "object" && corner !== null
    ? corner as { readonly [key: string]: unknown }
    : undefined
}

/**
 * The banner a session's open announces it is about to double as one ordinary
 * chunk, or `null`. Read POSITIVELY — a non-string, an absent corner, the
 * `null` a `session/load` answers with, all answer `null` and nothing is
 * dropped.
 */
export const prologueIn = (opened: unknown): string | null => {
  const said = piAcpIn(opened)?.["startupInfo"]
  return typeof said === "string" && said !== "" ? said : null
}

// ── the leg ────────────────────────────────────────────────────────────

/**
 * pi-acp's answers, beside {@link ./opencode.ts}'s: nearest of the three legs
 * to that one (plain ACP, the same call-id mint, the same two refused
 * extensions) and deliberately not sharing its files. Each `null` was a
 * request that would otherwise be sent and refused — a `session/set_mode` per
 * session, a `_session/steering` per deliberate interruption — and the one YES
 * is the wire-established queueing, not an advertisement.
 */
export const PI: Leg = {
  // Nothing is read off a frame — the name corners this adapter writes are
  // its terminal bookkeeping, and `title` on this wire is display text — so
  // nothing about a call is remembered either: the name is in the key the
  // question arrives under ({@link ../calls.ts}).
  toolNameIn: () => null,
  toolNameOf,
  allowedWithoutAsking,
  // No attribution, no spawn flag, no task registry: a fan-out renders flat
  // and a background-looking call is a call that finished.
  parentToolUse: () => null,
  spawned: () => null,
  backgroundTask: () => null,
  // `session/list` rows are the protocol's four fields and no corner — the
  // picker says nothing beyond them, never a zero.
  listedIn: () => null,
  prologueIn,
  // The handed servers REACH pi: the pin's adapter ships the bridge —
  // pi-acp (patched, acp/patches/README.md's `pi-mcp-servers` section)
  // spawns every session's pi with `-e <bridge>` and the session's servers
  // in its env, and pi's own registerTool API makes them real, callable
  // tools. Standing here is therefore the same as the other legs': what
  // olai handed, pi holds. What NO lane can answer is a foreign adapter
  // (the override lane in scripts/acp-pi.sh) — its capability flags are
  // its own claim, and olai's banner is exactly as strong as them, which
  // is the conversation every leg has with its adapter.
  // auto-approval for pi lives in its own settings, outside ACP.
  bypassMode: null,
  // Refused (`-32601`): `/steering` in this adapter is a SLASH COMMAND about
  // pi's own message delivery, not the ACP extension of the same name — the
  // one collision of vocabularies the spike was built to catch, and the
  // gesture this panel therefore does not draw, as a permanent word rather
  // than a pending one.
  steering: null,
  // YES, from what the spike established rather than from the handshake: the
  // queue is the adapter's own, and it announces and answers in order.
  queues: () => true,
  // pi-acp forwards no agent-private channel: the model is the `configOptions`
  // picker's, and a change comes back in the method response and a
  // `config_option_update` — {@link ./models.ts}'s reading, needed by no
  // subscription here.
  rawMessages: null,
}
  // is the conversation every leg has with its adapter.

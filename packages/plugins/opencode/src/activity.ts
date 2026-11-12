/**
 * OPENCODE 2'S CHILD SESSIONS, as a dialect of `@kolu/acp`'s one native
 * activity channel ({@link NativeActivity}).
 *
 * Captured live against **opencode 2.2.7** (2026-11-11). A `subagent` call
 * starts a SESSION of its own — not a tool that happens to think — and opencode
 * narrates that session on a notification of its own rather than in the
 * ordinary stream:
 *
 *     opencode/session/child_update {
 *       rootSessionId, childSessionId, parentSessionId, depth, title,
 *       type: "status", status: "created" | "running" | "completed"
 *                             | "interrupted" | "failed"
 *     }
 *     opencode/session/child_update {
 *       …the same five, type: "update", update: <an ordinary session update>
 *     }
 *
 * ASKED FOR, OR IT DOES NOT HAPPEN. opencode sends these only to a client
 * whose `initialize` advertised
 * `clientCapabilities._meta["opencode/child-session-updates"]`. Without the
 * opt-in a child's frames are FLATTENED into the parent's own stream — still
 * stamped, still prefixed, but with no `created`/`completed` pair anywhere, so
 * nothing marks when a child began or how it ended and a lane cannot be drawn
 * with a beginning and an end. The opt-in is therefore not an optimisation;
 * it is the difference between lanes and a flat fan-out.
 *
 * THREE THINGS THIS TRANSLATES, and each is a fact about opencode's spelling
 * rather than a policy about transcripts (which is `olai-plugin-chat`'s):
 *
 *   1. `created` opens a lane and the four TERMINAL statuses close it;
 *      `running` is opencode telling us the child started working, which the
 *      lane already said, so it moves nothing.
 *   2. a nested `update` is UNWRAPPED and re-stamped with the child's own
 *      session id, which is the shape every other reader in olai already
 *      speaks: a frame belongs to the session it arrived on.
 *   3. a `session/request_permission` about a CHILD's call arrives stamped
 *      with the ROOT session — opencode asks the client it is connected to,
 *      and that connection is the root's — while the call itself carries
 *      `_meta["opencode/child-session"]` and an id prefixed with the child's.
 *      Left alone, a child's question would be drawn in the main agent's name.
 *      So it is re-stamped here, at the one place that knows this agent's
 *      spelling, rather than branched on in the panel.
 */
import type { Heard, NativeActivity } from "@kolu/acp/engine"

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const text = (value: unknown): string | undefined => typeof value === "string" ? value : undefined

/** The notification a child session is narrated on. */
const CHILD_UPDATE = "opencode/session/child_update"

/** ... and the capability that turns it on. Spelled once: it is the key the
 *  handshake advertises and the key the agent reads. */
export const CHILD_SESSION_UPDATES = "opencode/child-session-updates"

/** The corner opencode stamps on a child's own frames — `{ id, parentID,
 *  depth, title }` — which is how a permission request about a child's call
 *  names the child it belongs to. */
const CHILD_STAMP = "opencode/child-session"

/**
 * What one of opencode's status words means to the channel — a lane OPENED, a
 * lane ENDED in olai's word, or nothing at all.
 *
 * `created` and `running` are both "open", and only one of them opens the
 * lane: `running` says what the lane already said. opencode's four terminal
 * words map onto the channel's three: a child that was `interrupted` ended
 * the way a cancelled one did, which is the word the channel has for a child
 * somebody stopped. One reader, so a sixth word has one place to be read in.
 */
const means = (status: unknown): "created" | "completed" | "failed" | "cancelled" | null =>
  status === "created" || status === "completed" || status === "failed"
    ? status
    : status === "interrupted"
    ? "cancelled"
    : null

/**
 * One `opencode/session/child_update`, as a lifecycle fact or as the ordinary
 * frame it was carrying — or `null` for anything else.
 *
 * READ POSITIVELY. A notification missing its two ids, or carrying a `type`
 * this has never seen, is left alone rather than guessed at: a lane nobody
 * drew is recoverable, and a lane drawn for a session the agent never
 * mentioned is not.
 *
 * The lane's NAME is the child's `title`, which opencode sets from the
 * `description` the `subagent` call was made with — the one line a person
 * asked for. There is no separate agent-kind on this notification; which of
 * opencode's agents was sent is on the spawning call's own frame, where the
 * leg reads it (`./leg.ts`'s `spawned`).
 */
export const childIn = (message: unknown): Heard | null => {
  const envelope = record(message)
  if (envelope?.["method"] !== CHILD_UPDATE) return null
  const params = record(envelope["params"])
  const session = text(params?.["childSessionId"])
  if (params === undefined || session === undefined) return null
  if (params["type"] === "update") {
    const update = record(params["update"])
    return update === undefined
      ? null
      : { kind: "message", value: { jsonrpc: "2.0", method: "session/update", params: { sessionId: session, update } } }
  }
  if (params["type"] !== "status") return null
  const parent = text(params["parentSessionId"])
  const state = means(params["status"])
  if (state === null) return null
  if (state !== "created") {
    return { kind: "activity", value: { session: parent ?? session, update: { kind: "childEnded", id: session, state } } }
  }
  if (parent === undefined) return null
  const title = text(params["title"]) ?? ""
  return { kind: "activity", value: { session: parent, update: { kind: "child", id: session, name: title, task: title } } }
}

/**
 * A `session/request_permission` about a CHILD's call, re-stamped with the
 * session that call really belongs to — or `null` for every other message.
 *
 * The stamp is opencode's own and is on the TOOL CALL rather than on the
 * request, which is the shape that makes this readable at all: the request is
 * addressed to the connection (the root), and the call carries the child it
 * was made in. Nothing else is touched — the id, the options and the request's
 * own id travel as they arrived, so the answer goes back to the same place.
 */
export const permissionIn = (message: unknown): Heard | null => {
  const envelope = record(message)
  if (envelope?.["method"] !== "session/request_permission") return null
  const params = record(envelope["params"])
  const child = text(record(record(record(params?.["toolCall"])?.["_meta"])?.[CHILD_STAMP])?.["id"])
  if (params === undefined || child === undefined || child === params["sessionId"]) return null
  return { kind: "message", value: { ...envelope, params: { ...params, sessionId: child } } }
}

/** THE DIALECT. Only opencode's own child-session notification leaves the
 *  stream; everything else keeps the SDK's validation and behaviour, with one
 *  field of one request corrected on the way past. */
export const CHILD_SESSIONS: NativeActivity = {
  clientMeta: { [CHILD_SESSION_UPDATES]: true },
  readIn: (message) => childIn(message) ?? permissionIn(message),
}

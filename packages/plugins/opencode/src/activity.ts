/**
 * opencode 2.2.7: a `subagent` call starts a child SESSION, narrated on
 * `opencode/session/child_update` rather than the ordinary stream:
 *
 *     { rootSessionId, childSessionId, parentSessionId, depth, title,
 *       type: "status", status: "created" | "running" | "completed"
 *                             | "interrupted" | "failed" }
 *     { …the same five, type: "update", update: <an ordinary session update> }
 *
 * Sent only to a client whose `initialize` advertised
 * `clientCapabilities._meta["opencode/child-session-updates"]`; without the
 * opt-in a child's frames are flattened into the parent's stream with no
 * `created`/`completed` pair anywhere.
 *
 * A `session/request_permission` about a CHILD's call arrives stamped with the
 * ROOT session — opencode asks the connection it has, which is the root's —
 * while the call carries `_meta["opencode/child-session"]`.
 */
import type { Heard, NativeActivity } from "@kolu/acp/engine"

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const text = (value: unknown): string | undefined => typeof value === "string" ? value : undefined

const CHILD_UPDATE = "opencode/session/child_update"

export const CHILD_SESSION_UPDATES = "opencode/child-session-updates"

/** The corner opencode stamps on a child's own frames — `{ id, parentID,
 *  depth, title }` — which is how a permission request about a child's call
 *  names the child it belongs to. */
const CHILD_STAMP = "opencode/child-session"

const means = (status: unknown): "created" | "completed" | "failed" | "cancelled" | null =>
  status === "created" || status === "completed" || status === "failed"
    ? status
    : status === "interrupted"
    ? "cancelled"
    : null

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

export const permissionIn = (message: unknown): Heard | null => {
  const envelope = record(message)
  if (envelope?.["method"] !== "session/request_permission") return null
  const params = record(envelope["params"])
  const child = text(record(record(record(params?.["toolCall"])?.["_meta"])?.[CHILD_STAMP])?.["id"])
  if (params === undefined || child === undefined || child === params["sessionId"]) return null
  return { kind: "message", value: { ...envelope, params: { ...params, sessionId: child } } }
}

export const CHILD_SESSIONS: NativeActivity = {
  clientMeta: { [CHILD_SESSION_UPDATES]: true },
  readIn: (message) => childIn(message) ?? permissionIn(message),
}

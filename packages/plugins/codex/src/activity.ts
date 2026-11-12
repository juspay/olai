/**
 * CODEX-ACP'S NATIVE CHILD SESSIONS AND AIR v1 ASYNC TASKS, as a dialect of
 * `@kolu/acp`'s one channel ({@link NativeActivity}).
 *
 * Captured against **codex-acp 1.10**. Five `sessionUpdate` kinds, sent on the
 * ORDINARY session stream — a child's frames arrive under the child's own
 * `sessionId`, so nothing here has to unwrap anything — plus one negotiation:
 * the adapter sends these only to a client whose `initialize` advertised the
 * AIR version and capabilities below.
 *
 * It lives in this plugin rather than in `@kolu/acp` for the reason every
 * other reading of one agent's spelling does: these five words are codex's,
 * and a general package that knew them would be the place the SECOND agent's
 * words had to go too.
 *
 * READ POSITIVELY, like every leg reader: a frame missing the fields its kind
 * needs answers `null` and travels on as the ordinary update it looks like. A
 * lane nobody drew is recoverable; a lane drawn for a session the agent never
 * mentioned is not.
 */
import type { ActivityNotification, ActivityUpdate, Heard, NativeActivity } from "@kolu/acp/engine"

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key] : undefined
const text = (value: unknown): string | undefined => typeof value === "string" ? value : undefined

const readers: Readonly<Record<string, (value: unknown) => ActivityUpdate | null>> = {
  subagent_spawned: (v) => {
    const id = text(field(v, "subagentSessionId")), name = text(field(v, "name")), task = text(field(v, "task"))
    return id && name !== undefined && task !== undefined ? { kind: "child", id, name, task } : null
  },
  subagent_state_update: (v) => {
    const id = text(field(v, "subagentSessionId"))
    const state = (["completed", "failed", "cancelled", "disconnected"] as const).find((s) => s === field(v, "state"))
    return id && state ? { kind: "childEnded", id, state } : null
  },
  async_task_spawned: (v) => {
    const id = text(field(v, "asyncTaskId")), name = text(field(v, "name"))
    return id && name !== undefined ? { kind: "task", id, name, description: text(field(v, "description")), tool: text(field(v, "toolCallId")) } : null
  },
  async_task_progress: (v) => {
    const id = text(field(v, "asyncTaskId"))
    return id ? { kind: "taskProgress", id, description: text(field(v, "description")), summary: text(field(v, "summary")) } : null
  },
  async_task_state_update: (v) => {
    const id = text(field(v, "asyncTaskId"))
    const state = (["completed", "failed", "stopped"] as const).find((s) => s === field(v, "state"))
    return id && state ? { kind: "taskEnded", id, state, summary: text(field(v, "summary")) } : null
  },
}

/** One `session/update` notification, as a lifecycle fact or as nothing. */
export const activityIn = (message: unknown): ActivityNotification | null => {
  if (field(message, "method") !== "session/update" || (typeof message === "object" && message !== null && "id" in message)) return null
  const params = field(message, "params")
  const session = text(field(params, "sessionId"))
  const raw = field(params, "update")
  const kind = field(raw, "sessionUpdate")
  const read = typeof kind === "string" && Object.hasOwn(readers, kind) ? readers[kind] : undefined
  const update = read?.(raw)
  return session && update ? { session, update } : null
}

/** THE DIALECT. Only the five known notifications leave the stream; requests
 *  and every other update keep the SDK's validation and behaviour. */
export const AIR: NativeActivity = {
  clientMeta: { jetbrains: { air: { version: 1, capabilities: ["nativeSubagentSessions", "asyncTasks"] } } },
  readIn: (message): Heard | null => {
    const value = activityIn(message)
    return value === null ? null : { kind: "activity", value }
  },
}

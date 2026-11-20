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

export const AIR: NativeActivity = {
  clientMeta: { jetbrains: { air: { version: 1, capabilities: ["nativeSubagentSessions", "asyncTasks"] } } },
  readIn: (message): Heard | null => {
    const value = activityIn(message)
    return value === null ? null : { kind: "activity", value }
  },
}

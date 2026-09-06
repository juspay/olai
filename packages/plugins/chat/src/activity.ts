/** Native ACP child sessions and AIR async tasks, scoped to one conversation.
 * The pinned SDK's closed SessionUpdate union predates these extensions. The
 * bridge changes only their transport method; ordinary updates keep SDK validation.
 * A child session gets its own agent row: it is not guessed to be a spawning
 * tool call. Explicit session ancestry owns its tools, reports, and questions.
 */
import type { Stream } from "@agentclientprotocol/sdk"
import type { AgentEvent } from "./events.ts"

type Tool = Extract<AgentEvent, { _tag: "tool" }>
export const ACTIVITY_METHOD = "_olai/session_activity"
const kinds = new Set(["subagent_spawned", "subagent_state_update", "async_task_spawned", "async_task_progress", "async_task_state_update"])
export const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key] : undefined
const string = (value: unknown): string | undefined => typeof value === "string" ? value : undefined
const agentId = (session: string): string => `acp-agent:${JSON.stringify(session)}`
const taskKey = (session: string, task: string): string => JSON.stringify([session, task])
const tool = (id: string, move: Partial<Omit<Tool, "_tag" | "id">>): Tool => ({
  _tag: "tool", id, title: undefined, status: undefined, detail: undefined,
  progress: undefined, diffs: undefined, wrote: undefined, locations: undefined,
  parent: undefined, spawned: undefined, armed: undefined, ...move,
})

export const activityStream = (stream: Stream): Stream => ({
  writable: stream.writable,
  readable: stream.readable.pipeThrough(new TransformStream({
    transform(message, controller) {
      const updateKind = field(field(field(message, "params"), "update"), "sessionUpdate")
      controller.enqueue(field(message, "method") === "session/update" && !("id" in message)
        && typeof updateKind === "string" && kinds.has(updateKind)
        ? { ...message, method: ACTIVITY_METHOD } : message)
    },
  })),
})

interface Child { readonly parent: string; report: string; ended: boolean }
interface Task { readonly row: string; readonly task: string; status: "in_progress" | "completed" | "failed" }

export class Activity {
  readonly #children = new Map<string, Child>()
  readonly #tasks = new Map<string, Task>()
  readonly #emit: (event: AgentEvent) => void
  constructor(emit: (event: AgentEvent) => void) { this.#emit = emit }

  root(session: string): string {
    let at = session
    while (this.#children.has(at)) at = this.#children.get(at)!.parent
    return at
  }
  parent(session: string): string | undefined {
    return this.#children.has(session) ? agentId(session) : undefined
  }
  toolId(session: string, id: string): string { return `acp-tool:${JSON.stringify([session, id])}` }
  clear(closed: Set<string>): void {
    for (const id of this.#children.keys()) closed.add(id)
    this.#children.clear()
    this.#tasks.clear()
  }

  /** Command completion is not background-task completion. Only the task's
   * terminal event may extinguish its row, including when frames interleave. */
  status(id: string, reported: Tool["status"]): Tool["status"] {
    for (const task of this.#tasks.values()) if (task.row === id) return task.status
    return reported
  }

  report(session: string, text: string): void {
    const child = this.#children.get(session)
    if (!child || text === "") return
    child.report += text
    this.#emit(tool(agentId(session), { progress: child.report }))
  }

  read(session: string, update: unknown): void {
    const kind = field(update, "sessionUpdate")
    if (kind === "subagent_spawned") {
      const id = string(field(update, "subagentSessionId"))
      const name = string(field(update, "name"))
      const task = string(field(update, "task"))
      if (!id || name === undefined || task === undefined || id === this.root(session) || this.#children.has(id)) return
      this.#children.set(id, { parent: session, report: "", ended: false })
      this.#emit(tool(agentId(id), {
        title: name, status: "in_progress", parent: this.parent(session),
        spawned: { kind: name, said: task }, detail: task,
      }))
      return
    }
    if (kind === "subagent_state_update") {
      const id = string(field(update, "subagentSessionId"))
      const child = id === undefined ? undefined : this.#children.get(id)
      const state = field(update, "state")
      if (!id || !child || child.parent !== session || child.ended
        || !["completed", "failed", "cancelled", "disconnected"].includes(String(state))) return
      child.ended = true
      this.#emit(tool(agentId(id), { status: state === "completed" ? "completed" : "failed" }))
      return
    }
    const id = string(field(update, "asyncTaskId"))
    if (!id) return
    const key = taskKey(session, id)
    if (kind === "async_task_spawned") {
      const name = string(field(update, "name"))
      if (name === undefined || this.#tasks.has(key)) return
      const linked = string(field(update, "toolCallId"))
      const row = linked ? this.toolId(session, linked) : `acp-task:${key}`
      this.#tasks.set(key, { row, task: id, status: "in_progress" })
      this.#emit(tool(row, {
        title: name, status: "in_progress", parent: this.parent(session),
        armed: { task: id, description: string(field(update, "description")) ?? name },
      }))
      return
    }
    const task = this.#tasks.get(key)
    if (!task || task.status !== "in_progress") return
    if (kind === "async_task_progress") {
      this.#emit(tool(task.row, {
        progress: string(field(update, "summary")),
        armed: { task: id, ...(typeof field(update, "description") === "string" ? { description: String(field(update, "description")) } : {}) },
      }))
    } else if (kind === "async_task_state_update") {
      const state = field(update, "state")
      if (!["completed", "failed", "stopped"].includes(String(state))) return
      task.status = state === "completed" ? "completed" : "failed"
      this.#emit(tool(task.row, {
        status: state === "completed" ? "completed" : "failed",
        armed: { task: id, ended: String(state) }, progress: string(field(update, "summary")),
      }))
    }
  }
}

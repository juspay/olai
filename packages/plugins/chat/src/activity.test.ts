import { describe, expect, test } from "bun:test"
import { Activity, activityStream, ACTIVITY_METHOD } from "./activity.ts"
import type { AgentEvent } from "./events.ts"
import type { Stream } from "@agentclientprotocol/sdk"

const setup = () => {
  const events: AgentEvent[] = []
  const activity = new Activity((event) => events.push(event))
  const spawn = (parent = "root", child = "child") => activity.read(parent, {
    sessionUpdate: "subagent_spawned", subagentSessionId: child, name: "Explorer", task: "inspect files",
  })
  const task = (session = "root", linked: string | undefined = "command") => activity.read(session, {
    sessionUpdate: "async_task_spawned", asyncTaskId: "task", name: "watch files", toolCallId: linked,
    taskType: "shell", canStop: true, showInTranscript: false,
  })
  return { activity, events, spawn, task }
}

describe("native session activity", () => {
  test("nested sessions own independent rows even when tool IDs collide", () => {
    const { activity, events, spawn } = setup()
    spawn(); spawn("child", "grandchild")
    expect(activity.root("grandchild")).toBe("root")
    expect(events[1]).toMatchObject({ parent: activity.parent("child") })
    expect(activity.toolId("root", "same")).not.toBe(activity.toolId("child", "same"))
    spawn("grandchild", "root") // cycles and duplicate announcements are inert
    spawn()
    expect(events).toHaveLength(2)
    expect(activity.root("grandchild")).toBe("root")
  })
  test("reports stay on their own agent and completion is scoped and idempotent", () => {
    const { activity, events, spawn } = setup()
    spawn()
    activity.report("child", "one "); activity.report("child", "two")
    expect(events.at(-1)).toMatchObject({ id: activity.parent("child"), progress: "one two" })
    activity.read("stranger", { sessionUpdate: "subagent_state_update", subagentSessionId: "child", state: "completed" })
    expect(events).toHaveLength(3)
    for (let i = 0; i < 2; i++) activity.read("root", { sessionUpdate: "subagent_state_update", subagentSessionId: "child", state: "completed" })
    expect(events).toHaveLength(4)
    expect(events.at(-1)).toMatchObject({ status: "completed" })
  })
  test.each(["completed", "failed", "stopped"])("task %s wins over late command updates", (state) => {
    const { activity, events, task } = setup()
    task()
    const row = activity.toolId("root", "command")
    expect(activity.status(row, "completed")).toBe("in_progress")
    activity.read("root", { sessionUpdate: "async_task_progress", asyncTaskId: "task", summary: "still checking" })
    expect(events.at(-1)).toMatchObject({ id: row, progress: "still checking", armed: { task: "task" } })
    activity.read("root", { sessionUpdate: "async_task_state_update", asyncTaskId: "task", state })
    expect(events.at(-1)).toMatchObject({ id: row, armed: { task: "task", ended: state } })
    expect(activity.status(row, "in_progress")).toBe(state === "completed" ? "completed" : "failed")
    task() // restored duplicate cannot resurrect the old task
    expect(events).toHaveLength(3)
  })
  test("task IDs are scoped, and unlinked restored tasks have their own rows", () => {
    const { activity, events, spawn, task } = setup()
    spawn(); task("root"); task("child", "");
    expect(events[2]).toMatchObject({ parent: activity.parent("child"), armed: { task: "task" } })
    activity.read("stranger", { sessionUpdate: "async_task_state_update", asyncTaskId: "task", state: "failed" })
    expect(events).toHaveLength(3)
  })
  test("leaving forgets ancestry and fences every former child; replay can restore it", () => {
    const { activity, events, spawn, task } = setup()
    spawn(); spawn("child", "grandchild"); task()
    const closed = new Set<string>()
    activity.clear(closed)
    expect([...closed]).toEqual(["child", "grandchild"])
    expect(activity.parent("child")).toBeUndefined()
    activity.report("child", "late")
    activity.read("root", { sessionUpdate: "async_task_state_update", asyncTaskId: "task", state: "failed" })
    expect(events).toHaveLength(3)
    spawn(); task()
    expect(events).toHaveLength(5)
  })
  test("malformed and unknown updates create no activity", () => {
    const { activity, events } = setup()
    for (const value of [null, [], {}, { sessionUpdate: "subagent_spawned", subagentSessionId: 7 },
      { sessionUpdate: "async_task_spawned", asyncTaskId: "x", name: [] }]) activity.read("root", value)
    expect(events).toEqual([])
  })
  test("the compatibility bridge reroutes only known extension notifications", async () => {
    const ordinary = { jsonrpc: "2.0" as const, method: "session/update", params: { sessionId: "root", update: { sessionUpdate: "agent_message_chunk" } } }
    const extension = { ...ordinary, params: { sessionId: "root", update: { sessionUpdate: "subagent_spawned" } } }
    const unknown = { ...ordinary, params: { sessionId: "root", update: { sessionUpdate: "future" } } }
    const stream: Stream = { writable: new WritableStream(), readable: new ReadableStream({ start(c) {
      c.enqueue(ordinary); c.enqueue(extension); c.enqueue(unknown); c.enqueue({ ...extension, id: 1 }); c.close()
    } }) }
    const read = activityStream(stream).readable.getReader()
    expect((await read.read()).value).toEqual(ordinary)
    expect((await read.read()).value).toEqual({ ...extension, method: ACTIVITY_METHOD })
    expect((await read.read()).value).toEqual(unknown)
    expect((await read.read()).value).toEqual({ ...extension, id: 1 })
  })
})

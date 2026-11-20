import { expect, test } from "bun:test"

import { activityIn, AIR } from "./activity.ts"

const update = (value: unknown) => ({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "root", update: value } })

test("the adapter's five kinds, read as the two lifecycles underneath", () => {
  const read = (value: unknown) => activityIn(update(value))?.update
  expect(read({ sessionUpdate: "subagent_spawned", subagentSessionId: "child", name: "Explorer", task: "inspect" }))
    .toEqual({ kind: "child", id: "child", name: "Explorer", task: "inspect" })
  expect(read({ sessionUpdate: "subagent_state_update", subagentSessionId: "child", state: "cancelled" }))
    .toEqual({ kind: "childEnded", id: "child", state: "cancelled" })
  expect(read({ sessionUpdate: "async_task_spawned", asyncTaskId: "watch", name: "watch files", toolCallId: "command" }))
    .toMatchObject({ kind: "task", id: "watch", name: "watch files", tool: "command" })
  expect(read({ sessionUpdate: "async_task_progress", asyncTaskId: "watch", summary: "checking" }))
    .toMatchObject({ kind: "taskProgress", id: "watch", summary: "checking" })
  expect(read({ sessionUpdate: "async_task_state_update", asyncTaskId: "watch", state: "stopped" }))
    .toMatchObject({ kind: "taskEnded", id: "watch", state: "stopped" })
  expect(activityIn(update({ sessionUpdate: "subagent_spawned", subagentSessionId: "child", name: "Explorer", task: "inspect" })))
    .toMatchObject({ session: "root" })
})

test("a payload missing what its kind needs is not a lane anybody drew", () => {
  for (
    const value of [
      { sessionUpdate: "subagent_spawned", subagentSessionId: 7 },
      { sessionUpdate: "subagent_spawned", subagentSessionId: "child", name: "Explorer" },
      { sessionUpdate: "subagent_state_update", subagentSessionId: "child", state: "invented" },
      { sessionUpdate: "async_task_spawned", asyncTaskId: "watch", name: [] },
      { sessionUpdate: "async_task_progress", asyncTaskId: "" },
      { sessionUpdate: "async_task_state_update", asyncTaskId: "watch", state: "invented" },
      { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "ordinary" } },
      { sessionUpdate: "future" },
    ]
  ) {
    expect(activityIn(update(value))).toBeNull()
  }
})

test("a REQUEST is never one of these, however its update is spelled", () => {
  expect(activityIn({
    ...update({ sessionUpdate: "subagent_spawned", subagentSessionId: "child", name: "Explorer", task: "inspect" }),
    id: 1,
  })).toBeNull()
  expect(activityIn({ method: "session/new", params: {} })).toBeNull()
  expect(activityIn(null)).toBeNull()
})

test("the channel is negotiated, and what it claims it consumes", () => {
  expect(AIR.clientMeta).toEqual({
    jetbrains: { air: { version: 1, capabilities: ["nativeSubagentSessions", "asyncTasks"] } },
  })
  expect(AIR.readIn(update({ sessionUpdate: "subagent_spawned", subagentSessionId: "child", name: "E", task: "t" })))
    .toMatchObject({ kind: "activity" })
  expect(AIR.readIn(update({ sessionUpdate: "agent_message_chunk" }))).toBeNull()
})

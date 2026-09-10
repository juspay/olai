import { expect, test } from "bun:test"
import { client, methods, type Stream } from "@agentclientprotocol/sdk"
import { nativeActivity, type ActivityNotification } from "@olai/acp"

/** Exercise the actual SDK dispatcher: these events otherwise fail its union
 * validation before an ordinary session/update callback can receive them. */
const deliver = async (updates: unknown[]) => {
  const events: ActivityNotification[] = []
  const ordinary: unknown[] = []
  const app = client({ name: "activity-test" }).onNotification(methods.client.session.update, ({ params }) => { ordinary.push(params.update) })
  const stream: Stream = { writable: new WritableStream(), readable: new ReadableStream({ start(c) {
    for (const update of updates) c.enqueue({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "root", update } })
    c.close()
  } }) }
  const protocol = nativeActivity(app, stream, (event) => events.push(event))
  await app.connect(protocol.stream).closed
  return { events, ordinary, clientMeta: protocol.clientMeta }
}

test("negotiated activity events pass through the pinned SDK alongside ordinary messages", async () => {
  const { events, ordinary, clientMeta } = await deliver([
    { sessionUpdate: "subagent_spawned", subagentSessionId: "child", name: "Explorer", task: "inspect" },
    { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "root answer" } },
    { sessionUpdate: "subagent_state_update", subagentSessionId: "child", state: "cancelled" },
    { sessionUpdate: "async_task_spawned", asyncTaskId: "watch", name: "watch files", toolCallId: "command" },
    { sessionUpdate: "async_task_progress", asyncTaskId: "watch", summary: "checking" },
    { sessionUpdate: "async_task_state_update", asyncTaskId: "watch", state: "stopped" },
  ])
  expect(clientMeta.jetbrains.air).toEqual({ version: 1, capabilities: ["nativeSubagentSessions", "asyncTasks"] })
  expect(events.map((event) => event.update.kind)).toEqual(["child", "childEnded", "task", "taskProgress", "taskEnded"])
  expect(events[0]).toEqual({ session: "root", update: { kind: "child", id: "child", name: "Explorer", task: "inspect" } })
  expect(events[2]?.update).toMatchObject({ tool: "command" })
  expect(ordinary).toHaveLength(1)
})

test("malformed known events create no activity and do not prevent subsequent messages", async () => {
  const { events, ordinary } = await deliver([
    { sessionUpdate: "subagent_spawned", subagentSessionId: 7 },
    { sessionUpdate: "subagent_state_update", subagentSessionId: "child", state: "invented" },
    { sessionUpdate: "async_task_spawned", asyncTaskId: "watch", name: [] },
    { sessionUpdate: "async_task_progress", asyncTaskId: "" },
    { sessionUpdate: "async_task_state_update", asyncTaskId: "watch", state: "invented" },
    { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "still connected" } },
  ])
  expect(events).toEqual([])
  expect(ordinary).toHaveLength(1)
})

test("unknown updates and requests remain unchanged for the SDK to handle", async () => {
  const notification = { jsonrpc: "2.0" as const, method: "session/update", params: { sessionId: "root", update: { sessionUpdate: "future" } } }
  const request = { ...notification, id: 1, params: { sessionId: "root", update: { sessionUpdate: "subagent_spawned" } } }
  const stream: Stream = { writable: new WritableStream(), readable: new ReadableStream({ start(c) {
    c.enqueue(notification); c.enqueue(request); c.close()
  } }) }
  const protocol = nativeActivity(client({ name: "test" }), stream, () => {})
  const read = protocol.stream.readable.getReader()
  expect((await read.read()).value).toEqual(notification)
  expect((await read.read()).value).toEqual(request)
})

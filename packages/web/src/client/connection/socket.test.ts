import { expect, test } from "bun:test"
import { checkedSocket } from "./socket.ts"

test("closing writes fail before the platform can silently drop them; open writes keep their receiver", () => {
  const sent: unknown[] = []
  const counted = { sent: [] as number[], refused: 0 }
  const platform = {
    readyState: 1,
    send(data: unknown) { expect(this).toBe(platform); sent.push(data) },
  }
  const socket = checkedSocket(platform as unknown as WebSocket, {
    sent: (size) => counted.sent.push(size),
    refused: () => { counted.refused += 1 },
  })
  socket.send("payload")
  for (const state of [0, 2, 3]) {
    platform.readyState = state
    expect(() => socket.send("lost")).toThrow("The socket is not open")
  }
  expect(sent).toEqual(["payload"])
  expect(counted).toEqual({ sent: [7], refused: 3 })
})

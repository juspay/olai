import { expect, test } from "bun:test"
import { checkedSocket } from "./socket.ts"

test("closing writes fail before the platform can silently drop them; open writes keep their receiver", () => {
  const sent: unknown[] = []
  const platform = {
    readyState: 1,
    send(data: unknown) { expect(this).toBe(platform); sent.push(data) },
  }
  const socket = checkedSocket(platform as unknown as WebSocket)
  socket.send("payload")
  for (const state of [0, 2, 3]) {
    platform.readyState = state
    expect(() => socket.send("lost")).toThrow("The socket is not open")
  }
  expect(sent).toEqual(["payload"])
})

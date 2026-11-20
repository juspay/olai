import { expect, test } from "bun:test"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { Effect, Fiber } from "effect"

import { type ClientOrConnection } from "@kolu/surface-mcp"

import { serveFace } from "./endpoint.ts"

const parked = () => {
  const entered = Promise.withResolvers<void>()
  const held = Promise.withResolvers<void>()
  let closed = false
  const transport: Transport = {
    start: async () => { entered.resolve(); await held.promise },
    send: async () => {},
    close: async () => { closed = true },
  }
  return { transport, entered: entered.promise, release: () => { held.resolve() }, closed: () => closed }
}

const face = (transport: Transport) =>
  serveFace({ siblings: {}, client: () => ({}) as unknown as ClientOrConnection, rows: () => [], transport })

test("an adapter acquired by a half that is already stopping is still closed", async () => {
  const port = parked()
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const acquiring = yield* Effect.forkChild(face(port.transport))
    yield* Effect.promise(() => port.entered)
    const stopping = yield* Effect.forkChild(Fiber.interrupt(acquiring))
    yield* Effect.sleep("20 millis")
    port.release()
    yield* Fiber.join(stopping)
    expect(port.closed()).toBe(false)
  })))
  expect(port.closed()).toBe(true)
})

test("an adapter acquired by a half that runs is closed with its scope", async () => {
  const port = parked()
  port.release()
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    yield* face(port.transport)
    expect(port.closed()).toBe(false)
  })))
  expect(port.closed()).toBe(true)
})

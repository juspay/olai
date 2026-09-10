/**
 * THE ADAPTER'S LIFETIME, and nothing else about the face.
 *
 * What a client is handed — the resources, the tools, the HTTP envelope — is
 * asked over a real bind in `@olai/server`'s three `mcp/` benches. This one
 * asks the question those three cannot: whether the thing `serveFace` opens
 * belongs to the scope from the moment it exists, rather than from the
 * statement after it.
 *
 * It needs no vault, no bind and no listener. `serveFace` takes its siblings,
 * its client and its transport, and the transport is the seam: the adapter's
 * boot awaits `server.connect(transport)`, which awaits `transport.start()` —
 * so a transport that parks there is a half stopped mid-acquisition, held open
 * as long as the case needs it.
 */

import { expect, test } from "bun:test"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { Effect, Fiber } from "effect"

import { type ClientOrConnection } from "@kolu/surface-mcp"

import { serveFace } from "./endpoint.ts"

/** A transport that has entered `start()` and will not come out of it until it
 *  is told to — and that records having been closed. */
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

/** The face composes with no siblings at all — the agent core alone is a legal
 *  bundle — which is what lets this bench stand up an adapter with nothing
 *  behind it. */
const face = (transport: Transport) =>
  serveFace({ siblings: {}, client: () => ({}) as unknown as ClientOrConnection, transport })

test("an adapter acquired by a half that is already stopping is still closed", async () => {
  // THE HOLE: this used to await the adapter and only THEN say how to close it,
  // so a stop landing between those two statements — the panel's switch,
  // `plugins.stop`, a Ctrl+C — left an adapter with no registered release.
  const port = parked()
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const acquiring = yield* Effect.forkChild(face(port.transport))
    yield* Effect.promise(() => port.entered)
    const stopping = yield* Effect.forkChild(Fiber.interrupt(acquiring))
    // LONG ENOUGH FOR THE STOP TO HAVE LANDED, which is what makes this case
    // discriminating rather than a race: a fiber parked in an `Effect.promise`
    // is interruptible and unwinds AT ONCE, so the shape this replaced would
    // be gone by now and the adapter about to be built would have nobody left
    // to register a release with. What stands here instead is an
    // uninterruptible acquisition, waiting for the transport below.
    yield* Effect.sleep("20 millis")
    port.release()
    yield* Fiber.join(stopping)
    expect(port.closed()).toBe(false)
  })))
  // ...and the scope it was acquired on is what closes it.
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

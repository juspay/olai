/**
 * A PLUGIN'S OWN SURFACE, FROM BOTH DOORS — the one value a plugin's two files
 * share, its browser file's typed client of it, and the write gate its server
 * file is handed.
 *
 * Several claims here are TYPES, and they are held by `tsc` reading this file:
 * a `@ts-expect-error` over a call the types must refuse is an error of its own
 * when the types stop refusing it, so `bun run typecheck` fails the day the
 * client goes back to `unknown` or the gate to `unknown`.
 */
import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"

import * as browser from "./index.ts"
import * as server from "./services.ts"

const surface = browser.defineSurface({
  procedures: {
    reader: {
      mark: { input: Schema.Struct({ word: Schema.String }), output: Schema.Number },
    },
  },
})

test("both doors export the one defineSurface", () => {
  expect(typeof browser.defineSurface).toBe("function")
  expect(server.defineSurface).toBe(browser.defineSurface)
})

test("the browser door types a plugin's own client, and answers null where there is none", () => {
  const calls: Array<unknown> = []
  const client = { procedures: { reader: { mark: (input: unknown) => Effect.sync(() => { calls.push(input); return 1 }) } } }
  const typed = browser.clientOf(surface, { client: () => client })
  expect(typed).toBe(client as unknown as typeof typed)
  Effect.runSync(typed!.procedures.reader.mark({ word: "boa" }))
  expect(calls).toEqual([{ word: "boa" }])
  // @ts-expect-error — a member the surface does not declare is not on its client
  void typed?.procedures.reader.unmark
  // @ts-expect-error — an input the member does not take is refused
  void typed?.procedures.reader.mark({ word: 1 })
  expect(browser.clientOf(surface, { client: () => null })).toBeNull()
})

test("the server door's Ops carries the write gate's own type", () => {
  // A function the types must accept with no cast: `Ops.gate` IS the gate.
  const gateOf = (ops: server.Ops): server.Gate => ops.gate
  const runs = (gate: server.Gate) => (request: server.WriteRequest, writer: server.Writer): Effect.Effect<server.WriteResult, server.OpFailure> =>
    gate.run(request, writer)
  expect(typeof gateOf).toBe("function")
  expect(typeof runs).toBe("function")
})

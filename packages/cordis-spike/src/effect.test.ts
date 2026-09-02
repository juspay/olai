/**
 * Does Cordis's Proxy-mediated `ctx` cooperate with Effect fibers?
 */

import { Effect } from "effect"
import { describe, expect, test } from "bun:test"

import { boot } from "./boot.ts"

describe("Proxy ctx × Effect", () => {
  test("property access inside Effect.gen sees the provided service", async () => {
    const ctx = await boot()
    const program = Effect.gen(function* () {
      const served = ctx.vault.served
      const kinds = ctx.kinds.table.size
      yield* Effect.void
      return { served, kinds }
    })
    const got = await Effect.runPromise(program)
    expect(got.served).toBe("/tmp/cordis-spike-vault")
    expect(got.kinds).toBe(0)
  })

  test("a nested Effect still reads ctx through the Proxy", async () => {
    const ctx = await boot()
    const n = await Promise.resolve().then(() =>
      Effect.runPromise(Effect.sync(() => ctx.surfaces.coreTags().length)),
    )
    expect(n).toBeGreaterThan(0)
  })

  test("ctx.effect disposers still run when the work inside was Effect", async () => {
    const ctx = await boot()
    let disposed = false
    const fiber = ctx.plugin({
      name: "effect-work",
      inject: ["vault"],
      apply() {
        return () => {
          disposed = true
        }
      },
    })
    await fiber
    await Effect.runPromise(Effect.sync(() => ctx.vault.now()))
    await fiber.dispose()
    expect(disposed).toBe(true)
  })
})

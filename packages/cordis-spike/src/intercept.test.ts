/**
 * Where subtree-fence intercept metadata would be consulted.
 *
 * Cordis carries intercept on the context and merges it into a Service's
 * config via `Service[resolveConfig]`. The store's `commit` is an Effect
 * and does not read a Cordis context. The fence therefore cannot live in
 * the store; it lives on a `vault` service wrapping it.
 */

import { describe, expect, test } from "bun:test"
import { Context, Service, symbols } from "cordis"
import { readFileSync } from "node:fs"
import { join } from "node:path"

class Boxed extends Service {
  constructor(ctx: Context) {
    super(ctx, "boxed")
  }

  fence(): { writable?: string } {
    return this[symbols.resolveConfig]() as { writable?: string }
  }
}

describe("intercept metadata for the subtree fence", () => {
  test("ctx.intercept(key, meta) is what Service.resolveConfig reads", async () => {
    const ctx = new Context()
    await ctx.plugin(Boxed)
    type WithBoxed = Context & { boxed: Boxed }
    expect((ctx as WithBoxed).boxed.fence()).toEqual({})
    const child = ctx.intercept("boxed", { writable: "/tmp/subtree" })
    // Same service instance, reached through the derived context — intercept
    // is merged at use, not at construction, and does not reload the fiber.
    expect((child as WithBoxed).boxed.fence()).toEqual({ writable: "/tmp/subtree" })
    expect((ctx as WithBoxed).boxed.fence()).toEqual({})
  })

  test("the store's commit does not mention intercept or a writable fence", () => {
    const store = readFileSync(
      join(import.meta.dirname, "../../store/src/store.ts"),
      "utf8",
    )
    expect(store).toContain("readonly commit:")
    expect(store.toLowerCase()).not.toContain("intercept")
    expect(store).not.toContain("writable")
  })
})

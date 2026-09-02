/**
 * A throwing `apply` lands the fiber in FAILED; a sibling fiber is untouched.
 */

import { defineSurface } from "@kolu/surface/define"
import { inMemoryStore } from "@kolu/surface/server"
import { Schema } from "effect"
import { describe, expect, test } from "bun:test"
import type { Context } from "cordis"

import { SERVERS } from "@olai/plugin-api/server"

import { boot } from "./boot.ts"
import { FiberState } from "./fiber-state.ts"
import { asFiber } from "./tenant.ts"

const tenantSurface = defineSurface({
  cells: { fleet: { schema: Schema.String, default: "" } },
})

const keeper = {
  name: "keep",
  inject: ["vault", "deliveries", "kinds", "surfaces"],
  apply(ctx: Context) {
    ctx.surfaces.register({
      name: "keep",
      surface: tenantSurface,
      faces: { browser: { fleet: "resource" } },
      deps: { cells: { fleet: { store: inMemoryStore("") } } },
    })
  },
}

const boom = {
  name: "boom",
  inject: ["vault", "deliveries", "kinds", "surfaces"],
  apply() {
    throw new Error("padi socket gone at boot")
  },
}

describe("a throwing apply lands FAILED and does not take a sibling with it", () => {
  test("the throwing fiber is FAILED; the keeper stays ACTIVE with its tags", async () => {
    const ctx = await boot()
    const kept = ctx.plugin(keeper)
    await kept
    const thrown = ctx.plugin(boom)
    try {
      await thrown
    } catch {
      // FAILED is the result — the thenable has no .catch
    }
    expect(thrown.state).toBe(FiberState.FAILED)
    expect(kept.state).toBe(FiberState.ACTIVE)
    expect(ctx.surfaces.fusedTags()).toContain("surface/keep/fleet/get")
    expect(ctx.surfaces.siblings.has("keep")).toBe(true)
  })

  test("the real agent-runner tenant stays ACTIVE when a neighbour throws", async () => {
    const ctx = await boot()
    const half = SERVERS.find((one) => one.name === "kolu")
    expect(half).toBeDefined()
    const kept = ctx.plugin(asFiber(half!))
    await kept
    const thrown = ctx.plugin(boom)
    try {
      await thrown
    } catch {
      // FAILED is the result
    }
    expect(thrown.state).toBe(FiberState.FAILED)
    expect(kept.state).toBe(FiberState.ACTIVE)
    expect(ctx.surfaces.fusedTags().some((tag) => tag.startsWith("surface/kolu/"))).toBe(true)
    await kept.dispose()
  })
})

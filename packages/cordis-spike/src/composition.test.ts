/**
 * `disabled: true` at RUNTIME leaves core's tags byte-identical —
 * composition.test.ts's claim, held at every moment rather than only at boot.
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

const synthetic = {
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

describe("disabled at runtime leaves core's tags byte-identical", () => {
  test("a live sibling fuses under its name, and core does not move", async () => {
    const ctx = await boot()
    const before = ctx.surfaces.coreTags()
    const fiber = ctx.plugin(synthetic)
    await fiber
    expect(fiber.state).toBe(FiberState.ACTIVE)
    expect(ctx.surfaces.fusedTags()).toContain("surface/keep/fleet/get")
    expect(ctx.surfaces.fusedTags()).toContain("surface/errors/get")
    expect(ctx.surfaces.coreTags()).toEqual(before)
    await fiber.dispose()
  })

  test("disposing the sibling (runtime disabled) restores core's tags exactly", async () => {
    const ctx = await boot()
    const before = ctx.surfaces.coreTags()
    const fiber = ctx.plugin(synthetic)
    await fiber
    expect(ctx.surfaces.fusedTags()).not.toEqual(before)
    await fiber.dispose()
    expect(ctx.surfaces.coreTags()).toEqual(before)
    expect(ctx.surfaces.fusedTags()).toEqual(before)
    expect(ctx.surfaces.fusedTags().some((tag) => tag.startsWith("surface/keep/"))).toBe(false)
  })

  test("the real CI tenant composes under its own name, and unload is absence", async () => {
    const ctx = await boot()
    const before = ctx.surfaces.coreTags()
    const half = SERVERS.find((one) => one.name === "odu")
    expect(half).toBeDefined()
    ctx.surfaces.builtNames = SERVERS.map((one) => one.name)
    const fiber = ctx.plugin(asFiber(half!))
    await fiber
    expect(fiber.state).toBe(FiberState.ACTIVE)
    expect(ctx.surfaces.fusedTags().some((tag) => tag.startsWith("surface/odu/"))).toBe(true)
    expect(ctx.surfaces.coreTags()).toEqual(before)
    expect(ctx.surfaces.roster.built.find((row) => row.name === "odu")?.running).toBe(true)
    await fiber.dispose()
    expect(ctx.surfaces.fusedTags()).toEqual(before)
    expect(ctx.surfaces.roster.built.find((row) => row.name === "odu")?.running).toBe(false)
  })
})

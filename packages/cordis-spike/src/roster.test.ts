/**
 * `Surfaces.roster` is spike-local. The real cell is `@olai/surface`'s
 * `plugins`. This spike does not wire that cell — touching the house for a
 * throwaway is out of scope. What it does prove: the value `publishRoster`
 * produces is a `PluginRoster`, so a composition root that set the cell
 * from it would decode.
 */

import { Schema } from "effect"
import { describe, expect, test } from "bun:test"

import { SERVERS } from "@olai/plugin-api/server"
import { NO_ROSTER, PluginRoster } from "@olai/surface"

import { boot } from "./boot.ts"
import { asFiber } from "./tenant.ts"

describe("the spike roster is the plugins cell's shape", () => {
  test("the empty roster is NO_ROSTER, and it decodes", async () => {
    const ctx = await boot()
    expect(ctx.surfaces.roster).toEqual(NO_ROSTER)
    expect(Schema.is(PluginRoster)(ctx.surfaces.roster)).toBe(true)
  })

  test("a live tenant's roster decodes as PluginRoster, running and not", async () => {
    const ctx = await boot()
    const half = SERVERS.find((one) => one.name === "odu")
    expect(half).toBeDefined()
    ctx.surfaces.builtNames = SERVERS.map((one) => one.name)
    const fiber = ctx.plugin(asFiber(half!))
    await fiber
    expect(Schema.is(PluginRoster)(ctx.surfaces.roster)).toBe(true)
    expect(ctx.surfaces.roster.pinned).toEqual(["odu"])
    const rows = Object.fromEntries(ctx.surfaces.roster.built.map((row) => [row.name, row.running]))
    expect(rows["odu"]).toBe(true)
    expect(rows["kolu"]).toBe(false)
    await fiber.dispose()
    expect(Schema.is(PluginRoster)(ctx.surfaces.roster)).toBe(true)
    expect(ctx.surfaces.roster.built.every((row) => row.running === false)).toBe(true)
  })
})

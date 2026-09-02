/**
 * `--plugins` expressed as a loader patch: a row left out is `disabled: true`,
 * and the loader disposing that row is the same absence composition.test.ts
 * already holds at boot.
 */

import { defineSurface } from "@kolu/surface/define"
import { inMemoryStore } from "@kolu/surface/server"
import { Schema } from "effect"
import { describe, expect, test } from "bun:test"
import type { Context } from "cordis"

import { SERVERS } from "@olai/plugin-api/server"

import { boot } from "./boot.ts"
import { FiberState } from "./fiber-state.ts"
import { pluginsPatch } from "./patch.ts"

const tenantSurface = defineSurface({
  cells: { fleet: { schema: Schema.String, default: "" } },
})

const applyNamed = (key: string) => ({
  name: key,
  inject: ["vault", "deliveries", "kinds", "surfaces"],
  apply(ctx: Context) {
    ctx.surfaces.register({
      name: key,
      surface: tenantSurface,
      faces: { browser: { fleet: "resource" } },
      deps: { cells: { fleet: { store: inMemoryStore("") } } },
    })
  },
})

describe("--plugins is a loader patch", () => {
  test("null (nobody said) writes no disabled flag", () => {
    const built = SERVERS.map((one) => ({ id: one.name, name: `cordis:${one.name}` }))
    expect(pluginsPatch(built, null)).toEqual([
      { id: "kolu", name: "cordis:kolu" },
      { id: "odu", name: "cordis:odu" },
    ])
  })

  test("a list disables every built row it left out", () => {
    const built = SERVERS.map((one) => ({ id: one.name, name: `cordis:${one.name}` }))
    expect(pluginsPatch(built, ["odu"])).toEqual([
      { id: "kolu", name: "cordis:kolu", disabled: true },
      { id: "odu", name: "cordis:odu" },
    ])
  })

  test("an empty list is --plugins= : every row disabled", () => {
    const built = SERVERS.map((one) => ({ id: one.name, name: `cordis:${one.name}` }))
    expect(pluginsPatch(built, [])).toEqual([
      { id: "kolu", name: "cordis:kolu", disabled: true },
      { id: "odu", name: "cordis:odu", disabled: true },
    ])
  })

  test("the loader applying that patch leaves the disabled fiber unmounted", async () => {
    const ctx = await boot({ loader: true })
    const keep = applyNamed("keep")
    const drop = applyNamed("drop")
    ctx.loader.builtins.keep = keep
    ctx.loader.builtins.drop = drop
    const patch = pluginsPatch(
      [
        { id: "keep", name: "cordis:keep" },
        { id: "drop", name: "cordis:drop" },
      ],
      ["keep"],
    )
    await ctx.loader.root.update([...patch])
    await ctx.loader.await()
    const byId = (id: string) => ctx.loader.store[id]
    expect(byId("keep")?.fiber?.state).toBe(FiberState.ACTIVE)
    expect(byId("drop")?.fiber).toBeUndefined()
    expect(byId("drop")?.options.disabled).toBe(true)
    expect(ctx.surfaces.siblings.has("keep")).toBe(true)
    expect(ctx.surfaces.siblings.has("drop")).toBe(false)
  })

  test("disabled: true applied later disposes the live fiber", async () => {
    const ctx = await boot({ loader: true })
    ctx.loader.builtins.keep = applyNamed("keep")
    await ctx.loader.root.update([{ id: "keep", name: "cordis:keep" }])
    await ctx.loader.await()
    expect(ctx.surfaces.siblings.has("keep")).toBe(true)
    const before = ctx.surfaces.coreTags()
    await ctx.loader.update("keep", { disabled: true })
    await ctx.loader.await()
    expect(ctx.surfaces.siblings.has("keep")).toBe(false)
    expect(ctx.surfaces.fusedTags()).toEqual(before)
  })
})

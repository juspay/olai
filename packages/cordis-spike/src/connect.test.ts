/**
 * Can `@kolu/surface` add/drop a sibling on a live group, and does
 * `connectSurfaces` tolerate a roster change?
 *
 * Server: `implementSurfaces` + `mergeDisjointGroups` are one-shot over the
 * map they are handed. Re-calling them with a new map is how this spike's
 * `ctx.surfaces` re-composes — there is no incremental add/drop on a live
 * group.
 *
 * Client: `connectSurfaces` takes `surfaces` at the call. `SurfacesConnection`
 * has no update. A roster change is a new call, which is a reconnect.
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { boot } from "./boot.ts"
import { FiberState } from "./fiber-state.ts"

describe("live sibling add/drop", () => {
  test("ctx.surfaces re-composes on register and on dispose", async () => {
    const { defineSurface } = await import("@kolu/surface/define")
    const { inMemoryStore } = await import("@kolu/surface/server")
    const { Schema } = await import("effect")
    const tenant = defineSurface({
      cells: { fleet: { schema: Schema.String, default: "" } },
    })
    const ctx = await boot()
    const fiber = ctx.plugin({
      name: "keep",
      inject: ["surfaces"],
      apply() {
        return ctx.surfaces.register({
          name: "keep",
          surface: tenant,
          faces: {},
          deps: { cells: { fleet: { store: inMemoryStore("") } } },
        })
      },
    })
    await fiber
    expect(fiber.state).toBe(FiberState.ACTIVE)
    expect(ctx.surfaces.fusedTags()).toContain("surface/keep/fleet/get")
    const published: Array<string> = []
    ctx.on("surfaces/published", (roster) => {
      published.push(roster.built.filter((row) => row.running).map((row) => row.name).join(","))
    })
    await fiber.dispose()
    expect(ctx.surfaces.fusedTags().some((tag) => tag.includes("/keep/"))).toBe(false)
    expect(published.length).toBeGreaterThan(0)
  })

  test("connectSurfaces bakes the sibling map at the call — no live update", () => {
    const src = readFileSync(
      join(import.meta.dirname, "../../../node_modules/@kolu/surface-app/src/solid/connectSurfaces.ts"),
      "utf8",
    )
    expect(src).toContain("export async function connectSurfaces")
    expect(src).toContain("surfaces: E")
    // Construction option, not a method on the connection.
    expect(src).not.toMatch(/SurfacesConnection[\s\S]*update\(/)
    expect(src).toContain("dispose: () => Promise<void>")
  })
})

/**
 * THE COMPOSITION, held as claims — and the one claim it exists for is that
 * NO PLUGINS is a state and not an edge case.
 *
 * ## Why this file is mostly about the empty record
 *
 * `--plugins` off, `olai surface`, the headless MCP faces and every test in
 * `@olai/server` compose a runtime with no plugins at all, which reaches
 * `implementSurfaces` as `{}`. That path is the ordinary one for most of the
 * processes olai runs, and it is the one nobody would notice breaking until a
 * one-shot CLI read stopped booting — so what it composes to is asserted here
 * rather than reasoned about: an empty group, an empty handler record, and a
 * fusion that leaves olai's own surface BYTE FOR BYTE what it was.
 *
 * That last one is the load-bearing claim of the whole arrangement. Core keeps
 * `implementSurface` and its tags are unchanged (`./compose.ts` argues why it
 * does not become a sibling); if the fusion could move one of them, every MCP
 * client's URIs and every tag assertion in the suite would move with it.
 *
 * ## ...and the two REAL plugins, at the group level only
 *
 * The second half asks what `@olai/plugins` actually composes today: that each
 * enabled plugin's members land at `surface/<its own name>/`, that no general
 * package computed that address, and that a face built over the bundle names
 * exactly the tags the bundle serves. It is all group-and-exposure work —
 * `composeSurfaceContracts` and `exposeFaces` take surfaces and never deps — so
 * it runs on the WIRE door alone and dials nothing. What a plugin's SERVER half
 * does with a revision is that plugin's own bench.
 */

import { defineSurface } from "@kolu/surface/define"
import { exposeFace, exposeFaces, restrictHandlers } from "@kolu/surface/expose"
import {
  implementSurface,
  implementSurfaces,
  inMemoryStore,
  type SurfaceMap,
} from "@kolu/surface/server"
import { Schema } from "effect"
import { describe, expect, test } from "bun:test"

import { fuseFaces, fuseGroups, fuseHandlers } from "./compose.ts"
import { exposeMapsOf, surfacesOf, WIRES } from "./surfaces.ts"

/** A stand-in for olai's own surface — one cell, which is enough to ask every
 *  question here. The real one is `@olai/surface`'s and is deliberately not
 *  imported: this package sits BELOW it (its manifest declines the dependency
 *  for the cycle it would be), and what is under test is the composition, not
 *  olai's spec. */
const core = defineSurface({
  cells: { errors: { schema: Schema.String, default: "" } },
})

/** ...and a plugin-shaped one, for the non-empty half. */
const tenant = defineSurface({
  cells: { fleet: { schema: Schema.String, default: "" } },
})

const coreRuntime = () =>
  implementSurface(core, { cells: { errors: { store: inMemoryStore("") } } })

describe("no plugins", () => {
  test("an empty sibling record composes without throwing", () => {
    // The claim `@olai/server`'s OFF setting rests on. `composeSurfaceContracts`
    // walks the record it is handed and `implementSurfaces` walks the same keys
    // for deps, so an empty one is a walk of nothing — but "nothing" and "a
    // refusal" look alike from a header, and every headless face in the tree
    // takes this path.
    const bundle = implementSurfaces({}, {}, {})
    expect(bundle.group.requests.size).toBe(0)
    expect(Object.keys(bundle.handlers)).toEqual([])
    expect(Object.keys(bundle.ctx)).toEqual([])
  })

  test("fusing it onto olai's own surface moves not one tag", () => {
    // The one that would be noticed last and cost most: a composition that
    // renamed a core tag would move every MCP client's URI and every tag
    // assertion in the suite.
    const runtime = coreRuntime()
    const bundle = implementSurfaces({}, {}, {})
    const fused = fuseGroups(runtime.group, bundle.group)
    expect([...fused.requests.keys()].sort()).toEqual(
      [...runtime.group.requests.keys()].sort(),
    )
    const handlers = fuseHandlers(fused, runtime.handlers, bundle.handlers)
    expect(Object.keys(handlers).sort()).toEqual(Object.keys(runtime.handlers).sort())
  })

  test("a face over the empty bundle is olai's own face, and it binds", () => {
    // `restrictHandlers` compares an exposure's universe with the served group
    // as a set EQUALITY in both directions and refuses at boot naming what it
    // cannot account for. That refusal is what makes the gate trustworthy and
    // is also the thing an OFF setting could trip over, so it is asked here
    // rather than discovered on somebody's machine.
    const runtime = coreRuntime()
    const bundle = implementSurfaces({}, {}, {})
    const fused = fuseGroups(runtime.group, bundle.group)
    const handlers = fuseHandlers(fused, runtime.handlers, bundle.handlers)
    const face = fuseFaces(
      exposeFace(core, { errors: "resource" }),
      exposeFaces({}, {}),
    )
    expect(() => restrictHandlers(fused, handlers, face)).not.toThrow()
  })
})

describe("one plugin", () => {
  const bundleOf = () =>
    implementSurfaces({ kolu: tenant }, {}, {
      kolu: { cells: { fleet: { store: inMemoryStore("") } } },
    })

  test("its members land under its own name, and olai's do not move", () => {
    const runtime = coreRuntime()
    const bundle = bundleOf()
    const fused = fuseGroups(runtime.group, bundle.group)
    expect(fused.requests.has("surface/kolu/fleet/get")).toBe(true)
    // The sibling prefix is what makes the fusion safe: a core tag has three
    // segments and a sibling's has four, and the framework forbids a `/` inside
    // a name — so the two sets cannot intersect however the members are called.
    expect(fused.requests.has("surface/errors/get")).toBe(true)
    expect(fused.requests.has("surface/fleet/get")).toBe(false)
  })

  test("a face that forgot the plugin refuses to bind, naming what it cannot describe", () => {
    // The right failure, and the reason `./compose.ts` does not try to be clever
    // about a missing half: a default-deny gate built from the wrong surface
    // grants nothing and still binds, which is the one failure mode that looks
    // like success from outside.
    const runtime = coreRuntime()
    const bundle = bundleOf()
    const fused = fuseGroups(runtime.group, bundle.group)
    const handlers = fuseHandlers(fused, runtime.handlers, bundle.handlers)
    expect(() =>
      restrictHandlers(fused, handlers, exposeFace(core, { errors: "resource" }))
    ).toThrow(/surface\/kolu\//)
  })
})

describe("the plugins this binary was built with", () => {
  test("every one composes under its own name, and nothing else does", () => {
    const siblings = surfacesOf(WIRES) as unknown as SurfaceMap
    const face = fuseFaces(
      { universe: new Set<string>(), tags: new Set<string>() },
      exposeFaces(siblings, exposeMapsOf(WIRES, "browser") as never),
    )
    // Every tag the bundle serves begins `surface/<one of ours>/`, which is the
    // polymorphism claim as a fact about the strings: no line in olai computed
    // any of these addresses.
    const owners: ReadonlySet<string> = new Set(WIRES.map((wire) => wire.name))
    for (const tag of face.universe) {
      const [, owner] = tag.split("/")
      expect([tag, owners.has(owner ?? "")]).toEqual([tag, true])
    }
    // ...and each plugin actually contributed some, so the walk above is not
    // vacuous over an empty universe.
    for (const wire of WIRES) {
      expect([
        wire.name,
        [...face.universe].some((tag) => tag.startsWith(`surface/${wire.name}/`)),
      ]).toEqual([wire.name, true])
    }
  })

  test("no plugin asks for the agent's face, and the denial is the DATA", () => {
    // Neither tenant writes an `agent` map, so `exposeMapsOf` answers with an
    // empty record and `exposeFaces` denies every sibling in full — the universe
    // still names their tags, so the face binds and each member answers
    // `SurfaceMemberNotExposed` to whoever asks. Nothing in `@olai/server` says
    // "plugins are browser-only"; the day one of them decides otherwise it
    // writes the map in its own package and the composition changes nothing.
    expect(exposeMapsOf(WIRES, "agent")).toEqual({})
    const siblings = surfacesOf(WIRES) as unknown as SurfaceMap
    const denied = exposeFaces(siblings, {})
    expect(denied.tags.size).toBe(0)
    expect(denied.universe.size).toBeGreaterThan(0)
    // ...and the browser's is not empty, so the assertion above is about a
    // decision rather than about a helper that answers nothing.
    expect(exposeFaces(siblings, exposeMapsOf(WIRES, "browser") as never).tags.size)
      .toBeGreaterThan(0)
  })
})

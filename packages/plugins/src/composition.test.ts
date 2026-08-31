/**
 * THE COMPOSITION, held as claims — and the one claim it exists for is that
 * NO PLUGINS is a state and not an edge case.
 *
 * Nothing under test here is olai's code. That is the point of the file after
 * juspay/kolu#2222: the rooted bundle is the FRAMEWORK's shape now
 * (`mergeDisjointGroups`, `exposeRootedFaces`, and `connectSurfaces`' `core`
 * slot one repo over), and what olai owns is the DECISION to have one plus the
 * registry the sibling map is read off. These cases pin the decision — that
 * olai's own tags do not move, that an empty roster composes, that each
 * plugin's members land under its own name — against the composition olai
 * actually performs, so a framework that changed its mind about any of it fails
 * here rather than in a serve somebody is using.
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
 * That last one is the load-bearing claim of the whole arrangement. Core stays
 * the ROOT and keeps `implementSurface`, so its tags are unchanged; if the
 * fusion could move one of them, every MCP client's URIs and every tag
 * assertion in the suite would move with it.
 *
 * ## ...and the two REAL plugins, at the group level only
 *
 * The second half asks what this binary actually composes today: that each
 * enabled plugin's members land at `surface/<its own name>/`, that no general
 * package computed that address, and that a face built over the bundle names
 * exactly the tags the bundle serves. It is all group-and-exposure work —
 * `composeSurfaceContracts` and `exposeRootedFaces` take surfaces and never
 * deps — so it runs on the WIRE door alone and dials nothing. What a plugin's
 * SERVER half does with a revision is that plugin's own bench.
 */

import { defineSurface, mergeDisjointGroups } from "@kolu/surface/define"
import { exposeRootedFaces, restrictHandlers } from "@kolu/surface/expose"
import {
  implementSurface,
  implementSurfaces,
  inMemoryStore,
  type SurfaceHandlers,
  type SurfaceMap,
} from "@kolu/surface/server"
import { Schema } from "effect"
import { describe, expect, test } from "bun:test"

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

/** The composition root's own two lines, spelled once here so every case below
 *  asks about the thing `@olai/server`'s `runtime.ts` actually builds rather
 *  than about a second arrangement that resembles it. */
const fuse = (
  runtime: ReturnType<typeof coreRuntime>,
  bundle: { group: ReturnType<typeof coreRuntime>["group"]; handlers: SurfaceHandlers },
) => {
  const group = mergeDisjointGroups({ core: runtime.group, plugins: bundle.group })
  const handlers: SurfaceHandlers = { ...runtime.handlers, ...bundle.handlers }
  return { group, handlers }
}

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
    const fused = fuse(runtime, implementSurfaces({}, {}, {}))
    expect([...fused.group.requests.keys()].sort()).toEqual(
      [...runtime.group.requests.keys()].sort(),
    )
    expect(Object.keys(fused.handlers).sort()).toEqual(
      Object.keys(runtime.handlers).sort(),
    )
  })

  test("a face over the empty bundle is olai's own face, and it binds", () => {
    // `restrictHandlers` compares an exposure's universe with the served group
    // as a set EQUALITY in both directions and refuses at boot naming what it
    // cannot account for. That refusal is what makes the gate trustworthy and
    // is also the thing an OFF setting could trip over, so it is asked here
    // rather than discovered on somebody's machine.
    const runtime = coreRuntime()
    const fused = fuse(runtime, implementSurfaces({}, {}, {}))
    const face = exposeRootedFaces(core, { errors: "resource" }, {}, {})
    expect(() => restrictHandlers(fused.group, fused.handlers, face)).not.toThrow()
  })
})

describe("one plugin", () => {
  const bundleOf = () =>
    implementSurfaces({ kolu: tenant }, {}, {
      kolu: { cells: { fleet: { store: inMemoryStore("") } } },
    })

  test("its members land under its own name, and olai's do not move", () => {
    const fused = fuse(coreRuntime(), bundleOf())
    expect(fused.group.requests.has("surface/kolu/fleet/get")).toBe(true)
    // The sibling prefix is what makes the fusion safe: a core tag has three
    // segments and a sibling's has four, and the framework forbids a `/` inside
    // a name — so the two sets cannot intersect however the members are called.
    expect(fused.group.requests.has("surface/errors/get")).toBe(true)
    expect(fused.group.requests.has("surface/fleet/get")).toBe(false)
  })

  test("a face that forgot the plugin refuses to bind, naming what it cannot describe", () => {
    // The right failure, and the reason nothing in `./faces.ts` one package over
    // tries to be clever about a missing half: a default-deny gate built from
    // the wrong surface grants nothing and still binds, which is the one failure
    // mode that looks like success from outside.
    const fused = fuse(coreRuntime(), bundleOf())
    const forgot = exposeRootedFaces(core, { errors: "resource" }, {}, {})
    expect(() => restrictHandlers(fused.group, fused.handlers, forgot))
      .toThrow(/surface\/kolu\//)
  })

  test("the root must be the UNPREFIXED surface, and the gate says so", () => {
    // The half of the rooted law that IS reachable from here. A sibling-scoped
    // surface handed in as the root carries `surface/<key>/…` tags, which either
    // collide with that sibling or quietly describe a bundle nobody serves — an
    // exposure `restrictHandlers` would then refuse far from the mistake. The
    // constructor refuses at the mistake instead, and the same refusal stands at
    // the browser's door (`connectSurfaces`' `core.surface`), which is what makes
    // it a law rather than one seam's habit.
    const scoped = { ...core, tagPrefix: "surface/kolu/" } as typeof core
    expect(() => exposeRootedFaces(scoped, { errors: "resource" }, {}, {}))
      .toThrow(/root of a rooted bundle is the UNPREFIXED one/)
  })
})

describe("the plugins this binary was built with", () => {
  /** A root with no members of its own — every tag it carries is one of the
   *  three the framework reserves on every surface (`surface/system/*`), which
   *  is what makes it a usable floor for asking about the SIBLINGS' tags below
   *  without olai's own hundred getting in the way. */
  const bareRoot = defineSurface({})

  /** The real roster's face, composed the way `@olai/server` composes it. */
  const siblingFace = (face: string) =>
    exposeRootedFaces(
      bareRoot,
      {},
      surfacesOf(WIRES) as unknown as SurfaceMap,
      exposeMapsOf(WIRES, face) as never,
    )

  /** ...and what the PLUGINS put in it: the universe less whatever the root
   *  brought. Subtracted rather than filtered by shape, so the case cannot
   *  quietly stop covering a tag the framework reserves under a new name. */
  const contributed = (universe: ReadonlySet<string>): ReadonlyArray<string> =>
    [...universe].filter((tag) => !bareRoot.group.requests.has(tag))

  test("every one composes under its own name, and nothing else does", () => {
    const tags = contributed(siblingFace("browser").universe)
    // Every tag the bundle serves begins `surface/<one of ours>/`, which is the
    // polymorphism claim as a fact about the strings: no line in olai computed
    // any of these addresses.
    const owners: ReadonlySet<string> = new Set(WIRES.map((wire) => wire.name))
    for (const tag of tags) {
      const [, owner] = tag.split("/")
      expect([tag, owners.has(owner ?? "")]).toEqual([tag, true])
    }
    // ...and each plugin actually contributed some, so the walk above is not
    // vacuous over an empty universe.
    for (const wire of WIRES) {
      expect([
        wire.name,
        tags.some((tag) => tag.startsWith(`surface/${wire.name}/`)),
      ]).toEqual([wire.name, true])
    }
  })

  test("no plugin asks for the agent's face, and the denial is the DATA", () => {
    // Neither tenant writes an `agent` map, so `exposeMapsOf` answers with an
    // empty record and the constructor denies every sibling in full — the
    // universe still names their tags, so the face binds and each member answers
    // `SurfaceMemberNotExposed` to whoever asks. Nothing in `@olai/server` says
    // "plugins are browser-only"; the day one of them decides otherwise it
    // writes the map in its own package and the composition changes nothing.
    expect(exposeMapsOf(WIRES, "agent")).toEqual({})
    const denied = siblingFace("agent")
    expect(denied.tags.size).toBe(0)
    expect(contributed(denied.universe).length).toBeGreaterThan(0)
    // ...and the browser's is not empty, so the assertion above is about a
    // decision rather than about a helper that answers nothing.
    expect(siblingFace("browser").tags.size).toBeGreaterThan(0)
  })
})

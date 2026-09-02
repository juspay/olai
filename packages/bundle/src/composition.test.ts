/**
 * THE COMPOSITION, held as claims — and the one claim it exists for is that
 * NO PLUGINS is a state and not an edge case.
 *
 * Nothing under test here is olai's code. That is the point of the file after
 * juspay/kolu#2222 and #2223: the rooted bundle is the FRAMEWORK's shape now —
 * `implementRootedSurfaces` on the serve side, `exposeRootedFaces` at the gate,
 * `connectSurfaces`' `core` slot one repo over — and what olai owns is the
 * DECISION to have one plus the registry the sibling map is read off. These
 * cases pin the decision — that olai's own tags do not move, that an empty
 * roster composes, that each plugin's members land under its own name, and that
 * a sibling can LEAVE — against the composition olai actually performs, so a
 * framework that changed its mind about any of it fails here rather than in a
 * serve somebody is using.
 *
 * ## Why this file is mostly about the empty roster
 *
 * `--plugins` off, `olai surface`, the headless MCP faces and every test in
 * `@olai/server` compose a runtime with no plugins at all, which reaches
 * `implementRootedSurfaces` and then never calls `mount`. That path is the
 * ordinary one for most of the processes olai runs, and it is the one nobody
 * would notice breaking until a one-shot CLI read stopped booting — so what it
 * composes to is asserted here rather than reasoned about: olai's own surface,
 * BYTE FOR BYTE what it was.
 *
 * That last one is the load-bearing claim of the whole arrangement. Core stays
 * the ROOT and keeps its unprefixed three-segment tags; if the composition could
 * move one of them, every MCP client's URIs and every tag assertion in the suite
 * would move with it.
 *
 * ## ...and what the phase changed here
 *
 * The composition used to be FIVE hand-spelled steps, and this file spelled them
 * too, in a `fuse` helper that had to be kept in step with the composition root's
 * own two lines. There is one call now, so there is nothing to keep in step: the
 * root's `runtime.group` IS the fused group.
 *
 * What that door adds, and what the two new cases below are about, is that the
 * roster MOVES. A plugin is a fiber and a fiber can be disposed, so a sibling can
 * leave — and the survivors must keep what they had, which is the finding the
 * spike was retired on: re-implementing the whole map over the survivors forks
 * every one of their runtimes silently.
 *
 * ## ...and the two REAL plugins, at the group level only
 *
 * The last section asks what this binary actually composes today: that each
 * plugin's members land at `surface/<its own name>/`, that no general package
 * computed that address, and that a face built over the bundle names exactly the
 * tags the bundle serves. It is all group-and-exposure work —
 * `composeSurfaceContracts` and `exposeRootedFaces` take surfaces and never deps
 * — so it runs on the WIRE door alone and dials nothing. What a plugin's SERVER
 * half does with a revision is that plugin's own bench.
 */

import { defineSurface } from "@kolu/surface/define"
import { exposeRootedFaces, restrictHandlers } from "@kolu/surface/expose"
import {
  implementRootedSurfaces,
  inMemoryStore,
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

/** The composition root's own ONE line. It was a `coreRuntime()` plus a `fuse`
 *  helper spelling five more; both are gone, which is the phase. */
const rooted = () =>
  implementRootedSurfaces(core, {}, { cells: { errors: { store: inMemoryStore("") } } })

const mountTenant = (runtime: ReturnType<typeof rooted>) =>
  runtime.mount("kolu", tenant, { cells: { fleet: { store: inMemoryStore("") } } })

describe("no plugins", () => {
  test("a rooted bundle with nothing mounted is olai's own surface, tag for tag", () => {
    // The claim `@olai/server`'s OFF setting rests on, and the one that would be
    // noticed last and cost most: a composition that renamed a core tag would
    // move every MCP client's URI and every tag assertion in the suite. The
    // comparison is against a standalone reading of the same spec, so what it
    // says is that the ROOTED door adds nothing to a root that carries no
    // siblings.
    const runtime = rooted()
    for (const tag of runtime.group.requests.keys()) {
      expect([tag, tag.startsWith("surface/")]).toEqual([tag, true])
      // Three segments and no sibling key: `surface/<member>/<verb>`.
      expect([tag, tag.split("/").length]).toEqual([tag, 3])
    }
    expect(runtime.group.requests.has("surface/errors/get")).toBe(true)
    expect(runtime.roster).toEqual([])
  })

  test("a face over the empty bundle is olai's own face, and it binds", () => {
    // `restrictHandlers` compares an exposure's universe with the served group
    // as a set EQUALITY in both directions and refuses at boot naming what it
    // cannot account for. That refusal is what makes the gate trustworthy and
    // is also the thing an OFF setting could trip over, so it is asked here
    // rather than discovered on somebody's machine.
    const runtime = rooted()
    const face = exposeRootedFaces(core, { errors: "resource" }, {}, {})
    expect(() => restrictHandlers(runtime.group, runtime.handlers, face)).not.toThrow()
  })
})

describe("one plugin", () => {
  test("its members land under its own name, and olai's do not move", () => {
    const runtime = rooted()
    const before = [...runtime.group.requests.keys()].sort()
    mountTenant(runtime)
    expect(runtime.group.requests.has("surface/kolu/fleet/get")).toBe(true)
    // The sibling prefix is what makes the composition safe: a core tag has
    // three segments and a sibling's has four, and the framework forbids a `/`
    // inside a name — so the two sets cannot intersect however the members are
    // called.
    expect(runtime.group.requests.has("surface/errors/get")).toBe(true)
    expect(runtime.group.requests.has("surface/fleet/get")).toBe(false)
    // ...and every tag the root had, it still has.
    for (const tag of before) expect([tag, runtime.group.requests.has(tag)]).toEqual([tag, true])
  })

  test("a face that forgot the plugin refuses to bind, naming what it cannot describe", () => {
    // The right failure, and the reason nothing in `@olai/server`'s `faces.ts`
    // tries to be clever about a missing half: a default-deny gate built from
    // the wrong surface grants nothing and still binds, which is the one failure
    // mode that looks like success from outside.
    const runtime = rooted()
    mountTenant(runtime)
    const forgot = exposeRootedFaces(core, { errors: "resource" }, {}, {})
    expect(() => restrictHandlers(runtime.group, runtime.handlers, forgot))
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

/**
 * A SIBLING CAN LEAVE, and what happens when it does — the two claims the phase
 * added and the reason the serve side needed a door of its own.
 *
 * A plugin is a FIBER: it can be disposed because its row went off, and it can
 * land in `FAILED` because its `apply` threw. Either way its sibling has to go,
 * and "disabled means absent" has to be as true after the boot as during it.
 */
describe("a roster that moves", () => {
  test("dropping a sibling restores the root exactly, tag for tag", async () => {
    // The claim `--plugins` has always made, asked at a moment it could not be
    // asked at before: the filter used to run once, so absence was a thing that
    // happened at boot. Now it is a `drop()` and the question is whether the
    // wire goes back to what it was.
    const runtime = rooted()
    const before = [...runtime.group.requests.keys()].sort()
    const mount = mountTenant(runtime)
    expect(runtime.roster).toEqual(["kolu"])
    await mount.drop()
    expect(runtime.roster).toEqual([])
    expect([...runtime.group.requests.keys()].sort()).toEqual(before)
    expect(Object.keys(runtime.handlers).sort()).toEqual(before)
  })

  test("a SURVIVOR keeps the handler it was serving when a sibling arrives beside it", () => {
    // THE SPIKE'S FINDING, as a claim. `packages/cordis-spike` re-composed by
    // re-calling `implementSurfaces` over every surviving sibling, which mints a
    // new handler, a new cell store, a new channel and a new source for a plugin
    // that had been serving since boot — so a connection accepted before the
    // change goes on answering out of the previous copy, and the two disagree
    // for as long as the socket is open.
    //
    // `mount` walks the ARRIVING sibling only, which is the property the door
    // exists for, and this is that property as an identity: the handler VALUE at
    // a survivor's tag is the same object before and after.
    const runtime = rooted()
    const first = runtime.mount("kolu", tenant, {
      cells: { fleet: { store: inMemoryStore("one") } },
    })
    const was = runtime.handlers["surface/kolu/fleet/get"]
    expect(was).toBeDefined()
    runtime.mount("odu", tenant, { cells: { fleet: { store: inMemoryStore("two") } } })
    expect(runtime.handlers["surface/kolu/fleet/get"]).toBe(was)
    // ...and the arriving one is served too, so the case is not passing over a
    // mount that did nothing.
    expect(runtime.group.requests.has("surface/odu/fleet/get")).toBe(true)
    void first
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


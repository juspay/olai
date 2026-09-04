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

import { exposeMapsOf, surfacesOf } from "@olai/plugin-api"

import { BUNDLE_NAMES, ROWS } from "./rows.ts"
import {
  composing,
  doorsOf,
  manifestAt,
  MEMBER_OF_PACKAGE,
  PACKAGES,
  packageOf,
  type ServerHalf,
  serverHalves,
} from "./tree.testlib.ts"
import * as fs from "node:fs"
import * as path from "node:path"

/** The real roster, LOADED — no door in this package imports a plugin
 *  statically any more, so a test that wants their values does what the runtime
 *  does and imports them by the row's own name (`./tree.testlib.ts`). */
const HALVES: ReadonlyArray<ServerHalf> = await serverHalves()

/** ...and the ones that compose a SIBLING, which is what every claim below
 *  about the composed wire is about. An ENGINE composes none — what it
 *  contributes to a tab travels on the chat cell, which is core's — so it is
 *  absent from the sibling map, the expose maps and every tag they produce.
 *  That absence is the same absence a plugin the roster left out has, which is
 *  what makes it a state rather than a case. */
const WIRES = composing(HALVES)

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

  test("git is the first plugin on the agent's face; the others stay off it", () => {
    // Chat and the appliances are browser-only. Git's cells AND verbs are on
    // the agent face too — what is waiting, what git is doing, and the two
    // acts that record it. The MCP tools stay named `commit` / `push` (ops
    // table). Nothing in `@olai/server` writes this map: git's own
    // `faces.agent` does.
    expect(exposeMapsOf(WIRES, "agent")).toEqual({
      git: {
        git: "resource",
        pending: "resource",
        "git.commit": "tool",
        "git.push": "tool",
      },
    })
    const agent = siblingFace("agent")
    expect(agent.tags.size).toBeGreaterThan(0)
    for (const tag of agent.tags) {
      expect(tag.startsWith("surface/git/")).toBe(true)
    }
    expect(siblingFace("browser").tags.size).toBeGreaterThan(agent.tags.size)
  })
})


/**
 * ...AND THE TWO CLAIMS ABOUT A PLUGIN'S OWN VALUES, which live here because
 * this is the file that LOADS them.
 *
 * They were `fence.test.ts`'s, and `prove-fence.sh` is what moved them. That
 * file's whole subject is what a package may name, and it answers it by
 * sweeping the tree as TEXT and walking module graphs — neither of which
 * evaluates a plugin. Reading a plugin's `name` and its `faces` needs the
 * module, and importing one there cost the falsifier two mutations: appending a
 * `.tsx` to a server half and appending an appliance's client to the wrong
 * tenant's dial both killed the fence MODULE at load, so the suite DIED rather
 * than refusing and no claim named the defect. A fence that dies names nothing.
 *
 * Here the loading is the point — every case above composes what these modules
 * export — so a plugin that will not load takes down a file that could not have
 * asserted anything about it anyway.
 */
describe("a plugin answers to the name its row binds it under", () => {
  test("every module's own `name` is the row's `id`", () => {
    // THE EQUALITY THE WHOLE PER-PLUGIN STAMP RESTS ON. The row's `id` is what
    // the loader binds the fiber under, and every service that stamps a plugin
    // reads `ctx.fiber.name` off that binding — the kind prefix, the delivery
    // door's key, the sibling key its members compose under. A module whose own
    // `name` disagreed would serve its members at one address and be stamped at
    // another, with nothing between the two to notice.
    // OVER EVERY HALF, not only the composing ones: the stamp is what a fiber
    // is bound under, and an engine's fiber is bound exactly as a tenant's is.
    expect([...HALVES.map((half) => half.name)].sort()).toEqual([...BUNDLE_NAMES].sort())
  })

  /**
   * ...AND A PLUGIN WITH MEMBERS SAYS SO ON BOTH DOORS.
   *
   * ## The bug this is written against, and it went all the way to a browser
   *
   * The tab builds its sibling map out of what each BROWSER half exports
   * (`@olai/web`'s `client/wire.ts`): a half carrying a `surface` is dialled and
   * handed its own client, and a half carrying none is read as an ENGINE — a
   * plugin that composes no sibling, because what it contributes to a tab
   * travels on somebody else's cell — and is mounted without being dialled.
   *
   * Both are real states, which is why `BrowserHalf.surface` is optional and has
   * to stay so. What was NOT a state is the third thing: a plugin whose SERVER
   * half registers a sibling and whose BROWSER half forgot to re-export it. The
   * server serves every member; the tab never dials them; `Wired.client()`
   * answers `null` because this wire does not carry that plugin; and the first
   * face to read one throws inside a render, which the app draws as a fault
   * card. Every scenario in the e2e suite failed on `Cannot read properties of
   * null (reading 'cells')` — one omitted `export` in a door with nothing else
   * in it.
   *
   * Nothing could have caught it: the two doors are two modules, the field is
   * optional in both, and every other claim in this file reads one door or the
   * other. So the claim is the EQUALITY BETWEEN THEM — a plugin composes a
   * sibling or it does not, and both halves have to be telling the same story
   * about which.
   *
   * ## READ, not imported, and the reason is the graph
   *
   * A browser half is a `.tsx` reaching a UI runtime; importing one here dies on
   * `react/jsx-dev-runtime` before it can be asked anything, which is the exact
   * hazard that keeps this package mounting none of them and `BROWSER_ROWS` a
   * table of thunks. So the door is RESOLVED the way a consumer resolves it —
   * off the package's own `exports` map — and its source is read for the one
   * word. A path spelled here instead would be a claim about a file rather than
   * about the door.
   */
  test("a plugin that composes a sibling exports it from BOTH doors", () => {
    const serving = new Set(WIRES.map((wire) => wire.name))
    const exporting = ROWS.map((row) => {
      const member = MEMBER_OF_PACKAGE.get(packageOf(row.name))
      if (member === undefined) throw new Error(`composition: no member for ${row.name}`)
      const dir = path.join(PACKAGES, member)
      const manifest = manifestAt(dir)
      const door = manifest === undefined ? undefined : doorsOf(manifest)["./browser"]
      if (door === undefined) {
        throw new Error(`composition: "${row.id}" opens no ./browser door`)
      }
      const text = fs.readFileSync(path.join(dir, door), "utf8")
      // The word in an EXPORT, not anywhere in the file: every browser half
      // imports its own `name` beside it, and half of them mention the surface
      // in prose.
      return { id: row.id, exports: /\bexport\s*\{[^}]*\bsurface\b[^}]*\}/.test(text) }
    })
    expect(exporting.filter((one) => serving.has(one.id) !== one.exports).map((one) => one.id))
      .toEqual([])
    // ...and the sweep is not vacuous in either direction: this build has halves
    // of both kinds, so a comparison that had stopped seeing one of them would
    // be a claim nobody is making.
    expect(exporting.some((one) => one.exports)).toBe(true)
    expect(exporting.some((one) => !one.exports)).toBe(true)
  })

  test("every face a plugin names is a face it wrote a map for", () => {
    // An empty map and an ABSENT map mean the same thing to `exposeFaces`
    // (deny in full) and different things to a reader: an empty one asserts
    // the plugin considered the face and declined, which is a claim worth
    // being able to make, but a face key holding nothing at all is more
    // likely a half-finished edit. This is the one shape check on a value the
    // compiler sees only as a record of records.
    // ...AND A HALF WITH NO SURFACE HAS NO MAPS TO WRITE, which is not the
    // same shape as a half-finished edit: `composing` is what tells the two
    // apart, so a plugin with a `surface` and no `faces` is red HERE rather
    // than quietly skipped.
    for (const wire of WIRES) {
      for (const [face, map] of Object.entries((wire.faces ?? {}) as Record<string, object>)) {
        expect([`${wire.name}/${face}`, Object.keys(map).length > 0])
          .toEqual([`${wire.name}/${face}`, true])
      }
    }
  })
})

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

const HALVES: ReadonlyArray<ServerHalf> = await serverHalves()

const WIRES = composing(HALVES)

const core = defineSurface({
  cells: { errors: { schema: Schema.String, default: "" } },
})

const tenant = defineSurface({
  cells: { fleet: { schema: Schema.String, default: "" } },
})

const rooted = () =>
  implementRootedSurfaces(core, {}, { cells: { errors: { store: inMemoryStore("") } } })

const mountTenant = (runtime: ReturnType<typeof rooted>) =>
  runtime.mount("kolu", tenant, { cells: { fleet: { store: inMemoryStore("") } } })

describe("no plugins", () => {
  test("a rooted bundle with nothing mounted is olai's own surface, tag for tag", () => {
    const runtime = rooted()
    for (const tag of runtime.group.requests.keys()) {
      expect([tag, tag.startsWith("surface/")]).toEqual([tag, true])
      expect([tag, tag.split("/").length]).toEqual([tag, 3])
    }
    expect(runtime.group.requests.has("surface/errors/get")).toBe(true)
    expect(runtime.roster).toEqual([])
  })

  test("a face over the empty bundle is olai's own face, and it binds", () => {
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
    expect(runtime.group.requests.has("surface/errors/get")).toBe(true)
    expect(runtime.group.requests.has("surface/fleet/get")).toBe(false)
    for (const tag of before) expect([tag, runtime.group.requests.has(tag)]).toEqual([tag, true])
  })

  test("a face that forgot the plugin refuses to bind, naming what it cannot describe", () => {
    const runtime = rooted()
    mountTenant(runtime)
    const forgot = exposeRootedFaces(core, { errors: "resource" }, {}, {})
    expect(() => restrictHandlers(runtime.group, runtime.handlers, forgot))
      .toThrow(/surface\/kolu\//)
  })

  test("the root must be the UNPREFIXED surface, and the gate says so", () => {
    const scoped = { ...core, tagPrefix: "surface/kolu/" } as typeof core
    expect(() => exposeRootedFaces(scoped, { errors: "resource" }, {}, {}))
      .toThrow(/root of a rooted bundle is the UNPREFIXED one/)
  })
})

describe("a roster that moves", () => {
  test("dropping a sibling restores the root exactly, tag for tag", async () => {
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
    const runtime = rooted()
    const first = runtime.mount("kolu", tenant, {
      cells: { fleet: { store: inMemoryStore("one") } },
    })
    const was = runtime.handlers["surface/kolu/fleet/get"]
    expect(was).toBeDefined()
    runtime.mount("odu", tenant, { cells: { fleet: { store: inMemoryStore("two") } } })
    expect(runtime.handlers["surface/kolu/fleet/get"]).toBe(was)
    expect(runtime.group.requests.has("surface/odu/fleet/get")).toBe(true)
    void first
  })
})
describe("the plugins this binary was built with", () => {
  const bareRoot = defineSurface({})

  const siblingFace = (face: string) =>
    exposeRootedFaces(
      bareRoot,
      {},
      surfacesOf(WIRES) as unknown as SurfaceMap,
      exposeMapsOf(WIRES, face) as never,
    )

  const contributed = (universe: ReadonlySet<string>): ReadonlyArray<string> =>
    [...universe].filter((tag) => !bareRoot.group.requests.has(tag))

  test("every one composes under its own name, and nothing else does", () => {
    const tags = contributed(siblingFace("browser").universe)
    const owners: ReadonlySet<string> = new Set(WIRES.map((wire) => wire.name))
    for (const tag of tags) {
      const [, owner] = tag.split("/")
      expect([tag, owners.has(owner ?? "")]).toEqual([tag, true])
    }
    for (const wire of WIRES) {
      expect([
        wire.name,
        tags.some((tag) => tag.startsWith(`surface/${wire.name}/`)),
      ]).toEqual([wire.name, true])
    }
  })

  test("sibling agent exposure is explicitly owned by its capability", () => {
    expect(exposeMapsOf(WIRES.filter(wire => wire.name !== "test-counter"), "agent")).toEqual({})
    expect([...siblingFace("agent").tags].sort()).toEqual([
      "surface/test-counter/counter/increment",
      "surface/test-counter/counter/read",
    ])
    expect(siblingFace("browser").tags.size).toBeGreaterThan(0)
  })
})


describe("a plugin answers to the name its row binds it under", () => {
  test("every module's own `name` is the row's `id`", () => {
    expect([...HALVES.map((half) => half.name)].sort()).toEqual([...BUNDLE_NAMES].sort())
  })

  test("a plugin that composes a sibling exports it from BOTH doors", () => {
    const serving = new Set(WIRES.map((wire) => wire.name))
    const exporting = ROWS.map((row) => {
      const member = MEMBER_OF_PACKAGE.get(packageOf(row.name))
      if (member === undefined) throw new Error(`composition: no member for ${row.name}`)
      const dir = path.join(PACKAGES, member)
      const manifest = manifestAt(dir)
      const door = manifest === undefined ? undefined : doorsOf(manifest)["./browser"]
      if (door === undefined) {
        return { id: row.id, exports: false }
      }
      const text = fs.readFileSync(path.join(dir, door), "utf8")
      return { id: row.id, exports: /\bexport\s*\{[^}]*\bsurface\b[^}]*\}/.test(text) }
    })
    expect(exporting.filter((one) => serving.has(one.id) !== one.exports).map((one) => one.id))
      .toEqual([])
    expect(exporting.some((one) => one.exports)).toBe(true)
    expect(exporting.some((one) => !one.exports)).toBe(true)
  })

  test("every face a plugin names is a face it wrote a map for", () => {
    for (const wire of WIRES) {
      for (const [face, map] of Object.entries((wire.faces ?? {}) as Record<string, object>)) {
        expect([`${wire.name}/${face}`, Object.keys(map).length > 0])
          .toEqual([`${wire.name}/${face}`, true])
      }
    }
  })
})

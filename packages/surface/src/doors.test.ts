import { readdirSync, readFileSync } from "node:fs"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

import * as dispatch from "./dispatch.ts"
import * as host from "./host.ts"
import * as index from "./index.ts"
import * as keyings from "./keyings.testlib.ts"
import * as client from "./client.ts"
import * as management from "./management.ts"
import * as projection from "./projection.ts"

const DOORS: Readonly<Record<string, { readonly module: object; readonly names: ReadonlyArray<string> }>> = {
  ".": {
    module: index,
    names: [
      "ASSET_PREFIX",
      "ATTACHMENT_ACCEPT",
      "ATTACHMENT_EXTENSIONS",
      "Anchor",
      "App",
      "BODY_REFUSED",
      "BuiltPlugin",
      "DOCUMENT_EXTENSIONS",
      "Edit",
      "MAX_ATTACHMENT_BYTES",
      "MAX_VIDEO_ATTACHMENT_BYTES",
      "MEDIA_PREFIX",
      "NO_ROSTER",
      "PLUGIN_BROWSER_FILE",
      "PLUGIN_CHUNK_PREFIX",
      "PLUGIN_FILES",
      "PLUGIN_FOLDER",
      "PLUGIN_README_FILE",
      "PLUGIN_SERVER_FILE",
      "PluginRoster",
      "REFUSED_MARKUP",
      "ROUNDING",
      "SEAL",
      "WHO_PATH",
      "WORD",
      "Who",
      "appName",
      "attachmentRejection",
      "chunkFile",
      "chunkUrl",
      "heard",
      "intentOf",
      "isAttachable",
      "isAttachmentPicture",
      "isAttachmentVideo",
      "localLink",
      "mediaHref",
      "mediaTarget",
      "pluginState",
      "refusalIn",
      "sealPolicy",
      "spellsHost",
      "surface",
      "watchable",
    ],
  },
  "./host": { module: host, names: ["NO_ROSTER", "hostFaces", "hostSurface"] },
  "./client": { module: client, names: ["clientOn", "clientOver"] },
  "./management": { module: management, names: ["browserManagement"] },
  "./projection": { module: projection, names: ["changeOf", "frame"] },
  "./dispatch": { module: dispatch, names: ["editProcedures", "writeProcedure"] },
  "./testlib": { module: keyings, names: ["keyings"] },
}

describe("the doors are what this package says they are", () => {
  for (const [door, { module, names }] of Object.entries(DOORS)) {
    test(`${door} exports exactly what is recorded`, () => {
      expect(Object.keys(module).sort()).toEqual([...names])
    })
  }

  test("every door the manifest advertises is recorded here", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(import.meta.dir, "..", "package.json"), "utf8"),
    ) as { readonly exports: Readonly<Record<string, string>> }
    expect(Object.keys(manifest.exports).sort()).toEqual(Object.keys(DOORS).sort())
  })
})

test("the root door re-exports nothing from outside this package but the floor", () => {
  const source = readFileSync(path.join(import.meta.dir, "index.ts"), "utf8")
  const specs = [...source.matchAll(/from\s+"([^"]+)"/g)].map(([, spec]) => spec!)
  expect(specs.length).toBeGreaterThan(5)
  expect(specs.filter((spec) => !spec.startsWith("./") && spec !== "@olai/format")).toEqual([])
})

test("every module here is reachable from a door", () => {
  const reached = new Set<string>()
  const walk = (file: string) => {
    if (reached.has(file)) return
    reached.add(file)
    const source = readFileSync(path.join(import.meta.dir, file), "utf8")
    for (const [, spec] of source.matchAll(/from\s+"(\.\/[^"]+)"/g)) walk(spec!.slice(2))
  }
  const manifest = JSON.parse(
    readFileSync(path.join(import.meta.dir, "..", "package.json"), "utf8"),
  ) as { readonly exports: Readonly<Record<string, string>> }
  for (const target of Object.values(manifest.exports)) walk(target.replace("./src/", ""))
  const orphans = readdirSync(import.meta.dir)
    .filter((file) => /\.tsx?$/.test(file) && !/\.(?:test|browsertest|bench)\.tsx?$/.test(file))
    .filter((file) => !reached.has(file))
  expect(orphans).toEqual([])
})

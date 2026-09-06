/**
 * WHAT LEAVES THIS PACKAGE, as an equality rather than as a description.
 *
 * The general package this one used to be is the thing the residue after phase
 * 18 was about: a spec that was the whole application, and a root door that
 * every row imported its own member's schema back out of. Both are gone —
 * `OutlineEntry` to `olai-plugin-outlines/wire`, `DocumentEntry` to
 * `olai-plugin-markdown/wire`, `Head` and `Manifest` to
 * `olai-plugin-vault/wire`, the page, narrowing, search, shelf, inbox and tag
 * shapes back to `@olai/format` where they were declared all along.
 *
 * THAT KIND OF THING COMES BACK ONE NAME AT A TIME, which is why this is a
 * test and not a paragraph. Nothing about adding `export { OutlineEntry } from
 * "olai-plugin-outlines/wire"` to `./index.ts` is red anywhere else: the fence
 * one package over would catch a general package IMPORTING a plugin, and the
 * bundle's contract test would catch a member changing shape, but a schema
 * declared here and used by one row is legal everywhere and is exactly what
 * this package accumulated the first time. So the door lists are recorded, and
 * a name added to any of them is a decision somebody has to make on purpose.
 *
 * AN EQUALITY AND NOT A CONTAINMENT, in both directions: a name that ARRIVES is
 * red because that is the whole point, and a name that LEAVES is red because a
 * door this package still advertises with nothing behind it is a broken import
 * for whoever was using it.
 *
 * WHAT THIS CANNOT SEE is a type-only export, which erases before the module
 * object exists — so the second test reads the source instead, and holds every
 * `export ... from` in the root door to modules inside this package or to the
 * floor. A row's door named there would be the registry arrow pointing
 * backwards, and it is the one shape that could reintroduce the residue without
 * adding a runtime name.
 */

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

/** Every door this package's manifest advertises, and everything behind it.
 *  The keys are the `exports` keys verbatim, so a door added to the manifest
 *  and forgotten here is caught by the last test in this file. */
const DOORS: Readonly<Record<string, { readonly module: object; readonly names: ReadonlyArray<string> }>> = {
  /** WHAT CORE SERVES WITH NO ROW AT ALL — `surface` (the four members), the
   *  roster vocabulary the composition root mints and the panel reads, who is
   *  looking, what the deployment is called — plus the protocol constants both
   *  ends spell and no member declares: the edit union, the media URL, the
   *  saved-page seal, the attachment policy, what a click meant, and where the
   *  hashed browser bundle lives. Not one collection, stream or procedure a
   *  row fills, and not one shape a row is declared with. */
  ".": {
    module: index,
    names: [
      "ASSET_PREFIX",
      "ATTACHMENT_EXTENSIONS",
      "Anchor",
      "App",
      "BODY_REFUSED",
      "BuiltPlugin",
      "DOCUMENT_EXTENSIONS",
      "Edit",
      "MAX_ATTACHMENT_BYTES",
      "MEDIA_PREFIX",
      "NO_ROSTER",
      "PLUGIN_BROWSER_NODE",
      "PLUGIN_CHUNK_PREFIX",
      "PLUGIN_SERVER_NODE",
      "PluginRoster",
      "REFUSED_MARKUP",
      "ROUNDING",
      "SEAL",
      "WHO_PATH",
      "Who",
      "appName",
      "attachmentRejection",
      "chunkFile",
      "chunkUrl",
      "heard",
      "isAttachable",
      "mediaHref",
      "mediaTarget",
      "ours",
      "pluginState",
      "sealPolicy",
      "spellsHost",
      "surface",
      "watchable",
    ],
  },
  /** The same spec object under the name an adapter reaches for, so nothing
   *  reconstructs an equivalent one on a separate identity. */
  "./host": { module: host, names: ["NO_ROSTER", "hostFaces", "hostSurface"] },
  /** A typed face built from a SUPPLIED surface — no fixed application spec,
   *  which is what lets the bundle, MCP and each browser row have their own. */
  "./client": { module: client, names: ["clientOn", "clientOver"] },
  /** The browser-side service tag for the roster, the reports and the switch. */
  "./management": { module: management, names: ["browserManagement"] },
  /** The slicing rule three rows call and none owns. Two names, and the count
   *  is the claim: `frame` reads a revision, `changeOf` cuts one collection out
   *  of it, and neither knows what a collection is called. `publishedOf` and
   *  `Published` — the monolith's one-pass projection of `outlines`,
   *  `documents` and `heads` together — left with the members. */
  "./projection": { module: projection, names: ["changeOf", "frame"] },
  /** The two write ENVELOPES six rows co-own. One spelling, because
   *  `@olai/server`'s `composition.ts` refuses dispatch co-owners whose
   *  payload, success or error ASTs differ. */
  "./dispatch": { module: dispatch, names: ["editProcedures", "writeProcedure"] },
  /** Not product: the AST walk that holds a member's `arrayKey` declaration
   *  honest, wherever that member is now declared. */
  "./testlib": { module: keyings, names: ["keyings"] },
}

describe("the doors are what this package says they are", () => {
  for (const [door, { module, names }] of Object.entries(DOORS)) {
    test(`${door} exports exactly what is recorded`, () => {
      expect(Object.keys(module).sort()).toEqual([...names])
    })
  }

  /** THE FLOOR under the equalities above: a manifest door with no entry here
   *  would be a door nothing holds still, and the table would go on passing. */
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
  // `@olai/format` is the floor both the wire and the ops layer stand on, and
  // the one package outside this one a root export may name. A row's door here
  // is the residue this whole change removed.
  expect(specs.filter((spec) => !spec.startsWith("./") && spec !== "@olai/format")).toEqual([])
})

/** ...and the same reading one level up: a module in this package that no door
 *  reaches is either dead or a door somebody forgot to declare, and the first
 *  time that mattered was `page.ts`, `narrowing.ts` and `search.ts` — three
 *  pure pass-throughs to `@olai/format` that existed only so a row could import
 *  the floor's shapes through this package. */
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
    .filter((file) => /\.tsx?$/.test(file) && !/\.(?:test|bench)\.tsx?$/.test(file))
    .filter((file) => !reached.has(file))
  expect(orphans).toEqual([])
})

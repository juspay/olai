/**
 * ONE BUNDLE, TWO ROSTERS, ONE POPULATION — the lid on what three doors cost.
 *
 * A plugin is ONE identity reached through THREE doors, because there are three
 * GRAPHS. What is behind each of them changed this phase, and the arithmetic is
 * worth stating plainly:
 *
 *   - the SERVER's list is `../olai.yml` — DATA, one row per plugin, mounted by
 *     name through the loader. It was `./server.ts`'s `SERVERS`, an `as const`
 *     array of statically imported halves, and its disappearance is what makes
 *     `--plugins` a `disabled` patch over rows rather than a `.filter` in a
 *     general package.
 *   - `./surfaces.ts`'s `WIRES` is the browser-safe half, and
 *   - `./registry.ts`'s `PLUGINS` is the manifests, whose graph carries SolidJS
 *     and a terminal emulator.
 *
 * The last two are still hand-written `as const` lists, and that is a cost
 * rather than a design: a browser bundle is built ahead of time,
 * `connectSurfaces` takes its sibling map at the call, and there is no loader in
 * the tab — so the tab keeps a compiled-in list until it boots off the roster
 * cell (the proposal's §6, phase 5). A third plugin is therefore ONE row plus
 * two lines rather than three lines, and this file is what keeps the three
 * honest until the two become none.
 *
 * WHAT THE COST BUYS is the graph separation, and it is worth it. What it did
 * not have until this file existed is the LID: nothing said the lists hold the
 * same plugins. A plugin added to two of them is not a compile error anywhere —
 * `enabled`, `surfacesOf` and the bundle's own reader each walk ONE of them, so
 * the failure is a plugin whose surface composes and whose kinds never reach the
 * validator, or whose row mounts on a serve whose browser never dialled it.
 * That is a silent partial plugin, and it is exactly the shape nobody notices
 * until a face on a page is quietly wrong.
 *
 * ## Why this reads the SOURCE rather than importing the two lists
 *
 * Because it cannot import the second, and the reason is the very cost this file
 * is the lid on: the MANIFEST door pulls each plugin's browser faces, and a
 * `bun test` importing `./registry.ts` dies at module scope on
 * `Cannot find module 'react/jsx-dev-runtime'` — the tree's JSX is configured
 * for the bundler, not for a node test runner. `@olai/server`'s `pluginPolicy.ts`
 * carries the same hazard on an import that looked innocent.
 *
 * One could be imported and the other read, and that asymmetry was rejected: one
 * rule read one way over two files is a claim a reader can check, where a hybrid
 * is two claims and a paragraph about why. What is read is narrow and structural
 * — which plugin package each roster's elements were imported FROM — so it is a
 * claim about the lists rather than about how they are spelled, and a roster
 * that stopped having this shape at all fails loudly here rather than quietly
 * passing.
 *
 * THE BUNDLE IS IMPORTED, though, because it is data: `ROWS` is what the loader
 * will mount, read out of the same file at the same moment, so comparing it
 * against a source reading of the other two is a comparison of the program's
 * own answer with the text.
 */

import { readFileSync } from "node:fs"
import * as path from "node:path"

import { expect, test } from "bun:test"

import { BUNDLE_NAMES, ROWS } from "./bundle.ts"
import { PLUGIN_NAMES } from "./surfaces.ts"

const SRC = import.meta.dirname

/**
 * Every plugin package a file imports, by the LOCAL NAME it binds it to.
 *
 * Both spellings the three rosters use — `import * as kolu from
 * "olai-plugin-kolu/wire"` and `import { plugin as kolu } from
 * "olai-plugin-kolu"` — because which one a door uses is a fact about what that
 * door exports, not about the roster.
 */
const BOUND =
  /import\s+(?:\*\s+as\s+(\w+)|\{[^}]*?(\w+)\s*\})\s+from\s+"olai-plugin-([a-z0-9-]+)(?:\/[^"]*)?"/g

/** ...and the roster itself: the identifiers between the brackets. */
const rosterIn = (code: string, binding: string): ReadonlyArray<string> => {
  const found = new RegExp(`export const ${binding} = \\[([^\\]]*)\\]`).exec(code)
  if (found === null) throw new Error(`rosters: no \`export const ${binding} = [...]\` to read`)
  return (found[1] ?? "").split(",").map((one) => one.trim()).filter((one) => one !== "")
}

/** WHICH PLUGINS ONE ROSTER LISTS, in its own order — the elements resolved
 *  through the imports that bound them. An element bound to nothing is a throw
 *  rather than a skip: a roster carrying something that is not a plugin is the
 *  question this file is about, not a case to filter out. */
const listed = (file: string, binding: string): ReadonlyArray<string> => {
  const code = readFileSync(path.join(SRC, file), "utf8")
  const names = new Map<string, string>()
  for (const [, star, named, plugin] of code.matchAll(BOUND)) {
    const local = star ?? named
    if (local !== undefined && plugin !== undefined) names.set(local, plugin)
  }
  return rosterIn(code, binding).map((element) => {
    const name = names.get(element)
    if (name === undefined) {
      throw new Error(`rosters: ${file}'s ${binding} lists \`${element}\`, which no import bound`)
    }
    return name
  })
}

// ONE EQUALITY, THREE TIMES, and in ORDER rather than as sets — the lists are
// walked in place (preferences draws a row per plugin in bundle order, the docs
// index assembles in it), so two rosters holding the same names in different
// orders is a difference worth failing on rather than one worth forgiving.
test("the bundle's rows and the two browser doors list the same plugins, in the same order", () => {
  expect([...BUNDLE_NAMES]).toEqual([...PLUGIN_NAMES])
  expect(listed("surfaces.ts", "WIRES")).toEqual([...PLUGIN_NAMES])
  expect(listed("registry.ts", "PLUGINS")).toEqual([...PLUGIN_NAMES])
})

/**
 * ...AND A ROW'S `id` IS THE PLUGIN'S NAME, which is the equality the whole
 * stamp rests on.
 *
 * The fiber is bound under the row's `id`, and `ctx.kinds`, `ctx.deliveries`,
 * `ctx.surfaces` and `ctx.wakes` all read `ctx.fiber.name` off that binding. So
 * a row whose `id` was not the plugin's own name would stamp a plugin's kinds,
 * its sibling key and its delivery door with a word the plugin does not answer
 * to — silently, and in four places at once. The module the row names is what
 * says the name; this is where the two are held to one.
 */
test("every row's id is the name the module it mounts answers to", async () => {
  for (const row of ROWS) {
    const mod = await import(row.name) as { readonly name?: unknown }
    expect(mod.name, row.id).toBe(row.id)
  }
  // Not vacuous.
  expect(ROWS.length).toBeGreaterThan(1)
})

// ...and the floor, so the cases above cannot pass over a reading that came back
// empty. `PLUGIN_NAMES` is itself derived from `WIRES` at RUNTIME, which is what
// makes the first assertion above a comparison of the source read against the
// value the program actually holds rather than a reading compared with itself.
test("the reading is not vacuous", () => {
  expect(PLUGIN_NAMES.length).toBeGreaterThan(1)
  expect(listed("registry.ts", "PLUGINS").length).toBe(PLUGIN_NAMES.length)
})

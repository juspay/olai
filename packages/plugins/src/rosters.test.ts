/**
 * THREE ROSTERS, ONE POPULATION — the lid on what three doors cost.
 *
 * A plugin is ONE identity reached through THREE doors, because there are three
 * GRAPHS: `./surfaces.ts`'s `WIRES` (the browser-safe half), `./server.ts`'s
 * `SERVERS` (what a composition root runs) and `./registry.ts`'s `PLUGINS` (the
 * manifests, whose graph carries SolidJS and a terminal emulator). Each is a
 * hand-written `as const` list, and each is a line somebody has to remember to
 * add — so a third plugin is three lines rather than one, which is a cost the
 * README names out loud.
 *
 * WHAT THE COST BUYS is the graph separation, and it is worth it. What it did
 * not have until now is the LID: nothing said the three lists hold the same
 * plugins. A plugin added to two of them is not a compile error anywhere —
 * `enabled`, `surfacesOf`, `probesOf` and `kindsOf` each walk ONE of the lists,
 * so the failure is a plugin whose surface composes and whose kinds never
 * reach the validator, or whose probe runs on a serve that never dialled it.
 * That is a silent partial plugin, and it is exactly the shape nobody notices
 * until a face on a page is quietly wrong.
 *
 * ## Why this reads the SOURCE rather than importing the three lists
 *
 * Because it cannot import the third, and the reason is the very cost this file
 * is the lid on: the MANIFEST door pulls each plugin's browser faces, and a
 * `bun test` importing `./registry.ts` dies at module scope on
 * `Cannot find module 'react/jsx-dev-runtime'` — the tree's JSX is configured
 * for the bundler, not for a node test runner. `@olai/server`'s `pluginPolicy.ts`
 * carries the same hazard on an import that looked innocent.
 *
 * Two of the three could be imported and the third read, and that asymmetry was
 * rejected: one rule read one way over three files is a claim a reader can
 * check, where a hybrid is two claims and a paragraph about why. What is read is
 * narrow and structural — which plugin package each roster's elements were
 * imported FROM — so it is a claim about the lists rather than about how they
 * are spelled, and a roster that stopped having this shape at all fails loudly
 * here rather than quietly passing.
 */

import { readFileSync } from "node:fs"
import * as path from "node:path"

import { expect, test } from "bun:test"

import { PLUGIN_NAMES } from "./surfaces.ts"

const SRC = import.meta.dirname

/**
 * Every plugin package a file imports, by the LOCAL NAME it binds it to.
 *
 * Both spellings the three rosters use — `import * as kolu from
 * "@olai/plugin-kolu/wire"` and `import { plugin as kolu } from
 * "@olai/plugin-kolu"` — because which one a door uses is a fact about what that
 * door exports, not about the roster.
 */
const BOUND =
  /import\s+(?:\*\s+as\s+(\w+)|\{[^}]*?(\w+)\s*\})\s+from\s+"@olai\/plugin-([a-z0-9-]+)(?:\/[^"]*)?"/g

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
// walked in place (preferences draws a row per plugin in registry order, the
// docs index assembles in it), so two rosters holding the same names in
// different orders is a difference worth failing on rather than one worth
// forgiving.
test("the three doors list the same plugins, in the same order", () => {
  expect(listed("surfaces.ts", "WIRES")).toEqual([...PLUGIN_NAMES])
  expect(listed("server.ts", "SERVERS")).toEqual([...PLUGIN_NAMES])
  expect(listed("registry.ts", "PLUGINS")).toEqual([...PLUGIN_NAMES])
})

// ...and the floor, so the case above cannot pass over a reading that came back
// empty. `PLUGIN_NAMES` is itself derived from `WIRES` at RUNTIME, which is what
// makes the first assertion above a comparison of the source read against the
// value the program actually holds rather than a reading compared with itself.
test("the reading is not vacuous", () => {
  expect(PLUGIN_NAMES.length).toBeGreaterThan(1)
  expect(listed("registry.ts", "PLUGINS").length).toBe(PLUGIN_NAMES.length)
})

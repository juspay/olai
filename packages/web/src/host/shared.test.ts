/**
 * THE TABLE AND THE LIST HAVE TO AGREE — the browser half of the promise
 * `@olai/server`'s `dynamic/runtime.test.ts` keeps at the other end.
 *
 * `@olai/plugin-build` names the specifiers it will BIND in a compiled half;
 * `./shared.ts` fills the table those bindings read, out of this app's own
 * static imports. They are two lists on one clock: a module added to
 * `BROWSER_MODULES` and forgotten here is a face destructuring `undefined` at
 * its first line, in a plugin somebody approved, with nothing red anywhere.
 *
 * They cannot be ONE list. The table's values are static imports, which is the
 * whole point of it — the same copy the app draws with — and the compiler
 * package must not have Solid, Effect or the plugin interface on its graph. So
 * the two are held equal instead, at the one end that has both.
 */

import { BROWSER_MODULES, REGISTRY } from "@olai/plugin-build/shared"
import { expect, test } from "bun:test"

import "./shared.ts"

test("this app binds every module the compiler says a browser half may name", () => {
  const table = (globalThis as Record<string, unknown>)[REGISTRY] as Record<string, unknown>
  expect(Object.keys(table).sort()).toEqual([...BROWSER_MODULES].sort())
  for (const name of BROWSER_MODULES) expect(table[name]).toBeDefined()
})

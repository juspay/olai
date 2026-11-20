/**
 * THE TABLE AND THE LIST HAVE TO AGREE. `@olai/plugin-build` names the
 * specifiers it will BIND in a compiled half; `./shared.ts` fills the table
 * those bindings read. They are two lists on one clock: a module added to
 * `BROWSER_MODULES` and forgotten here is a face destructuring `undefined` at
 * its first line.
 */

import { BROWSER_MODULES, REGISTRY } from "@olai/plugin-build/shared"
import { expect, test } from "bun:test"

test("this app binds every module the compiler says a browser half may name", async () => {
  const held = (globalThis as Record<string, unknown>)[REGISTRY]
  try {
    await import("./shared.ts")
    const table = (globalThis as Record<string, unknown>)[REGISTRY] as Record<string, unknown>
    expect(Object.keys(table).sort()).toEqual([...BROWSER_MODULES].sort())
    for (const name of BROWSER_MODULES) expect(table[name]).toBeDefined()
  } finally {
    ;(globalThis as Record<string, unknown>)[REGISTRY] = held
  }
})

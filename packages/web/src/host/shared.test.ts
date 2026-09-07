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

/**
 * ## THE WRITE IS CONTAINED, and it has to be
 *
 * `./shared.ts` fills the table AT MODULE LOAD, and so does the server half's
 * (`olai-plugin-vault-plugins`' `runtime.ts`) — one key, `@olai/plugin-api`,
 * meaning the browser door in one and the server door in the other. In a real
 * process exactly one of the two is ever loaded; in ONE `bun test` process both
 * are, so whichever file bun happened to load last decided what every other
 * bench read. That was a latent flake this branch tripped by moving a
 * directory, which is the least interesting way to find one.
 *
 * So the side effect is taken INSIDE the case, with the previous table put back
 * afterwards — `@olai/plugin-build`'s own `build.test.ts` keeps its fixture the
 * same way. A dynamic import is what makes that possible: the module's body
 * runs on the first `await` here rather than at this file's own load.
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

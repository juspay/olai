/**
 * The compiler, benched on the shapes an agent actually writes — and on the
 * ones it must not get away with.
 *
 * Two string constants and no serve: the package knows nothing about vaults or
 * rows, which is what makes every claim here checkable without one.
 */

import { describe, expect, test } from "bun:test"

import { bind } from "./bind.ts"
import { buildHalf } from "./build.ts"
import { unresolvable } from "./imports.ts"
import { BROWSER_MODULES, REGISTRY, SERVER_MODULES } from "./shared.ts"

/** Evaluate a built half with a registry standing in for the host's modules,
 *  and answer what it exported. This is the whole contract: the text is a module
 *  that reads `globalThis[REGISTRY]` and nothing else. */
const evaluated = async (
  text: string,
  modules: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const held = (globalThis as Record<string, unknown>)[REGISTRY]
  ;(globalThis as Record<string, unknown>)[REGISTRY] = modules
  try {
    const url = `data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`
    return await import(url) as Record<string, unknown>
  } finally {
    ;(globalThis as Record<string, unknown>)[REGISTRY] = held
  }
}

describe("what a plugin's source may name", () => {
  test("the three, and nothing else", () => {
    expect(unresolvable(`import { Effect } from "effect"`)).toBeNull()
    expect(unresolvable(`import { Kinds } from "@olai/plugin-api"`)).toBeNull()
    expect(unresolvable(`import { createSignal } from "solid-js"`)).toBeNull()
    expect(unresolvable(`import pad from "left-pad"`)).toContain(`"left-pad"`)
    expect(unresolvable(`import pad from "left-pad"`)).toContain("node_modules")
  })

  test("a subpath is not one of the three, including the one the transform emits", () => {
    expect(unresolvable(`import { template } from "solid-js/web"`)).toContain(`"solid-js/web"`)
    expect(unresolvable(`import { Schema } from "effect/Schema"`)).toContain(`"effect/Schema"`)
  })

  test("a relative import names a file that is not there", () => {
    expect(unresolvable(`import { helper } from "./util.ts"`)).toContain("nothing else")
  })

  test("a computed module is refused whatever it names", () => {
    const why = unresolvable(`const m = await import("effect")`)
    expect(why).toContain("may not compute a module")
  })

  test("a specifier in a comment or a string is not an import", () => {
    expect(unresolvable(`// import "left-pad"\nconst said = 'import "left-pad"'`)).toBeNull()
  })

  test("a type-only import is erased and so is never refused", () => {
    expect(unresolvable(`import type { Accessor } from "solid-js"`)).toBeNull()
  })
})

describe("binding a built module to the host's own copies", () => {
  test("named, namespace and default, and a bare import dropped", () => {
    const bound = bind(
      [
        `import { Effect, Layer as L } from "effect";`,
        `import * as All from "effect";`,
        `import api from "@olai/plugin-api";`,
        `import "effect";`,
        `export const x = 1;`,
      ].join("\n"),
      SERVER_MODULES,
    )
    expect(bound.ok).toBe(true)
    if (!bound.ok) return
    // `Layer as L` is `Layer: L` in the pattern: the name on the left is the
    // one the host's namespace carries, and the one on the right is what the
    // author called it.
    expect(bound.text).toContain(`const { Effect, Layer: L } = globalThis`)
    expect(bound.text).toContain(`const All = globalThis`)
    expect(bound.text).toContain(`.default;`)
    expect(bound.text).not.toContain(`import`)
  })

  test("a module the host does not hold is a refusal and not a silent import", () => {
    const bound = bind(`import { x } from "solid-js";`, SERVER_MODULES)
    expect(bound.ok).toBe(false)
    if (bound.ok) return
    expect(bound.why).toContain(`"solid-js"`)
  })

  test("module syntax this does not understand is refused rather than left in", () => {
    const bound = bind(`export { Effect } from "effect";`, SERVER_MODULES)
    expect(bound.ok).toBe(false)
    if (bound.ok) return
    expect(bound.why).toContain("could not bind")
  })
})

describe("a built half is a module that runs", () => {
  test("the server half reaches the host's Effect", async () => {
    const built = await buildHalf(
      "server",
      [
        `import { Effect } from "effect"`,
        `const twice = (n: number): number => n * 2`,
        `export default Effect.succeed(twice(21))`,
      ].join("\n"),
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const marker = { theHostsEffect: true, succeed: (value: unknown) => ({ value }) }
    const module = await evaluated(built.text, { effect: { Effect: marker } })
    expect(module.default).toEqual({ value: 42 })
  })

  test("the browser half is Solid's transform and its emitted imports are bound too", async () => {
    const built = await buildHalf(
      "browser",
      [
        `import { createSignal } from "solid-js"`,
        `export const Chip = () => {`,
        `  const [n] = createSignal(7)`,
        `  return <span class="chip">{n()}</span>`,
        `}`,
      ].join("\n"),
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    // The transform reached for `solid-js/web`, which the author never wrote —
    // and it is bound, which is the whole reason the two lists in `./shared.ts`
    // differ from the one an author may write.
    expect(built.text).toContain(`["solid-js/web"]`)
    expect(built.text).not.toMatch(/^\s*import\s/m)
    expect(BROWSER_MODULES).toContain("solid-js/web")
  })

  test("a syntax error is the author's own sentence", async () => {
    const built = await buildHalf("browser", `export const Chip = () => <span>`)
    expect(built.ok).toBe(false)
    if (built.ok) return
    expect(built.why.length).toBeGreaterThan(0)
  })

  test("the gate runs before the compiler, so the refusal names what was written", async () => {
    const built = await buildHalf("server", `import pad from "left-pad"\nexport default pad`)
    expect(built.ok).toBe(false)
    if (built.ok) return
    expect(built.why).toContain(`"left-pad"`)
  })
})

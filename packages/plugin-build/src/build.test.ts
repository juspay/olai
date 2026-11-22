/**
 * The compiler, benched on the shapes an agent actually writes — and on the
 * ones it must not get away with.
 *
 * Two string constants and no serve: the package knows nothing about vaults or
 * rows, which is what makes every claim here checkable without one.
 */

import { describe, expect, test } from "bun:test"

import { bind } from "./bind.ts"
import { asDataUrl, buildPlugin, type Half } from "./build.ts"
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

/** A plugin of one file: the half's own entry and nothing beside it. */
const buildHalf = (half: Half, source: string) =>
  buildPlugin(half, half === "server" ? "server.ts" : "browser.tsx", new Map([[half === "server" ? "server.ts" : "browser.tsx", source]]), (_path, text) => asDataUrl(text))

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

  test("a relative import is left to the folder's own resolution rather than refused here", () => {
    expect(unresolvable(`import { helper } from "./util.ts"`)).toBeNull()
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

  test("a re-export's `from` is the keyword, not a word in a string", () => {
    const bound = bind(`export const said = "from over there";`, SERVER_MODULES)
    expect(bound.ok).toBe(true)
  })

  /**
   * THE SHAPE THAT WAS QUADRATIC, benched by the clock rather than argued.
   *
   * `bind` read a whole statement with one regular expression, and it held a
   * `\s+` in front of a lazy class that also admitted whitespace — so for
   * `import` followed by a long run of spaces and no `from`, the engine tried
   * every split of the run. CodeQL named it (`js/polynomial-redos`), and the
   * input here is a person's: the compiled form of source somebody wrote into a
   * vault.
   *
   * THE ASSERTION IS THAT THIS TEST RETURNS. At a hundred thousand spaces the
   * old shape is minutes of matching, so the bench is bun's own timeout; the
   * `expect` below is about the ANSWER being the honest one — a shape that is
   * not an import statement is left where it is and refused by name.
   */
  test("a long run of whitespace after `import` is refused rather than chewed on", () => {
    const bound = bind(`import ${" ".repeat(100_000)}`, SERVER_MODULES)
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

  /**
   * A COMMENTED-OUT IMPORT IS NOT AN IMPORT, all the way through — and it took
   * being read through `buildHalf` to see that it was not.
   *
   * The gate is a real parse and answered this correctly from the first line;
   * the bench beside it (`a specifier in a comment or a string is not an
   * import`) asks `unresolvable` and passes either way. What it could not see is
   * that babel PRESERVES comments, so the comment reached `bind` — which reads
   * emitted text and is not a parser — and the build was refused naming a module
   * the author had deliberately commented out.
   *
   * Two steps, two answers, and only the composition of them is the product.
   */
  test("a commented-out import is not an import to the compiler either", async () => {
    const built = await buildHalf(
      "browser",
      [
        `/*`,
        `import pad from "left-pad"`,
        `*/`,
        `// import { readFile } from "node:fs"`,
        `import { createSignal } from "solid-js"`,
        `export const Chip = () => <span>{createSignal(1)[0]()}</span>`,
      ].join("\n"),
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.text).not.toContain("left-pad")
    expect(built.text).not.toContain("node:fs")
  })

  /** ...and the same on the server half, which gets there by a different road:
   *  `Bun.Transpiler` strips comments on its way through, so nothing downstream
   *  ever sees one. Benched anyway, because what is being kept is the PRODUCT's
   *  behaviour and not either compiler's. */
  test("...and on the server half, which strips them a step earlier", async () => {
    const built = await buildHalf(
      "server",
      [`/* import pad from "left-pad" */`, `import { Effect } from "effect"`, `export default Effect`]
        .join("\n"),
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.text).not.toContain("left-pad")
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

/**
 * A PLUGIN OF SEVERAL FILES — every `.ts` and `.tsx` in its folder, an import
 * naming one by a relative path with its suffix, resolved by arithmetic over
 * the files handed in and never against a disk.
 */
describe("a plugin of several files", () => {
  const folder = (files: Readonly<Record<string, string>>): ReadonlyMap<string, string> =>
    new Map(Object.entries(files))
  /** The serve's linking: each file a `data:` module of its own text. */
  const server = (files: Readonly<Record<string, string>>, entry = "server.ts") =>
    buildPlugin("server", entry, folder(files), (_path, text) => asDataUrl(text))
  const refused = async (files: Readonly<Record<string, string>>, entry = "server.ts"): Promise<string> => {
    const built = await server(files, entry)
    if (built.ok) throw new Error("this folder built, and the case is that it must not")
    return built.why
  }

  test("a relative import of a file in the folder builds, and the module runs", async () => {
    const built = await server({
      "server.ts": `import { Effect } from "effect"\nimport { twice } from "./lib/sm2.ts"\nexport default Effect.succeed(twice(21))`,
      "lib/sm2.ts": `import { half } from "../half.ts"\nexport const twice = (n: number): number => half(n) * 4`,
      "half.ts": `export const half = (n: number): number => n / 2`,
    })
    if (!built.ok) throw new Error(built.why)
    expect(built.text).not.toMatch(/^\s*import\s/m)
    const module = await evaluated(built.text, { effect: { Effect: { succeed: (value: unknown) => ({ value }) } } })
    expect(module.default).toEqual({ value: 42 })
    expect(built.modules.map((one) => one.path).sort()).toEqual(["half.ts", "lib/sm2.ts"])
  })

  test("a path that leaves the folder is refused, naming it", async () => {
    expect(await refused({ "server.ts": `import { x } from "../other/server.ts"\nexport default x` })).toContain(`"../other/server.ts"`)
    expect(await refused({ "server.ts": `import { x } from "/etc/x.ts"\nexport default x` })).toContain(`"/etc/x.ts"`)
  })

  test("a file the folder does not hold is refused, naming it", async () => {
    const why = await refused({ "server.ts": `import { x } from "./missing.ts"\nexport default x` })
    expect(why).toContain(`"./missing.ts"`)
  })

  test("a suffix that is not .ts or .tsx is refused, naming it", async () => {
    expect(await refused({ "server.ts": `import { x } from "./sm2"\nexport default x`, "sm2.ts": `export const x = 1` })).toContain(`"./sm2"`)
    expect(await refused({ "server.ts": `import x from "./data.json"\nexport default x` })).toContain(`"./data.json"`)
  })

  test("a cycle is refused, naming the import that closes it", async () => {
    const why = await refused({
      "server.ts": `import { a } from "./a.ts"\nexport default a`,
      "a.ts": `import { b } from "./b.ts"\nexport const a = () => b`,
      "b.ts": `import { a } from "./a.ts"\nexport const b = () => a`,
    })
    expect(why).toContain(`"./a.ts"`)
    expect(why).toContain("cycle")
  })

  test("a .tsx reached from server.ts is refused, naming it", async () => {
    const why = await refused({
      "server.ts": `import { Face } from "./face.tsx"\nexport default Face`,
      "face.tsx": `export const Face = () => <span />`,
    })
    expect(why).toContain(`"./face.tsx"`)
  })

  test("a computed import and a fourth bare module are refused in any file, as before", async () => {
    expect(await refused({ "server.ts": `import { x } from "./lib.ts"\nexport default x`, "lib.ts": `export const x = await import("effect")` }))
      .toContain("may not compute a module")
    expect(await refused({ "server.ts": `import { x } from "./lib.ts"\nexport default x`, "lib.ts": `import pad from "left-pad"\nexport const x = pad` }))
      .toContain(`"left-pad"`)
  })

  test("a re-export of a file in the folder stays refused", async () => {
    const why = await refused({ "server.ts": `export { x } from "./lib.ts"`, "lib.ts": `export const x = 1` })
    expect(why).toContain("could not bind")
  })

  test("a file both halves import is bound to each half's own door", async () => {
    const files = folder({
      "server.ts": `import { door } from "./shared.ts"\nexport default door`,
      "browser.tsx": `import { door } from "./shared.ts"\nexport default door`,
      "shared.ts": `import { which } from "@olai/plugin-api"\nexport const door = which`,
    })
    // The tab serves a module at an address of its own; a marked `data:` URL
    // stands in for it, so the two halves' copies are two modules here too.
    const each = await Promise.all((["server", "browser"] as const).map((half) =>
      buildPlugin(half, half === "server" ? "server.ts" : "browser.tsx", files, (_path, text) => asDataUrl(`// ${half}\n${text}`))))
    const [onServer, inTab] = each
    if (!onServer?.ok || !inTab?.ok) throw new Error("a half did not build")
    expect((await evaluated(onServer.text, { "@olai/plugin-api": { which: "services" } })).default).toBe("services")
    expect((await evaluated(inTab.text, { "@olai/plugin-api": { which: "root" } })).default).toBe("root")
  })

  test("a chain twelve files deep loads", async () => {
    const files: Record<string, string> = { "link-12.ts": `export const n = 0 // ${"x".repeat(20_000)}` }
    for (let depth = 11; depth >= 1; depth -= 1) {
      files[`link-${depth}.ts`] = `import { n as below } from "./link-${depth + 1}.ts"\nexport const n = below + 1`
    }
    files["server.ts"] = `import { n } from "./link-1.ts"\nexport default n + 1`
    const built = await server(files)
    if (!built.ok) throw new Error(built.why)
    expect((await evaluated(built.text, {})).default).toBe(12)
  })

  test("the browser half links a helper by the address its linker names", async () => {
    const built = await buildPlugin("browser", "browser.tsx", folder({
      "browser.tsx": `import { Columns } from "./columns.tsx"\nexport const Page = () => <Columns />`,
      "columns.tsx": `export const Columns = () => <div class="columns" />`,
    }), (path) => `/_olai/plugins/reader-v1/${path}.js`)
    if (!built.ok) throw new Error(built.why)
    expect(built.text).toContain(`"/_olai/plugins/reader-v1/columns.tsx.js"`)
    expect(built.modules.map((one) => one.path)).toEqual(["columns.tsx"])
    expect(built.modules[0]?.text).toContain(`["solid-js/web"]`)
  })
})

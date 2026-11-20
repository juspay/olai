import { transformAsync } from "@babel/core"
// @ts-expect-error — the babel presets ship loose types
import babelTypeScript from "@babel/preset-typescript"
// @ts-expect-error — the babel presets ship loose types
import babelSolid from "babel-preset-solid"

import { bind, type Made } from "./bind.ts"
import { type Half, modulesFor, unresolvable } from "./imports.ts"

export type { Half } from "./imports.ts"

export type { Made } from "./bind.ts"

/**
 * Compile one half. The gate runs first, on the author's own text, then the
 * transform, then the bind; a failure at any of the three is one `Made`, and a
 * compiler error is passed through as the author's own sentence.
 */
export const buildHalf = async (half: Half, source: string): Promise<Made> => {
  const refused = unresolvable(source)
  if (refused !== null) return { ok: false, why: refused }
  let text: string
  try {
    text = half === "server" ? transpiled(source) : await drawn(source)
  } catch (thrown) {
    return { ok: false, why: said(thrown) }
  }
  const bound = bind(text, modulesFor(half))
  return bound.ok ? { ok: true, text: bound.text } : { ok: false, why: bound.why }
}

const transpiled = (source: string): string =>
  new Bun.Transpiler({ loader: "ts" }).transformSync(source)

const drawn = async (source: string): Promise<string> => {
  const result = await transformAsync(source, {
    filename: "browser.tsx",
    babelrc: false,
    configFile: false,
    comments: false,
    presets: [[babelSolid, {}], [babelTypeScript, {}]],
  })
  if (result?.code == null) {
    throw new Error("the Solid transform produced no output for this plugin's browser half")
  }
  return result.code
}

const said = (thrown: unknown): string => {
  const message = thrown instanceof Error ? thrown.message : String(thrown)
  const trimmed = message.trim()
  return trimmed === "" ? "the compiler refused this source and said nothing about why" : trimmed
}

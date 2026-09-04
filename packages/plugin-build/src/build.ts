/**
 * SOURCE IN, A MODULE OUT — the two halves of a dynamic plugin, compiled.
 *
 * ## Two compilers, and the split is JSX
 *
 * A SERVER half is TypeScript with no JSX in it, and `Bun.Transpiler` is the
 * whole step: it is in the runtime already, it costs no dependency, and there is
 * nothing for a preset to do.
 *
 * A BROWSER half draws, and Solid's JSX is not a runtime factory — it compiles
 * to template cloning, which is a BABEL preset and not a transpiler option.
 * `@olai/web`'s own build makes the same choice for the app's faces and records
 * why (*Bun's default transform emits `React.createElement`, which Solid does not
 * have*); the pinned Bun honours neither a `jsxImportSource` in a tsconfig nor
 * the `@jsxImportSource` pragma through `Bun.build`, which was measured rather
 * than assumed. An agent-written face has to compile the way a shipped one does,
 * or the slot table would hold two kinds of component.
 *
 * ## NOTHING IS BUNDLED, in either half
 *
 * There is nothing to bundle: a plugin is two files, relative imports are
 * refused (`./imports.ts`), and the only specifiers left are the ones the host
 * binds (`./bind.ts`). So neither half touches a filesystem, resolves a package
 * or reads a `node_modules` — which is what lets this run in a serve whose own
 * tree is a read-only store path, and what makes the whole step a pure function
 * of the text.
 *
 * ## What a caller gets, and what it does not
 *
 * TEXT. Not a module, not a URL, not a file: where a half is EVALUATED is the
 * caller's question and the two answers are different — a `data:` URL in the
 * serve, an HTTP chunk under the tab's own origin — and neither belongs to the
 * compiler.
 */

import { transformAsync } from "@babel/core"
// @ts-expect-error — the babel presets ship loose types
import babelTypeScript from "@babel/preset-typescript"
// @ts-expect-error — the babel presets ship loose types
import babelSolid from "babel-preset-solid"

import { bind, type Made } from "./bind.ts"
import { type Half, modulesFor, unresolvable } from "./imports.ts"

export type { Half } from "./imports.ts"

/** A built half is `./bind.ts`'s one answer shape, re-exported: what comes back
 *  from a COMPILE and what comes back from a BIND are the same two things, and
 *  they were two identical declarations until somebody read them side by side. */
export type { Made } from "./bind.ts"

/**
 * COMPILE ONE HALF.
 *
 * The gate runs FIRST, on the author's own text, so the sentence a refusal
 * carries names what THEY wrote rather than what a compiler made of it. Then the
 * transform, then the bind, and a failure at any of the three is one shape.
 *
 * A COMPILER ERROR IS THE AUTHOR'S SENTENCE and is passed through with nothing
 * composed around it, which is the same rule the roster keeps for a plugin's own
 * failure prose: a syntax error names a line and a column, and core has nothing
 * to add to that but noise.
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

/** The server half: TypeScript, erased. */
const transpiled = (source: string): string =>
  new Bun.Transpiler({ loader: "ts" }).transformSync(source)

/**
 * ...and the browser half: TypeScript AND Solid's JSX, in the order
 * `@olai/web`'s build runs them — Solid first, so the preset sees the JSX
 * before the types are stripped out from under it.
 *
 * `generate: "dom"` and no hydration: this is a chunk a tab fetches and mounts
 * into a page that is already drawn, which is the only way a dynamic plugin ever
 * arrives.
 */
const drawn = async (source: string): Promise<string> => {
  const result = await transformAsync(source, {
    // A NAME THE COMPILER CAN QUOTE. There is no file — the source is a note on
    // a node — so this is what a syntax error names, and it is the name the
    // author gave the node they wrote it in.
    filename: "browser.tsx",
    babelrc: false,
    configFile: false,
    presets: [[babelSolid, {}], [babelTypeScript, {}]],
  })
  if (result?.code == null) {
    throw new Error("the Solid transform produced no output for this plugin's browser half")
  }
  return result.code
}

/** A thrown thing as a person's sentence — the plugin author's words where
 *  there are some, and never the word "Error" dressed up as one. */
const said = (thrown: unknown): string => {
  const message = thrown instanceof Error ? thrown.message : String(thrown)
  const trimmed = message.trim()
  return trimmed === "" ? "the compiler refused this source and said nothing about why" : trimmed
}

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
 * A plugin is every `.ts` and `.tsx` file in its folder, and the caller hands
 * them all in, as text. An import of another of those files is resolved by
 * path arithmetic against that set ({@link resolvedFrom}); the only other
 * specifiers left are the ones the host binds (`./bind.ts`). So neither half
 * touches a filesystem, resolves a package or reads a `node_modules` — which is
 * what lets this run in a serve whose own tree is a read-only store path, and
 * what makes the whole step a pure function of the text. What is built is the
 * text the caller hashed into a version, and nothing else.
 *
 * ## Each file alone, and linked by the caller
 *
 * Every file is transformed on its own, exactly as one file always was, and a
 * relative specifier in its emit is rewritten to the address its target was
 * linked at. WHERE a built file lives is the caller's question — a `data:` URL
 * in the serve, a path under the plugin's own chunk in the tab — so the caller
 * passes `link`, and this package learns neither.
 */

import { transformAsync } from "@babel/core"
// @ts-expect-error — the babel presets ship loose types
import babelTypeScript from "@babel/preset-typescript"
// @ts-expect-error — the babel presets ship loose types
import babelSolid from "babel-preset-solid"

import { bind } from "./bind.ts"
import { type Half, modulesFor, relativeIn, unresolvable } from "./imports.ts"

export type { Half } from "./imports.ts"

/** A file of the folder, built: its path in the folder and its module text. */
export interface Module {
  readonly path: string
  readonly text: string
}

/** An entry built with every file it reaches, or the sentence that says why
 *  not. `modules` is every OTHER file it reached, each built once, in the order
 *  they finished — a dependency before what imports it. */
export type Linked =
  | { readonly ok: true; readonly text: string; readonly modules: ReadonlyArray<Module> }
  | { readonly ok: false; readonly why: string }

/** A module's text as a URL `import()` can load with no file behind it — what
 *  the serve links its built files by. */
export const asDataUrl = (text: string): string =>
  `data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`

/**
 * COMPILE ONE HALF of a plugin: its entry, and every file of the folder the
 * entry reaches.
 *
 * The gate runs FIRST on each file, on the author's own text, so the sentence a
 * refusal carries names what THEY wrote rather than what a compiler made of it.
 * Then the file's own imports are resolved and built, then the file itself is
 * transformed and bound, and a failure at any step is one shape.
 *
 * A COMPILER ERROR IS THE AUTHOR'S SENTENCE and is passed through with only the
 * file's path in front of it: a syntax error names a line and a column, and core
 * has nothing to add to that but noise.
 *
 * `link` answers the address a built file is imported by, given its path and
 * text. It is called once per file, after that file is built.
 */
export const buildPlugin = async (
  half: Half,
  entry: string,
  folder: ReadonlyMap<string, string>,
  link: (path: string, text: string) => string,
): Promise<Linked> => {
  const built = new Map<string, { readonly text: string; readonly url: string }>()
  const modules: Array<Module> = []
  /** Build `path` and everything it reaches; `chain` is the files above it,
   *  so an import of one of them is a cycle. */
  const visit = async (path: string, chain: ReadonlyArray<string>): Promise<string | null> => {
    const source = folder.get(path)
    if (source === undefined) return `this plugin has no \`${path}\` to build.`
    const refused = unresolvable(source)
    if (refused !== null) return path === entry ? refused : `\`${path}\`: ${refused}`
    const local = new Map<string, string>()
    for (const spec of relativeIn(source)) {
      const target = resolvedFrom(half, path, spec, folder)
      if (!target.ok) return target.why
      if (target.path === path || chain.includes(target.path)) {
        return `\`${path}\` imports "${spec}", which imports \`${path}\` back: a cycle. `
          + `No file of a plugin may import itself back, directly or through others; `
          + `move what both need into a third file.`
      }
      if (!built.has(target.path)) {
        const why = await visit(target.path, [...chain, path])
        if (why !== null) return why
      }
      local.set(spec, built.get(target.path)!.url)
    }
    let text: string
    try {
      text = half === "server" ? transpiled(source) : await drawn(source, path)
    } catch (thrown) {
      return path === entry ? said(thrown) : `\`${path}\`: ${said(thrown)}`
    }
    const bound = bind(text, modulesFor(half), local)
    if (!bound.ok) return path === entry ? bound.why : `\`${path}\`: ${bound.why}`
    built.set(path, { text: bound.text, url: link(path, bound.text) })
    if (path !== entry) modules.push({ path, text: bound.text })
    return null
  }
  const why = await visit(entry, [])
  if (why !== null) return { ok: false, why }
  return { ok: true, text: built.get(entry)!.text, modules }
}

/** The two suffixes a plugin's code is written in. */
const CODE = /\.tsx?$/

/**
 * WHICH FILE OF THE FOLDER `spec`, written in `from`, names — by path
 * arithmetic over the folder's own files and nothing else.
 *
 * Each refusal names the specifier as written and the file that wrote it,
 * because the author fixes the import, not the path olai worked out.
 */
const resolvedFrom = (
  half: Half,
  from: string,
  spec: string,
  folder: ReadonlyMap<string, string>,
): { readonly ok: true; readonly path: string } | { readonly ok: false; readonly why: string } => {
  const leaves = {
    ok: false as const,
    why: `\`${from}\` imports "${spec}", which is outside this plugin's folder. A plugin may `
      + `import only what is in its own folder, by a path relative to the file importing it.`,
  }
  if (spec.startsWith("/")) return leaves
  const parts = from.split("/").slice(0, -1)
  for (const step of spec.split("/")) {
    if (step === "" || step === ".") continue
    if (step === "..") {
      if (parts.length === 0) return leaves
      parts.pop()
      continue
    }
    parts.push(step)
  }
  const path = parts.join("/")
  if (!CODE.test(path)) {
    return {
      ok: false,
      why: `\`${from}\` imports "${spec}", which is not a .ts or .tsx file. Name a code file of `
        + `this folder with its suffix, as in "./sm2.ts".`,
    }
  }
  if (!folder.has(path)) {
    return { ok: false, why: `\`${from}\` imports "${spec}", but this plugin's folder holds no \`${path}\`.` }
  }
  if (half === "server" && path.endsWith(".tsx")) {
    return {
      ok: false,
      why: `\`${from}\` imports "${spec}", a .tsx file, into the server half. A .tsx file is drawn `
        + `in the page and the server half cannot import one; put what the server needs in a .ts file.`,
    }
  }
  return { ok: true, path }
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
const drawn = async (source: string, path: string): Promise<string> => {
  const result = await transformAsync(source, {
    // A NAME THE COMPILER CAN QUOTE, and the one that decides whether JSX is
    // allowed: the file's own path in the plugin's folder, so a `.ts` helper is
    // TypeScript and a `.tsx` file is TypeScript with JSX, as anywhere else.
    filename: path,
    babelrc: false,
    configFile: false,
    /**
     * NO COMMENTS IN THE EMIT, and this is a correctness option rather than a
     * size one.
     *
     * babel preserves comments by default. `./bind.ts` reads the emitted text
     * for `import` at the head of a line, and it is not a parser — it cannot be,
     * and its post-condition is written on that admission — so a browser half
     * carrying
     *
     *     \/*
     *     import pad from "left-pad"
     *     *\/
     *
     * passed the gate honestly (a specifier in a comment is not an import, and
     * `Bun.Transpiler.scan` says so) and was then refused by the BIND, naming a
     * module the author never imported. A refusal that quotes a line somebody
     * commented OUT is the worst kind of wrong: it is about the one part of
     * their file that does nothing.
     *
     * The server half does not need this — `Bun.Transpiler` strips comments on
     * its way through — which is why the two halves differ here and nowhere
     * else.
     */
    comments: false,
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

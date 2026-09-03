/**
 * THIS REPOSITORY, AS VALUES — the reading `fence.test.ts` and
 * `mechanics.test.ts` both stand on, and the one thing neither of them is about.
 *
 * ## Why it is its own module
 *
 * `fence.test.ts` had grown to ~1400 lines, of which the first ~550 were this:
 * glob expansion, manifest parsing, a source walk, four import grammars, a
 * transpiler, a module resolver and a graph walk — all of it generic, none of it
 * a claim, and every one of the file's nine claims sitting behind it. Two
 * concerns in one module, and the reader of claim 6 had to scroll past a
 * discriminated resolver to reach it.
 *
 * "Its only consumer is `fence.test.ts`, so it belongs there" is circular: it
 * lived there because it was written there. Placed here, the claims file is the
 * claims and their reasons, and this file is answerable on its own terms —
 * which is also what let `mechanics.test.ts` stop carrying its own copy of the
 * source walk (the same recursion, the same `node_modules` argument, written
 * twice in one package with no wall between them).
 *
 * ## The line
 *
 * Nothing here knows what a plugin is. This module answers WHAT THIS TREE IS
 * MADE OF — members, manifests, sources, specifiers, the module graph — and
 * `fence.test.ts` answers WHAT MAY NAME WHAT. That is the split, and it is why
 * `namesAPlugin`, the tenants, the container and every claim stayed behind.
 *
 * TWO OTHER PACKAGES READ THE TREE THE SAME WAY and cannot call this, so a
 * future reader knows where the other copies are: `@olai/acp`'s
 * `manifest.test.ts` (whose own first claim is that acp imports no `@olai`
 * sibling, so reaching for this module is the thing that test exists to fail)
 * and `@olai/tests`' `imports.test.ts` (which could import it — that package
 * declares `@olai/plugin-api` — but only through a door, and a `./tree` door
 * would put this file on the very closure `codeDoorsOf` walks, changing what
 * the tenancy claims compute). Both are structural, not sloppiness.
 *
 * ## Why `.testlib.ts`
 *
 * The repo's convention for a module that exists to serve tests and ships no
 * product (nineteen of its twenty-six are internal to their package, as this one
 * is). It also puts this file on the right side of `fence.test.ts`'s own claim 8,
 * which reads PRODUCTION sources: a tree reader is not product.
 */

import { existsSync, readFileSync } from "node:fs"

import { ROWS } from "./rows.ts"
import * as path from "node:path"

/** Where every workspace member lives. */
export const PACKAGES = path.join(import.meta.dirname, "..", "..")

/** The repository root. Its manifest is the one the isolated linker splices
 *  into the node_modules every hydrated source resolves from by walking up,
 *  which is why a specifier it declares is not confined to anybody — and it is
 *  also where the workspace globs live, which is what {@link MEMBERS} is read
 *  out of. */
export const REPO = path.join(PACKAGES, "..")

/** ONE READ PER MANIFEST, and the memo is not an optimisation for its own sake:
 *  the graph walk below asks this the same question hundreds of times —
 *  `kolu-client`'s manifest is opened forty-one times in a run without it, once
 *  per specifier that resolves into it. A second read could answer differently
 *  only if something rewrote the file mid-run, which is a thing no claim here
 *  does and none should. */
const MANIFESTS = new Map<string, Record<string, unknown> | undefined>()
export const manifestAt = (dir: string): Record<string, unknown> | undefined => {
  if (MANIFESTS.has(dir)) return MANIFESTS.get(dir)
  const file = path.join(dir, "package.json")
  let read: Record<string, unknown> | undefined
  if (!existsSync(file)) {
    // THE ONE HONEST ABSENCE: there is no manifest here. Every caller reads
    // that as "not a package", which is what it is.
    read = undefined
  } else {
    try {
      read = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>
    } catch (cause) {
      // A MANIFEST THAT IS THERE AND WILL NOT PARSE IS NOT AN ABSENCE, and
      // answering `undefined` for it made this a two-job value whose second job
      // was silent: the member stays in `MEMBERS` (which only asks whether the
      // file exists) so `tree` walks its sources, and drops out of
      // `MEMBER_OF_PACKAGE` so its whole subgraph leaves every door walk. Two
      // readings of one tree then disagree about whether that package is there,
      // with nothing red anywhere.
      throw new Error(`fence: ${path.relative(REPO, file)} did not parse — ${String(cause)}`)
    }
  }
  MANIFESTS.set(dir, read)
  return read
}

/** A manifest's `exports` map, PARSED rather than cast. npm legally allows a
 *  conditional object (`{"./wire": {"import": "…"}}`) and a wildcard; this
 *  reading knows neither, and the difference between "knows neither" and
 *  "silently drops both" is a door that leaves a tenant's closure with nothing
 *  red — in the one file whose thesis is that a corpus may not quietly shrink.
 *  So a shape this cannot read is a THROW, which is the ruling {@link MEMBERS}
 *  already makes about an unrecognised workspaces glob. */
export const doorsOf = (manifest: Record<string, unknown>): Readonly<Record<string, string>> => {
  const exports = manifest["exports"]
  if (exports === undefined) return {}
  if (typeof exports !== "object" || exports === null || Array.isArray(exports)) {
    throw new Error("fence: an `exports` field that is not a map is a shape this reading does not know")
  }
  for (const [door, target] of Object.entries(exports)) {
    if (typeof target !== "string") {
      throw new Error(
        `fence: the \`${door}\` door resolves to a ${typeof target} rather than a path — a ` +
          "conditional or wildcard export is a shape this reading does not know, and dropping it " +
          "would shrink a tenant's closure with nothing red.",
      )
    }
  }
  return exports as Readonly<Record<string, string>>
}

export const mainOf = (manifest: Record<string, unknown>): string | undefined => {
  const main = manifest["main"]
  return typeof main === "string" ? main : undefined
}

/** ...and what one declares, in the three blocks that all mean the same thing
 *  to a wall: a dependency, a devDependency and a peer are three reasons to
 *  resolve a specifier and one answer about which side of a boundary a package
 *  stands on. */
export const dependencyNames = (manifest: Record<string, unknown> | undefined): ReadonlyArray<string> =>
  Object.keys({
    ...(manifest?.["dependencies"] as Record<string, string> | undefined),
    ...(manifest?.["devDependencies"] as Record<string, string> | undefined),
    ...(manifest?.["peerDependencies"] as Record<string, string> | undefined),
  })

/**
 * EVERY WORKSPACE MEMBER, as its directory relative to `packages/` — so a
 * top-level member is `web` and a nested tenant is `plugins/olai-plugin-kolu`.
 *
 * READ OUT OF THE ROOT'S OWN `workspaces` GLOBS, and that is the point rather
 * than an implementation detail. This file used to walk `readdirSync(PACKAGES)`
 * one level deep, which was the same set only while every member sat at the top
 * — and the day the tenants moved under `packages/plugins/` that walk would have
 * gone on passing over a corpus with both of them missing, which is the exact
 * failure mode the header calls a fence that passes by failing to run. The
 * globs are what bun installs from, so a member this reading cannot see is a
 * member that is not in the tree at all.
 *
 * THE EXPANSION IS THE RUNTIME'S (`Bun.Glob`), not this file's reading of the
 * pattern. The first draft hand-rolled it — a `readdirSync` behind a check that
 * each glob ended `/*` — and the hand-roll could read exactly one shape, so a
 * root that grew a `packages/**` would have been a THROW rather than a reading.
 * The throw was the right outcome for a hand-roll that could not read the shape;
 * it is not needed by a reading that can read every shape bun installs from.
 *
 * What IS still a throw: a glob outside `packages/`, and a glob that matched
 * NOTHING. Both are a corpus quietly short of members, and every claim below is
 * an equality over that corpus — which is the fence passing by not running.
 */
export const MEMBERS: ReadonlyArray<string> = (() => {
  const globs = manifestAt(REPO)?.["workspaces"]
  if (!Array.isArray(globs) || globs.length === 0) {
    throw new Error("fence: the root manifest declares no `workspaces`, so there is no tree to read")
  }
  const found = (globs as ReadonlyArray<unknown>).flatMap((glob) => {
    if (typeof glob !== "string" || !glob.startsWith("packages/")) {
      throw new Error(
        `fence: the workspaces glob ${JSON.stringify(glob)} does not name anything under ` +
          "`packages/`, and guessing at it would shrink the corpus every claim here is an " +
          "equality over.",
      )
    }
    // THE RUNTIME'S OWN GLOB, rather than this file interpreting the pattern.
    // It was a `readdirSync` behind a check that the glob ended `/*`, which is
    // a hand-roll that could read exactly one shape and threw on the rest — so
    // the day the root grew a `packages/**` the corpus would have been a throw
    // rather than a reading, and the throw was the good outcome only because
    // the alternative hand-roll was a silent skip. `Bun.Glob` reads every shape
    // bun installs from, which is the only reading that cannot disagree with
    // the field it is derived from.
    const members = [...new Bun.Glob(`${glob}/package.json`).scanSync({ cwd: REPO })]
      .map((found) => path.relative("packages", path.dirname(found)))
    if (members.length === 0) {
      throw new Error(
        `fence: the workspaces glob ${JSON.stringify(glob)} matched no package at all. A glob ` +
          "that installs nothing is either a typo or a directory that is not there, and both " +
          "are a corpus this file's equalities would pass over in silence.",
      )
    }
    return members
  })
  return [...new Set(found)].sort()
})()

/** Which member a `packages/`-relative path belongs to — the LONGEST member
 *  that prefixes it, because `plugins/olai-plugin-kolu` and a hypothetical
 *  `plugins` would both prefix a tenant's file and only one of them is its
 *  package. `undefined` for a path under no member at all. */
export const memberOf = (file: string): string | undefined =>
  MEMBERS.filter((member) => file === member || file.startsWith(`${member}${path.sep}`))
    .sort((a, b) => b.length - a.length)[0]

/** The PACKAGE a specifier names, subpath dropped. `@kolu/padi-client/dial` and
 *  `@kolu/padi-client` are one package and one wall; so are `olai-plugin-kolu`
 *  and `olai-plugin-kolu/wire`. */
export const packageOf = (spec: string): string =>
  spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : (spec.split("/")[0] ?? spec)

/** What each member CALLS itself, so a specifier can be resolved to a directory
 *  without this file inventing a rule about how the two relate. It is one rule
 *  today — a directory is its package's name, scope dropped — and deriving it
 *  anyway is what let `@olai/plugins` become `@olai/plugin-api` and the tenants
 *  become unscoped `olai-plugin-*` with no arithmetic here to update. */
export const MEMBER_OF_PACKAGE: ReadonlyMap<string, string> = new Map(
  MEMBERS.flatMap((member) => {
    const name = manifestAt(path.join(PACKAGES, member))?.["name"]
    return typeof name === "string" ? [[name, member] as const] : []
  }),
)


/** Every import specifier, by POSITION rather than by statement, so a braced
 *  list broken across lines — this tree's dominant style — is seen. Prose
 *  spelling one of those forms is seen too, which is the right direction to be
 *  wrong in: an extra specifier fails a boundary claim rather than passing
 *  one. `@olai/acp`'s manifest test argues this at length and this is its
 *  reading, unchanged. */
export const specifiersOf = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/(?:\bfrom\s*|^\s*import\s*|\bimport\(\s*|\brequire\(\s*)["']([^"'\n]+)["']/gm)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

/** ...and a stylesheet's own door, which the two TypeScript readings are blind
 *  to. It is not hypothetical: `@olai/web`'s `styles.css` reaches
 *  `@olai/plugin-api/all.css` today, which chains each tenant's own sheet, and a
 *  plugin's sheet is exactly how a face
 *  gets its layout (`all.css`'s header says what a missed `@source` costs —
 *  the components render with no layout at all and nothing errors). */
export const cssImportsOf = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/^\s*@import\s+["']([^"']+)["']/gm)]
    .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

/** Every source under one package.
 *
 *  `Bun.Glob` does not follow a symlinked DIRECTORY, which is the whole of why
 *  this used to be a hand-rolled walk: it refused `node_modules` before
 *  descending, because a workspace `node_modules` is full of symlinks back to
 *  sibling packages, each with a `node_modules` of its own, and a walk that
 *  filtered the results had already gone in (`@olai/acp`'s own `ELOOP`). The
 *  runtime declines to follow them, so the hazard does not arise and the prune
 *  has nothing left to prune — checked rather than assumed, against the two
 *  packages with the largest trees: `packages/web` answers 608 files and
 *  `packages/tests` 109, neither with a single `node_modules` entry. */
export const sourcesUnder = (dir: string): ReadonlyArray<string> =>
  [...new Bun.Glob("**/*.{ts,tsx,css}").scanSync({ cwd: dir })]
    .map((found) => path.join(dir, found))
    .sort()

export interface Named {
  /** Root-relative, so a failure reads as a path somebody can open. */
  readonly file: string
  /** WHICH READER PRODUCED `specs`, carried rather than re-derived. It was
   *  recoverable only by testing the extension again, which three separate
   *  sites did — and `specs` means a different thing per grammar, so a consumer
   *  that guessed wrong would be asking a CSS reading a TypeScript question.
   *  The fact travels with the value. */
  readonly grammar: "css" | "tsx" | "ts"
  /** Every specifier this file reaches for at all, by that grammar. Kept beside
   *  the filtered answer because the tenancy claims at the bottom of this file
   *  ask a DIFFERENT question of the same reading, and reading every source
   *  twice to ask it would be the corpus walked twice. */
  readonly specs: ReadonlyArray<string>
}

/** The grammar a path is read in, decided ONCE. */
export const grammarOf = (file: string): Named["grammar"] =>
  file.endsWith(".css") ? "css" : file.endsWith(".tsx") ? "tsx" : "ts"

// ── the wire door's closure ────────────────────────────────────────────
//
// A WALK, not one file's text, and it has to be: `./wire.ts` is one ESM
// module, so what a listener evaluates when it reads the surface is its whole
// closure — and the incident `@olai/tests`' import fence exists to not have
// re-learned is exactly that a single re-export one module in is invisible to
// a reading of the door itself.
//
// It crosses PACKAGE boundaries, which that fence deliberately does not
// ("another package's discipline is another package's fence"). Here the
// crossing is the point: the graph this door opens runs `@olai/plugin-api/wire`
// → each plugin's `./wire` → each appliance client's `./wire`, and what the
// claim is about is where it STOPS.

/**
 * WHERE A WORKSPACE SPECIFIER LANDS — and the answer is DISCRIMINATED, because
 * "the walk stops here" and "the walk could not go on" are two different facts
 * and only one of them is allowed.
 *
 * It was one `string | undefined`, and the `undefined` was doing three jobs:
 * the specifier LEAVES the workspace (the legitimate terminus — `effect`,
 * `node:fs`, a `@kolu/*` from the pin), the named member's manifest could not
 * be READ, and the manifest opens NO SUCH DOOR. A caller that cannot tell them
 * apart reads all three as "the graph ends here", and the last two are exactly
 * what a packaging move breaks — this branch moved every door in the tree. The
 * fence's own header names "a resolver that answered `undefined` and walked one
 * file" as the failure mode it exists against; a three-job `undefined` is that
 * failure mode with a type signature.
 *
 * So the dependent fact — a resolved path — exists only on the arm that grounds
 * it, and `unresolved` is held to `[]` beside every other equality in this file.
 *
 * The door is read off the named package's own `exports` map rather than
 * guessed. NOT because string arithmetic would be "a second module resolver" —
 * that was the old comment's reason and it is backwards. The RUNTIME resolver
 * was tried and refuses this question: `Bun.resolveSync("@olai/format",
 * packages/plugin-api/src)` throws, because the isolated linker gives a member
 * only the siblings its own manifest declares, and this walk crosses from the
 * registry THROUGH a tenant INTO packages the registry never declares. That is
 * the whole point of the walk, and it is a question the resolver is right to
 * refuse and this file is right to ask. Standing on `Bun.resolveSync` or on a
 * `Bun.build` metafile would make every such crossing an unresolved edge and
 * every purity claim pass over the truncated graph.
 */
type Landing =
  | { readonly kind: "external" }
  | { readonly kind: "module"; readonly path: string }
  | { readonly kind: "unresolved"; readonly why: string }

const resolveWorkspace = (spec: string): Landing => {
  // WHICH MEMBER a specifier names is a lookup rather than a pattern, because
  // the two families of workspace name do not share one: core is `@olai/<x>`
  // and a tenant is the unscoped `olai-plugin-<x>` its directory is called.
  // A regex over the first family alone would answer "external" for every
  // plugin door, which is not a walk that stops — it is a walk that never
  // starts, and every purity claim below would pass over one file.
  const member = MEMBER_OF_PACKAGE.get(packageOf(spec))
  if (member === undefined) return { kind: "external" }
  const dir = path.join(PACKAGES, member)
  const manifest = manifestAt(dir)
  if (manifest === undefined) return { kind: "unresolved", why: `${member} has no readable manifest` }
  const subpath = spec.slice(packageOf(spec).length)
  const door = subpath === "" ? "." : `.${subpath}`
  const target = doorsOf(manifest)[door] ?? (door === "." ? mainOf(manifest) : undefined)
  if (target === undefined) {
    return { kind: "unresolved", why: `${member} opens no ${door} door` }
  }
  return { kind: "module", path: path.join(dir, target) }
}

/**
 * ONE EDGE the walk found, with the one thing that decides whether it is
 * followed.
 *
 * `dynamic` is a `import("…")` rather than an `import … from "…"`, and the
 * difference is a BUNDLER'S: a static edge is code the door's consumer pays
 * for at load, and a dynamic one is a CHUNK — a literal the bundler can split
 * on and a module nothing fetches until somebody calls the thunk. That is the
 * whole mechanism behind "a plugin the roster does not name is never
 * evaluated" (`./rows.ts`), so a walk that followed both would be a walk that
 * could not see it.
 *
 * Both are RECORDED, and only the static ones are FOLLOWED. A claim about what
 * a door names reads every edge; a claim about what it costs reads the files
 * the walk visited.
 */
export interface Edge {
  readonly spec: string
  readonly dynamic: boolean
}

/** One transpiler per grammar — the `ts` loader refuses JSX. The walk reads
 *  imports the RUNTIME's way (`scanImports`) rather than by position, and
 *  that is the difference between this reading and the one above it: a
 *  positional match over-includes, which fails CLOSED for "does anything
 *  reach for X" and fails OPEN for a WALK — an `@olai/surface` spelled inside
 *  a comment in `@olai/kolu-client/wire` sent the first draft of this walk
 *  straight into a package the door does not reach. `scanImports` sees no
 *  comments and elides type-only imports, which is the right instrument for a claim about what a listener actually EVALUATES. */

export const transpilers = {
  ts: new Bun.Transpiler({ loader: "ts" }),
  tsx: new Bun.Transpiler({ loader: "tsx" }),
} as const
export const runtimeImportsOf = (file: string, text: string): ReadonlyArray<string> =>
  edgesOf(file, text).map((one) => one.spec)

/** ...and the same reading with the kind kept — see {@link Edge}. */
export const edgesOf = (file: string, text: string): ReadonlyArray<Edge> =>
  transpilers[grammarOf(file) === "tsx" ? "tsx" : "ts"]
    .scanImports(text)
    .map((one) => ({ spec: one.path, dynamic: one.kind === "dynamic-import" }))
/**
 * ...memoised for the WALK ALONE, keyed by the absolute path it visits.
 *
 * The three door entries reach overlapping graphs — most of `@olai/format`'s
 * modules are on all of them — so without this each shared module is transpiled
 * once per entry rather than once.
 *
 * It is private to the walk rather than wrapped around `runtimeImportsOf`, and
 * the difference is a correctness one rather than a scoping preference. That
 * function has a second caller (claim 8's `codeOf`), which hands it a
 * PACKAGES-RELATIVE path and a SHEBANG-STRIPPED text — a different key and a
 * different input for the same file. A memo keyed on the path alone would be a
 * place with two writers that agree only by the accident that one spells its
 * paths absolute and the other relative, and the first shebang-carrying module
 * either walk visited would make it answer one caller with the other's reading.
 * A cache is a mutable place; this one has exactly one writer.
 */
const WALKED = new Map<string, ReadonlyArray<Edge>>()
const importsOfModule = (file: string, text: string): ReadonlyArray<Edge> => {
  const held = WALKED.get(file)
  if (held !== undefined) return held
  const found = edgesOf(file, text)
  WALKED.set(file, found)
  return found
}



/**
 * THE GRAPH ONE DOOR OPENS, in the two readings the claims below need.
 *
 * `reached` is the PAIRS — which file evaluated which specifier — and is what a
 * confinement list is checked against: the failure it prints is a file and the
 * thing it reached for, which is what somebody has to go and change.
 *
 * `files` is every MODULE VISITED, leaves included, and it is a different set
 * rather than a projection of the first: a module that imports nothing of its
 * own is visited and contributes no pair at all. That is right for "what does
 * this graph reach for" and wrong for "what is ON this graph" — and a component
 * with no imports is exactly the shape that falls through the gap.
 *
 * `unresolved` is the third, and it is what keeps the other two honest. A pair
 * is pushed for EVERY specifier, including one the walk could not follow, while
 * `files` grows only where it could — so the two read honest alone and lie
 * together: a walk in which every workspace specifier failed to resolve reports
 * a `reached` naming all of them and a `files` of one module, and each then
 * passes its own floor. The confinement claims are satisfied by an empty graph;
 * `it DOES reach each appliance client` is satisfied by the PAIR, which records
 * that the specifier was reached FOR rather than that it was entered. The
 * precondition — these two mean something only where resolution succeeded — is
 * not left to arm order: it is a list, and every door holds it to `[]`.
 *
 * One traversal answers all three, because three would be three chances to
 * disagree about what the graph is.
 */
export const graphFrom = (entry: string): {
  reached: ReadonlyArray<{ file: string; spec: string; dynamic: boolean }>
  files: ReadonlyArray<string>
  unresolved: ReadonlyArray<string>
} => {
  const seen = new Set<string>()
  const reached: Array<{ file: string; spec: string; dynamic: boolean }> = []
  const unresolved: Array<string> = []
  const visit = (file: string): void => {
    if (seen.has(file)) return
    seen.add(file)
    let text: string
    try {
      text = readFileSync(file, "utf8")
    } catch {
      // Reached but unreadable, which is not a terminus either: a module the
      // walk was sent to and could not open is a hole in the graph, and it is
      // recorded rather than returned from.
      unresolved.push(`${path.relative(PACKAGES, file)}: could not be read`)
      return
    }
    for (const { spec, dynamic } of importsOfModule(file, text)) {
      const rel = path.relative(PACKAGES, file)
      reached.push({ file: rel, spec, dynamic })
      // A DYNAMIC edge is RECORDED AND NOT FOLLOWED — see `Edge`. It is a
      // chunk boundary: the specifier is a literal the bundler splits on and
      // the module behind it is fetched by whoever calls the thunk, so a walk
      // that crossed it would be measuring what a door NAMES as if it were
      // what a door COSTS.
      if (dynamic) continue
      if (spec.startsWith(".")) {
        visit(path.normalize(path.join(path.dirname(file), spec)))
        continue
      }
      const landing = resolveWorkspace(spec)
      if (landing.kind === "module") visit(landing.path)
      else if (landing.kind === "unresolved") unresolved.push(`${rel}: ${spec} — ${landing.why}`)
    }
  }
  visit(entry)
  return {
    reached,
    files: [...seen].map((file) => path.relative(PACKAGES, file)).sort(),
    unresolved: [...new Set(unresolved)].sort(),
  }
}

/** The pairs alone, which is what most callers here want. */
export const walkFrom = (entry: string): ReadonlyArray<{ file: string; spec: string }> =>
  graphFrom(entry).reached


/**
 * EVERY PLUGIN'S SERVER MODULE, LOADED — what a test reads now that no door in
 * this package statically imports a plugin.
 *
 * `WIRES` used to be a compiled-in tuple of each plugin's wire half, and a test
 * that wanted a plugin's own values read it. There is no such tuple: the rows
 * name modules, the composition root's loader resolves them at mount and the
 * tab's generated table resolves them at fetch, and a static import anywhere in
 * this package would be the thing the fence now asserts is absent.
 *
 * So a test does what the runtime does, which is also the stronger claim: it
 * IMPORTS BY THE ROW'S OWN NAME. A row whose module does not export what this
 * package believes it does fails here, in the same grammar the loader would
 * fail in, rather than at a `satisfies` on a list nobody maintains.
 *
 * The SERVER half, because that is the one that carries `faces` — which face
 * may see which member is a serve's question, and a browser half answers none
 * of it.
 */
export const serverHalves = async (): Promise<ReadonlyArray<ServerHalf>> =>
  Promise.all(ROWS.map((row) => import(row.name) as Promise<ServerHalf>))

/** As much of a server half as the tests in this package read. */
export interface ServerHalf {
  readonly name: string
  readonly surface: { readonly spec: unknown }
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly kinds?: ReadonlyArray<{ readonly kind: string }>
}

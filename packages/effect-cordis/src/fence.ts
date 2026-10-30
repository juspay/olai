/**
 * THE STATIC FENCE — the half of spatial composability no runtime can check.
 *
 * ## What is on this side of the line
 *
 * Cordis decides whether a plugin's DECLARED coeffects are met at START. It
 * cannot say whether the STATIC graph agrees with that declaration: whether a
 * package resolved a dependency through the door its provider published or
 * reached into the provider's private state, whether a browser entry's walk
 * carries a `node:` builtin, whether a module two packages share holds one
 * activation's value in a module variable. Every one of those is a fact about
 * imports and text, and the runtime is the wrong instrument for all of them.
 *
 * So they are here, in the package that is already the boundary between the
 * runtime and everything above it. The nouns are the runtime's own: ROWS,
 * DOORS, ROOTS, NAMES. There is no vault, no surface and no doorbell in this
 * file — that is the README's line, and a fence whose subjects were somebody
 * else's features could not sit on this side of it.
 *
 * ## What it is NOT
 *
 * It imports no plugin and evaluates no plugin. Every claim is a reading of
 * SOURCES and of MODULE GRAPHS, which is why a plugin that will not load at all
 * still gets every claim here run against it — exactly when a fence is most
 * worth having. The dependency list is deliberate: `node:` builtins and
 * `typescript`, nothing else. A second consumer hydrates this package as SOURCE
 * from a pin with no build step and has `typescript` and not babel; a fence that
 * needed a transpiler to strip a comment would be a fence that consumer could
 * not run.
 *
 * ## Silence is the only failure mode a fence can have
 *
 * A sweep is green when it found nothing — and "found nothing" is exactly what
 * a corpus that came back short, a resolver that answered `undefined` and a
 * pattern that stopped matching all look like. So every claim carries its own
 * non-vacuity check, and each of those is a FINDING rather than an assertion: a
 * declaration whose sweep saw no cross-package import is red here, not quiet.
 * {@link prove} is the other half — it breaks a COPY of the tree on purpose,
 * once per claim, and asserts the claim that names each defect refuses it.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import ts from "typescript"

const posix = path.posix

// ── what a claim is called ─────────────────────────────────────────────

/**
 * THE FIVE CLAIMS, named once so a failure, a proof and a test can agree.
 *
 *   - `imports` — a row's package is imported only by roots, or by another row
 *     through a declared door; a host imports rows only from a root file; rows
 *     import neither a root file nor the registry.
 *   - `door-graphs` — what each root's walk may carry, decided by the kind of
 *     graph the root is, and every edge the walk followed resolved.
 *   - `names` — a row's name as TEXT lives in its own packages, the root files
 *     and the collision record, and nowhere else.
 *   - `live-state` — a module another package can open holds no module-level
 *     mutable value, or is an argued allowance that is still reachable and
 *     still holds something.
 *   - `registry` — the rows the host supplied, the rows on disk and the rows the
 *     roots compose are one set.
 */
export const CLAIMS = ["imports", "door-graphs", "names", "live-state", "registry"] as const
export type Claim = (typeof CLAIMS)[number]

export interface Finding {
  readonly claim: Claim
  /** A sentence naming what is wrong and where. Read on its own in a failure. */
  readonly said: string
}

export interface Report {
  readonly findings: ReadonlyArray<Finding>
  readonly ok: boolean
  /** One claim's findings, as the sentences a test prints. */
  red(claim: Claim): ReadonlyArray<string>
  /** What the reading saw, so a consumer's floors are stated against THIS
   *  file's corpus rather than a second one. */
  readonly reading: Reading
}

// ── the declaration ────────────────────────────────────────────────────

/** A root is a CLAIM a person makes: this file may name more than one row, and
 *  the graph it opens is a BROWSER's or a NODE's. There is no per-door
 *  declaration of that kind — a door's kind is which roots reach it. */
export interface Root {
  /** Repo-relative, POSIX separators. */
  readonly entry: string
  readonly graph: "browser" | "node"
}

/**
 * THE HOST'S ROWS — names alone, resolved through each package's manifest, or a
 * record supplied from wherever the host already names them.
 *
 * Both arms exist because two consumers differ in a way worth stating: one has
 * ONE place rows are named (a generated roster) and must not name them twice,
 * and the other has no roster at all and says so on each package. A row may
 * span several packages — a build whose `ci` row owns a runner and the
 * vocabulary beside it has two directories behind one name — which is why the
 * record arm maps a row to its packages rather than to one directory.
 */
export type Rows = ReadonlyArray<string> | Readonly<Record<string, ReadonlyArray<string>>>

/** The manifest field that carries a package's row: `"cordis": { "row": "ci" }`. */
const ROW_FIELD = "cordis"

/**
 * The one list a PERSON writes for claim 4.
 *
 * A module that holds live state behind a door is a module somebody has to
 * argue for — a declared broker, a page's own layer stack, a memo over an
 * immutable input — and the argument is prose, so it belongs where a reader
 * lands when the claim fails. Every entry is held to two things: the module is
 * still reachable across a package boundary, and it still holds something. An
 * allowance for a module nobody can open any more, or one that stopped holding
 * anything, is a sentence nobody has to keep true.
 */
export type Allowances = Readonly<Record<string, string>>

/**
 * A HOLDER FACTORY — a call that mints a slot with a `const` and no `let` in
 * sight, so a module-scope call is state the two obvious rules cannot see.
 *
 * Matched by the DOOR it comes from and the name it exports, never by the local
 * spelling: `import { heldService as slot }` is the first thing anybody would
 * reach for, and a table of bare words would miss it.
 */
export interface Holder {
  readonly from: RegExp
  readonly named: string
}

export interface Declaration {
  /** The workspace root: the directory whose `package.json` carries the
   *  `workspaces` globs. */
  readonly repo: string
  readonly rows: Rows
  readonly roots: ReadonlyArray<Root>
  /** A row's name outside its own packages, exactly. Grants no import and no
   *  lifetime exemption: claims 1 and 4 are independent of this table. */
  readonly collisions?: Readonly<Record<string, Readonly<Record<string, number>>>>
  readonly allowances?: Allowances
  readonly holders?: ReadonlyArray<Holder>
  /** What a node root's walk may not reach. It REPLACES {@link DEFAULT_RUNTIMES}
   *  rather than extending them, so a consumer that wants its own words as well
   *  spreads the default and does not restate it. */
  readonly runtimes?: ReadonlyArray<RegExp>
  /** What counts as a bench, whose sources no claim about SHIPPING code reads.
   *  The default is {@link isBench}; a consumer whose benches live somewhere
   *  else supplies its own reading rather than arguing with this one. */
  readonly bench?: (file: string) => boolean
}

/**
 * THE UI RUNTIMES A NODE GRAPH MUST NEVER EVALUATE — Solid's and React's,
 * because Bun's default JSX runtime is React's and a `.tsx` on a server graph is
 * a boot death with nothing in the source to see.
 *
 * EXPORTED because a consumer's list is this one plus its own words: replacing
 * it with a hand-typed copy is how `react` gets dropped by accident, which is
 * the exact death the list exists for.
 */
export const DEFAULT_RUNTIMES: ReadonlyArray<RegExp> = [
  /^solid-js(\/|$)/,
  /^@solid-primitives\//,
  /^react(\/|$)/,
  /^react-dom(\/|$)/,
  /^preact(\/|$)/,
]

/** A `node:` or `bun:` builtin — nothing a browser bundle can satisfy. */
const BUILTIN = /^(?:node|bun):/

// ── the workspace, as values ───────────────────────────────────────────

export type Grammar = "ts" | "tsx" | "css"

export interface Source {
  /** Repo-relative, POSIX separators: a failure reads as a path somebody opens. */
  readonly file: string
  readonly grammar: Grammar
  readonly text: string
}

/** One edge, with the one thing that decides whether a walk follows it: a
 *  dynamic `import("…")` is a CHUNK boundary, a literal the bundler splits on
 *  and a module nobody fetches until somebody calls the thunk. */
export interface Edge {
  readonly spec: string
  readonly dynamic: boolean
}

export interface Graph {
  /** Which file evaluated which specifier, in visit order. */
  readonly reached: ReadonlyArray<{ readonly file: string; readonly spec: string; readonly dynamic: boolean }>
  /** Every module VISITED, leaves included — a different set from `reached`: a
   *  module with no imports is visited and contributes no pair. */
  readonly visited: ReadonlyArray<string>
  /** Every edge the walk could not follow. Held to `[]` by `door-graphs`: a
   *  graph with holes satisfies every confinement list by being empty. */
  readonly unresolved: ReadonlyArray<string>
}

export type Manifest = Record<string, unknown>

export type Landing =
  | { readonly kind: "external" }
  | { readonly kind: "module"; readonly file: string }
  | { readonly kind: "unresolved"; readonly why: string }

/** Dirs a walk never enters: no member and no door is under them, and
 *  `node_modules` links back into sibling packages. Dot-directories are skipped
 *  by {@link entriesOf} itself, which is why a repository's own metadata
 *  directory is not named here. */
const SKIP: Record<string, true> = {
  node_modules: true,
  dist: true,
  result: true,
}

/** A static string-keyed table's membership, own-key only — a name like
 *  `constructor` is not a rule. */
const has = (table: Record<string, true>, key: string): boolean => Object.hasOwn(table, key)

const isDirectory = (at: string): boolean => {
  try {
    return statSync(at).isDirectory()
  } catch {
    return false
  }
}

const join = (dir: string, name: string): string => (dir === "" ? name : `${dir}/${name}`)

const entriesOf = (dir: string): ReadonlyArray<{ readonly name: string; readonly dir: boolean }> => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((one) => !has(SKIP, one.name) && !one.name.startsWith("."))
      .map((one) => ({ name: one.name, dir: one.isDirectory() }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  } catch {
    return []
  }
}

export const grammarOf = (file: string): Grammar =>
  file.endsWith(".css") ? "css" : file.endsWith(".tsx") ? "tsx" : "ts"

/**
 * ONE WORKSPACE, READ ONCE — members, manifests, sources and the module graphs
 * over them.
 *
 * Everything here is memoised per instance, and the memo is not a performance
 * nicety: the claims ask the same question hundreds of times (a contract module
 * a dozen packages reach is walked once per door, and `live-state` walks one
 * graph per cross-package door), and a second read could answer differently only
 * if something rewrote the tree mid-run — which no claim does, and which
 * {@link prove} refuses by working on a COPY rather than editing in place.
 */
export interface Workspace {
  readonly repo: string
  /** Repo-relative, sorted. */
  readonly members: ReadonlyArray<string>
  readonly memberOfPackage: ReadonlyMap<string, string>
  readonly sources: ReadonlyArray<Source>
  readonly rootManifestText: string
  manifestText(member: string): string
  manifestOf(member: string): Manifest
  /** The LONGEST member that prefixes this file — `group/one` and a
   *  hypothetical `group` both prefix a member's file and only one of them is
   *  its package. */
  memberOf(file: string): string | undefined
  sourceOf(file: string): Source | undefined
  /** The comment-stripped text of a file, module specifiers still in it. */
  strippedOf(file: string): string
  /** What a file COMPILES TO: comments gone and every module specifier gone,
   *  both by the parser rather than by a stripper that eats the rest of a line
   *  when a string literal contains `//`. */
  codeOf(file: string): string
  /** The graph a module opens, static edges followed and dynamic ones recorded. */
  graphOf(file: string): Graph
  /** What a file imports, the runtime's way: type-only imports elided. The
   *  right instrument for a walk. */
  importsOf(file: string): ReadonlyArray<Edge>
  /** Every specifier a file names, type-only ones INCLUDED — a type import is a
   *  cycle a bundler forgives and a reader does not. */
  specifiersOf(file: string): ReadonlyArray<string>
  /** Every string literal in a file. A ROSTER names a row's module as DATA —
   *  `{ id, name: "<package>/server" }` — and a reading that only looked at
   *  imports would call that row uncomposed. */
  literalsOf(file: string): ReadonlyArray<string>
  resolve(from: string, spec: string): Landing
}

/**
 * A FILE'S TEXT, or `undefined` for a file that is not there.
 *
 * ONE function, because every `existsSync`-then-read in this file is a
 * check-then-use — the read can fail after the check and the check is not what
 * the caller meant. The `ENOENT` is the only absence; anything else is the
 * caller's to see.
 */
const readIfPresent = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8")
  } catch (cause) {
    if ((cause as { readonly code?: unknown }).code === "ENOENT") return undefined
    throw cause
  }
}

/** A manifest read PARSED, and a manifest that is there and will not parse is
 *  not an absence: answering `undefined` for it would drop the member from one
 *  reading and keep it in another, with nothing red anywhere. */
export const manifestAt = (dir: string): Manifest | undefined => {
  const file = path.join(dir, "package.json")
  const text = readIfPresent(file)
  if (text === undefined) return undefined
  try {
    return JSON.parse(text) as Manifest
  } catch (cause) {
    throw new Error(`fence: ${file} did not parse — ${String(cause)}`)
  }
}

/**
 * A MANIFEST'S `exports` MAP, PARSED rather than cast.
 *
 * npm legally allows a conditional object and a wildcard; this reading knows the
 * string form and the ONE-star wildcard, and a shape it cannot read is a THROW.
 * The difference between "knows neither" and "silently drops both" is a door
 * that leaves a row's closure with nothing red, in a file whose whole thesis is
 * that a corpus may not quietly shrink.
 */
export const doorsOf = (manifest: Manifest): Readonly<Record<string, string>> => {
  const exports = manifest["exports"]
  if (exports === undefined) return {}
  if (typeof exports !== "object" || exports === null || Array.isArray(exports)) {
    throw new Error("fence: an `exports` field that is not a map is a shape this reading does not know")
  }
  const found: Record<string, string> = {}
  for (const [door, target] of Object.entries(exports)) {
    if (typeof target !== "string") {
      throw new Error(
        `fence: the \`${door}\` door resolves to a ${typeof target} rather than a path — a conditional ` +
          "export is a shape this reading does not know, and dropping it would shrink a closure with nothing red.",
      )
    }
    found[door] = target
  }
  return found
}

export const mainOf = (manifest: Manifest): string | undefined => {
  const main = manifest["main"]
  return typeof main === "string" ? main : undefined
}

/** The package a specifier names, subpath dropped: `@scope/x/y` and `@scope/x`
 *  are one package and one wall. */
export const packageOf = (spec: string): string =>
  spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : (spec.split("/")[0] ?? spec)

/** ...and what one package declares, in the three blocks that all mean the same
 *  thing to a wall: a dependency, a devDependency and a peer are three reasons
 *  to resolve a specifier and one answer about which side of a boundary a
 *  package stands on. */
export const dependencyNames = (manifest: Manifest | undefined): ReadonlyArray<string> => {
  const found: Array<string> = []
  for (const block of ["dependencies", "devDependencies", "peerDependencies"]) {
    const value = manifest?.[block]
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue
    found.push(...Object.keys(value))
  }
  return found
}

/** A package's row, if it says one. */
export const rowOf = (manifest: Manifest | undefined): string | undefined => {
  const field = manifest?.[ROW_FIELD]
  if (typeof field !== "object" || field === null) return undefined
  const row = Object.entries(field).find(([key]) => key === "row")?.[1]
  return typeof row === "string" ? row : undefined
}

/** WHERE THE ONE `*` IS, or `-1` for a string that has none or has two. Node's
 *  subpath patterns allow exactly one per key; a key with two is a malformed
 *  pattern rather than a wider one, and the caller reports it instead of
 *  half-honouring it. */
const onlyStar = (of: string): number => {
  const at = of.indexOf("*")
  return at === -1 || of.indexOf("*", at + 1) !== -1 ? -1 : at
}

/** The manifest target a specifier lands on, or `undefined` for a subpath the
 *  package does not open. */
const targetOf = (manifest: Manifest, spec: string): string | undefined => {
  const doors = doorsOf(manifest)
  const subpath = spec.slice(packageOf(spec).length)
  const door = subpath === "" ? "." : `.${subpath}`
  const exact = doors[door] ?? (door === "." ? mainOf(manifest) : undefined)
  if (exact !== undefined) return exact
  for (const [key, value] of Object.entries(doors)) {
    const at = onlyStar(key)
    if (at === -1) continue
    const head = key.slice(0, at)
    const tail = key.slice(at + 1)
    if (!door.startsWith(head) || !door.endsWith(tail)) continue
    if (door.length < head.length + tail.length) continue
    const into = onlyStar(value)
    if (into === -1) continue
    return value.slice(0, into) + door.slice(head.length, door.length - tail.length) + value.slice(into + 1)
  }
  return undefined
}

/** Is this a door the package DECLARES — the only way a row may import another
 *  row. */
export const declaresDoor = (manifest: Manifest, spec: string): boolean => targetOf(manifest, spec) !== undefined

const posixOf = (file: string): string => file.split(path.sep).join("/")

/**
 * THE `workspaces` GLOBS, EXPANDED.
 *
 * The globs are what a package manager installs from, so a member this reading
 * cannot see is a member that is not in the tree at all. What is still a THROW
 * is a glob that leaves the workspace, and a glob that matched NOTHING: both are
 * a corpus quietly short of members, and every claim here is an equality over
 * it.
 */
const expand = (repo: string, glob: string): ReadonlyArray<string> => {
  const segments = glob.split("/").filter((one) => one !== "" && one !== ".")
  if (glob.startsWith("/") || segments.includes("..")) {
    throw new Error(`fence: the workspaces glob ${JSON.stringify(glob)} leaves the workspace`)
  }
  const found = new Set<string>()
  const walk = (dir: string, rest: ReadonlyArray<string>): void => {
    const head = rest[0]
    if (head === undefined) {
      if (existsSync(path.join(repo, dir, "package.json"))) found.add(dir)
      return
    }
    if (head === "**") {
      walk(dir, rest.slice(1))
      for (const entry of entriesOf(path.join(repo, dir))) if (entry.dir) walk(join(dir, entry.name), rest)
      return
    }
    if (head === "*" || head === "?") {
      for (const entry of entriesOf(path.join(repo, dir))) if (entry.dir) walk(join(dir, entry.name), rest.slice(1))
      return
    }
    const next = join(dir, head)
    if (!isDirectory(path.join(repo, next))) return
    if (rest.length === 1 && !existsSync(path.join(repo, next, "package.json"))) return
    walk(next, rest.slice(1))
  }
  walk("", segments)
  return [...found].sort()
}

/** Every source under one directory of the workspace: the two TypeScript
 *  grammars and the one CSS grammar, because a CSS `@import` is a door a name
 *  can be spelled through. Repo-relative in, repo-relative out. */
const sourcesUnder = (repo: string, dir: string): ReadonlyArray<string> => {
  const found: Array<string> = []
  const walk = (dir: string): void => {
    for (const entry of entriesOf(path.join(repo, dir))) {
      const at = join(dir, entry.name)
      if (entry.dir) walk(at)
      else if (/\.(?:ts|tsx|css)$/.test(entry.name)) found.push(at)
    }
  }
  walk(dir)
  return found.sort()
}

/**
 * THE SAME READING, OVER A TREE ON DISK — the one entry point.
 *
 * Throws for the structural impossibilities a claim could not report honestly
 * (no globs, no members, a manifest that will not parse, an `exports` shape this
 * reading does not know); everything a claim can name is a finding.
 */
export const readWorkspace = (repo: string): Workspace => {
  const root = path.resolve(repo)
  const rootManifestText = readFileSync(path.join(root, "package.json"), "utf8")
  let rootManifest: Manifest
  try {
    rootManifest = JSON.parse(rootManifestText) as Manifest
  } catch (cause) {
    throw new Error(`fence: ${root}/package.json did not parse — ${String(cause)}`)
  }
  const globs = rootManifest["workspaces"]
  if (!Array.isArray(globs) || globs.length === 0) {
    throw new Error(`fence: ${root}/package.json declares no \`workspaces\`, so there is no tree to read`)
  }
  const members = [
    ...new Set(
      globs.flatMap((glob) => {
        if (typeof glob !== "string") {
          throw new Error(`fence: the workspaces glob ${JSON.stringify(glob)} is not a string`)
        }
        const matched = expand(root, glob)
        if (matched.length === 0) {
          throw new Error(
            `fence: the workspaces glob ${JSON.stringify(glob)} matched no package at all. A glob that ` +
              "installs nothing is either a typo or a directory that is not there, and both are a corpus this " +
              "file's equalities would pass over in silence.",
          )
        }
        return matched
      }),
    ),
  ].sort()

  const manifests = new Map<string, Manifest>()
  const manifestTexts = new Map<string, string>()
  for (const member of members) {
    const text = readFileSync(path.join(root, member, "package.json"), "utf8")
    manifestTexts.set(member, text)
    try {
      manifests.set(member, JSON.parse(text) as Manifest)
    } catch (cause) {
      throw new Error(`fence: ${member}/package.json did not parse — ${String(cause)}`)
    }
  }

  const memberOfPackage = new Map<string, string>()
  for (const [member, manifest] of manifests) {
    const name = manifest["name"]
    if (typeof name === "string") memberOfPackage.set(name, member)
  }

  const sources: ReadonlyArray<Source> = members.flatMap((member) =>
    sourcesUnder(root, member).map((file) => ({
      file,
      grammar: grammarOf(file),
      text: readFileSync(path.join(root, file), "utf8"),
    })),
  )
  const byFile = new Map(sources.map((source) => [source.file, source]))

  const stripped = new Map<string, string>()
  const codes = new Map<string, string>()
  const graphs = new Map<string, Graph>()
  const edges = new Map<string, ReadonlyArray<Edge>>()
  const specs = new Map<string, ReadonlyArray<string>>()
  const literals = new Map<string, ReadonlyArray<string>>()
  const asts = new Map<string, ts.SourceFile>()

  /** A FILE'S TEXT, whether or not it is a source of a member: a walk reaches
   *  `.json` and `.js` leaves too (a data table a build reads), and "the walk
   *  could not read it" must mean the file is not there rather than that this
   *  reading only preloaded `.ts`. */
  const textOf = (file: string): string | undefined => {
    const known = byFile.get(file)
    if (known !== undefined) return known.text
    try {
      return readFileSync(path.join(root, file), "utf8")
    } catch {
      return undefined
    }
  }

  /** The AST of a file, kept for the life of THIS reading of the tree — the
   *  walk and the boundary claim ask the same file for its specifiers, and the
   *  cache must not outlive the instance (see `parse`). */
  const astOf = (file: string): ts.SourceFile | undefined => {
    const held = asts.get(file)
    if (held !== undefined) return held
    const text = textOf(file)
    if (text === undefined) return undefined
    // A data leaf has no edges and is not TypeScript; parsing it would only
    // produce a syntax-error AST whose statement list is not what it says.
    const built = file.endsWith(".json") ? ts.createSourceFile(file, "", ts.ScriptTarget.ESNext, true) : parse(file, text)
    asts.set(file, built)
    return built
  }

  const memberOf = (file: string): string | undefined =>
    members.filter((member) => file === member || file.startsWith(`${member}/`)).sort((a, b) => b.length - a.length)[0]

  const resolve = (from: string, spec: string): Landing => {
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const base = spec.startsWith("/") ? posix.normalize(spec) : posix.normalize(posix.join(posix.dirname(from), spec))
      // The extension-less spelling a bundler allows, tried only where the
      // literal path is not itself a file.
      const found = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((one) =>
        existsSync(path.join(root, one)),
      )
      return found === undefined
        ? { kind: "unresolved", why: `${from}: ${spec} names no file of this tree` }
        : { kind: "module", file: found }
    }
    const member = memberOfPackage.get(packageOf(spec))
    if (member === undefined) return { kind: "external" }
    const manifest = manifests.get(member)
    if (manifest === undefined) return { kind: "unresolved", why: `${member} has no readable manifest` }
    const target = targetOf(manifest, spec)
    if (target === undefined) {
      const subpath = spec.slice(packageOf(spec).length)
      return { kind: "unresolved", why: `${member} opens no \`${subpath === "" ? "." : `.${subpath}`}\` door` }
    }
    return { kind: "module", file: posix.normalize(posix.join(member, target)) }
  }

  const importsOf = (file: string): ReadonlyArray<Edge> => {
    const held = edges.get(file)
    if (held !== undefined) return held
    const source = astOf(file)
    const found = source === undefined ? [] : moduleEdges(source, true)
    edges.set(file, found)
    return found
  }

  const specifiersOf = (file: string): ReadonlyArray<string> => {
    const held = specs.get(file)
    if (held !== undefined) return held
    const source = astOf(file)
    const found = source === undefined ? [] : moduleEdges(source, false).map((one) => one.spec)
    specs.set(file, found)
    return found
  }

  const literalsOf = (file: string): ReadonlyArray<string> => {
    const held = literals.get(file)
    if (held !== undefined) return held
    const source = astOf(file)
    const found: Array<string> = []
    if (source !== undefined) {
      const visit = (node: ts.Node): void => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push(node.text)
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    literals.set(file, found)
    return found
  }

  const graphOf = (entry: string): Graph => {
    const held = graphs.get(entry)
    if (held !== undefined) return held
    const seen = new Set<string>()
    const reached: Array<{ file: string; spec: string; dynamic: boolean }> = []
    const unresolved: Array<string> = []
    const visit = (file: string): void => {
      if (seen.has(file)) return
      seen.add(file)
      if (textOf(file) === undefined) {
        // Reached but unreadable is not a terminus either: a module the walk was
        // sent to and could not open is a hole in the graph.
        unresolved.push(`${file}: could not be read`)
        return
      }
      for (const edge of importsOf(file)) {
        reached.push({ file, spec: edge.spec, dynamic: edge.dynamic })
        // A DYNAMIC edge is RECORDED AND NOT FOLLOWED: it is a chunk boundary,
        // and a walk that crossed it would measure what a door NAMES as if it
        // were what a door COSTS.
        if (edge.dynamic) continue
        const landing = resolve(file, edge.spec)
        if (landing.kind === "module") visit(landing.file)
        else if (landing.kind === "unresolved") unresolved.push(`${file}: ${edge.spec} — ${landing.why}`)
      }
    }
    visit(entry)
    const answer: Graph = { reached, visited: [...seen].sort(), unresolved: [...new Set(unresolved)].sort() }
    graphs.set(entry, answer)
    return answer
  }

  return {
    repo: root,
    members,
    memberOfPackage,
    sources,
    rootManifestText,
    manifestText: (member) => manifestTexts.get(member) ?? "{}",
    manifestOf: (member) => manifests.get(member) ?? {},
    memberOf,
    sourceOf: (file) => byFile.get(file),
    strippedOf: (file) => {
      const held = stripped.get(file)
      if (held !== undefined) return held
      // ANY file the reading can open, not only a member's: a root may live
      // beside the packages (`src/main.ts`), and a claim that skipped it would
      // call a row it names uncomposed.
      const text = textOf(file)
      const found = text === undefined ? "" : withoutComments(file, text)
      stripped.set(file, found)
      return found
    },
    codeOf: (file) => {
      const held = codes.get(file)
      if (held !== undefined) return held
      const text = textOf(file)
      const found = text === undefined || !/\.(?:[cm]?[jt]sx?)$/.test(file) ? "" : intoCode(file, text)
      codes.set(file, found)
      return found
    },
    graphOf,
    importsOf,
    specifiersOf,
    literalsOf,
    resolve,
  }
}

// ── reading one source file ────────────────────────────────────────────

/**
 * IS THIS DECLARATION ERASED BY THE COMPILER — `import type …`, `export type …`,
 * and also `import { type A, type B } from "…"`, where every binding is a type
 * and the statement it compiles to is nothing.
 *
 * Both spellings matter to a WALK: a type-only edge is not something a listener
 * pays for, and a walk that followed it would report a chunk carrying a package
 * it only mentions. That is not hypothetical — one tree's contract module names
 * `solid-js` in a `{ type Accessor, type JSX }` import, and following it puts a
 * UI runtime on the SERVER's graph; an all-type `export … from` one module on
 * pulls a provider's private implementation into a published contract's
 * closure.
 */
const erasedImport = (node: ts.ImportDeclaration | ts.ExportDeclaration): boolean => {
  if (ts.isExportDeclaration(node)) {
    if (node.isTypeOnly) return true
    const clause = node.exportClause
    // `export * from` re-exports values; only a named list can be all-types.
    if (clause === undefined || ts.isNamespaceExport(clause)) return false
    return clause.elements.length > 0 && clause.elements.every((element) => element.isTypeOnly)
  }
  const clause = node.importClause
  if (clause === undefined) return false
  if (clause.isTypeOnly) return true
  if (clause.name !== undefined) return false
  const bindings = clause.namedBindings
  if (bindings === undefined) return false
  if (ts.isNamespaceImport(bindings)) return false
  return bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly)
}

/**
 * WHAT A FILE NAMES, by the AST rather than by a regular expression: comments
 * are not seen at all, a `import(` is told from an `import … from`, and a
 * `require(` is an edge like any other.
 *
 * `runtimeOnly` is the WALK's reading — a type-only import is erased by the
 * compiler and cannot cost a listener anything — and the false arm is the
 * boundary reading, where a type import is still a package standing on the wrong
 * side of a wall.
 */

export const edgesOf = (file: string, text: string, runtimeOnly: boolean): ReadonlyArray<Edge> =>
  moduleEdges(parse(file, text), runtimeOnly)

/** Every specifier a file names, type-only ones INCLUDED — a type import is a
 *  cycle a bundler forgives and a reader does not. */
export const specifiersOf = (file: string, text: string): ReadonlyArray<string> =>
  moduleEdges(parse(file, text), false).map((one) => one.spec)

const moduleEdges = (source: ts.SourceFile, runtimeOnly: boolean): ReadonlyArray<Edge> => {
  const found: Array<Edge> = []
  const push = (spec: string | undefined, dynamic: boolean): void => {
    if (spec !== undefined) found.push({ spec, dynamic })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const spec = node.moduleSpecifier
      if (spec !== undefined && ts.isStringLiteral(spec)) {
        if (!(runtimeOnly && erasedImport(node))) push(spec.text, false)
      }
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const spec = node.moduleReference.expression
      if (ts.isStringLiteral(spec)) push(spec.text, false)
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const only = node.arguments[0]
      if (only !== undefined && ts.isStringLiteral(only)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) push(only.text, true)
        else if (ts.isIdentifier(node.expression) && node.expression.text === "require") push(only.text, false)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/**
 * A FILE, PARSED — never memoised here.
 *
 * A module-level cache keyed by path is the tempting shape and it is WRONG:
 * {@link prove} reads the same repo-relative paths out of several copies of one
 * workspace, so the second copy would be answered with the first copy's AST and
 * a mutation would be judged against a tree that no longer exists. Each
 * {@link Workspace} keeps its own cache instead, where the key and the tree
 * belong to the same instance.
 */
const parse = (file: string, text: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

/** One file's text, parsed for its specifier literals, with the ranges the two
 *  readings below blank out. Offsets are preserved, so the answer parses again
 *  and a byte offset in a failure is a byte offset in the file. */
const blank = (text: string, ranges: ReadonlyArray<readonly [number, number]>): string => {
  const chars = text.split("")
  for (const [from, to] of ranges) {
    for (let at = from; at < to; at += 1) {
      const one = chars[at]
      if (one !== "\n" && one !== "\r") chars[at] = " "
    }
  }
  return chars.join("")
}

/**
 * THE FILE WITH ITS COMMENTS REMOVED — by the PARSER's token boundaries, which
 * is the only instrument that is sound here.
 *
 * The obvious reading is `ts.createScanner(..., skipTrivia: false)` and blank
 * every comment token, and it is WRONG in a way that took a measurement to
 * find: a scanner cannot tell a regular expression from a division, so one `/`
 * in a `.ts` file can make every `/*` after it a string — and it cannot lex JSX
 * text at all. One real file carried a block comment the scanner never saw, and
 * a name sweep that believes a comment is code
 * is a sweep that reports the wrong files.
 *
 * So the ranges are the TRIVIA GAPS between the parser's own leaf tokens: what
 * sits between one token's end and the next token's start is whitespace and
 * comments by definition, whatever they contain. A JSDoc node is skipped rather
 * than descended into, so the gap that contains it is blanked whole.
 *
 * The reason this is not `transpileModule(..., { removeComments: true })`: this
 * file must read the SOURCE the way the reader wrote it, and a transpilation
 * would rewrite every string it did not like.
 */
export const withoutComments = (file: string, text: string): string => {
  const source = parse(file, text)
  const gaps: Array<readonly [number, number]> = []
  let previous = 0
  const visit = (node: ts.Node): void => {
    if (ts.isJSDoc(node)) return
    const children = node.getChildren(source)
    if (children.length > 0) {
      for (const child of children) visit(child)
      return
    }
    const start = node.getStart(source)
    if (start > previous) gaps.push([previous, start])
    previous = Math.max(previous, node.getEnd())
  }
  visit(source)
  if (previous < text.length) gaps.push([previous, text.length])
  return blank(text, gaps)
}

/**
 * WHAT A FILE COMPILES TO, for the claim about a name in CODE: the comments are
 * gone (prose is allowed — a fence that failed on a comment is a fence people
 * learn to work around) and so is every module SPECIFIER (an import path is
 * claim 1's business, and counting it again here would make this claim report on
 * a decision that is not its own).
 */
export const intoCode = (file: string, text: string): string => {
  const stripped = withoutComments(file, text)
  const source = parse(file, stripped)
  const ranges: Array<readonly [number, number]> = []
  const cut = (node: ts.Node): void => {
    ranges.push([node.getStart(source) + 1, node.getEnd() - 1])
  }
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      cut(node.moduleSpecifier)
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const only = node.arguments[0]
      if (
        only !== undefined
        && ts.isStringLiteral(only)
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        cut(only)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return blank(stripped, ranges)
}

/** A stylesheet's own door, which the TypeScript readings are blind to. */
export const cssImportsOf = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/^\s*@import\s+["']([^"']+)["']/gm)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

// ── live state, by a real parser ───────────────────────────────────────

/** Solid's cells, by the names that mint one. */
const REACTIVE: Record<string, true> = {
  createSignal: true,
  createStore: true,
  createMutable: true,
  createResource: true,
}

/** The methods that write to a collection. Reading one is what an inert lookup
 *  table is FOR and says nothing. */
const MUTATORS: Record<string, true> = {
  set: true,
  add: true,
  delete: true,
  clear: true,
  push: true,
  pop: true,
  shift: true,
  unshift: true,
  splice: true,
  sort: true,
  reverse: true,
  fill: true,
}

/**
 * WHAT A MODULE HOLDS AT ITS OWN SCOPE — one line per binding that can carry a
 * value from one call to the next, or the empty list for an inert module.
 *
 * ## Why a real parser, and not the pattern every other reading here is
 *
 * The shapes this hunts are three, and two of them are indistinguishable from
 * their legitimate twins by text alone: `let held` at module scope is state and
 * `let n` inside a function is a local, and `const [x, setX] = createSignal()`
 * at module scope is state while the same line inside a factory is the shape
 * half a browser furniture library takes. A fence may only ever be wrong in the
 * direction that fails LOUDLY, and a regex is wrong in the other one: it would
 * have to pass every factory or fail every one.
 *
 * ## The three rules
 *
 * 1. `let` / `var` at module scope — a binding that can be REBOUND.
 * 2. A reactive cell (or a caller's holder) minted when the module is evaluated.
 * 3. A `const` the module WRITES — `.set`, `.add`, `.push`, a property, an
 *    element. Deliberately narrower than "a top-level Map": an inert lookup
 *    table built once and never written is a valid contract, and a `ReadonlyMap`
 *    annotation proves nothing, so what is read is whether the module writes.
 *
 * Everything else passes: a primitive, a function, a class, a frozen table, a
 * type. A source check supports the ownership rule; it cannot prove arbitrary
 * program behaviour, and this one is not asked to.
 */
export const liveStateIn = (
  file: string,
  text: string,
  holders: ReadonlyArray<Holder> = [],
): ReadonlyArray<string> => {
  const source = parse(file, text)
  const found: Array<string> = []
  const bound = new Set<string>()
  const minting = holdersIn(source, holders)
  const declared = new Set(
    source.statements
      .filter(ts.isClassDeclaration)
      .flatMap((one) => (one.name === undefined || !keepsState(one) ? [] : [one.name.text])),
  )

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    const rebindable = (statement.declarationList.flags & ts.NodeFlags.Const) === 0
    for (const declaration of statement.declarationList.declarations) {
      const spelled = declaration.name.getText(source)
      if (rebindable) {
        found.push(`${file}: \`${spelled}\` is a module-scope let/var`)
        continue
      }
      if (ts.isIdentifier(declaration.name)) bound.add(declaration.name.text)
      const cell =
        declaration.initializer === undefined ? undefined : reactiveAt(declaration.initializer, minting, declared)
      if (cell !== undefined) found.push(`${file}: \`${spelled}\` is a module-scope ${cell}`)
    }
  }

  const written = mutatedIn(source)
  for (const name of bound) {
    if (written.has(name)) found.push(`${file}: \`${name}\` is a const this module writes to`)
  }
  return found
}

/** The local names, in ONE module, that mint a holder — however they were
 *  spelled on the way in. */
const holdersIn = (source: ts.SourceFile, holders: ReadonlyArray<Holder>): ReadonlySet<string> => {
  const local = new Set<string>()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const spec = statement.moduleSpecifier.text
    const doors = holders.filter((one) => one.from.test(spec))
    if (doors.length === 0) continue
    const bindings = statement.importClause?.namedBindings
    if (bindings === undefined) continue
    if (ts.isNamespaceImport(bindings)) {
      for (const door of doors) local.add(`${bindings.name.text}.${door.named}`)
      continue
    }
    for (const element of bindings.elements) {
      const exported = (element.propertyName ?? element.name).text
      if (doors.some((one) => one.named === exported)) local.add(element.name.text)
    }
  }
  return local
}

/** What an initializer MINTS when the module is evaluated, or nothing — a call
 *  inside a function body is that function's, however deep. */
const reactiveAt = (
  initializer: ts.Expression,
  minting: ReadonlySet<string>,
  declared: ReadonlySet<string>,
): string | undefined => {
  let found: string | undefined
  const walk = (node: ts.Node): void => {
    if (found !== undefined) return
    if (ts.isCallExpression(node) && atModuleScope(node, initializer)) {
      const called = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.getText()
          : undefined
      if (called !== undefined && has(REACTIVE, called)) {
        found = `${called}()`
        return
      }
      if (called !== undefined && minting.has(called)) {
        found = `${called}() holder`
        return
      }
      // An IIFE that keeps something: the BODY decides, so a frozen constant
      // computed this way is a value and
      // `(() => { let n = 0; return () => ++n })()` is a slot.
      const body = ts.isParenthesizedExpression(node.expression) ? node.expression.expression : node.expression
      if (ts.isFunctionLike(body) && keepsState(body)) {
        found = "IIFE"
        return
      }
    }
    if (
      ts.isNewExpression(node)
      && ts.isIdentifier(node.expression)
      && declared.has(node.expression.text)
      && atModuleScope(node, initializer)
    ) {
      found = `new ${node.expression.text}()`
      return
    }
    ts.forEachChild(node, walk)
  }
  walk(initializer)
  return found
}

/** Does this body KEEP anything — a `let`, a cell or a holder, or a binding it
 *  writes THROUGH. A body with none of them computed its answer and stopped. */
const keepsState = (body: ts.Node): boolean => {
  let keeps = false
  const walk = (node: ts.Node): void => {
    if (keeps) return
    if (ts.isVariableStatement(node) && (node.declarationList.flags & ts.NodeFlags.Const) === 0) {
      keeps = true
      return
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && has(REACTIVE, node.expression.text)) {
      keeps = true
      return
    }
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
      && node.left.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      keeps = true
      return
    }
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && has(MUTATORS, node.expression.name.text)
      && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      keeps = true
      return
    }
    ts.forEachChild(node, walk)
  }
  ts.forEachChild(body, walk)
  return keeps
}

/** Is this node evaluated when the module is — outside every function and class
 *  body between it and the declaration it sits in. */
const atModuleScope = (node: ts.Node, root: ts.Node): boolean => {
  if (ts.isFunctionLike(root) || ts.isClassLike(root)) return false
  for (let at: ts.Node | undefined = node.parent; at !== undefined && at !== root; at = at.parent) {
    if (ts.isFunctionLike(at) || ts.isClassLike(at)) return false
  }
  return true
}

/** Every identifier this module writes THROUGH — `x.set(…)`, `x.y = …`,
 *  `x[k] = …` — read over the whole file, because a module-scope `const` written
 *  from inside an exported function is exactly the shape here. */
const mutatedIn = (source: ts.SourceFile): ReadonlySet<string> => {
  const written = new Set<string>()
  const wrote = (target: ts.Identifier): void => {
    if (!shadowed(target)) written.add(target.text)
  }
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && has(MUTATORS, node.expression.name.text)
    ) {
      wrote(node.expression.expression)
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = node.left
      if (
        (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target))
        && ts.isIdentifier(target.expression)
      ) {
        wrote(target.expression)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return written
}

/**
 * Does a scope between this use and the module declare the same word — a local,
 * a parameter, a `for (const x of …)`, a `var` anywhere in the function? Then the
 * write is that binding's and says nothing about the module's.
 *
 * BY ACTUAL LEXICAL SCOPE, and each scope is asked only about the bindings it
 * DECLARES: a `const` in a nested block three lines later does not shadow a use
 * that came before it and outside it, and a reading that said it did would lose
 * the mutable-map rule to an unrelated local.
 */
const shadowed = (used: ts.Identifier): boolean => {
  const spells = (name: ts.BindingName): boolean => {
    if (ts.isIdentifier(name)) return name.text === used.text
    return name.elements.some((element) => !ts.isOmittedExpression(element) && spells(element.name))
  }
  const bindsIn = (list: ts.VariableDeclarationList): boolean => list.declarations.some((one) => spells(one.name))
  const varsIn = (node: ts.Node): boolean => {
    let found = false
    const walk = (at: ts.Node): void => {
      if (found) return
      if (ts.isFunctionLike(at) && at !== node) return
      if (
        ts.isVariableStatement(at)
        && (at.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) === 0
        && bindsIn(at.declarationList)
      ) {
        found = true
        return
      }
      ts.forEachChild(at, walk)
    }
    ts.forEachChild(node, walk)
    return found
  }
  const ownStatements = (node: ts.Node): ReadonlyArray<ts.Statement> => {
    if (ts.isBlock(node) || ts.isCaseClause(node) || ts.isDefaultClause(node)) return [...node.statements]
    if (ts.isCaseBlock(node)) return node.clauses.flatMap((one) => [...one.statements])
    const body =
      ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
        || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)
        || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)
        ? node.body
        : undefined
    return body !== undefined && ts.isBlock(body) ? [...body.statements] : []
  }
  const declares = (node: ts.Node): boolean => {
    if (ts.isFunctionLike(node)) {
      if (node.parameters.some((one) => spells(one.name))) return true
      if (varsIn(node)) return true
    }
    if (
      (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node))
      && node.initializer !== undefined
      && ts.isVariableDeclarationList(node.initializer)
      && bindsIn(node.initializer)
    ) {
      return true
    }
    return ownStatements(node).some((one) => ts.isVariableStatement(one) && bindsIn(one.declarationList))
  }
  for (let at: ts.Node | undefined = used.parent; at !== undefined; at = at.parent) {
    if (ts.isSourceFile(at)) return false
    if (ts.isBlock(at) && at.parent !== undefined && ts.isFunctionLike(at.parent)) continue
    if (
      (ts.isFunctionLike(at) || ts.isBlock(at) || ts.isForOfStatement(at) || ts.isForInStatement(at)
        || ts.isForStatement(at) || ts.isCaseBlock(at) || ts.isCaseClause(at) || ts.isDefaultClause(at))
      && declares(at)
    ) {
      return true
    }
  }
  return false
}

// ── the scope of a sweep ───────────────────────────────────────────────

/**
 * A BENCH IS NOT PRODUCT, and every claim about what SHIPS reads production
 * sources only.
 *
 * What these claims are about is a package's product code knowing a row by name,
 * importing it outside a door, or holding its value. A fixture is neither, and
 * the words it carries are its subject's — a scenario about a conversation says
 * `alpha` because it is about alpha. The CONTAINER is excused rather than a
 * suffix: a step file is named for the feature it drives.
 *
 * A consumer whose benches live somewhere else supplies its own reading through
 * the declaration's `bench`; the floors and the manifest half are the
 * consumer's own claims and read the benches themselves.
 */
const BENCH_NAME = /\.(?:test|browsertest|spec|testlib|bench)\.[cm]?[jt]sx?$/
const BENCH_DIR: Record<string, true> = {
  test: true,
  tests: true,
  e2e: true,
  __tests__: true,
  fixtures: true,
  fixture: true,
  bench: true,
  benches: true,
}

export const isBench = (file: string): boolean =>
  BENCH_NAME.test(file) || file.split("/").some((segment) => has(BENCH_DIR, segment))

// ── the facts one declaration rests on ─────────────────────────────────

interface Facts {
  readonly tree: Workspace
  readonly rows: ReadonlyMap<string, ReadonlyArray<string>>
  readonly rowOfMember: ReadonlyMap<string, string>
  readonly rowOfPackage: ReadonlyMap<string, string>
  readonly roots: ReadonlyArray<{ readonly entry: string; readonly kind: "browser" | "node"; readonly graph: Graph }>
  readonly rootFiles: ReadonlySet<string>
  /** THE ROSTER: the one non-row member a root's walk reaches that NAMES every
   *  row. Undefined when the tree has none — a consumer that mounts rows from a
   *  root file alone has no roster, and that is a state rather than a defect. */
  readonly registry: string | undefined
  /** What the derivation found. One is the roster; two or more is red, because
   *  a guess that silently picks one exempts the other from two claims. */
  readonly registryCandidates: ReadonlyArray<string>
  /** Rows a root file or the roster NAMES — by specifier, or by the string a
   *  loader resolves. */
  readonly composed: ReadonlySet<string>
  /** Every module opened across a package boundary, with the files that open it. */
  readonly opened: ReadonlyMap<string, ReadonlyArray<string>>
  /** Shipping sources, by the declaration's reading of "test". */
  readonly production: ReadonlyArray<Source>
  /** Every package name a file names, by specifier or by loader string. */
  readonly namesOf: (file: string) => ReadonlySet<string>
  /** Every file any root's walk visits — `onARootWalk` and not `reachable`,
   *  because `live-state` has a reachable of its own and the two never meant
   *  the same thing. */
  readonly onARootWalk: ReadonlySet<string>
  /** The counts a consumer's floors are stated against. */
  readonly reading: Reading
}

/**
 * WHAT ONE READING OF THE TREE SAW — the numbers a consumer's *not vacuous*
 * test is written against.
 *
 * They are here rather than recomputed in a bench because a floor stated against
 * a number this file did not produce is a floor over a second reading: a
 * resolver that answered `undefined` once would move both, and the bench would
 * agree with the claim that everything is fine.
 */
export interface Reading {
  readonly members: number
  readonly sources: number
  readonly production: number
  /** Production TS/TSX files the name sweep compiled to non-empty code. */
  readonly compiled: number
  /** Modules opened across a package boundary — the live-state corpus. */
  readonly doors: number
  /** Files any root's walk visits. */
  readonly onARootWalk: number
  readonly rows: number
  readonly registry: string | undefined
}

const unique = <T>(items: ReadonlyArray<T>): ReadonlyArray<T> => [...new Set(items)]

/** Which arm of {@link Rows} a host supplied — named, so the two readings stay
 *  apart in a `let` that neither branch is allowed to mis-shape. */
const isNamedRows = (rows: Rows): rows is ReadonlyArray<string> => Array.isArray(rows)

const isString = (one: unknown): one is string => typeof one === "string"

const factsOf = (tree: Workspace, declaration: Declaration): Facts => {
  const bench = declaration.bench ?? isBench
  const rows = ((): Map<string, ReadonlyArray<string>> => {
    const answer = new Map<string, ReadonlyArray<string>>()
    const supplied = declaration.rows
    if (isNamedRows(supplied)) {
      for (const name of supplied) {
        answer.set(
          name,
          tree.members.filter((member) => rowOf(tree.manifestOf(member)) === name),
        )
      }
      return answer
    }
    for (const [name, packages] of Object.entries(supplied)) {
      answer.set(name, [...unique(packages.map(posixOf))].sort())
    }
    return answer
  })()

  const rowOfMember = new Map<string, string>()
  const rowOfPackage = new Map<string, string>()
  for (const [row, packages] of rows) {
    for (const member of packages) {
      rowOfMember.set(member, row)
      const name = tree.manifestOf(member)["name"]
      if (typeof name === "string") rowOfPackage.set(name, row)
    }
  }

  const roots = declaration.roots.map((root) => ({
    entry: posixOf(root.entry),
    graph: tree.graphOf(posixOf(root.entry)),
    kind: root.graph,
  }))
  const rootFiles = new Set(declaration.roots.map((root) => posixOf(root.entry)))
  const onARootWalk = new Set(roots.flatMap((root) => root.graph.visited))

  /** Every package name a file NAMES — in a specifier or in a string a loader
   *  resolves — which is how a roster and a root both spell a row. */
  const namesOf = (file: string): ReadonlySet<string> =>
    new Set([...tree.specifiersOf(file), ...tree.literalsOf(file)].map(packageOf))

  // THE ROSTER, DERIVED FROM THE ROOTS: a member a root's walk reaches, that is
  // no row, and that names EVERY row. Not "the first member that declares
  // them", which was a guess — and a guess that silently picked one exempted a
  // second from two claims at once.
  const reachedMembers = new Set([...onARootWalk].map((file) => tree.memberOf(file)).filter(isString))
  // ...AND A ROOT NAMES IT. That is what separates a roster from the package
  // that merely HOLDS the entries: a root is where a build says "mount these",
  // and a member it never names is not the composition. Without this clause a
  // package whose own root file names the rows (because a root may name several)
  // competes with the roster that a root actually imports.
  const namedByRoots = new Set([...rootFiles].flatMap((file) => [...namesOf(file)]))
  const registryCandidates =
    rows.size === 0
      ? []
      : tree.members.filter((member) => {
          if (rowOfMember.has(member) || !reachedMembers.has(member)) return false
          const own = tree.manifestOf(member)["name"]
          if (typeof own !== "string" || !namedByRoots.has(own)) return false
          // ...AND NOT COUNTING A BENCH: a post-hoc closure test that lists the
          // packages a build REFUSES names every row too, and it is not a
          // composition. A roster is production code.
          const named = new Set(
            tree.sources
              .filter((source) => tree.memberOf(source.file) === member && !bench(source.file))
              .flatMap((source) => [...namesOf(source.file)]),
          )
          // EVERY ROW, BY ANY OF ITS PACKAGES: a row may span several packages,
          // and the host that composes it names one of them — requiring the
          // whole set made the roster of such a build undiscoverable.
          return [...rows.values()].every((packages) =>
            packages.some((one) => {
              const name = tree.manifestOf(one)["name"]
              return typeof name === "string" && named.has(name)
            }),
          )
        })
  const registry = registryCandidates.length === 1 ? registryCandidates[0] : undefined

  // A row is COMPOSED when a file that IS the composition names it: a root file,
  // or the roster. Their own walk is not read — a walk reaches every module a
  // chunk happens to import, and counting that made a common word compose
  // everything.
  const composed = new Set<string>()
  const composition = [...rootFiles, ...(registry === undefined ? [] : tree.sources.filter((source) => tree.memberOf(source.file) === registry).map((source) => source.file))]
  for (const file of composition) {
    // NO MEMBER CHECK: a consumer's entries may live beside the packages
    // (`src/main.ts`), and the composition is exactly where that layout is the
    // ordinary one.
    const named = namesOf(file)
    for (const [row, packages] of rows) {
      if (composed.has(row)) continue
      const mine = packages.map((member) => tree.manifestOf(member)["name"]).filter(isString)
      if (mine.some((pkg) => named.has(pkg))) composed.add(row)
    }
  }

  const production = tree.sources.filter((source) => !bench(source.file))
  const opened = new Map<string, Array<string>>()
  for (const source of production) {
    if (source.grammar === "css") continue
    const member = tree.memberOf(source.file)
    for (const spec of unique(tree.specifiersOf(source.file))) {
      const landing = tree.resolve(source.file, spec)
      if (landing.kind !== "module" || tree.memberOf(landing.file) === member) continue
      const held = opened.get(landing.file)
      if (held === undefined) opened.set(landing.file, [source.file])
      else held.push(source.file)
    }
  }

  const compiled = production.filter(
    (source) => source.grammar !== "css" && tree.codeOf(source.file).trim().length > 0,
  ).length

  return {
    tree,
    rows,
    rowOfMember,
    rowOfPackage,
    roots,
    rootFiles,
    registry,
    registryCandidates,
    composed,
    opened,
    production,
    namesOf,
    onARootWalk,
    reading: {
      members: tree.members.length,
      sources: tree.sources.length,
      production: production.length,
      compiled,
      doors: opened.size,
      onARootWalk: onARootWalk.size,
      rows: rows.size,
      registry,
    },
  }
}

// ── the name, as it would be spelled ───────────────────────────────────

const escapeRe = (of: string): string => of.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * EVERY SPELLING OF A ROW'S WORD, each with the boundary that ends it — and
 * every half of this was written by a mutation or a review rather than by taste.
 *
 * ## Why the obvious pattern is wrong
 *
 * `/\balpha(?![a-z0-9])/i` refuses the exact defect it was written for: `i`
 * applies to the LOOKAHEAD too, so `[a-z0-9]` matches the `H` of `alphaHalf`.
 * Case-sensitive with the casing spelled out then catches the whole tree, because
 * a SHOUTED identifier has no case change in it — "the next character is
 * upper-case" ends a lower-case name and continues an upper-case one.
 *
 * ## Why the LEADING boundary is not `\b`
 *
 * `\b` does not fire after `_`, so `PROVED_ALPHA_BIN` and `my_alpha` were invisible
 * to the first version of this claim — a real hole, since the env-shaped knob is
 * exactly how a build spells a row's word at a root. `_` is a separator between
 * words and is treated as one: `(?<![A-Za-z0-9])`.
 *
 * ## Why a hyphenated row has four forms
 *
 * `two-words` is a file name and a yaml id; the CODE says `twoWords`,
 * `TwoWords` and `TWO_WORDS`, and a pattern that only knew the hyphen
 * never saw any of them. A single-word row spells the same three casings it
 * always did.
 *
 *   - a lower-case run, ended by anything that is not `[a-z0-9]`;
 *   - a SHOUTED run, ended by anything that is not `[A-Z0-9]`.
 *
 * What it cannot tell apart is a shouted name that ENDS a word (`Math.PI`),
 * which is why the collision record exists: the reading reports, a person
 * decides, and the record holds the decision as an exact count.
 */
const casings = (name: string): ReadonlyArray<string> => {
  const lead = "(?<![A-Za-z0-9])"
  const lower = "(?![a-z0-9])"
  const shout = "(?![A-Z0-9])"
  const parts = name.split("-").filter((one) => one !== "")
  const capital = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`
  const forms: Array<{ readonly spelled: string; readonly end: string }> = [{ spelled: name, end: lower }]
  if (parts.length > 1) {
    forms.push({ spelled: parts.map((word, at) => (at === 0 ? word : capital(word))).join(""), end: lower })
    forms.push({ spelled: parts.map(capital).join(""), end: lower })
    forms.push({ spelled: parts.join("_").toUpperCase(), end: shout })
  } else {
    forms.push({ spelled: capital(name), end: lower })
    forms.push({ spelled: name.toUpperCase(), end: shout })
  }
  return unique(forms.map((one) => `${lead}${escapeRe(one.spelled)}${one.end}`))
}

/** ...built ONCE per row rather than once per (row × file). `anywhere` answers
 *  whether a name is spelled at all; `all` counts, and `String.match` with a
 *  global expression resets its own cursor, so the shared object is safe. */
const SPELLINGS = new Map<string, { readonly anywhere: RegExp; readonly all: RegExp }>()

const spellingOf = (name: string): { readonly anywhere: RegExp; readonly all: RegExp } => {
  const held = SPELLINGS.get(name)
  if (held !== undefined) return held
  const source = `(?:${casings(name).join("|")})`
  const built = { anywhere: new RegExp(source), all: new RegExp(source, "g") }
  SPELLINGS.set(name, built)
  return built
}

const spelledIn = (name: string, text: string): number => {
  const found = text.match(spellingOf(name).all)
  return found === null ? 0 : found.length
}

// ── the claims ─────────────────────────────────────────────────────────

const NO_DOOR = "a row reaches another row only through a door its manifest declares"

const claimImports = (facts: Facts): ReadonlyArray<string> => {
  const { tree } = facts
  const found: Array<string> = []
  let edges = 0

  for (const source of facts.production) {
    const member = tree.memberOf(source.file)
    if (member === undefined) continue
    const here = facts.rowOfMember.get(member)
    const specs = source.grammar === "css" ? cssImportsOf(source.text) : unique(tree.specifiersOf(source.file))
    for (const spec of specs) {
      const landing = tree.resolve(source.file, spec)
      // WHICH PACKAGE, not only which file: a specifier that names a row's
      // package and then a path the package does not open is still a row
      // importing a row, and dropping it because the resolver refused it would
      // make the sharpest version of this defect invisible here.
      const there =
        tree.memberOfPackage.get(packageOf(spec)) ?? (landing.kind === "module" ? tree.memberOf(landing.file) : undefined)
      if (there === undefined || there === member) continue
      const target = landing.kind === "module" ? landing.file : undefined
      const row = facts.rowOfMember.get(there)
      edges += 1

      // A ROW IMPORTING A ROOT FILE is one rule, so it is asked once: a
      // specifier's KIND says how the file was named, not what naming it means.
      if (here !== undefined && target !== undefined && facts.rootFiles.has(target)) {
        found.push(`${source.file}: ${spec} — a row imports a root file`)
        continue
      }

      if (spec.startsWith(".")) {
        // A path into another package is never a door.
        if (here !== undefined) {
          found.push(`${source.file}: ${spec} — a row imports \`${there}\` by path; ${NO_DOOR}`)
        } else {
          found.push(`${source.file}: ${spec} — \`${there}\` is reached by path, not through a door its manifest declares`)
        }
        continue
      }

      if (here !== undefined) {
        if (row !== undefined) {
          if (!declaresDoor(tree.manifestOf(there), spec)) {
            found.push(`${source.file}: ${spec} — \`${there}\` declares no such door; ${NO_DOOR}`)
          }
        } else if (there === facts.registry) {
          found.push(
            `${source.file}: ${spec} — a row imports the registry, which names every row; that is the cycle the ` +
              "manifests cannot express",
          )
        }
        continue
      }

      if (row === undefined) continue
      if (member === facts.registry) continue
      if (facts.rootFiles.has(source.file)) continue
      found.push(`${source.file}: ${spec} — a host package imports the \`${row}\` row outside a root file`)
    }
  }

  if (facts.production.length === 0) found.push("vacuous: the imports claim read no production source at all")
  if (edges === 0) {
    found.push("vacuous: no file imports another package of this workspace, so every boundary claim here is empty")
  }
  // ...AND THE ROW-TO-PACKAGE MAPPING IS NAMED SOMEWHERE — in a source, or in a
  // ROOT, which may name the rows from outside every member because a consumer
  // with no roster composes them there and nowhere else. The floor is "the
  // corpus knows what a row's package is", not "a row was imported": a mapping
  // that came back empty is what makes every boundary claim here pass over
  // nothing.
  const namedFiles = unique([...tree.sources.map((source) => source.file), ...facts.rootFiles])
  const rowMentioned =
    facts.rows.size === 0 ||
    namedFiles.some((file) => [...facts.namesOf(file)].some((one) => facts.rowOfPackage.has(one)))
  if (!rowMentioned) {
    found.push(
      "vacuous: no source names a row's package at all — by specifier or by the string a loader resolves — so " +
        "nothing here ties a row to a package",
    )
  }
  return found
}

const claimDoorGraphs = (facts: Facts, declaration: Declaration): ReadonlyArray<string> => {
  const found: Array<string> = []
  const runtimes = declaration.runtimes ?? DEFAULT_RUNTIMES
  if (facts.roots.length === 0) {
    found.push("vacuous: the declaration names no root, so no door graph is weighed")
    return found
  }
  for (const root of facts.roots) {
    const graph = root.graph
    for (const hole of graph.unresolved) found.push(`${root.entry}: unresolved edge — ${hole}`)
    if (graph.visited.length <= 1) {
      found.push(
        `${root.entry}: the walk visited ${graph.visited.length} file(s). A resolver that answers nothing walks ` +
          "one file and satisfies every confinement list by being empty.",
      )
    }
    const own = facts.tree.memberOf(root.entry)
    if (graph.visited.every((file) => facts.tree.memberOf(file) === own)) {
      found.push(`${root.entry}: the walk never left \`${own ?? "its own package"}\`, so no door was measured`)
    }
    for (const edge of graph.reached) {
      if (root.kind === "browser" && BUILTIN.test(edge.spec)) {
        found.push(`${edge.file}: ${edge.spec} — a browser root's walk reaches a builtin, which no tab can satisfy`)
      }
      if (root.kind === "node" && runtimes.some((rule) => rule.test(edge.spec))) {
        found.push(`${edge.file}: ${edge.spec} — a node root's walk reaches a UI runtime`)
      }
    }
  }
  return found
}

const claimNames = (facts: Facts, declaration: Declaration): ReadonlyArray<string> => {
  const { tree } = facts
  const expected = declaration.collisions ?? {}
  const actual = new Map<string, Map<string, number>>()

  /** WHERE A ROW'S WORD MAY APPEAR: its own packages, the roots, and the roster
   *  — ONE predicate, because the sweep and its positive control are the same
   *  partition read from its two sides, and two spellings would drift. */
  const allowed = (file: string, row: string): boolean => {
    if (facts.rootFiles.has(file)) return true
    const member = tree.memberOf(file)
    return member !== undefined && (member === facts.registry || (facts.rows.get(row) ?? []).includes(member))
  }

  const corpus = facts.production.filter(
    (source) => source.grammar !== "css" && !facts.rootFiles.has(source.file),
  )
  for (const source of corpus) {
    const code = tree.codeOf(source.file)
    for (const row of facts.rows.keys()) {
      if (allowed(source.file, row)) continue
      const count = spelledIn(row, code)
      if (count === 0) continue
      const held = actual.get(row)
      if (held === undefined) actual.set(row, new Map([[source.file, count]]))
      else held.set(source.file, count)
    }
  }

  const found: Array<string> = []
  for (const row of unique([...Object.keys(expected), ...actual.keys(), ...facts.rows.keys()])) {
    if (!facts.rows.has(row)) {
      found.push(`the collision record names \`${row}\`, which is no row of this declaration`)
      continue
    }
    const record = expected[row] ?? {}
    const seen = actual.get(row) ?? new Map<string, number>()
    for (const file of [...unique([...Object.keys(record), ...seen.keys()])].sort()) {
      const says = record[file] ?? 0
      const is = seen.get(file) ?? 0
      if (says === is) continue
      found.push(
        `${file}: \`${row}\` is spelled ${is} time(s) in code; the collision record says ${says}` +
          (says === 0 ? " — move it into the row's own package, or record it with a reason" : ""),
      )
    }
  }

  // THE POSITIVE CONTROL IS PER ROW, and it is about the rows that are CLEAN.
  // A global "the sweep found something somewhere" is red on a tree with no
  // collisions — the state every consumer starts in — and silent about the one
  // row whose pattern stopped matching. So each row's word is looked for on the
  // other side of the partition above.
  const allowedCorpus = facts.production.filter((source) => source.grammar !== "css")
  for (const row of [...facts.rows.keys()].sort()) {
    const seen = allowedCorpus.some((source) => allowed(source.file, row) && spelledIn(row, tree.codeOf(source.file)) > 0)
    if (!seen) {
      found.push(
        `row \`${row}\` is spelled nowhere its own packages, the roots or the roster can see it — a pattern ` +
          "that stopped matching would be silent, and so would a corpus that came back short",
      )
    }
  }

  if (corpus.length === 0) found.push("vacuous: the name sweep read no production source")
  return found
}

const claimLiveState = (facts: Facts, declaration: Declaration): ReadonlyArray<string> => {
  const { tree } = facts
  const allowed = declaration.allowances ?? {}
  const holders = declaration.holders ?? []
  const found: Array<string> = []
  /** Every module the claim JUDGED, which is what an allowance has to be
   *  reachable in — `onARootWalk` is a different set and never meant this. */
  const judged = new Set<string>()

  /** What is actually imported when a package opens a door: the door itself and
   *  every module of ITS OWN package reachable from it. Another package's
   *  private modules are judged at that package's own door. */
  const behind = (door: string): ReadonlyArray<string> => {
    const member = tree.memberOf(door)
    if (member === undefined || facts.rowOfMember.has(member)) return [door]
    const graph = tree.graphOf(door)
    for (const hole of graph.unresolved) found.push(`${door}: unresolved edge — ${hole}`)
    return unique([door, ...graph.visited.filter((file) => tree.memberOf(file) === member)])
  }

  for (const door of [...facts.opened.keys()].sort()) {
    for (const file of behind(door)) {
      judged.add(file)
      if (Object.hasOwn(allowed, file)) continue
      const source = tree.sourceOf(file)
      if (source === undefined || source.grammar === "css") continue
      for (const said of liveStateIn(file, source.text, holders)) {
        found.push(file === door ? said : `${said} (behind ${door})`)
      }
    }
  }

  for (const [file, why] of Object.entries(allowed)) {
    if (!judged.has(file)) {
      found.push(`the allowance for \`${file}\` names a module no package opens across a boundary any more`)
    }
    const source = tree.sourceOf(file)
    if (source === undefined || liveStateIn(file, source.text, holders).length === 0) {
      found.push(`the allowance for \`${file}\` holds nothing, so its argument is dead`)
    }
    if (why.length <= 20) found.push(`the allowance for \`${file}\` states no reason`)
  }

  if (facts.opened.size === 0) {
    found.push("vacuous: no module is opened across a package boundary, so the live-state claim judged nothing")
  }
  return found
}

const claimRegistry = (facts: Facts): ReadonlyArray<string> => {
  const { tree } = facts
  const found: Array<string> = []
  if (facts.rows.size === 0) found.push("the declaration names no rows")

  for (const [row, packages] of facts.rows) {
    if (packages.length === 0) found.push(`row \`${row}\` is named and no package of this workspace carries it`)
    for (const member of packages) {
      if (!tree.members.includes(member)) found.push(`row \`${row}\` names \`${member}\`, which is no workspace member`)
    }
  }

  for (const member of tree.members) {
    const declared = rowOf(tree.manifestOf(member))
    if (declared === undefined) continue
    if (!facts.rows.has(declared)) {
      found.push(`${member}: declares row \`${declared}\`, which the declaration does not name`)
    } else if (!(facts.rows.get(declared) ?? []).includes(member)) {
      found.push(`${member}: declares row \`${declared}\`, which the declaration places elsewhere`)
    }
  }

  for (const row of [...facts.rows.keys()].sort()) {
    if (!facts.composed.has(row)) {
      found.push(`row \`${row}\` is declared and neither a root file nor the roster names it`)
    }
  }

  // THE ROSTER MUST BE ONE. Two packages that each name every row is two
  // rosters, and picking the first would exempt the second from `imports` and
  // `names` — silently, which is the failure mode every claim here is written
  // against.
  if (facts.registryCandidates.length > 1) {
    found.push(
      `more than one package a root's walk reaches names every row (${[...facts.registryCandidates].sort().join(", ")}); ` +
        "the roster must be one, or which of them is exempt from `imports` and `names` is a guess",
    )
  }

  if (facts.roots.length === 0) found.push("vacuous: the declaration names no root, so no row can be composed")
  if (facts.composed.size === 0 && facts.rows.size > 0) {
    found.push("vacuous: no root file or roster names any row, so the agreement above is three empty sets")
  }
  return found
}

// ── the report ─────────────────────────────────────────────────────────

/**
 * THE FENCE, ONE PASS — every claim, once, over one reading of the tree.
 *
 * Each answer is a list of sentences rather than a boolean, because a failure
 * has to name the file somebody then has to change. A report is CACHED by its
 * declaration object: a test file computes one declaration at module scope and
 * asks it five questions, and each claim's sweep is the expensive part of this
 * file.
 */
export const fence = (declaration: Declaration): Report => {
  const held = reports.get(declaration)
  if (held !== undefined) return held

  const tree = readWorkspace(declaration.repo)
  const facts = factsOf(tree, declaration)
  const findings: Array<Finding> = []
  for (const [claim, read] of [
    ["imports", () => claimImports(facts)],
    ["door-graphs", () => claimDoorGraphs(facts, declaration)],
    ["names", () => claimNames(facts, declaration)],
    ["live-state", () => claimLiveState(facts, declaration)],
    ["registry", () => claimRegistry(facts)],
  ] as ReadonlyArray<readonly [Claim, () => ReadonlyArray<string>]>) {
    for (const said of unique(read())) findings.push({ claim, said })
  }
  const report: Report = {
    findings,
    ok: findings.length === 0,
    red: (claim) => findings.filter((one) => one.claim === claim).map((one) => one.said),
    reading: facts.reading,
  }
  reports.set(declaration, report)
  return report
}

const reports = new WeakMap<Declaration, Report>()

// ── rows from manifests ────────────────────────────────────────────────

/**
 * THE ROWS A WORKSPACE DECLARES ON ITS OWN PACKAGES — the arm for a consumer
 * that has no roster.
 *
 * A row may span several packages, so the answer is a record rather than a list:
 * the declaration needs to know which package belongs where, and a name alone
 * cannot say.
 */
export const rowsFromManifests = (repo: string): Readonly<Record<string, ReadonlyArray<string>>> => {
  const tree = readWorkspace(repo)
  const found = new Map<string, Array<string>>()
  for (const member of tree.members) {
    const row = rowOf(tree.manifestOf(member))
    if (row === undefined) continue
    const held = found.get(row)
    if (held === undefined) found.set(row, [member])
    else held.push(member)
  }
  return Object.fromEntries([...found].map(([row, members]) => [row, members.sort()]))
}

// ── prove: the falsifier for the falsifier ─────────────────────────────

export interface Proved {
  readonly claim: Claim
  readonly what: string
  readonly caught: boolean
  /** Other claims that also went red. A mutation is caught because the claim it
   *  NAMES refused it; a spill is reported so a reader can see what else
   *  noticed, and a mutation whose spill is not empty is not a clean proof. */
  readonly spill: ReadonlyArray<Claim>
  /** Why this mutation could not be applied here, if it could not. */
  readonly why?: string
}

export interface Proof {
  /** A red baseline means the mutations below would prove nothing. Empty is the
   *  only starting state a proof has. */
  readonly baseline: ReadonlyArray<Finding>
  readonly mutations: ReadonlyArray<Proved>
  readonly ok: boolean
}

type Edit = { readonly file: string; readonly append: string } | { readonly file: string; readonly write: string }

interface Canonical {
  readonly claim: Claim
  /** `undefined` when this declaration gives the defect nothing to break — which
   *  is reported as a failure rather than skipped, because a proof that quietly
   *  ran four mutations is the failure mode it exists to detect. */
  readonly plan: (
    facts: Facts,
    declaration: Declaration,
  ) => { readonly what: string; readonly edits: ReadonlyArray<Edit> } | undefined
}

/** The first production source of a member, for a mutation to append to —
 *  preferring one no root's walk reaches, because a file already on a graph is
 *  the one an appended edge can colour a second claim with. `undefined` for a
 *  member with no production source that answers the question asked.
 *
 *  `holdingNothing` exists for the TARGET of the `imports` plant: the edge it
 *  adds opens that file across a package boundary, so a target that keeps state
 *  would redden `live-state` too — a plant that colours two claims proves
 *  neither. */
const sourceIn = (
  facts: Facts,
  member: string | undefined,
  options: { readonly holdingNothing?: ReadonlyArray<Holder> } = {},
): string | undefined => {
  const mine = facts.production.filter((source) => source.grammar !== "css" && facts.tree.memberOf(source.file) === member)
  const quiet =
    options.holdingNothing === undefined
      ? mine
      : mine.filter((source) => liveStateIn(source.file, source.text, options.holdingNothing).length === 0)
  return (quiet.find((source) => !facts.onARootWalk.has(source.file)) ?? quiet[0])?.file
}

/**
 * A SPECIFIER A RUNTIME RULE MATCHES — the inverse of a filter, and it has to be
 * derived rather than typed: a consumer's list is its own, and a plan that
 * hard-coded one word would plant a defect that consumer's list does not
 * recognise. The rule's literal head is the candidate; the fallbacks cover an
 * anchored prefix (`@scope/`, `thing/`).
 */
const specFor = (rule: RegExp): string | undefined => {
  const head = rule.source.replace(/^\^/, "").split(/\(|\[|\||\$/)[0] ?? ""
  const base = head.replace(/\\(.)/g, "$1")
  return [base, `${base}x`, `${base}x/y`, `${base}y`].find(
    (candidate) => candidate !== "" && rule.test(candidate),
  )
}

/** A host package's production file with no spelling of this row yet — where a
 *  planted one is unambiguous. */
const hostFileSpellingNothing = (facts: Facts, row: string): string | undefined =>
  facts.production.find(
    (source) =>
      source.grammar !== "css"
      && !facts.rootFiles.has(source.file)
      && !facts.rowOfMember.has(facts.tree.memberOf(source.file) ?? "")
      && spelledIn(row, facts.tree.codeOf(source.file)) === 0,
  )?.file

/**
 * ONE CANONICAL MUTATION PER CLAIM, each the exact defect the claim is about.
 *
 * Every one is DERIVED from the tree the fence just read: which package is a
 * row, which file is on a root's walk, which door another package opens, and
 * which KIND that root is. The derivation is from the WALK and the MANIFESTS
 * rather than from the fence's own arithmetic, because a harness that
 * re-derived from the claim it is testing would prove nothing.
 */
const CANONICAL: ReadonlyArray<Canonical> = [
  {
    claim: "imports",
    plan: (facts, declaration) => {
      const rows = [...facts.rows.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      const mine = rows[0]
      const other = rows.find(([name, packages]) => name !== mine?.[0] && packages.length > 0)
      if (mine === undefined || other === undefined) return undefined
      const host = sourceIn(facts, mine[1]?.[0])
      // EACH OF THE OTHER ROW'S PACKAGES, because a row may span several and
      // only one of them needs a file that holds nothing.
      const target = (other[1] ?? [])
        .flatMap((member) => sourceIn(facts, member, { holdingNothing: declaration.holders ?? [] }))
        .find((one) => one !== undefined)
      if (host === undefined || target === undefined) return undefined
      const relative = posix.relative(posix.dirname(host), target)
      return {
        what: `row \`${mine[0]}\` imports \`${other[0]}\`'s file by path, through no door`,
        edits: [{ file: host, append: `\nimport "${relative.startsWith(".") ? relative : `./${relative}`}"\n` }],
      }
    },
  },
  {
    claim: "door-graphs",
    plan: (facts, declaration) => {
      const runtime = declaration.runtimes ?? DEFAULT_RUNTIMES
      // EACH ROOT KIND HAS ITS OWN DEFECT: a builtin is what a browser graph may
      // not carry, a UI runtime is what a node graph may not.
      for (const root of facts.roots) {
        if (root.graph.visited.length <= 1) continue
        const own = facts.tree.memberOf(root.entry)
        const inside = root.graph.reached.find(
          (edge) => facts.tree.memberOf(edge.file) !== own && !edge.file.endsWith(".d.ts"),
        )
        const file = inside?.file ?? root.graph.visited.find((one) => one !== root.entry)
        if (file === undefined) continue
        if (root.kind === "browser") {
          return {
            what: `a file on \`${root.entry}\`'s walk imports a \`node:\` builtin`,
            edits: [{ file, append: '\nimport "node:fs"\n' }],
          }
        }
        const spec = runtime.map(specFor).find((one) => one !== undefined)
        if (spec === undefined) continue
        return {
          what: `a file on the node root \`${root.entry}\`'s walk imports the UI runtime \`${spec}\``,
          edits: [{ file, append: `\nimport "${spec}"\n` }],
        }
      }
      return undefined
    },
  },
  {
    claim: "names",
    plan: (facts) => {
      // THE ENV-SHAPED SPELLING, which a leading `\b` cannot see: `_` is a
      // separator, so a knob at a root is a spelling of the row's word.
      const row = [...facts.rows.keys()].sort()[0]
      if (row === undefined) return undefined
      const host = hostFileSpellingNothing(facts, row)
      if (host === undefined) return undefined
      const knob = `PROVED_${row.replace(/-/g, "_").toUpperCase()}_BIN`
      return {
        what: `a host package holds the env-shaped knob \`${knob}\``,
        edits: [{ file: host, append: `\nexport const ${knob} = ""\n` }],
      }
    },
  },
  {
    claim: "names",
    plan: (facts) => {
      // ...AND THE FORM A HYPHENATED ROW IS ACTUALLY WRITTEN IN: `two-words` is
      // never an identifier, `twoWords` is. A single-word row falls back to its
      // capitalised form, so this mutation can never be inapplicable.
      const rows = [...facts.rows.keys()].sort()
      const hyphenated = rows.find((row) => row.includes("-"))
      const row = hyphenated ?? rows[0]
      if (row === undefined) return undefined
      const host = hostFileSpellingNothing(facts, row)
      if (host === undefined) return undefined
      // AT A LINE START, because `provedAlpha` is not a spelling of `alpha`: a
      // leading boundary is the rule, and a mutation glued to an identifier
      // would be testing the mutation rather than the claim.
      const spelled = hyphenated === undefined
        ? row.toUpperCase()
        : row.split("-").map((word, at) => (at === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`)).join("")
      return {
        what: `a host package spells \`${row}\` as \`${spelled}\``,
        edits: [{ file: host, append: `\nexport const ${spelled} = 1\n` }],
      }
    },
  },
  {
    claim: "live-state",
    plan: (facts) => {
      const doors = [...facts.opened.keys()].sort()
      // A NON-ROW door first, because `behind` walks its package; then ANY door,
      // because a consumer's host files may be opened by nobody and a ROW's door
      // is judged as itself — so the fallback is what keeps this claim provable
      // on a tree whose only doors belong to rows.
      const door =
        doors.find((file) => !facts.rowOfMember.has(facts.tree.memberOf(file) ?? "")) ?? doors[0]
      if (door === undefined) return undefined
      return {
        what: "a door another package opens holds a module-scope value",
        edits: [{ file: door, append: "\nlet provedHeld: unknown\nexport const provedCurrent = () => provedHeld\n" }],
      }
    },
  },
  {
    claim: "registry",
    plan: (facts) => {
      const member = [...facts.rows.values()].flat()[0]
      if (member === undefined) return undefined
      const container = posix.dirname(member)
      if (container === ".") return undefined
      return {
        what: "a package on disk declares a row the declaration never names",
        edits: [
          {
            file: `${container}/proved-ghost/package.json`,
            write: JSON.stringify(
              { name: "proved-ghost", version: "0.0.0", [ROW_FIELD]: { row: "proved-ghost" } },
              null,
              2,
            ),
          },
          { file: `${container}/proved-ghost/index.ts`, write: "export const proved = 1\n" },
        ],
      }
    },
  },
]

/**
 * THE COPY a mutation is applied to — the same files the fence reads, written
 * into a directory of their own.
 *
 * COPY AND RESTORE rather than editing in place: a fence that breaks a person's
 * tree to prove itself is a fence nobody runs before a commit, and the `finally`
 * in {@link prove} is the trap. THE DIRECTORY IS `prove`'s, not this function's:
 * created before the copy so a throw part-way through writing the tree still
 * leaves `prove` holding a path to delete. The copy holds only what the reading looks at —
 * the root manifest, each member's manifest and each member's sources — so it
 * costs megabytes rather than a `node_modules`.
 */
const copyInto = (dir: string, facts: Facts): void => {
  const tree = facts.tree
  const put = (file: string, text: string): void => {
    const at = path.join(dir, file)
    mkdirSync(path.dirname(at), { recursive: true })
    writeFileSync(at, text)
  }
  /** ...and this one COPIES, so a `.json`, a binary or a fixture arrives as the
   *  bytes it is rather than as a UTF-8 decoding of them. A source that vanished
   *  between the walk and here is not a copy that failed: there is nothing to
   *  copy. */
  const copy = (file: string): void => {
    const at = path.join(dir, file)
    mkdirSync(path.dirname(at), { recursive: true })
    try {
      copyFileSync(path.join(tree.repo, file), at)
    } catch (cause) {
      if ((cause as { readonly code?: unknown }).code !== "ENOENT") throw cause
    }
  }
  put("package.json", tree.rootManifestText)
  for (const member of tree.members) put(`${member}/package.json`, tree.manifestText(member))
  // EVERY FILE OF EVERY MEMBER, not only the sources: a walk reaches `.json` and
  // `.js` leaves, and a copy that dropped them would report a hole in a graph
  // the real tree does not have — which reads as a mutation "spilling" into a
  // claim it has nothing to do with.
  const walk = (relative: string): void => {
    for (const entry of entriesOf(path.join(tree.repo, relative))) {
      const at = join(relative, entry.name)
      if (entry.dir) walk(at)
      else copy(at)
    }
  }
  for (const member of tree.members) walk(member)
  // ...AND EVERY FILE A ROOT'S WALK TOUCHED THAT IS NOT IN A MEMBER. A consumer
  // whose entries live at the repository root — `src/main.ts` beside the
  // packages rather than in one — would otherwise get a copy with no roots at
  // all, and every mutation would spill into the claim that says so.
  for (const file of facts.onARootWalk) {
    if (tree.memberOf(file) === undefined) copy(file)
  }
}

const applyEdits = (dir: string, edits: ReadonlyArray<Edit>): void => {
  for (const edit of edits) {
    const at = path.join(dir, edit.file)
    mkdirSync(path.dirname(at), { recursive: true })
    if ("write" in edit) {
      writeFileSync(at, edit.write)
      continue
    }
    const before = readIfPresent(at) ?? ""
    writeFileSync(at, `${before}${edit.append}`)
  }
}

/**
 * PROVE THE FENCE — a mutation run, so "the claims are as strong as before" is
 * something somebody watched happen rather than a sentence in a PR body.
 *
 * Every claim above is a SWEEP, and a sweep's one failure mode is going quiet: a
 * pattern that stopped matching, a corpus that came back short, a resolver that
 * answered `undefined` and walked one file — every one of them GREEN. The suite
 * and a reviewer cannot tell a fence that is holding from a fence that is not
 * running, because both look exactly like `0 fail`. So this breaks a COPY of the
 * tree on purpose, once per claim, and reports whether the claim that names the
 * defect refused it.
 */
export const prove = (declaration: Declaration): Proof => {
  const baseline = fence(declaration)
  if (!baseline.ok) return { baseline: baseline.findings, mutations: [], ok: false }
  const facts = factsOf(readWorkspace(declaration.repo), declaration)
  const mutations: Array<Proved> = []
  for (const one of CANONICAL) {
    const plan = one.plan(facts, declaration)
    if (plan === undefined) {
      mutations.push({
        claim: one.claim,
        what: `${one.claim}: no defect to plant`,
        caught: false,
        spill: [],
        why: "this declaration gives the mutation nothing to break",
      })
      continue
    }
    let dir: string | undefined
    try {
      // THE TRAP COVERS THE COPY TOO, and only because the directory exists
      // first: a `copyInto` that threw with no path assigned would leak it.
      dir = mkdtempSync(path.join(os.tmpdir(), "cordis-fence-"))
      copyInto(dir, facts)
      applyEdits(dir, plan.edits)
      const report = fence({ ...declaration, repo: dir })
      mutations.push({
        claim: one.claim,
        what: plan.what,
        caught: report.red(one.claim).length > 0,
        spill: CLAIMS.filter((claim) => claim !== one.claim && report.red(claim).length > 0),
      })
    } finally {
      if (dir !== undefined) rmSync(dir, { recursive: true, force: true })
    }
  }
  // RED ON EXACTLY THAT CLAIM, which is the sentence `prove` is sold with: a
  // mutation that also reddened another claim has not shown that claim is
  // asleep, it has shown this one is over-eager.
  return { baseline: [], mutations, ok: mutations.every((one) => one.caught && one.spill.length === 0) }
}

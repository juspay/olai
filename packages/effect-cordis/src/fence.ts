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

export const CLAIMS = ["imports", "door-graphs", "names", "live-state", "registry"] as const
export type Claim = (typeof CLAIMS)[number]

export interface Finding {
  readonly claim: Claim
  readonly said: string
}

export interface Report {
  readonly findings: ReadonlyArray<Finding>
  readonly ok: boolean
  red(claim: Claim): ReadonlyArray<string>
  readonly reading: Reading
}

export interface Root {
  readonly entry: string
  readonly graph: "browser" | "node"
}

export type Rows = ReadonlyArray<string> | Readonly<Record<string, ReadonlyArray<string>>>

const ROW_FIELD = "cordis"

export type Allowances = Readonly<Record<string, string>>

export interface Holder {
  readonly from: RegExp
  readonly named: string
}

export interface Declaration {
  readonly repo: string
  readonly rows: Rows
  readonly roots: ReadonlyArray<Root>
  readonly collisions?: Readonly<Record<string, Readonly<Record<string, number>>>>
  readonly allowances?: Allowances
  readonly holders?: ReadonlyArray<Holder>
  readonly runtimes?: ReadonlyArray<RegExp>
  readonly bench?: (file: string) => boolean
}

/** Bun's default JSX runtime is React's, so a `.tsx` reached by a node graph is a
 *  boot death with nothing in the source to see. */
export const DEFAULT_RUNTIMES: ReadonlyArray<RegExp> = [
  /^solid-js(\/|$)/,
  /^@solid-primitives\//,
  /^react(\/|$)/,
  /^react-dom(\/|$)/,
  /^preact(\/|$)/,
]

const BUILTIN = /^(?:node|bun):/

export type Grammar = "ts" | "tsx" | "css"

export interface Source {
  readonly file: string
  readonly grammar: Grammar
  readonly text: string
}

export interface Edge {
  readonly spec: string
  readonly dynamic: boolean
}

export interface Graph {
  readonly reached: ReadonlyArray<{ readonly file: string; readonly spec: string; readonly dynamic: boolean }>
  readonly visited: ReadonlyArray<string>
  readonly unresolved: ReadonlyArray<string>
}

export type Manifest = Record<string, unknown>

export type Landing =
  | { readonly kind: "external" }
  | { readonly kind: "module"; readonly file: string }
  | { readonly kind: "unresolved"; readonly why: string }

const SKIP: Record<string, true> = {
  node_modules: true,
  dist: true,
  result: true,
}

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

export interface Workspace {
  readonly repo: string
  readonly members: ReadonlyArray<string>
  readonly memberOfPackage: ReadonlyMap<string, string>
  readonly sources: ReadonlyArray<Source>
  readonly rootManifestText: string
  manifestText(member: string): string
  manifestOf(member: string): Manifest
  memberOf(file: string): string | undefined
  sourceOf(file: string): Source | undefined
  strippedOf(file: string): string
  codeOf(file: string): string
  graphOf(file: string): Graph
  importsOf(file: string): ReadonlyArray<Edge>
  specifiersOf(file: string): ReadonlyArray<string>
  literalsOf(file: string): ReadonlyArray<string>
  resolve(from: string, spec: string): Landing
}

const readIfPresent = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8")
  } catch (cause) {
    if ((cause as { readonly code?: unknown }).code === "ENOENT") return undefined
    throw cause
  }
}

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

export const packageOf = (spec: string): string =>
  spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : (spec.split("/")[0] ?? spec)

export const dependencyNames = (manifest: Manifest | undefined): ReadonlyArray<string> => {
  const found: Array<string> = []
  for (const block of ["dependencies", "devDependencies", "peerDependencies"]) {
    const value = manifest?.[block]
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue
    found.push(...Object.keys(value))
  }
  return found
}

export const rowOf = (manifest: Manifest | undefined): string | undefined => {
  const field = manifest?.[ROW_FIELD]
  if (typeof field !== "object" || field === null) return undefined
  const row = Object.entries(field).find(([key]) => key === "row")?.[1]
  return typeof row === "string" ? row : undefined
}

const onlyStar = (of: string): number => {
  const at = of.indexOf("*")
  return at === -1 || of.indexOf("*", at + 1) !== -1 ? -1 : at
}

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

export const declaresDoor = (manifest: Manifest, spec: string): boolean => targetOf(manifest, spec) !== undefined

const posixOf = (file: string): string => file.split(path.sep).join("/")

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

  const textOf = (file: string): string | undefined => {
    const known = byFile.get(file)
    if (known !== undefined) return known.text
    try {
      return readFileSync(path.join(root, file), "utf8")
    } catch {
      return undefined
    }
  }

  const astOf = (file: string): ts.SourceFile | undefined => {
    const held = asts.get(file)
    if (held !== undefined) return held
    const text = textOf(file)
    if (text === undefined) return undefined
    const built = file.endsWith(".json") ? ts.createSourceFile(file, "", ts.ScriptTarget.ESNext, true) : parse(file, text)
    asts.set(file, built)
    return built
  }

  const memberOf = (file: string): string | undefined =>
    members.filter((member) => file === member || file.startsWith(`${member}/`)).sort((a, b) => b.length - a.length)[0]

  const resolve = (from: string, spec: string): Landing => {
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const base = spec.startsWith("/") ? posix.normalize(spec) : posix.normalize(posix.join(posix.dirname(from), spec))
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
        unresolved.push(`${file}: could not be read`)
        return
      }
      for (const edge of importsOf(file)) {
        reached.push({ file, spec: edge.spec, dynamic: edge.dynamic })
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

const erasedImport = (node: ts.ImportDeclaration | ts.ExportDeclaration): boolean => {
  if (ts.isExportDeclaration(node)) {
    if (node.isTypeOnly) return true
    const clause = node.exportClause
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

export const edgesOf = (file: string, text: string, runtimeOnly: boolean): ReadonlyArray<Edge> =>
  moduleEdges(parse(file, text), runtimeOnly)

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

const parse = (file: string, text: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

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

export const cssImportsOf = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/^\s*@import\s+["']([^"']+)["']/gm)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

const REACTIVE: Record<string, true> = {
  createSignal: true,
  createStore: true,
  createMutable: true,
  createResource: true,
}

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

const atModuleScope = (node: ts.Node, root: ts.Node): boolean => {
  if (ts.isFunctionLike(root) || ts.isClassLike(root)) return false
  for (let at: ts.Node | undefined = node.parent; at !== undefined && at !== root; at = at.parent) {
    if (ts.isFunctionLike(at) || ts.isClassLike(at)) return false
  }
  return true
}

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

interface Facts {
  readonly tree: Workspace
  readonly rows: ReadonlyMap<string, ReadonlyArray<string>>
  readonly rowOfMember: ReadonlyMap<string, string>
  readonly rowOfPackage: ReadonlyMap<string, string>
  readonly roots: ReadonlyArray<{ readonly entry: string; readonly kind: "browser" | "node"; readonly graph: Graph }>
  readonly rootFiles: ReadonlySet<string>
  readonly registry: string | undefined
  readonly registryCandidates: ReadonlyArray<string>
  readonly composed: ReadonlySet<string>
  readonly opened: ReadonlyMap<string, ReadonlyArray<string>>
  readonly production: ReadonlyArray<Source>
  readonly namesOf: (file: string) => ReadonlySet<string>
  readonly onARootWalk: ReadonlySet<string>
  readonly reading: Reading
}

export interface Reading {
  readonly members: number
  readonly sources: number
  readonly production: number
  readonly compiled: number
  readonly doors: number
  readonly onARootWalk: number
  readonly rows: number
  readonly registry: string | undefined
}

const unique = <T>(items: ReadonlyArray<T>): ReadonlyArray<T> => [...new Set(items)]

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

  const namesOf = (file: string): ReadonlySet<string> =>
    new Set([...tree.specifiersOf(file), ...tree.literalsOf(file)].map(packageOf))

  const reachedMembers = new Set([...onARootWalk].map((file) => tree.memberOf(file)).filter(isString))
  const namedByRoots = new Set([...rootFiles].flatMap((file) => [...namesOf(file)]))
  const registryCandidates =
    rows.size === 0
      ? []
      : tree.members.filter((member) => {
          if (rowOfMember.has(member) || !reachedMembers.has(member)) return false
          const own = tree.manifestOf(member)["name"]
          if (typeof own !== "string" || !namedByRoots.has(own)) return false
          const named = new Set(
            tree.sources
              .filter(
                (source) =>
                  tree.memberOf(source.file) === member && !rootFiles.has(source.file) && !bench(source.file),
              )
              .flatMap((source) => [...namesOf(source.file)]),
          )
          return [...rows.values()].every((packages) =>
            packages.some((one) => {
              const name = tree.manifestOf(one)["name"]
              return typeof name === "string" && named.has(name)
            }),
          )
        })
  const registry = registryCandidates.length === 1 ? registryCandidates[0] : undefined

  const composed = new Set<string>()
  const composition = [...rootFiles, ...(registry === undefined ? [] : tree.sources.filter((source) => tree.memberOf(source.file) === registry).map((source) => source.file))]
  for (const file of composition) {
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

const escapeRe = (of: string): string => of.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

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
      const there =
        tree.memberOfPackage.get(packageOf(spec)) ?? (landing.kind === "module" ? tree.memberOf(landing.file) : undefined)
      if (there === undefined || there === member) continue
      const target = landing.kind === "module" ? landing.file : undefined
      const row = facts.rowOfMember.get(there)
      edges += 1

      if (here !== undefined && target !== undefined && facts.rootFiles.has(target)) {
        found.push(`${source.file}: ${spec} — a row imports a root file`)
        continue
      }

      if (spec.startsWith(".")) {
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
  const judged = new Set<string>()

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

export interface Proved {
  readonly claim: Claim
  readonly what: string
  readonly caught: boolean
  readonly spill: ReadonlyArray<Claim>
  readonly why?: string
}

export interface Proof {
  readonly baseline: ReadonlyArray<Finding>
  readonly mutations: ReadonlyArray<Proved>
  readonly ok: boolean
}

type Edit = { readonly file: string; readonly append: string } | { readonly file: string; readonly write: string }

interface Canonical {
  readonly claim: Claim
  readonly plan: (
    facts: Facts,
    declaration: Declaration,
  ) => { readonly what: string; readonly edits: ReadonlyArray<Edit> } | undefined
}

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

const specFor = (rule: RegExp): string | undefined => {
  const head = rule.source.replace(/^\^/, "").split(/\(|\[|\||\$/)[0] ?? ""
  const base = head.replace(/\\(.)/g, "$1")
  return [base, `${base}x`, `${base}x/y`, `${base}y`].find(
    (candidate) => candidate !== "" && rule.test(candidate),
  )
}

const plantSpot = (facts: Facts, row: string): { readonly file: string; readonly word: string } | undefined => {
  const quiet = (file: string, word: string): boolean => spelledIn(word, facts.tree.codeOf(file)) === 0
  const host = facts.production.find((source) => {
    if (source.grammar === "css" || facts.rootFiles.has(source.file)) return false
    const member = facts.tree.memberOf(source.file)
    return (
      member !== undefined
      && member !== facts.registry
      && !facts.rowOfMember.has(member)
      && quiet(source.file, row)
    )
  })
  if (host !== undefined) return { file: host.file, word: row }

  const neighbour = [...facts.rows.keys()].sort().find((other) => other !== row)
  if (neighbour === undefined) return undefined
  const mine = facts.rows.get(row) ?? []
  const theirs = facts.production.find((source) => {
    if (source.grammar === "css") return false
    const member = facts.tree.memberOf(source.file)
    return member !== undefined && mine.includes(member) && quiet(source.file, neighbour)
  })
  return theirs === undefined ? undefined : { file: theirs.file, word: neighbour }
}

const CANONICAL: ReadonlyArray<Canonical> = [
  {
    claim: "imports",
    plan: (facts, declaration) => {
      const rows = [...facts.rows.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      const mine = rows[0]
      const other = rows.find(([name, packages]) => name !== mine?.[0] && packages.length > 0)
      if (mine === undefined || other === undefined) return undefined
      const host = sourceIn(facts, mine[1]?.[0])
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
      const row = [...facts.rows.keys()].sort()[0]
      if (row === undefined) return undefined
      const spot = plantSpot(facts, row)
      if (spot === undefined) return undefined
      const knob = `PROVED_${spot.word.replace(/-/g, "_").toUpperCase()}_BIN`
      return {
        what: `a host package holds the env-shaped knob \`${knob}\` (the \`${spot.word}\` row's word)`,
        edits: [{ file: spot.file, append: `\nexport const ${knob} = ""\n` }],
      }
    },
  },
  {
    claim: "names",
    plan: (facts) => {
      const rows = [...facts.rows.keys()].sort()
      const hyphenated = rows.find((row) => row.includes("-"))
      const row = hyphenated ?? rows[0]
      if (row === undefined) return undefined
      const spot = plantSpot(facts, row)
      if (spot === undefined) return undefined
      const spelled = spot.word.includes("-")
        ? spot.word.split("-").map((word, at) => (at === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`)).join("")
        : spot.word.toUpperCase()
      return {
        what: `a host package spells \`${spot.word}\` as \`${spelled}\``,
        edits: [{ file: spot.file, append: `\nexport const ${spelled} = 1\n` }],
      }
    },
  },
  {
    claim: "live-state",
    plan: (facts) => {
      const doors = [...facts.opened.keys()].sort()
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

const copyInto = (dir: string, facts: Facts): void => {
  const tree = facts.tree
  const put = (file: string, text: string): void => {
    const at = path.join(dir, file)
    mkdirSync(path.dirname(at), { recursive: true })
    writeFileSync(at, text)
  }
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
  const walk = (relative: string): void => {
    for (const entry of entriesOf(path.join(tree.repo, relative))) {
      const at = join(relative, entry.name)
      if (entry.dir) walk(at)
      else copy(at)
    }
  }
  for (const member of tree.members) walk(member)
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
  return { baseline: [], mutations, ok: mutations.every((one) => one.caught && one.spill.length === 0) }
}

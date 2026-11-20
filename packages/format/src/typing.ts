import { Result } from "effect"

import { type CustomValue, customOrder, type HasCustom } from "./custom.ts"
import type { Derived } from "./derive.ts"
import { resolveRelative } from "./documents.ts"
import {
  isRegular,
  type Located,
  type LocatedRegular,
  propertiesIn,
  type RegularNode,
  shadowFor,
} from "./node.ts"
import { didYouMean, didYouMeanDeclared } from "./suggest.ts"

export type PropType =
  | { readonly kind: "text" }
  | { readonly kind: "date" }
  | { readonly kind: "int" }
  | { readonly kind: "path"; readonly base?: PathBase }
  | { readonly kind: "doc"; readonly base?: PathBase }
  | { readonly kind: "ref"; readonly under?: string }
  | { readonly kind: "node" }
  | { readonly kind: "contributed"; readonly word: string }

export type BuiltInKind = Exclude<PropType["kind"], "contributed">

export const PROP_KINDS = [
  "text",
  "date",
  "int",
  "path",
  "doc",
  "ref",
  "node",
] as const satisfies ReadonlyArray<BuiltInKind>

export const PROP_KIND_TAKES = {
  text: "`text` (anything)",
  date: "`date` (an ISO day or instant)",
  int: "`int` (a digit run)",
  path: "`path` (no whitespace; optional `base`)",
  doc: "`doc` (a served `.md`; optional `base`)",
  ref: "`ref` (a child's id; `under` names the parent)",
  node: "`node` (any node id)",
} as const satisfies Record<BuiltInKind, string>

export interface ContributedKind {
  readonly kind: string
  readonly takes: string
  readonly admits: (value: string) => boolean
  readonly claims?: string
}

export interface KindVocabulary {
  readonly built: ReadonlyMap<string, ContributedKind>
  readonly enabled: ReadonlyMap<string, ContributedKind>
}

export const NO_KINDS: KindVocabulary = { built: new Map(), enabled: new Map() }

const kindsTaken = (kinds: KindVocabulary): string =>
  [
    ...PROP_KINDS.map((kind) => PROP_KIND_TAKES[kind]),
    ...[...kinds.built.values()].map((kind) => kind.takes),
  ].join(", ")

const kindWords = (kinds: KindVocabulary): ReadonlyArray<string> =>
  [...PROP_KINDS, ...kinds.built.keys()]

export type PathBase =
  | "root"
  | "file"

export const PATH_BASES = ["root", "file"] as const satisfies ReadonlyArray<PathBase>

export const BASE_BY_DEFAULT: PathBase = "file"

export interface Declared {
  readonly type: PropType
  readonly at: string
}

export type PropDeclarations = ReadonlyMap<string, Declared>

export const NO_TYPING: PropDeclarations = new Map()

const foldedKey = (word: string): string => word.trim().toLowerCase()

export const declaredFor = (
  declarations: PropDeclarations,
  key: string,
): Declared | undefined => {
  const folded = foldedKey(key)
  return folded === "" ? undefined : declarations.get(folded)
}

export const TYPE_KEY = "type"
export const UNDER_KEY = "under"
export const BASE_KEY = "base"

export const basedAt = (declared: Declared | undefined, from: string): string =>
  baseOf(declared) === "root" ? "" : from

export const resolvedDoc = (
  declared: Declared | undefined,
  from: string,
  value: string,
): string | undefined =>
  isPathShaped(value) ? resolveRelative(basedAt(declared, from), value) : undefined

export const baseOf = (declared: Declared | undefined): PathBase => {
  const type = declared?.type
  return type?.kind === "doc" || type?.kind === "path"
    ? type.base ?? BASE_BY_DEFAULT
    : BASE_BY_DEFAULT
}

interface Grounded {
  readonly takes: (kinds: KindVocabulary) => string
  readonly wrong: (
    value: string,
    derived: Derived,
    kinds: KindVocabulary,
  ) => string | undefined
  readonly resolves: boolean
}

export const BOOTSTRAP: ReadonlyMap<string, Grounded> = new Map<string, Grounded>([
  [TYPE_KEY, {
    takes: kindsTaken,
    resolves: false,
    wrong: (value, _derived, kinds) =>
      isBuiltInKind(value) || kinds.built.has(value)
        ? undefined
        : `is not a property type — write ${kindsTaken(kinds)}${
          didYouMean(value, kindWords(kinds))
        }.`,
  }],
  [UNDER_KEY, {
    takes: () => "the id of a node in the set — where a `ref`'s variants live",
    resolves: true,
    wrong: (value, derived) => {
      const located = derived.byId.get(value)
      if (located !== undefined && isRegular(located)) return undefined
      return located !== undefined
        ? "is a mirror — a second placement rather than a node of its own, so " +
          "nothing hangs under it. Name the node it points at."
        : `no node declares${didYouMeanDeclared(value, derived.byId)}`
    },
  }],
  [BASE_KEY, {
    takes: () => `\`root\` or \`file\` — where a \`doc\` or \`path\` value resolves from`,
    resolves: false,
    wrong: (value) =>
      isPathBase(value) ? undefined : "is not a base — write `root` (from the " +
        "served directory's root, which is what a value written by a convention " +
        "means) or `file` (beside the file the value was written in, which is " +
        `what a note's own relative link means)${didYouMean(value, PATH_BASES)}`,
  }],
])

export const declarationsOf = (
  derived: Derived,
  kinds: KindVocabulary,
): PropDeclarations => {
  const held = DECLARED.get(derived)
  if (held !== undefined && held.kinds === kinds) return held.declarations
  const declarations = declaringIn(derived, kinds)
  DECLARED.set(derived, { kinds, declarations })
  return declarations
}

const DECLARED = new WeakMap<
  Derived,
  { readonly kinds: KindVocabulary; readonly declarations: PropDeclarations }
>()

const declaringIn = (derived: Derived, kinds: KindVocabulary): PropDeclarations =>
  declarationsIn(derived, propertiesIn(derived.claims, derived.byFile.keys()), kinds)

export const declarationsIn = (
  derived: Derived,
  file: string | undefined,
  kinds: KindVocabulary,
): PropDeclarations => {
  if (file === undefined) return withClaims(NO_TYPING, kinds)
  const declarations = new Map<string, Declared>()
  for (const located of declaringInLineOrder(derived, file)) {
    const key = keyOf(located.node.title)
    if (key === undefined || declarations.has(key)) continue
    const type = typeIn(derived, located.node)
    if (type === undefined) continue
    declarations.set(key, { type, at: located.node.id })
  }
  return withClaims(declarations, kinds)
}

const declaredOver = (
  defaults: ReadonlyArray<readonly [string, Declared]>,
  declared: PropDeclarations,
): PropDeclarations =>
  defaults.length === 0 ? declared : new Map([...defaults, ...declared])

export const withClaims = (
  vault: PropDeclarations,
  kinds: KindVocabulary,
): PropDeclarations => {
  const claimed: Array<readonly [string, Declared]> = []
  for (const kind of kinds.enabled.values()) {
    if (kind.claims === undefined) continue
    const key = keyOf(kind.claims)
    if (key === undefined) continue
    claimed.push([key, { type: { kind: "contributed", word: kind.kind }, at: "" }])
  }
  return declaredOver(claimed, vault)
}

const declaringInLineOrder = (
  derived: Derived,
  file: string,
): ReadonlyArray<LocatedRegular> =>
  (derived.byFile.get(file) ?? [])
    .filter((at): at is LocatedRegular => isRegular(at) && at.node.parent === undefined)

export const keyOf = (title: string): string | undefined => {
  const key = foldedKey(title)
  if (key === "" || shadowFor(key) !== undefined || BOOTSTRAP.has(key)) return undefined
  return key
}

const typeIn = (derived: Derived, node: RegularNode): PropType | undefined => {
  const said = customText(node, TYPE_KEY)
  const under = customText(node, UNDER_KEY)
  const base = customText(node, BASE_KEY)
  if (said === undefined) return undefined
  if (said === "doc" || said === "path") {
    if (under !== undefined) return undefined
    if (base === undefined) return { kind: said }
    return isPathBase(base) ? { kind: said, base } : undefined
  }
  if (base !== undefined) return undefined
  if (said !== "ref") {
    if (under !== undefined) return undefined
    return isBuiltInKind(said) ? { kind: said } : { kind: "contributed", word: said }
  }
  if (under === undefined) return { kind: "ref" }
  return BOOTSTRAP.get(UNDER_KEY)?.wrong(under, derived, NO_KINDS) === undefined
    ? { kind: "ref", under }
    : undefined
}

const customText = (node: HasCustom, key: string): string | undefined => {
  const held = node.custom?.[key]
  return typeof held === "string" && held !== "" ? held : undefined
}

const isBuiltInKind = (word: string): word is BuiltInKind =>
  (PROP_KINDS as ReadonlyArray<string>).includes(word)

const isPathBase = (word: string): word is PathBase =>
  (PATH_BASES as ReadonlyArray<string>).includes(word)

export const sameTyping = (one: PropDeclarations, other: PropDeclarations): boolean => {
  if (one.size !== other.size) return false
  for (const [key, declared] of one) {
    const against = other.get(key)
    if (against === undefined) return false
    if (declared.at !== against.at) return false
    if (declared.type.kind !== against.type.kind) return false
    const here = declared.type.kind === "ref" ? declared.type.under : undefined
    const there = against.type.kind === "ref" ? against.type.under : undefined
    if (here !== there) return false
    const said = declared.type.kind === "contributed" ? declared.type.word : undefined
    const meant = against.type.kind === "contributed" ? against.type.word : undefined
    if (said !== meant) return false
    if (baseOf(declared) !== baseOf(against)) return false
  }
  return true
}

export const variantsOf = (
  derived: Derived,
  declared: Declared,
): ReadonlyArray<string> => {
  if (declared.type.kind !== "ref") return []
  const under = declared.type.under ?? declared.at
  return (derived.children.get(under) ?? [])
    .filter(isRegular)
    .map((child) => child.node.id)
}

export const declaresKind = (
  declarations: PropDeclarations,
  word: string,
): boolean => {
  for (const declared of declarations.values()) {
    if (declared.type.kind === "contributed" && declared.type.word === word) return true
  }
  return false
}

export const keysDeclaredAs = (
  declarations: PropDeclarations,
  word: string,
): ReadonlyArray<string> => {
  const vault: Array<string> = []
  const claimed: Array<string> = []
  for (const [key, declared] of declarations) {
    if (declared.type.kind !== "contributed" || declared.type.word !== word) continue
    if (declared.at === "") claimed.push(key)
    else vault.push(key)
  }
  return vault.length === 0 ? claimed : [...vault, ...claimed]
}

export const textDeclaredAs = (
  declarations: PropDeclarations,
  node: HasCustom,
  word: string,
): string | undefined => {
  const custom = node.custom
  if (custom === undefined) return undefined
  for (const key of customOrder(custom)) {
    const type = declaredFor(declarations, key)?.type
    if (type?.kind !== "contributed" || type.word !== word) continue
    const held = customText(node, key)
    if (held !== undefined) return held
  }
  return undefined
}

export const canonicalDate = (
  value: string,
  offset: string | null,
): string | undefined => {
  const match = DATE_SHAPE.exec(value.trim())
  if (match === null) return undefined
  const [, year, month, day, hour, minute, second, zone] = match as unknown as [
    string,
    string,
    string,
    string,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ]
  const date = `${year}-${pad(month)}-${pad(day)}`
  if (!isRealDay(date)) return undefined
  if (hour === undefined || minute === undefined) return date
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second ?? "0") > 59) {
    return undefined
  }
  const said = zone ?? offset
  if (said === null || said === undefined) return undefined
  return `${date}T${pad(hour)}:${minute}:${second ?? "00"}${said === "Z" ? "+00:00" : said}`
}

const DATE_SHAPE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/

const pad = (value: string): string => value.padStart(2, "0")

const isRealDay = (date: string): boolean => {
  const utc = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(utc.getTime())) return false
  const [, month, day] = date.split("-") as [string, string, string]
  return utc.getUTCMonth() + 1 === Number(month) && utc.getUTCDate() === Number(day)
}

export const offsetIn = (now: string): string | undefined =>
  /(Z|[+-]\d{2}:\d{2})$/.exec(now)?.[1]

export const isDigitRun = (value: string): boolean => /^(?:0|[1-9]\d*)$/.test(value)

export const isPathShaped = (value: string): boolean =>
  value !== "" && !/\s/.test(value) && !value.includes("//")

export interface Typed {
  readonly declarations: PropDeclarations
  readonly derived: Derived
  readonly kinds: KindVocabulary
  readonly documents: ReadonlySet<string>
}

export const wrongValue = (
  typed: Typed,
  from: string,
  key: string,
  value: CustomValue,
): string | undefined => {
  const declared = declaredFor(typed.declarations, key)
  if (declared === undefined) return undefined
  if (typeof value !== "string") {
    for (const member of value) {
      const wrong = wrongOne(typed, declared, from, key, member)
      if (wrong !== undefined) return wrong
    }
    return undefined
  }
  return wrongOne(typed, declared, from, key, value)
}

const wrongOne = (
  typed: Typed,
  declared: Declared,
  from: string,
  key: string,
  value: string,
): string | undefined => {
  const named = `\`${key}\``
  switch (declared.type.kind) {
    case "text":
      return undefined
    case "date":
      return canonicalDate(value, null) === value ? undefined : canonicalDate(value, "") === value
        ? `${named} is a date — write the offset too, the way a mark records ` +
          `its instant: \`2026-08-25T10:06:00-04:00\`, or a bare day ` +
          `\`2026-08-25\`. Got ${quoted(value)}.`
        : `${named} is a date — got ${quoted(value)}. Write ` +
          `\`2026-08-25T10:06:00-04:00\` or \`2026-08-25\`; the story goes in the note.`
    case "int":
      return isDigitRun(value) ? undefined : `${named} is a whole number — got ${
        quoted(value)
      }. Digits alone: no sign, no leading zeros, no separators, and nothing ` +
        `after them.`
    case "path":
      return isPathShaped(value) ? undefined : `${named} is a path — got ${
        quoted(value)
      }. A path is one run of characters with no spaces in it; the remark ` +
        `belongs in the note.`
    case "doc":
      return wrongDoc(typed, declared, from, named, value)
    case "ref":
      return wrongRef(typed, declared, named, value)
    case "node":
      return wrongNode(typed, named, value)
    case "contributed":
      return wrongContributed(typed, declared.type.word, named, value)
  }
}

const wrongContributed = (
  typed: Typed,
  word: string,
  named: string,
  value: string,
): string | undefined => {
  const kind = typed.kinds.enabled.get(word)
  if (kind === undefined || kind.admits(value)) return undefined
  return `${named} is ${kind.takes} — got ${quoted(value)}.`
}

const wrongDoc = (
  typed: Typed,
  declared: Declared,
  from: string,
  named: string,
  value: string,
): string | undefined => {
  const resolved = resolvedDoc(declared, from, value)
  if (resolved === undefined) {
    return `${named} names a document — got ${quoted(value)}, which is not a path.`
  }
  if (typed.documents.has(resolved)) return undefined
  return `${named} names a document — \`${value}\` resolves to \`${resolved}\`, ` +
    `and no such \`.md\` file is served${didYouMean(resolved, typed.documents)}`
}

const wrongRef = (
  typed: Typed,
  declared: Declared,
  named: string,
  value: string,
): string | undefined => {
  const variants = variantsOf(typed.derived, declared)
  if (variants.includes(value)) return undefined
  const under = declared.type.kind === "ref" ? declared.type.under : undefined
  const said = variants.length === 0
    ? `nothing is declared under \`${under ?? declared.at}\` yet, so it has no legal value`
    : under === undefined
    ? `is ${listed(variants, " | ")}`
    : `names a node under \`${under}\` — those are ${listed(variants, ", ")}`
  return `${named} ${said} — got ${quoted(value)}${didYouMean(value, variants)}`
}

const NAMED_AT_MOST = 8

const listed = (all: ReadonlyArray<string>, between: string): string =>
  all.slice(0, NAMED_AT_MOST).map((one) => `\`${one}\``).join(between) +
  (all.length > NAMED_AT_MOST ? `, and ${all.length - NAMED_AT_MOST} more` : "")

const wrongNode = (
  typed: Typed,
  named: string,
  value: string,
): string | undefined => {
  const located = typed.derived.byId.get(value)
  if (located !== undefined && isRegular(located)) return undefined
  if (located !== undefined) {
    return `${named} names a node — \`${value}\` is a mirror, which is a second ` +
      `placement rather than a node of its own.`
  }
  return `${named} names a node — \`${value}\` is not one this set declares${
    didYouMeanDeclared(value, typed.derived.byId)
  }`
}

const quoted = (value: string): string => `"${value}"`

export const storedValue = (
  typed: Typed,
  from: string,
  key: string,
  value: string,
  now: string,
): Result.Result<string, string> => {
  const declared = declaredFor(typed.declarations, key)
  if (declared === undefined || declared.type.kind === "text") return Result.succeed(value)
  const stored = declared.type.kind === "date"
    ? canonicalDate(value, offsetIn(now) ?? null) ?? value.trim()
    : value.trim()
  const wrong = wrongValue(typed, from, key, stored)
  return wrong === undefined ? Result.succeed(stored) : Result.fail(wrong)
}

export interface Wrong {
  readonly said: string
  readonly across: boolean
}

const decided = (said: string): Wrong => ({ said, across: false })

export const resolvesId = (
  declarations: PropDeclarations,
  key: string,
): boolean => {
  const kind = declaredFor(declarations, key)?.type.kind
  return kind === "ref" || kind === "node"
}

export const wrongDeclaration = (
  derived: Derived,
  located: Located,
  declared: ReadonlySet<string>,
  kinds: KindVocabulary,
): Wrong | undefined => {
  if (!isRegular(located)) return undefined
  const node = located.node
  if (node.parent !== undefined) {
    const said = [...BOOTSTRAP.keys()].find((word) => customText(node, word) !== undefined)
    return said === undefined ? undefined : decided(
      `\`${said}\` declares a property key, and ` +
        `only a TOP-LEVEL node of this file declares one — what hangs under a ` +
        `declaration is its variants, named by their ids.`,
    )
  }
  const written = node.title.trim()
  if (written === "") {
    return decided("a declaration's title IS the property key, and this one has none.")
  }
  const shadow = shadowFor(written)
  if (shadow !== undefined) {
    return decided(
      `\`${written}\` is what a node's own fields already answer, so no property ` +
        `may be called that — ${shadow.door}.`,
    )
  }
  if (BOOTSTRAP.has(written.toLowerCase())) {
    return decided(
      `\`${written}\` is what a declaration in this file says about ITSELF, so it ` +
        `cannot also be a key this vault declares — the built-in table is where the ` +
        `types of these two stop being read out of a file.`,
    )
  }
  const key = keyOf(written)
  if (key !== undefined && declared.has(key)) {
    return decided(
      `\`${written}\` is already declared by an earlier node in this file${
        key === written ? "" : ` (as \`${key}\`, and a property key is folded for case)`
      }; a key has one type across the vault, or its meaning depends on where the ` +
        `reader is standing.`,
    )
  }
  for (const [word, grounded] of BOOTSTRAP) {
    const value = customText(node, word)
    if (value === undefined) continue
    const wrong = grounded.wrong(value, derived, kinds)
    if (wrong === undefined) continue
    return { said: `\`${word}\` is \`${value}\`, which ${wrong}`, across: grounded.resolves }
  }
  const said = customText(node, TYPE_KEY)
  if (said === undefined) {
    return decided(
      `\`${written}\` declares a property key but does not say its \`${TYPE_KEY}\` — write ` +
        `${BOOTSTRAP.get(TYPE_KEY)?.takes(kinds) ?? ""}.`,
    )
  }
  if (said !== "ref" && customText(node, UNDER_KEY) !== undefined) {
    return decided(
      `\`${UNDER_KEY}\` says where a \`ref\`'s variants live, and \`${written}\` is a ` +
        `\`${said}\` — which takes its values from nowhere in particular.`,
    )
  }
  if (said !== "doc" && said !== "path" && customText(node, BASE_KEY) !== undefined) {
    return decided(
      `\`${BASE_KEY}\` says where a \`doc\` or \`path\` value resolves from, and ` +
        `\`${written}\` is a \`${said}\` — which names no path to resolve.`,
    )
  }
  return undefined
}

export const declaringOf = (
  derived: Derived,
  node: RegularNode,
): { readonly key: string; readonly declared: Declared } | undefined => {
  if (node.parent !== undefined) return undefined
  const key = keyOf(node.title)
  if (key === undefined) return undefined
  const type = typeIn(derived, node)
  if (type === undefined) return undefined
  return { key, declared: { type, at: node.id } }
}

export interface UnfitHeld {
  readonly file: string
  readonly id: string
  readonly title: string
  readonly value: string
  readonly members: ReadonlyArray<string>
  readonly wrong: string
}

export const unfitHeld = (typed: Typed, key: string): ReadonlyArray<UnfitHeld> => {
  if (declaredFor(typed.declarations, key) === undefined) return []
  const folded = foldedKey(key)
  const found: Array<UnfitHeld> = []
  for (const { located, key: held, value } of heldCustoms(typed.derived.nodes)) {
    if (foldedKey(held) !== folded) continue
    const wrong = wrongValue(typed, located.file, key, value)
    if (wrong === undefined) continue
    const members = typeof value === "string" ? [value] : value
    found.push({
      file: located.file,
      id: located.node.id,
      title: located.node.title,
      value: members.join(", "),
      members,
      wrong,
    })
  }
  return found
}

export function* heldCustoms(
  records: Iterable<Located>,
): Generator<{
  readonly located: LocatedRegular
  readonly key: string
  readonly value: CustomValue
}> {
  for (const located of records) {
    if (!isRegular(located)) continue
    const custom = located.node.custom
    if (custom === undefined) continue
    for (const key of customOrder(custom)) {
      const value = custom[key]
      if (value === undefined) continue
      yield { located, key, value }
    }
  }
}

import { TEST_CLAIMS } from "@olai/format/testlib"
import * as fs from "node:fs"
import * as path from "node:path"

import { Result } from "effect"

import { ancestorsOf, byCorpus, type Derived } from "./derive.ts"
import { bodiedDocument, type Document } from "./document.ts"
import { type Verdict, verdictOf } from "./verdict.ts"
import {
  type Filter,
  type Matched,
  matching,
  parseFilter,
  type Scope,
  selecting,
} from "./filter.ts"
import { seeded } from "./fixtures.testlib.ts"
import { bodyKind, fileKind, unkept } from "./kinds.ts"
import { isMirror, type LocatedRegular } from "./node.ts"
import { parseOutline } from "./fixtures.testlib.ts"
import { assemble } from "./set.ts"
import { reading, type Reading } from "./validate.ts"

export const walkedMatching = (
  derived: Derived,
  filter: Filter,
  scope: Scope = {},
  named?: Iterable<string>,
): ReadonlyArray<Matched> => [
  ...selecting(
    derived,
    filter,
    named === undefined
      ? walkedInScope(derived, scope)
      : walkedNamedInScope(derived, scope, named),
    scope.trashed === true || (filter.kind === "asking" && filter.speaksOfTrash),
  ),
]

const walkedScoping = (
  derived: Derived,
  scope: Scope,
): ((at: LocatedRegular) => boolean) => {
  const { file, under } = scope
  if (file === undefined && under === undefined) return () => true
  return (at) => {
    if (file !== undefined && at.file !== file) return false
    if (under === undefined) return true
    return at.node.id === under ||
      ancestorsOf(derived, at.node.id).some((crumb) => crumb.node.id === under)
  }
}

function* walkedInScope(derived: Derived, scope: Scope): Generator<LocatedRegular> {
  const inScope = walkedScoping(derived, scope)
  for (const located of derived.nodes) {
    if (isMirror(located.node)) continue
    const at = located as LocatedRegular
    if (!inScope(at)) continue
    yield at
  }
}

const walkedNamedInScope = (
  derived: Derived,
  scope: Scope,
  named: Iterable<string>,
): ReadonlyArray<LocatedRegular> => {
  const inScope = walkedScoping(derived, scope)
  const found: Array<LocatedRegular> = []
  for (const id of named) {
    const located = derived.byId.get(id)
    if (located === undefined || isMirror(located.node)) continue
    const at = located as LocatedRegular
    if (!inScope(at)) continue
    found.push(at)
  }
  return found.sort(byCorpus)
}

export interface Ask {
  readonly text: string
  readonly scope: Scope
}

export interface Report {
  readonly divergences: ReadonlyArray<string>
  readonly asked: number
  readonly hits: number
  readonly narrowing: number
  readonly candidates: number
}

export const differential = (
  at: Reading,
  asks: Iterable<Ask>,
  now: string,
  narrow?: (at: Reading, filter: Filter) => Iterable<string> | null | undefined,
): Report => {
  const divergences: Array<string> = []
  let asked = 0
  let hits = 0
  let narrowing = 0
  let candidates = 0
  for (const ask of asks) {
    const filter = parseFilter(ask.text, now)
    const answered = narrow?.(at, filter)
    const named = answered === null || answered === undefined ? undefined : [...answered]
    const walked = walkedMatching(at.derived, filter, ask.scope, named)
    const narrowed = matching(at.derived, filter, ask.scope, named)
    asked += 1
    hits += walked.length
    if (named !== undefined) candidates += 1
    if (isScoped(ask.scope) && walked.length > 0) {
      const whole = walkedMatching(at.derived, filter, trashOnly(ask.scope), named)
      if (walked.length < whole.length) narrowing += 1
    }
    for (const line of differing(ask, walked, narrowed)) divergences.push(line)
  }
  return { divergences, asked, hits, narrowing, candidates }
}

const isScoped = (scope: Scope): boolean =>
  scope.file !== undefined || scope.under !== undefined

const trashOnly = (scope: Scope): Scope =>
  scope.trashed === undefined ? {} : { trashed: scope.trashed }

const differing = (
  ask: Ask,
  walked: ReadonlyArray<Matched>,
  narrowed: ReadonlyArray<Matched>,
): ReadonlyArray<string> => {
  const said = `${askedAs(ask)}:`
  const out: Array<string> = []
  const byWalk = new Set(walked.map(whereOf))
  const byNarrowing = new Set(narrowed.map(whereOf))
  for (const one of byWalk) {
    if (!byNarrowing.has(one)) out.push(`${said} the narrowing misses ${one}`)
  }
  for (const one of byNarrowing) {
    if (!byWalk.has(one)) out.push(`${said} the narrowing admits ${one}, which the walk does not`)
  }
  if (out.length > 0) return out
  for (let at = 0; at < Math.max(walked.length, narrowed.length); at++) {
    const one = walked[at]
    const other = narrowed[at]
    if (one !== undefined && other !== undefined && spelled(one) === spelled(other)) continue
    out.push(
      `${said} at position ${at} the walk says ${one === undefined ? "nothing" : spelled(one)}` +
        ` and the narrowing says ${other === undefined ? "nothing" : spelled(other)}`,
    )
    if (out.length >= ORDER_LINES) {
      out.push(`${said} ...and the rest of the order past position ${at}`)
      break
    }
  }
  return out
}

const ORDER_LINES = 5

const askedAs = (ask: Ask): string => {
  const corner = [
    ask.scope.file === undefined ? [] : [`file:${ask.scope.file}`],
    ask.scope.under === undefined ? [] : [`under:${ask.scope.under}`],
    ask.scope.trashed === true ? ["trashed"] : [],
  ].flat()
  return `${JSON.stringify(ask.text)}${corner.length === 0 ? "" : ` (${corner.join(" ")})`}`
}

const whereOf = (one: Matched): string =>
  `${one.at.node.id} @ ${one.at.file}:${one.at.line}`

const spelled = (one: Matched): string =>
  `${whereOf(one)} [${one.match.field ?? "-"} ${one.match.score}]`

export const TANGLED: Readonly<Record<string, string>> = {
  "far.olai": [
    `{"id":"t-far","ord":"a0","title":"far kitchen root"}`,
    `{"id":"t-target","parent":"t-far","ord":"a1","title":"the kitchen target","todo":true}`,
    `{"id":"t-target-child","parent":"t-target","ord":"a2","title":"kitchen under the target"}`,
    `{"id":"t-cross","parent":"t-live","ord":"a3","title":"kitchen written in another file"}`,
  ].join("\n"),
  "tangled.olai": [
    `{"id":"t-root","ord":"a0","title":"tangled kitchen root"}`,
    `{"id":"t-live","parent":"t-root","ord":"a1","title":"a live kitchen branch","todo":true}`,
    `{"id":"t-inner","parent":"t-live","ord":"a2","title":"kitchen deeper in","desc":"walnut"}`,
    `{"id":"t-place","parent":"t-root","ord":"a3","mirror":"t-target"}`,
    `{"id":"t-beneath","parent":"t-place","ord":"a4","title":"kitchen beneath a placement"}`,
    `{"id":"t-deeper","parent":"t-beneath","ord":"a5","title":"kitchen deeper beneath one"}`,
    `{"id":"t-chain","parent":"t-root","ord":"a6","mirror":"t-place"}`,
    `{"id":"t-loop-a","parent":"t-loop-b","ord":"a7","title":"kitchen in a loop, one"}`,
    `{"id":"t-loop-b","parent":"t-loop-a","ord":"a8","title":"kitchen in a loop, two"}`,
    `{"id":"t-orphan","parent":"t-nobody","ord":"a9","title":"kitchen under nothing"}`,
  ].join("\n"),
  "_olai/Trash.olai": [
    `{"id":"t-gone","ord":"a0","title":"an old kitchen plan"}`,
    `{"id":"t-gone-child","parent":"t-gone","ord":"a1","title":"kitchen, once"}`,
  ].join("\n"),
}

export const deepVaultOf = (
  { files, records, seed = 20260824 }: {
    readonly files: number
    readonly records: number
    readonly seed?: number
  },
): ReadonlyMap<string, string> => {
  const random = seeded(seed)
  const corpus = new Map<string, string>()
  for (let at = 0; at < files; at++) {
    corpus.set(
      at % 5 === 0 ? `area${at % 7}/deep${at}.olai` : `deep${at}.olai`,
      deepFileOf(random, at, records),
    )
  }
  return corpus
}

const deepFileOf = (random: () => number, at: number, records: number): string => {
  const root = `d${at}r`
  const lines = [
    JSON.stringify({ id: root, ord: "a0", title: `deep file ${at} kitchen` }),
  ]
  const parents: Array<string> = [root]
  const placed: Array<string> = []
  for (let which = 1; which < records; which++) {
    const id = `d${at}n${which}`
    const parent = parents[
      Math.min(parents.length - 1, Math.floor(parents.length * (1 - random() * random())))
    ] as string
    if (which % 9 === 0 && at > 0) {
      lines.push(
        JSON.stringify({ id, parent, ord: `a${which}`, mirror: `d${at - 1}n1` }),
      )
      placed.push(id)
      continue
    }
    if (which % 11 === 0 && placed.length > 0) {
      lines.push(
        JSON.stringify({
          id,
          parent: placed[Math.floor(random() * placed.length)] as string,
          ord: `a${which}`,
          title: `kitchen ${which} beneath a placement in file ${at}`,
        }),
      )
      parents.push(id)
      continue
    }
    lines.push(
      JSON.stringify({
        id,
        parent,
        ord: `a${which}`,
        title: `${which % 3 === 0 ? "kitchen" : "garden"} record ${which} of deep file ${at}`,
        ...(which % 4 === 0 ? { desc: `a note about walnut and the budget ${which}` } : {}),
        ...(which % 5 === 0 ? { todo: true } : {}),
        ...(which % 7 === 0
          ? { date: `2026-08-${String((which % 28) + 1).padStart(2, "0")}` }
          : {}),
      }),
    )
    parents.push(id)
  }
  return lines.join("\n")
}

export const asksOver = (
  derived: Derived,
  queries: ReadonlyArray<string>,
  { files = 12, roots = 24, seed = 20260824 }: {
    readonly files?: number
    readonly roots?: number
    readonly seed?: number
  } = {},
): ReadonlyArray<Ask> => {
  const random = seeded(seed)
  const scopes: Array<Scope> = [{}]
  const paths = [...derived.byFile.keys()]
  for (const file of sampled(random, paths, files)) scopes.push({ file })
  const regular = derived.nodes.filter((at) => !isMirror(at.node))
  for (const at of sampled(random, regular, roots)) {
    scopes.push({ under: at.node.id })
    scopes.push({ under: at.node.id, file: at.file })
  }
  const live = paths.find((file) => (derived.byFile.get(file) ?? []).length > 0)
  const placement = derived.nodes.find((at) => isMirror(at.node))
  for (
    const under of [
      ...(placement === undefined ? [] : [placement.node.id]),
      "nothing-claims-this-id",
    ]
  ) {
    scopes.push({ under })
    if (live !== undefined) scopes.push({ under, file: live })
  }
  scopes.push({ trashed: true })
  for (const file of paths) {
    if (file.includes("Trash")) scopes.push({ file, trashed: true })
  }
  return queries.flatMap((text) => scopes.map((scope) => ({ text, scope })))
}

const sampled = <T>(
  random: () => number,
  of: ReadonlyArray<T>,
  count: number,
): ReadonlyArray<T> => {
  if (of.length <= count) return of
  const stride = of.length / count
  return Array.from(
    { length: count },
    (_, at) => of[Math.min(of.length - 1, Math.floor(at * stride + random() * stride))] as T,
  )
}

export const decodedVault = (
  vault: ReadonlyMap<string, string>,
): Map<string, Result.Result<Document, Verdict>> => {
  const decoded = new Map<string, Result.Result<Document, Verdict>>()
  for (const [file, text] of vault) {
    decoded.set(
      file,
      bodyKind(TEST_CLAIMS, file) === null
        ? Result.mapError(parseOutline(file, text, TEST_CLAIMS), verdictOf)
        : Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, file, text)),
    )
  }
  return decoded
}

export const readingOfVault = (vault: ReadonlyMap<string, string>): Reading =>
  reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decodedVault(vault)))

export const vaultAt = (dir: string): ReadonlyMap<string, string> => {
  const vault = new Map<string, string>()
  const walk = (at: string): void => {
    for (const entry of fs.readdirSync(path.join(dir, at), { withFileTypes: true })) {
      const file = at === "" ? entry.name : `${at}/${entry.name}`
      if (entry.isDirectory()) walk(file)
      else if (fileKind(TEST_CLAIMS, file) !== null && !unkept(TEST_CLAIMS, file)) {
        vault.set(file, fs.readFileSync(path.join(dir, file), "utf8"))
      }
    }
  }
  walk("")
  return vault
}

export const pinnedVault = (): string => {
  const at = process.env["OSS_OLAI_VAULT"]
  if (at === undefined || at === "") {
    throw new Error(
      "OSS_OLAI_VAULT is not set: the real-vault corpus is the pinned " +
        "https://github.com/juspay/oss.olai (npins/sources.json, exported by " +
        "shell.nix). Run this suite inside `nix develop` — `just test` does.",
    )
  }
  if (!fs.existsSync(at)) {
    throw new Error(
      `OSS_OLAI_VAULT names nothing on disk: ${at}. The pin is stale or the ` +
        "store path was garbage-collected — `just update-pins`, or re-enter " +
        "`nix develop` to realise it.",
    )
  }
  return at
}

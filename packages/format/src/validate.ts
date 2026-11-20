import type { Claims } from "./kinds.ts"
import { Result } from "effect"

import { derive, type Derived } from "./derive.ts"
import { type Document, isOutline } from "./document.ts"
import type { BrokenFile, OutlineError } from "./errors.ts"
import { type Decline, incrementally, type Ledger } from "./incremental.ts"
import type { Located } from "./node.ts"
import { type FileNodes, patch, patched, type SetDelta } from "./patch.ts"
import { type Pointing, pointingOf, repointed } from "./pointing.ts"
import {
  danglingIn,
  markdownPaths,
  reportCycleWalks,
  reportDeclarations,
  reportDuplicateIds,
  reportOf,
  reportConventions,
  reportParents,
  reportPropValues,
  reportUnknownTargets,
} from "./rules.ts"
import { type OutlineSet, outlinesIn, withDocuments, withheld } from "./set.ts"
import { declarationsOf, type KindVocabulary, NO_KINDS, type Typed } from "./typing.ts"
import { blamed, type Verdict } from "./verdict.ts"

export interface Reading {
  readonly claims: Claims
  readonly set: OutlineSet
  readonly derived: Derived
  readonly pointing: Pointing
}

export interface Previous {
  readonly read: Reading
  readonly delta: SetDelta
}

export const validate = (
  claims: Claims,
  set: OutlineSet,
  previous?: Previous,
  kinds: KindVocabulary = NO_KINDS,
): Result.Result<Reading, Verdict> => {
  const view = viewOf(claims, set, previous)
  const derived = view.derived

  const said = narrowly(set, previous, view, kinds)
  const ledger = typeof said === "string" ? wholly(set, derived, kinds, said) : said

  const report = reportOf(set, [...ledger.errors, ...reportConventions(claims, set)])
  const answer: Reading = report.length === 0
    ? { claims, set, derived, pointing: view.pointing }
    : degraded(set, view, blamed(report))

  LEDGERS.set(answer.derived, ledger)
  return Result.succeed(answer)
}

const degraded = (
  set: OutlineSet,
  view: Taken,
  broken: ReadonlyArray<BrokenFile>,
): Reading => {
  const withdrawn = withheld(view.derived.claims, set, broken)
  if (withdrawn === set) return { claims: view.derived.claims, set, derived: view.derived, pointing: view.pointing }
  return {
    claims: view.derived.claims,
    set: withdrawn,
    derived: patch(view.derived, {
      upserts: NO_UPSERTS,
      removes: broken.map((entry) => entry.file),
    }),
    pointing: repointed(view.pointing, view.derived.claims, set.documents, withdrawn.documents),
  }
}

const NO_UPSERTS: ReadonlyArray<readonly [file: string, entry: FileNodes]> = []

export type Cold = "first" | "rebuilt" | "unledgered" | Decline

const followingOf = (
  previous: Previous | undefined,
  view: Taken,
): { readonly previous: Previous; readonly ledger: Ledger } | Cold => {
  if (previous === undefined) return "first"
  if (!view.patched) return "rebuilt"
  const ledger = LEDGERS.get(previous.read.derived)
  return ledger === undefined ? "unledgered" : { previous, ledger }
}

const narrowly = (
  set: OutlineSet,
  previous: Previous | undefined,
  view: Taken,
  kinds: KindVocabulary,
): Ledger | Cold => {
  const following = followingOf(previous, view)
  if (typeof following === "string") return following
  const narrowed = incrementally(
    set,
    following.previous.read.derived,
    following.ledger,
    following.previous.delta,
    view.derived,
    kinds,
  )
  if (typeof narrowed === "string") return narrowed
  reached({ kind: "narrowed", walked: narrowed.walked })
  return narrowed.ledger
}

const wholly = (
  set: OutlineSet,
  derived: Derived,
  kinds: KindVocabulary,
  why: Cold,
): Ledger => {
  reached({ kind: "whole", why })
  const errors: Array<OutlineError> = []
  const all = derived.nodes
  const known = markdownPaths(set)
  const declarations = declarationsOf(derived, kinds)
  const typed: Typed = { declarations, derived, documents: known, kinds }
  reportDuplicateIds(all, derived, errors)
  reportParents(all, derived, errors)
  reportCycleWalks(all, derived, errors)
  reportUnknownTargets(danglingIn(derived), derived, errors)
  reportDeclarations(derived, kinds, errors)
  reportPropValues(all, typed, errors)
  return { errors, known, typing: declarations }
}

const LEDGERS = new WeakMap<Derived, Ledger>()

export const ledgerOf = (derived: Derived): Ledger | undefined => LEDGERS.get(derived)

export interface Reached {
  readonly kind: "narrowed" | "whole"
  readonly why?: Cold
  readonly walked?: boolean
}

export type Watcher = (reached: Reached) => void

export const watching = (installed: Watcher | null): void => {
  watcher = installed
}

let watcher: Watcher | null = null

const reached = (one: Reached): void => {
  watcher?.(one)
}

export const reading = (claims: Claims, set: OutlineSet, previous?: Previous): Reading => {
  const view = viewOf(claims, set, previous)
  return { claims: view.derived.claims, set, derived: view.derived, pointing: view.pointing }
}

export const following = (
  read: Reading,
  written: ReadonlyArray<Document>,
): Reading => {
  const set = withDocuments(read.set, written)
  const view = viewAfter(read.derived, written)
  return {
    claims: read.claims,
    set,
    derived: view ?? derive(read.claims, recordsIn(set)),
    pointing: repointed(read.pointing, read.claims, read.set.documents, set.documents),
  }
}

const viewAfter = (
  before: Derived,
  written: ReadonlyArray<Document>,
): Derived | undefined => {
  const surviving = new Map<string, Document>()
  for (const document of written) surviving.set(document.path, document)
  const upserts: Array<readonly [file: string, entry: FileNodes]> = []
  for (const [file, document] of surviving) {
    if (isOutline(document)) {
      upserts.push([file, { nodes: document.nodes }])
    } else if (before.byFile.has(file)) {
      return undefined
    }
  }
  const view = patched(before, { upserts, removes: [] })
  if (view === undefined) return undefined
  for (const [file, entry] of upserts) {
    const records = view.byFile.get(file)
    if (records === undefined) {
      if (entry.nodes.length > 0) return undefined
      continue
    }
    if (records.length !== entry.nodes.length) return undefined
    for (let at = 0; at < records.length; at++) {
      if (records[at] !== entry.nodes[at]) return undefined
    }
  }
  return view
}

const recordsIn = (set: OutlineSet): ReadonlyArray<Located> =>
  outlinesIn(set).flatMap((outline) => outline.nodes)

const viewOf = (claims: Claims, set: OutlineSet, previous: Previous | undefined): Taken => {
  if (previous?.read.claims !== claims) previous = undefined
  const pointing = previous === undefined
    ? pointingOf(claims, set.documents)
    : repointed(previous.read.pointing, claims, previous.read.set.documents, set.documents)
  if (previous !== undefined) {
    const view = patched(previous.read.derived, previous.delta)
    if (view !== undefined && isSet(view, set)) {
      return { derived: view, pointing, patched: true }
    }
  }
  return { derived: derive(claims, recordsIn(set)), pointing, patched: false }
}

interface Taken {
  readonly derived: Derived
  readonly pointing: Pointing
  readonly patched: boolean
}

const isSet = (view: Derived, set: OutlineSet): boolean => {
  const outlines = outlinesIn(set).filter((outline) => outline.nodes.length > 0)
  if (view.byFile.size !== outlines.length) return false
  let which = 0
  for (const [file, records] of view.byFile) {
    const outline = outlines[which++]
    if (outline === undefined || outline.path !== file) return false
    if (outline.nodes.length !== records.length) return false
    for (let at = 0; at < records.length; at++) {
      if (records[at] !== outline.nodes[at]) return false
    }
  }
  return true
}

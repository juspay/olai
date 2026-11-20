import { claimedOf } from "./address.ts"
import { Result, Schema } from "effect"

import {
  bodiedDocument,
  Document,
  isBodied,
  isKeptText,
  isMarkdown,
  isOutline,
  type Markdown,
  type Outline,
  outlineDocument,
  type Unkept,
} from "./document.ts"
import { BrokenFile, type OutlineError } from "./errors.ts"
import { bodyKind, type Claims } from "./kinds.ts"
import { Located } from "./node.ts"
import { byPath } from "./paths.ts"
import { admits, darkened, type Verdict, verdictOf } from "./verdict.ts"

export { BrokenFile }

export const OutlineSet = Schema.Struct({
  documents: Schema.Array(Document),
  broken: Schema.Array(BrokenFile),
})
export type OutlineSet = typeof OutlineSet.Type

export const nodesIn = <E>(
  decoded: Result.Result<Document, E> | undefined,
): ReadonlyArray<Located> =>
  decoded === undefined || Result.isFailure(decoded) || !isOutline(decoded.success)
    ? NO_NODES
    : decoded.success.nodes

const NO_NODES: ReadonlyArray<Located> = []

export const assemble = (
  claims: Claims,
  files: ReadonlyMap<string, Result.Result<Document, Verdict>>,
): OutlineSet => {
  const documents: Array<Document> = []
  const broken: Array<BrokenFile> = []

  for (const path of [...files.keys()].sort(byPath)) {
    if (claimedOf(claims, path) === null) continue
    const decoded = files.get(path)!
    if (Result.isFailure(decoded)) {
      broken.push({ file: path, errors: decoded.failure.findings })
      documents.push(emptyDocument(claims, path))
    } else documents.push(decoded.success)
  }
  return { documents, broken }
}

export const brokenIn = (
  set: OutlineSet,
  file: string,
): ReadonlyArray<OutlineError> | undefined => brokenBy(set).get(file)

export const brokenBy = (
  set: OutlineSet,
): ReadonlyMap<string, ReadonlyArray<OutlineError>> => {
  const held = heldFor(set)
  return held.broken ??= new Map(set.broken.map((entry) => [entry.file, entry.errors]))
}

export const stopping = (
  set: OutlineSet,
  paths: ReadonlyArray<string>,
  standing: OutlineSet,
): Verdict | null => {
  const admission = admits(set.broken, [...paths, ...darkened(standing.broken, set.broken)])
  return admission._tag === "admitted" ? null : verdictOf(admission.rows)
}

export const withheld = (
  claims: Claims,
  set: OutlineSet,
  broken: ReadonlyArray<BrokenFile>,
): OutlineSet => {
  if (sameBroken(set.broken, broken)) return set
  const held = new Set(set.broken.map((entry) => entry.file))
  const withdrawn = new Set(broken.map((entry) => entry.file))
  return {
    documents: set.documents.map((document) =>
      withdrawn.has(document.path) && !held.has(document.path)
        ? emptyDocument(claims, document.path)
        : document
    ),
    broken,
  }
}

const sameBroken = (
  held: ReadonlyArray<BrokenFile>,
  next: ReadonlyArray<BrokenFile>,
): boolean =>
  held.length === next.length &&
  held.every((entry, at) => {
    const other = next[at] as BrokenFile
    return entry.file === other.file && entry.errors.length === other.errors.length &&
      entry.errors.every((row, index) => row === other.errors[index])
  })

interface Held {
  broken?: ReadonlyMap<string, ReadonlyArray<OutlineError>>
  paths?: ReadonlyArray<string>
  names?: ReadonlySet<string>
}

const HELD = new WeakMap<OutlineSet, Held>()

const heldFor = (set: OutlineSet): Held => {
  const held = HELD.get(set)
  if (held !== undefined) return held
  const fresh: Held = {}
  HELD.set(set, fresh)
  return fresh
}

export const documentAt = (set: OutlineSet, path: string): Document | undefined => {
  const { documents } = set
  let low = 0
  let high = documents.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    const at = documents[middle] as Document
    const side = byPath(at.path, path)
    if (side === 0) return at
    if (side < 0) low = middle + 1
    else high = middle - 1
  }
  return undefined
}

export const outlinesIn = (set: OutlineSet): ReadonlyArray<Outline> =>
  set.documents.filter(isOutline)

export const outlinePaths = (set: OutlineSet): ReadonlyArray<string> => {
  const held = heldFor(set)
  return held.paths ??= outlinesIn(set).map((outline) => outline.path)
}

export const outlineNames = (set: OutlineSet): ReadonlySet<string> => {
  const held = heldFor(set)
  return held.names ??= new Set(outlinePaths(set))
}

export const markdownAt = (set: OutlineSet, path: string): Markdown | undefined => {
  const document = documentAt(set, path)
  return document !== undefined && isKeptText(document) ? document : undefined
}

export const markdownIn = (set: OutlineSet): ReadonlyArray<Markdown> =>
  set.documents.filter(isMarkdown)

export const bodiedIn = (set: OutlineSet): ReadonlyArray<Markdown | Unkept> =>
  set.documents.filter(isBodied)

export const apart = (
  set: OutlineSet,
): Map<string, Result.Result<Document, Verdict>> => {
  const files = new Map<string, Result.Result<Document, Verdict>>()
  for (const broken of set.broken) {
    files.set(broken.file, Result.fail(verdictOf(broken.errors)))
  }
  for (const document of set.documents) {
    if (files.has(document.path)) continue
    files.set(document.path, Result.succeed(document))
  }
  return files
}

export const withDocuments = (
  set: OutlineSet,
  written: Iterable<Document>,
): OutlineSet => {
  const swapped = new Map<string, Document>()
  for (const document of written) swapped.set(document.path, document)
  if (swapped.size === 0) return set

  const arriving = [...swapped.values()]
    .filter((document) => documentAt(set, document.path) === undefined)
    .sort((one, other) => byPath(one.path, other.path))

  const documents: Array<Document> = []
  let next = 0
  for (const held of set.documents) {
    while (next < arriving.length && byPath((arriving[next] as Document).path, held.path) < 0) {
      documents.push(arriving[next++] as Document)
    }
    documents.push(swapped.get(held.path) ?? held)
  }
  while (next < arriving.length) documents.push(arriving[next++] as Document)

  const mended = set.broken.some((entry) => swapped.has(entry.file))
  return {
    documents,
    broken: mended ? set.broken.filter((entry) => !swapped.has(entry.file)) : set.broken,
  }
}

const emptyDocument = (claims: Claims, file: string): Document =>
  bodyKind(claims, file) === null ? outlineDocument(claims, file, []) : bodiedDocument(claims, file, "")

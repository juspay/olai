/**
 * Which nodes this browser is keeping folded.
 *
 * Folding is how a READER is reading, not something the outline says, so this
 * is a preference of the browser (`../preference.ts`) and nothing else: no
 * cell, no wire, nothing on disk and nothing in git. Two people reading the
 * same directory are entitled to have different halves of it shut, and a
 * machine is entitled to differ from the same person's other machine — which is
 * what "per-device, like the theme" means and why `makePersisted` is no more
 * adopted here than it is beside the theme.
 *
 * What is stored is COLLAPSED IDS, PER FILE: a fold adds an id, an unfold
 * removes it, and a node nobody has touched is simply absent and therefore
 * open. The default is a fact about the shape rather than a value to store,
 * which is what keeps the entry a directory of forty outlines writes bounded by
 * what the reader has actually shut.
 *
 * Grouped by the file the node is DEFINED in (./rows.ts) for two reasons that
 * are one reason: an id means a node, so folding a mirror while reading another
 * outline is a fact about the file the target lives in; and PRUNING is a
 * question that can only be asked per file — the ids of a file this browser can
 * currently see are known, so what is left over in ITS bucket is a node that
 * has been deleted, while a file that is broken or not served right now is one
 * this app knows nothing about and must not throw away folds for.
 *
 * A stored value this app did not write — an older olai, something typed into a
 * console — is not an error to report; it is nothing, and the reader gets the
 * default (everything open), exactly as `parseBool` rules for a stored boolean.
 * The one storage failure that IS worth a word — a browser that will not
 * remember at all — is already said once per key by `writePreference`.
 */

import type { Derived } from "@olai/format"
import { type Accessor, createSignal } from "solid-js"

import { readPreference, watchPreference, writePreference } from "../preference.ts"
import type { Fold } from "./rows.ts"

export const FOLDS_KEY = "olai.folds"

/** file → the nodes of it this reader has folded. */
export type Folds = ReadonlyMap<string, ReadonlySet<string>>

/** What is in storage, or nothing at all — which is what a browser that has
 *  never been asked, a value from an older olai, and a hand-edited entry all
 *  come to. */
export const parseFolds = (raw: string | null): Folds => {
  if (raw === null) return new Map()
  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    return new Map()
  }
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    return new Map()
  }
  const out = new Map<string, ReadonlySet<string>>()
  for (const [file, ids] of Object.entries(decoded)) {
    if (!Array.isArray(ids)) continue
    const kept = ids.filter((id): id is string => typeof id === "string")
    if (kept.length > 0) out.set(file, new Set(kept))
  }
  return out
}

/** ...and back, or `null` for "remember nothing", which is a key REMOVED
 *  rather than an empty object left behind.
 *
 *  Sorted, both halves. Nothing reads the order, but a preference somebody may
 *  open a devtools panel on is worth being able to read, and a stable spelling
 *  is what lets a test say what a fold wrote rather than what it happened to
 *  iterate. */
export const printFolds = (folds: Folds): string | null => {
  const out: Record<string, ReadonlyArray<string>> = {}
  for (const file of [...folds.keys()].sort()) {
    const ids = folds.get(file)
    if (ids === undefined || ids.size === 0) continue
    out[file] = [...ids].sort()
  }
  return Object.keys(out).length === 0 ? null : JSON.stringify(out)
}

/** The same memory with `of` folded (or unfolded). One function for both, and
 *  for one fold or a hundred, because "Collapse all" is the same write as a
 *  triangle — the menu just names more of them. */
export const withFolds = (
  folds: Folds,
  given: ReadonlyArray<Fold>,
  collapsed: boolean,
): Folds => {
  const next = new Map<string, Set<string>>()
  for (const [file, ids] of folds) next.set(file, new Set(ids))
  for (const fold of given) {
    const ids = next.get(fold.file) ?? new Set<string>()
    if (collapsed) ids.add(fold.id)
    else ids.delete(fold.id)
    if (ids.size === 0) next.delete(fold.file)
    else next.set(fold.file, ids)
  }
  return next
}

/**
 * The same memory with the folds of nodes that are no longer there dropped.
 *
 * `live` is what this browser can currently SEE — file → the ids it declares —
 * and a file missing from it is missing on purpose: a file that would not parse,
 * or one this directory does not serve any more, is not evidence that its nodes
 * are gone. So a bucket is pruned only against a file that is present, and
 * everything else is left exactly as it was.
 */
export const pruned = (
  folds: Folds,
  live: ReadonlyMap<string, ReadonlySet<string>>,
): Folds => {
  const next = new Map<string, ReadonlySet<string>>()
  for (const [file, ids] of folds) {
    const known = live.get(file)
    if (known === undefined) {
      next.set(file, ids)
      continue
    }
    const kept = new Set([...ids].filter((id) => known.has(id)))
    if (kept.size > 0) next.set(file, kept)
  }
  return next
}

/** file → the ids the served set says it declares. The other half of
 *  {@link pruned}, and the only thing the derivation is asked for here. */
export const idsByFile = (derived: Derived): ReadonlyMap<string, ReadonlySet<string>> => {
  const out = new Map<string, Set<string>>()
  for (const located of derived.nodes) {
    const ids = out.get(located.file)
    if (ids === undefined) out.set(located.file, new Set([located.node.id]))
    else ids.add(located.node.id)
  }
  return out
}

/** Every folded id, whichever file it came from. Ids are unique across the
 *  loaded set, so this is what a ROW is asked about — one membership test
 *  rather than a file lookup and then a set lookup, on a question every row on
 *  screen asks. */
const merged = (folds: Folds): ReadonlySet<string> => {
  const out = new Set<string>()
  for (const ids of folds.values()) for (const id of ids) out.add(id)
  return out
}

/** The two readings of one memory, minted together so the flat one can never
 *  be a frame behind the grouped one. */
interface Memory {
  readonly byFile: Folds
  readonly ids: ReadonlySet<string>
}

const memoryOf = (byFile: Folds): Memory => ({ byFile, ids: merged(byFile) })

const [memory, setMemory] = createSignal<Memory>(
  memoryOf(parseFolds(readPreference(FOLDS_KEY))),
)

/** The nodes that are folded right now, by id. */
export const collapsedNodes: Accessor<ReadonlySet<string>> = () => memory().ids

/**
 * Fold the nodes `given`, or unfold them, and remember which.
 *
 * `live` is the set as this browser currently has it, and it is here rather
 * than on a timer or a load because a write is exactly when the answer is both
 * known and cheap: the reader has just folded something, so the derivation is
 * in hand and the entry is being rewritten anyway. `undefined` — a page that
 * has not loaded a set — prunes nothing, which is the same rule as a file
 * that is not in it.
 */
export const setFolded = (
  given: ReadonlyArray<Fold>,
  collapsed: boolean,
  live: Derived | undefined,
): void => {
  const next = pruned(
    withFolds(memory().byFile, given, collapsed),
    live === undefined ? new Map() : idsByFile(live),
  )
  setMemory(memoryOf(next))
  writePreference(FOLDS_KEY, printFolds(next))
}

/** Follow it for as long as this document lives — the same shape as
 *  `followDoneDefault` and `followLayout`, started once from `main.tsx`,
 *  because a preference belongs to the browser and a browser is more than one
 *  tab. A fold made in another tab lands here without a reload. */
export const followFolds = (): void => {
  watchPreference(FOLDS_KEY, (value) => setMemory(memoryOf(parseFolds(value))))
}

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
import type { Accessor } from "solid-js"

import { createPreference, parsedJson } from "../preference.ts"
import type { Fold } from "./rows.ts"

export const FOLDS_KEY = "olai.folds"

/** file → the nodes of it this reader has folded.
 *
 *  NEVER an empty set: a file with nothing folded in it is not a key. The three
 *  functions that mint one of these keep that (`parseFolds` skips an empty
 *  list, `withFolds` deletes the file when its last id goes, `pruned` sets only
 *  what survived), which is what lets `printFolds` ask `folds.size` and mean
 *  "this browser is holding no folds at all". */
export type Folds = ReadonlyMap<string, ReadonlySet<string>>

/** What is in storage, or nothing at all — which is what a browser that has
 *  never been asked, a value from an older olai, and a hand-edited entry all
 *  come to. */
export const parseFolds = (raw: string | null): Folds => {
  const decoded = parsedJson(raw)
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
  if (folds.size === 0) return null
  const out: Record<string, ReadonlyArray<string>> = {}
  for (const file of [...folds.keys()].sort()) {
    out[file] = [...(folds.get(file) ?? [])].sort()
  }
  return JSON.stringify(out)
}

/** The same memory with `of` folded (or unfolded). One function for both, and
 *  for one fold or a hundred, because "Collapse all" is the same write as a
 *  triangle — the menu just names more of them.
 *
 *  An id is taken out of every OTHER file on its way, in both directions, which
 *  is the storage half of "one node, one fold state": a node has one home at a
 *  time, so a copy left under the file it used to live in would be a second
 *  answer — and the one that wins, since the id set every row reads is the
 *  union. It can be left behind: a bucket for a file this browser cannot
 *  currently see is deliberately never pruned ({@link pruned}), so a node that
 *  moved out of a file that then stopped parsing is exactly the case. */
export const withFolds = (
  folds: Folds,
  given: ReadonlyArray<Fold>,
  collapsed: boolean,
): Folds => {
  const next = new Map<string, Set<string>>()
  for (const [file, ids] of folds) next.set(file, new Set(ids))
  for (const fold of given) {
    for (const [file, ids] of next) {
      if (file === fold.file) continue
      if (ids.delete(fold.id) && ids.size === 0) next.delete(file)
    }
    const ids = next.get(fold.file) ?? new Set<string>()
    if (collapsed) ids.add(fold.id)
    else ids.delete(fold.id)
    if (ids.size === 0) next.delete(fold.file)
    else next.set(fold.file, ids)
  }
  return next
}

/**
 * The same memory with the folds of nodes that are no longer there dropped —
 * and the folds of nodes that MOVED filed under where they moved to.
 *
 * `live` is what this browser can currently SEE, file → the ids it declares,
 * and two rules come out of it.
 *
 * A file missing from `live` is missing on purpose: a file that would not
 * parse, or one this directory does not serve any more, is not evidence that
 * its nodes are gone, so its bucket is left exactly as it was.
 *
 * And GONE MEANS GONE FROM THE SET, not from the file the fold is filed under.
 * That is the whole point of keying by id: `archive` is a MOVE — the record
 * lands in `Archive.jsonl` with its id kept while the file it left goes on
 * being served with the rest of its nodes — and reading "house.jsonl does not
 * declare it any more" as a deletion would forget a fold precisely when the
 * design promises to keep it (a place key could not survive that move at all,
 * which is why it is not the key). So an id its own file no longer declares is
 * looked for in the others, and re-homed when one of them has it. Only an id no
 * live file declares is dropped.
 */
export const pruned = (
  folds: Folds,
  live: ReadonlyMap<string, ReadonlySet<string>>,
): Folds => {
  const next = new Map<string, Set<string>>()
  const keep = (file: string, id: string): void => {
    const ids = next.get(file)
    if (ids === undefined) next.set(file, new Set([id]))
    else ids.add(id)
  }
  for (const [file, ids] of folds) {
    const known = live.get(file)
    if (known === undefined) {
      for (const id of ids) keep(file, id)
      continue
    }
    for (const id of ids) {
      const home = known.has(id) ? file : homeOf(id, live)
      if (home !== undefined) keep(home, id)
    }
  }
  return next
}

/** The live file that declares `id`, or nothing — which is the answer that
 *  makes {@link pruned} drop it. A scan, and it can be: it runs only for an id
 *  its own file has stopped declaring, which is a node somebody moved or
 *  deleted since this browser folded it. */
const homeOf = (
  id: string,
  live: ReadonlyMap<string, ReadonlySet<string>>,
): string | undefined => {
  for (const [file, ids] of live) if (ids.has(id)) return file
  return undefined
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

/**
 * ...and the one above, remembered for as long as the derivation it is of.
 *
 * The walk is over EVERY node in the directory, and a reader shutting a branch
 * shuts several in a row — so a fresh walk per click is the corpus walked once
 * per triangle, on the feature whose whole reason is somebody with a big one. A
 * `Derived` is immutable and minted per published frame (`../outlines.ts`), so
 * its identity is exactly the right key: N folds between two frames pay for one
 * walk, and a frame that arrives drops the old answer with the old set.
 *
 * Weak, so nothing here is what keeps a retired revision of the whole directory
 * alive.
 */
const declared = new WeakMap<Derived, ReadonlyMap<string, ReadonlySet<string>>>()

const declaredIn = (derived: Derived): ReadonlyMap<string, ReadonlySet<string>> => {
  const known = declared.get(derived)
  if (known !== undefined) return known
  const fresh = idsByFile(derived)
  declared.set(derived, fresh)
  return fresh
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

/**
 * Everything either of two readings of this memory holds.
 *
 * What a write starts FROM, and the reason it is not simply what this tab is
 * holding: a fold is a SET of independent facts rather than one value, so two
 * tabs are not making rival picks the way two theme presses are — they are each
 * adding a different fact, and last-write-wins over the whole entry throws one
 * of them away. Tab A folds a tree, tab B folds another one from a map that has
 * not heard about A yet, and A's fold is gone for good.
 *
 * So a write reads the entry back, unions it with what this tab holds, and
 * applies its own change on top — which is why the change goes on LAST and why
 * this is a union rather than a merge with rules: an unfold is a removal, and a
 * removal that ran before the union would be undone by it.
 *
 * A browser that will not give storage back reads as nothing here, and then the
 * union is just what this tab holds — which is `preference.ts`'s standing
 * promise that a preference which cannot be remembered is still a preference
 * for this tab.
 */
export const combined = (stored: Folds, held: Folds): Folds => {
  const out = new Map<string, Set<string>>()
  for (const source of [stored, held]) {
    for (const [file, ids] of source) {
      const into = out.get(file)
      if (into === undefined) out.set(file, new Set(ids))
      else for (const id of ids) into.add(id)
    }
  }
  return out
}

/** The two readings of one memory, minted together so the flat one can never
 *  be a frame behind the grouped one. */
interface Memory {
  readonly byFile: Folds
  readonly ids: ReadonlySet<string>
}

const memoryOf = (byFile: Folds): Memory => {
  // The flat set is LAZY, because not every parse is read flat: `setFolded`'s
  // look at the stored entry wants only the grouped half, and paying `merged`
  // there would be a union built to be thrown away. It still cannot lag the
  // grouped half — a Memory is immutable, so the answer is the same whenever
  // it is first asked for.
  let ids: ReadonlySet<string> | undefined
  return {
    byFile,
    get ids() {
      return (ids ??= merged(byFile))
    },
  }
}

/** The circuit (../preference.ts), with the codec carrying `Memory` rather
 *  than bare `Folds` so the flat set rides wherever a parse goes — the first
 *  read, and a sibling tab's write arriving — and can never lag the grouped
 *  one by a frame. */
const pref = createPreference(FOLDS_KEY, {
  parse: (raw) => memoryOf(parseFolds(raw)),
  print: (memory) => printFolds(memory.byFile),
})

/** The nodes that are folded right now, by id. */
export const collapsedNodes: Accessor<ReadonlySet<string>> = () => pref.value().ids

/**
 * Fold the nodes `given`, or unfold them, and remember which.
 *
 * `live` is the set as this browser currently has it, and it is here rather
 * than on a timer or a load because a write is exactly when the answer is both
 * known and cheap: the reader has just folded something, so the derivation is
 * in hand and the entry is being rewritten anyway. `undefined` — a page that
 * has not loaded a set — prunes nothing, which is the same rule as a file
 * that is not in it.
 *
 * The base is the ENTRY unioned with what this tab holds ({@link combined}),
 * not the held map alone, so a sibling tab's folds are not thrown away by this
 * one's — see there. `stored()` is that entry as it is NOW, and the reason the
 * circuit offers it: this is the one preference whose writes merge instead of
 * replace. The read costs one `getItem` and one parse per fold, over a value
 * bounded by what the reader has actually shut.
 */
export const setFolded = (
  given: ReadonlyArray<Fold>,
  collapsed: boolean,
  live: Derived | undefined,
): void => {
  const next = pruned(
    withFolds(
      combined(pref.stored().byFile, pref.value().byFile),
      given,
      collapsed,
    ),
    live === undefined ? new Map() : declaredIn(live),
  )
  pref.set(memoryOf(next))
}

/** Follow it for as long as this document lives — the same shape as
 *  `followDoneHidden` and `followLayout`, started once from `main.tsx`,
 *  because a preference belongs to the browser and a browser is more than one
 *  tab. A fold made in another tab lands here without a reload. */
export const followFolds = (): void => {
  pref.follow()
}

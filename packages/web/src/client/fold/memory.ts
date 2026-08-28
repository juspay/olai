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
 * question that can only be asked per file — a file this directory has READ can
 * say that one of its nodes is gone, while a file that is broken or not served
 * right now is one nothing can say anything about and whose folds must not be
 * thrown away.
 *
 * WHAT THE SET SAYS IS ASKED, not walked. This module used to take a whole
 * `Derived` and read the id→file map of every record in the directory out of
 * it, per fold; the browser is giving that copy up
 * (`https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/vault-in-browser.md` — it may hold at most the page in
 * front of somebody), so the two facts pruning needs are a question with an
 * answer ({@link Homes}, asked by ./refiling.ts). The RULE did not move: what a
 * home, an absence and an unheard-of file each mean is still spelled once, in
 * {@link pruned}, right here beside the memory they are about.
 *
 * A stored value this app did not write — an older olai, something typed into a
 * console — is not an error to report; it is nothing, and the reader gets the
 * default (everything open), exactly as `parseBool` rules for a stored boolean.
 * The one storage failure that IS worth a word — a browser that will not
 * remember at all — is already said once per key by `writePreference`.
 */

import type { Accessor } from "solid-js"

import type { HomesAnswer, HomesRequest } from "@olai/format"

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
 *  iterate. Since ./refiling.ts it is load-bearing beyond that: a memory
 *  carries its own spelling ({@link Memory.printed}) and that is what "has this
 *  changed" is asked as — one string comparison over a canonical form, rather
 *  than a deep walk of two maps. */
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
 *  union. It can be left behind: a bucket for a file nothing can currently say
 *  anything about is deliberately never pruned ({@link pruned}), so a node that
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
 * WHAT THE SET SAID about each folded id it was asked about: the file it is in
 * NOW, or `null` for one the set has no record of and can say so about.
 *
 * ONE MAP with three states rather than three fields, and the third state is
 * the one worth naming: an id ABSENT from it is one nothing can be concluded
 * about — either nobody asked (the reader folded it while the question was
 * out), or its file is one the set never read and so cannot testify about. It is the shape `chat/declared.ts` reads its own batch through, for
 * the same reason: three answers about one id, told apart without a fourth
 * value.
 *
 * The point of collapsing them here is that {@link pruned} then cannot get the
 * decision wrong. Kept as the answer's own three lists, "absent means gone"
 * would be true only under a precondition about ANOTHER field — a rule every
 * reader has to remember rather than a value it can read.
 */
export type Homes = ReadonlyMap<string, string | null>

/** THE QUESTION, on the wire: the ids to place, and the files whose silence
 *  about them would mean anything. Two flat lists, unpaired — which is the
 *  member's own shape, and why (`@olai/surface`) — and both are readings this
 *  memory already carries rather than a second flattening of it.
 *
 *  Here beside {@link homesOf} rather than in the door that sends it, because
 *  the two are one thing said twice: what goes out decides what the answer can
 *  be read against, and a request built somewhere else is free to stop matching
 *  the reading of its reply. */
export const askingOf = (memory: Memory): HomesRequest => ({
  ids: [...memory.ids],
  files: [...memory.byFile.keys()],
})

/**
 * ...and the answer, read against that question.
 *
 * BOTH HALVES ARE NEEDED and this is the only place that holds them: the set
 * says nothing at all about an id it has no record for, so an answer read alone
 * cannot tell "the set denies this" from "nobody mentioned it" — the memory
 * that was ASKED about is what says which, and a file the set never read is
 * what turns silence about one of its ids back into nothing.
 *
 * It takes the same {@link Memory} {@link askingOf} was given, which is what
 * makes "read the reply against the question" a fact about one value rather
 * than a rule the caller keeps.
 */
export const homesOf = (asked: Memory, answer: HomesAnswer): Homes => {
  const at = new Map(answer.homes.map((home) => [home.id, home.file]))
  const loaded = new Set(answer.loaded)
  const said = new Map<string, string | null>()
  for (const [file, ids] of asked.byFile) {
    for (const id of ids) {
      const home = at.get(id)
      if (home !== undefined) said.set(id, home)
      else if (loaded.has(file)) said.set(id, null)
    }
  }
  return said
}

/**
 * The same memory with the folds of nodes that are no longer there dropped —
 * and the folds of nodes that MOVED filed under where they moved to.
 *
 * Three answers, three outcomes, and the map above is what makes them a
 * lookup rather than a rule.
 *
 * WHERE THE SET SAYS IT IS is where the fold goes, whether that is the file it
 * was already under or another one. GONE MEANS GONE FROM THE SET, not from the
 * file the fold is filed under, and that is the whole point of keying by id:
 * `archive` is a MOVE — the record lands in `_olai/Trash.olai` with its id kept
 * while the file it left goes on being served with the rest of its nodes — and
 * reading "house.olai does not declare it any more" as a deletion would forget
 * a fold precisely when the design promises to keep it (a place key could not
 * survive that move at all, which is why it is not the key).
 *
 * And AN ID THE SET SAID NOTHING ABOUT IS LEFT EXACTLY WHERE IT IS. A file that
 * would not parse, or one this directory does not serve any more, is not
 * evidence that its nodes are gone; neither is a question that never named the
 * id, which is what a fold made while the last one was in flight comes to. An
 * outline somebody EMPTIED is not one of those cases and must not become one —
 * it was read, it holds nothing, and every fold in it is a fold of a node that
 * is gone (`@olai/ops`' `homes` is where that line is drawn).
 */
export const pruned = (folds: Folds, homes: Homes): Folds => {
  const next = new Map<string, Set<string>>()
  for (const [file, ids] of folds) {
    for (const id of ids) {
      const home = homes.get(id)
      if (home === null) continue
      const into = home ?? file
      const own = next.get(into)
      if (own === undefined) next.set(into, new Set([id]))
      else own.add(id)
    }
  }
  return next
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

/** The three readings of one memory, minted together so none of them can be a
 *  frame behind another. */
export interface Memory {
  /** What is remembered, as it is remembered: file → the ids shut in it. */
  readonly byFile: Folds
  /** Every folded id, whichever file it came from — what a ROW is asked
   *  about, and what the QUESTION next door is a list of. */
  readonly ids: ReadonlySet<string>
  /** ...and the canonical spelling of the whole thing, `null` for a browser
   *  holding no folds at all. It is what goes into storage AND what "has this
   *  memory changed" is one comparison of (./refiling.ts) — two readers of one
   *  string rather than two sorts of one map. */
  readonly printed: string | null
}

/** One memory, from what it remembers. Exported for the tests that hand a
 *  {@link Homes} reading a memory of their own — the three readings are the
 *  value, and building one by hand would be a fourth spelling of them. */
export const memoryOf = (byFile: Folds): Memory => {
  // Both derived readings are LAZY, because not every parse is read either way:
  // `setFolded`'s look at the stored entry wants only the grouped half, and
  // paying for the other two there would be answers built to be thrown away.
  // Neither can lag it — a Memory is immutable, so each is the same whenever it
  // is first asked for.
  let ids: ReadonlySet<string> | undefined
  let printed: string | null | undefined
  return {
    byFile,
    get ids() {
      return (ids ??= merged(byFile))
    },
    get printed() {
      // NOT `??=`, and the difference is the empty memory: `null` is a real
      // answer here — "nothing to store at all" — and a coalescing assignment
      // reads it as "not computed yet" and prints again on every access. It is
      // the same overload {@link Homes} refuses one field over; `undefined`
      // means unasked and nothing else.
      if (printed === undefined) printed = printFolds(byFile)
      return printed
    },
  }
}

/** The circuit (../preference.ts), with the codec carrying `Memory` rather
 *  than bare `Folds` so the derived readings ride wherever a parse goes — the
 *  first read, and a sibling tab's write arriving — and can never lag the
 *  grouped one by a frame. The print is the memory's own, so what is written to
 *  storage and what the re-filing compares are one string computed once. */
const pref = createPreference(FOLDS_KEY, {
  parse: (raw) => memoryOf(parseFolds(raw)),
  print: (memory) => memory.printed,
})

/** The nodes that are folded right now, by id. */
export const collapsedNodes: Accessor<ReadonlySet<string>> = () => pref.value().ids

/** ...and the whole memory, which is what the QUESTION is built out of
 *  (./refiling.ts): the ids are what to ask about, the files are what their
 *  absence would mean, and the spelling is whether it has moved since. */
export const folded: Accessor<Memory> = () => pref.value()

/** What a write starts from: the entry as it is now, unioned with what this tab
 *  holds. Its own name because both writers use it — the fold below and the
 *  re-filing beside it — and starting from either half alone is the flattening
 *  {@link combined} exists to forbid. */
const standing = (): Folds => combined(pref.stored().byFile, pref.value().byFile)

/**
 * Fold the nodes `given`, or unfold them, and remember which.
 *
 * IT PRUNES NOTHING, which is what changed: pruning needs the set, the set is
 * not in this browser any more, and a fold that waited for a round trip would
 * be a triangle that lags behind the finger on it. The tidy is a question
 * asked beside the write and applied when it lands (./refiling.ts), so what a
 * reader presses is instant and what the entry HOLDS catches up a moment
 * later — which is the right way round for a chore nothing on screen is
 * waiting for.
 *
 * The base is the ENTRY unioned with what this tab holds ({@link combined}),
 * not the held map alone, so a sibling tab's folds are not thrown away by this
 * one's — see there. `stored()` is that entry as it is NOW, and the reason the
 * circuit offers it: this is the one preference whose writes merge instead of
 * replace. The read costs one `getItem` and one parse per fold, over a value
 * bounded by what the reader has actually shut.
 */
export const setFolded = (given: ReadonlyArray<Fold>, collapsed: boolean): void => {
  pref.set(memoryOf(withFolds(standing(), given, collapsed)))
}

/**
 * ...and the same memory re-filed against what the set just said.
 *
 * Applied to the entry AS IT IS, never to the folds the question was built
 * from: the reader goes on folding while a question is out, and a sibling tab
 * may have written in the meantime. Every id those two added is one {@link
 * pruned} leaves alone, because the set was never asked about it and so said
 * nothing — which is why {@link homesOf} takes the question as well as the
 * answer.
 *
 * NOTHING IS WRITTEN when nothing moved, which is most times it is asked: a
 * `setItem` per answer for a value that came back identical would wake every
 * other tab of this browser through the `storage` event for no news at all.
 * Compared as the entry is SPELLED, which is one canonical string per reading
 * rather than a walk of two maps — and the one the write would use anyway,
 * since a {@link Memory} carries its own and the storage codec reads it.
 */
export const refiled = (homes: Homes): void => {
  const now = standing()
  const next = memoryOf(pruned(now, homes))
  if (next.printed === printFolds(now)) return
  pref.set(next)
}

/** Follow it for as long as this document lives — the same shape as
 *  `followDoneHidden` and `followLayout`, started once from `main.tsx`,
 *  because a preference belongs to the browser and a browser is more than one
 *  tab. A fold made in another tab lands here without a reload. */
export const followFolds = (): void => {
  pref.follow()
}

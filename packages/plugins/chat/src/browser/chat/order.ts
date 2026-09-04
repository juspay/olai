/**
 * The conversation's ORDER, folded from the frames rather than re-sorted per
 * frame.
 *
 * The transcript is served with batched `deltas`, so what reaches this tab is
 * `{upserts, removes}` — the keys that moved, and nothing about the ones that
 * did not. The order a reader sees is a fact about `seq` ({@link ChatEntry}),
 * which is the server's own count and not the order keys arrived in, so
 * SOMETHING has to put the list in it. What used to do that was a memo that
 * read `seq` off every key and sorted the whole transcript again on every
 * frame, and the frames a live turn sends are overwhelmingly the ones that
 * merely GROW a row — an agent's prose accumulating a token at a time, a tool
 * call revising its progress. A thousand-row conversation paid a thousand
 * reads and a sort for each of them.
 *
 * It is a fold now (`@kolu/surface`'s collection `fold` — the same socket the
 * outlines' own fold used, when a tab still held one), and the shape of the
 * saving is
 * the shape of the frame: a frame that changes no key's `seq` and adds no key
 * costs the length of the FRAME, and the list it answers with is the very
 * array it answered with last time.
 *
 * THAT IDENTITY IS THE SECOND HALF, and it is worth as much as the sort:
 * `<For>` diffs its list, and `./Transcript.tsx`'s `previousOf` — the
 * map from each row to the one drawn above it — is a memo over it. A fresh
 * array per frame woke both on every token the agent streamed; the same array
 * wakes neither, which is what that memo's own docstring already claimed and
 * could not have been true while the sort ran per frame.
 *
 * WHAT IT IS NOT is a second copy of the transcript. The accumulator holds the
 * keys and each key's `seq` — never an entry — because a row's VALUE is read
 * through `transcript.byKey` inside the row that draws it, which is what keeps
 * a growing row from replacing its own DOM (`./state.ts`'s header). This fold
 * decides membership and order and says nothing about content.
 */

import type { ChatEntry } from "olai-plugin-chat/wire"
import type { CollectionFold, CollectionFoldOptions } from "@kolu/surface/solid"
import { type Accessor, createMemo } from "solid-js"

import { filedUnder } from "./lanes.ts"

/**
 * The accumulator: the keys in conversation order, and where each of them
 * sits.
 *
 * `keys` is what LEAVES — the array `<For>` is handed — so it is rebuilt
 * rather than written into, and a frame that moves nothing hands back the one
 * it was already holding. `seq` is this fold's own working memory and is
 * MUTATED in place: it is reachable from nowhere else (the framework hands the
 * accumulator back to `step` and to nobody), and copying a map of the whole
 * transcript per frame would be the corpus-wide walk this fold exists to
 * retire, reintroduced one line down from where it was removed.
 */
export interface Ordered {
  readonly keys: ReadonlyArray<string>
  /**
   * ... and the rows that are NOT in it, filed under the agent that made them:
   * each `Agent` frame's key, to that agent's own calls in conversation order.
   *
   * THE SECOND HALF OF ONE ANSWER, here rather than anywhere else, because it
   * is the same walk. A subagent's calls left the column
   * ({@link ./lanes.ts}'s `filedUnder`) and something still has to be able to
   * draw them; what a preview needs is exactly the rows this fold has just
   * decided are not the column's, in exactly the order it has just put them in.
   * Computed a second time — by a memo over `keys`, or by a `.filter()` in the
   * component — it would be the corpus-wide walk this fold exists to retire,
   * reintroduced by the feature that needed it.
   *
   * REBUILT WITH `keys` AND ONLY WITH IT, so the identity guarantee above
   * covers both: a frame that moves nothing hands back the very map it handed
   * back last time, and the preview's own `<For>` sleeps through a turn's
   * tokens exactly as the transcript's does.
   *
   * EMPTY on every conversation that never spawned anything, which is nearly
   * all of them, and on every agent whose feed carries no attribution at all.
   */
  readonly lanes: ReadonlyMap<string, ReadonlyArray<string>>
  readonly seq: Map<string, number>
  /**
   * ... and this fold's second piece of working memory: which `Agent` frame
   * each row is filed under, for the rows that are filed under one.
   *
   * MUTATED IN PLACE beside `seq` and for its reason. It is a SEPARATE map
   * rather than a widened value on that one because the two move on different
   * frames and the cheap test above is `seq` alone: a row's place in the
   * conversation is fixed when it is born, and its attribution can arrive
   * several frames later (`chat/src/transcript.ts` carries `parent` forward
   * across the frames one call arrives on) — so a pair would have to be
   * compared field by field on every upsert of every streaming row.
   */
  readonly under: Map<string, string>
}

/** The list in `seq` order, out of the working map. Ties fall to the order the
 *  keys were first seen, because `sort` is stable over a map's own insertion
 *  order — which is the same tie-break the per-frame sort had, since it sorted
 *  the collection's arrival-ordered key list.
 *
 *  It sorts the ENTRIES and drops the numbers afterwards rather than sorting
 *  the keys and looking each one up again: the iterator materialises the pairs
 *  either way, and a comparator that asks the map costs two lookups per
 *  comparison in the one module whose whole argument is what a frame costs. */
const ordered = (seq: Map<string, number>): ReadonlyArray<string> =>
  [...seq].sort(([, one], [, other]) => one - other).map(([key]) => key)

/** No lanes, minted once — so a conversation that never spawned anything hands
 *  back the same empty map every rebuild, and a reader memoing over it settles.
 *  The array twin of {@link NO_ROWS}, one collection up. */
const NO_LANES: ReadonlyMap<string, ReadonlyArray<string>> = new Map()

/**
 * The two lists, cut out of one pass over the sorted keys.
 *
 * ONE WALK, because they are one decision: a key is the column's or it is an
 * agent's, and asking twice is two answers free to disagree about a row — which
 * renders as a call drawn nowhere at all, or drawn twice.
 *
 * A ROW WHOSE `Agent` FRAME THE PANEL NEVER GOT STAYS IN THE COLUMN, and that
 * is the whole of what `under.get(key)` being present but unknown means here. A
 * lane is reachable through the frame it hangs off — the strip while the agent
 * is out, that row's own door afterwards — so filing a row under a frame that
 * does not exist would be filing it where nothing can open it. Drawn in the
 * column it is what it has always been: a row behind a rail, named *a
 * subagent* ({@link ./lanes.ts}), which is the honest half of the sentence.
 *
 * It answers the ONE map when there are no lanes at all, which is nearly every
 * conversation: the allocation is skipped and so is the settling problem.
 */
const cut = (
  seq: Map<string, number>,
  under: Map<string, string>,
): { keys: ReadonlyArray<string>; lanes: ReadonlyMap<string, ReadonlyArray<string>> } => {
  const all = ordered(seq)
  if (under.size === 0) return { keys: all, lanes: NO_LANES }
  const keys: Array<string> = []
  const lanes = new Map<string, Array<string>>()
  for (const key of all) {
    const parent = under.get(key)
    if (parent === undefined || !seq.has(parent)) {
      keys.push(key)
      continue
    }
    const lane = lanes.get(parent)
    if (lane === undefined) lanes.set(parent, [key])
    else lane.push(key)
  }
  return { keys, lanes }
}

/**
 * The fold: seed from a full-set frame, and step one delta.
 *
 * A MODULE CONSTANT rather than a function called per panel, because it holds
 * nothing — the accumulator is the framework's to keep, one per registration,
 * and two panels open at once (the dock and the mobile sheet are two
 * components) each get their own from the same pair of callbacks.
 *
 * THE STEP REBUILDS THE LISTS ONLY WHEN MEMBERSHIP OR ORDER MOVED, and that
 * distinction is the whole point: a frame naming three keys whose `seq` this
 * fold already knows changes nothing about the order, so the answer is the
 * array that was already right. When it does move, the list is rebuilt whole
 * and sorted — O(rows) on the frames that ADD a row, where the shape it
 * replaced was O(rows·log rows) on every frame there is. A cheaper insertion
 * would still have to copy the array (the one it holds is on screen), so what
 * it would save is the `log` on the rare frame rather than the walk on the
 * common one.
 *
 * WHICH FRAMES COUNT AS MOVING gained a second answer with the lanes, and it is
 * the one that would have been easy to miss: **attribution arrives late.** A
 * subagent's call is announced, drawn, and only then stamped with the `Agent`
 * frame it was made inside — one call reaches this fold on several frames, and
 * the one that says whose it is may be neither the first nor the last. A step
 * that watched `seq` alone would leave that row in the column until something
 * else happened to move the order, which for the last call of a fan-out is
 * never. So a row whose FILING changed is a row that moved.
 *
 * TOTAL OVER A REMOVE IT HAS NEVER SEEN, which the socket requires: the
 * server's tick coalescer resolves an upsert-then-remove inside one producer
 * tick to a bare remove, so a row born and dead within one tick arrives as a
 * remove that was never preceded by an upsert. `Map.delete` answers `false`
 * for it and nothing is rebuilt.
 */
export const TRANSCRIPT_ORDER: CollectionFoldOptions<string, ChatEntry, Ordered> = {
  init: (entries) => {
    const seq = new Map<string, number>()
    const under = new Map<string, string>()
    for (const [key, entry] of entries) {
      seq.set(key, entry.seq)
      const parent = filedUnder(entry)
      if (parent !== null) under.set(key, parent)
    }
    return { ...cut(seq, under), seq, under }
  },
  step: (held, { upserts, removes }) => {
    let moved = false
    for (const key of removes) {
      if (held.seq.delete(key)) moved = true
      // ... and out of the filing with it. A lane that kept a removed key would
      // hand a preview a row nothing can read, and the `<For>` over it would
      // draw a hole — the one thing this fold promises about membership.
      if (held.under.delete(key)) moved = true
    }
    for (const [key, entry] of upserts) {
      if (held.seq.get(key) !== entry.seq) {
        held.seq.set(key, entry.seq)
        moved = true
      }
      // NEVER RETRACTED, which is `filedUnder`'s own rule read through the
      // transcript's: a frame that says nothing about the parent arrives with
      // the field already carried forward, so `null` here means the row is the
      // column's and always was. What is guarded is the frame that ADDS it.
      const parent = filedUnder(entry)
      if (parent !== null && held.under.get(key) !== parent) {
        held.under.set(key, parent)
        moved = true
      }
    }
    return moved ? { ...cut(held.seq, held.under), seq: held.seq, under: held.under } : held
  },
}

/** The empty conversation, minted once: every panel reading a fold that has no
 *  accumulator yet is handed the same array, so the memo below settles rather
 *  than reporting a new empty list per frame. */
const NO_ROWS: ReadonlyArray<string> = []

/**
 * The row keys, in conversation order — the fold registered and read.
 *
 * BOTH HALVES HERE, because they are one claim. The fold's saving is that a
 * frame which moved nothing hands back the very array it handed back last time,
 * and the framework declares a fold's accessor `equals: false` — it cannot know
 * whether a consumer's accumulator is a value — so that sameness has to be
 * COMPARED somewhere or it buys nothing. A memo is where: it compares with
 * `===`, so `<For>` and `./Transcript.tsx`'s `previousOf` re-run when a
 * row arrives or leaves and on none of the frames that merely grow one. Split
 * across two modules, the claim and the thing that cashes it were an unenforced
 * rule; here they are one function.
 *
 * MUST be called under a reactive owner, which is the fold's own requirement:
 * the registration is dropped by that owner's `onCleanup`.
 *
 * `undefined` is the fold's one absent state — no snapshot yet, or a `step`
 * that threw and was contained — and an empty conversation is what it reads as,
 * which is what a panel looked like before the first frame anyway.
 */
/** BOTH LISTS, from ONE registration. Two calls would be two accumulators over
 *  one collection — the same walk done twice, and two answers free to disagree
 *  about which list a row is in. */
export interface Rows {
  /** The conversation's own column: the main agent's rows and the reader's. */
  readonly keys: Accessor<ReadonlyArray<string>>
  /** ... and each agent's own calls, by the key of the frame that sent it. */
  readonly lanes: Accessor<ReadonlyMap<string, ReadonlyArray<string>>>
}

export const createRows = (fold: CollectionFold<string, ChatEntry>): Rows => {
  const order = fold(TRANSCRIPT_ORDER)
  return {
    keys: createMemo(() => order()?.keys ?? NO_ROWS),
    lanes: createMemo(() => order()?.lanes ?? NO_LANES),
  }
}

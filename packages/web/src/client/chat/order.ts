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
 * It is a fold now (`@kolu/surface`'s collection `fold` — the same socket
 * `../outlines.ts` hands the format's patcher), and the shape of the saving is
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

import type { ChatEntry } from "@olai/surface"
import type { CollectionFold, CollectionFoldOptions } from "@kolu/surface/solid"
import { type Accessor, createMemo } from "solid-js"

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
  readonly seq: Map<string, number>
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

/**
 * The fold: seed from a full-set frame, and step one delta.
 *
 * A MODULE CONSTANT rather than a function called per panel, because it holds
 * nothing — the accumulator is the framework's to keep, one per registration,
 * and two panels open at once (the dock and the mobile sheet are two
 * components) each get their own from the same pair of callbacks.
 *
 * THE STEP REBUILDS THE LIST ONLY WHEN MEMBERSHIP OR ORDER MOVED, and that
 * distinction is the whole point: a frame naming three keys whose `seq` this
 * fold already knows changes nothing about the order, so the answer is the
 * array that was already right. When it does move, the list is rebuilt whole
 * and sorted — O(rows) on the frames that ADD a row, where the shape it
 * replaced was O(rows·log rows) on every frame there is. A cheaper insertion
 * would still have to copy the array (the one it holds is on screen), so what
 * it would save is the `log` on the rare frame rather than the walk on the
 * common one.
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
    for (const [key, entry] of entries) seq.set(key, entry.seq)
    return { keys: ordered(seq), seq }
  },
  step: (held, { upserts, removes }) => {
    let moved = false
    for (const key of removes) if (held.seq.delete(key)) moved = true
    for (const [key, entry] of upserts) {
      if (held.seq.get(key) === entry.seq) continue
      held.seq.set(key, entry.seq)
      moved = true
    }
    return moved ? { keys: ordered(held.seq), seq: held.seq } : held
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
export const createRows = (
  fold: CollectionFold<string, ChatEntry>,
): Accessor<ReadonlyArray<string>> => {
  const order = fold(TRANSCRIPT_ORDER)
  return createMemo(() => order()?.keys ?? NO_ROWS)
}

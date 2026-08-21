/**
 * The directory's readings: the one of them that has to HOLD STILL, and how
 * many times a frame walks the key set to produce them.
 *
 * `broken` is a `Map` minted per run over a collection that publishes a frame
 * for every write anywhere in the vault, and what reads it is every `<File>`
 * row of the sidebar (`./Sidebar.tsx`'s `broken.has`). Without an `equals` the
 * identity of that map said "a frame arrived" rather than "the unreadable files
 * changed", which is what the first half of these cases is about
 * (docs/brainstorming/reactivity-after-the-flip.md §4.2).
 *
 * The second half is `perf-faces-broken-walk`: `faces` and `broken` are two
 * readings of ONE key set, taken from the SAME leaf, and they used to be two
 * memos that each walked it — so a directory of a thousand files was two
 * thousand reads per frame for a thousand files' worth of answer. They are one
 * walk now, and the count below is what says so, since both shapes answer
 * identically and only the bill tells them apart.
 *
 * A MEMO TEST rather than a test of the predicate, because the predicate alone
 * would pass with nothing wired to it. The collection is stood up out of two
 * signals — the whole of what `createDirectory` asks for (`HeadEntries`).
 *
 * UNDER THE BROWSER CONDITION, and it has to be: `bun test` resolves SolidJS's
 * SERVER build, where a memo NEVER RE-RUNS — so every case here would pass
 * having asserted that a value nothing recomputed is the value it was. That is
 * the trap `./settled.browsertest.ts`'s header names, and the filename is what
 * keeps the two runs apart.
 */

import { expect, test } from "bun:test"
import { type Accessor, batch, createRoot, createSignal, untrack } from "solid-js"

import type { BrokenFile } from "@olai/format"
import type { Head } from "@olai/surface"

import { createDirectory, type HeadEntries } from "./directory.ts"
import { sameList } from "./same.ts"

/** A head as the wire carries one, with only the fields this module reads. */
const head = (rev: number, broken: BrokenFile | null = null): Head =>
  ({ rev, face: { path: "x", kind: "outline" }, broken } as unknown as Head)

const unreadable = (file: string, message: string): BrokenFile => ({
  file,
  errors: [{ code: "not-json", file, line: 1, message }],
})

/**
 * A live directory over a collection made of two signals: which paths there
 * are, and what each holds. `byKey` hands back an accessor per call, exactly as
 * the framework's does.
 *
 * `put` is a frame — the whole head set as it stands after it — so a case is
 * its two frames and what it says about the answer between them.
 *
 * THE KEY SET IS ITS OWN SIGNAL, and it is quiet on a frame that moved no
 * membership, because that is what the real collection does: kolu writes the
 * order only when a key arrived or left, and "the key set UNCHANGED (a pure
 * value-update tick) → the order signal keeps its array BY REFERENCE and
 * `keys()` stays quiet" is its own comment (`@kolu/surface`'s
 * `solid/useCollection.ts`). A fake that re-minted the key list per frame would
 * report that everything downstream of it must re-run, which is the opposite of
 * the fact this file is here to hold — and a file REWRITTEN is the ordinary
 * frame, so it is the one that has to be modelled honestly.
 *
 * ## The two counters
 *
 * `reads` COUNTS THE LEAVES. Every reading of the directory answers by asking
 * one head what it holds, so one read of an entry accessor IS one step of a
 * walk over the key set — and how many of them a frame costs is how many times
 * the set was walked. No assertion about a VALUE can see that: two walks and
 * one walk answer the same, and the second walk is only a bill.
 *
 * `asks` COUNTS THE KEY SET being taken, which is where the ORDER is computed —
 * `sortByPath` is spent once per ask and nowhere else, so an ask is a sort. It
 * is a second counter rather than a second fake because the two costs come
 * apart exactly where the quietness above puts them: a rewritten file is a
 * frame that must re-walk (a leaf moved) and must NOT re-sort (no key did).
 *
 * Both are `./names.browsertest.ts`'s `copies` idiom — count reads of the
 * accessor a memo is built over, since a memo reads it once per run.
 */
const live = () => {
  const [keys, setKeys] = createSignal<ReadonlyArray<string>>([])
  const [held, setHeld] = createSignal<ReadonlyMap<string, Head>>(new Map())
  let reads = 0
  let asks = 0
  const entries: HeadEntries = {
    keys: () => {
      asks += 1
      return keys()
    },
    byKey: (file: string): Accessor<Head | undefined> | undefined =>
      held().has(file)
        ? () => {
          reads += 1
          return held().get(file)
        }
        : undefined,
  }
  return createRoot((dispose) => {
    const directory = createDirectory(entries, () => ({}))
    return {
      faces: directory.faces,
      broken: directory.broken,
      put: (next: ReadonlyMap<string, Head>) =>
        batch(() => {
          setHeld(next)
          const now = [...next.keys()]
          // The order signal moves only when MEMBERSHIP did — see the header.
          if (!sameList(now, untrack(keys))) setKeys(now)
        }),
      reads: () => reads,
      asks: () => asks,
      stop: dispose,
    }
  })
}

/** The frame every count case starts from: two files, both readings taken —
 *  which is what `./App.tsx` does with a directory once per frame (`opensAt`
 *  and the `ServedProvider` read `faces()`, the sidebar is handed `broken()`). */
const twoFiles = () => {
  const directory = live()
  directory.put(new Map([["house.olai", head(1)], ["garden.olai", head(1)]]))
  directory.faces()
  directory.broken()
  return directory
}

test("a frame that broke nothing leaves the broken map where it was", () => {
  const directory = live()
  directory.put(new Map([["house.olai", head(1)], ["garden.olai", head(1)]]))
  const first = directory.broken()
  // One file rewritten — a new head, a new entry, a new frame — and nothing
  // about it unreadable.
  directory.put(new Map([["house.olai", head(2)], ["garden.olai", head(1)]]))
  expect(directory.broken()).toBe(first)
  directory.stop()
})

test("a file that stops parsing is a new answer", () => {
  const directory = live()
  directory.put(new Map([["house.olai", head(1)]]))
  const first = directory.broken()
  directory.put(new Map([["house.olai", head(2, unreadable("house.olai", "not JSON"))]]))
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect([...now.keys()]).toEqual(["house.olai"])
  directory.stop()
})

test("a file that is still broken for another reason is a new answer", () => {
  // The case a key-set comparison would miss, and it is the pane drawing the
  // errors that would go on showing the previous parse failure.
  const directory = live()
  directory.put(new Map([["house.olai", head(1, unreadable("house.olai", "not JSON"))]]))
  const first = directory.broken()
  directory.put(new Map([["house.olai", head(2, unreadable("house.olai", "no id"))]]))
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect(now.get("house.olai")?.errors[0]?.message).toBe("no id")
  directory.stop()
})

test("a file that parses again is a new answer", () => {
  const directory = live()
  directory.put(new Map([["house.olai", head(1, unreadable("house.olai", "not JSON"))]]))
  const first = directory.broken()
  directory.put(new Map([["house.olai", head(2)]]))
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect(now.size).toBe(0)
  directory.stop()
})

// ── and what ONE FRAME costs, which is the walk ────────────────────────

/**
 * `perf-faces-broken-walk`, pinned by counting.
 *
 * The two readings above are taken from the same leaf of the same key set:
 * `faces` wants each head's face and `broken` wants each head's `broken`, so
 * written as two memos they walked the whole directory twice for one frame's
 * worth of answer — and they invalidate together, since the one thing either
 * depends on is the head set, so there was never a frame where the second walk
 * learned anything the first had not already read.
 *
 * THE CLAIM IS A RATIO, not a total, and the two are worth keeping apart. "The
 * directory is walked once per frame however many readings ask" is what this
 * change is; "and a walk is the whole set" is a fact about the walk that the
 * change deliberately leaves standing (`./directory.ts`'s `walkOf` says what
 * would end it). A case that pinned the total would go red the day the second
 * one stops being true, under a name claiming the opposite — so the frames
 * after the first ask whether the second reading was FREE, which is exactly
 * the sentence above and survives the walk getting cheaper.
 */
test("one frame reads each head once, not once per reading", () => {
  // The TOTAL is fair on a first frame: whatever answers a directory that has
  // never been read has to read every head of it once.
  const directory = twoFiles()
  expect(directory.reads()).toBe(2)
  directory.stop()
})

test("the second reading of a frame is free", () => {
  const directory = twoFiles()
  // One file rewritten — the ordinary frame, and the one the batched `heads`
  // deltas carry.
  directory.put(new Map([["house.olai", head(2)], ["garden.olai", head(1)]]))
  directory.faces()
  const walked = directory.reads()
  directory.broken()
  expect(directory.reads()).toBe(walked)
  directory.stop()
})

test("two readers of the faces are still one walk", () => {
  // `./App.tsx` asks twice per frame, and the answer is held rather than
  // recomputed — which is the whole of what a memo was buying here.
  const directory = twoFiles()
  const faces = directory.faces()
  const once = directory.reads()
  expect(directory.faces()).toBe(faces)
  expect(directory.reads()).toBe(once)
  directory.stop()
})

test("a file rewritten does not put the directory in order again", () => {
  // The order is a fact about the KEYS, and this frame moved none of them. The
  // collection keeps its key set quiet for exactly that reason (the header),
  // so the sort must sit where that quietness reaches it — behind its own
  // memo, not inside the walk, which a moved LEAF wakes.
  const directory = twoFiles()
  const before = directory.asks()
  directory.put(new Map([["house.olai", head(2)], ["garden.olai", head(1)]]))
  directory.faces()
  directory.broken()
  expect(directory.asks()).toBe(before)
  directory.stop()
})

test("...and a file arriving does", () => {
  const directory = twoFiles()
  const before = directory.asks()
  directory.put(
    new Map([["house.olai", head(1)], ["garden.olai", head(1)], ["shed.olai", head(1)]]),
  )
  expect(directory.faces()).toHaveLength(3)
  expect(directory.asks()).toBeGreaterThan(before)
  directory.stop()
})

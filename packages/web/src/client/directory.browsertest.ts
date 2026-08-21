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
import { type Accessor, createRoot, createSignal } from "solid-js"

import type { BrokenFile } from "@olai/format"
import type { Head } from "@olai/surface"

import { createDirectory, type HeadEntries } from "./directory.ts"

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
 * `reads` COUNTS THE LEAVES, and it is the second thing this file measures.
 * Every reading of the directory answers by asking one head what it holds, so
 * one read of an entry accessor IS one step of a walk over the key set — and
 * how many of them a frame costs is how many times the set was walked. No
 * assertion about a VALUE can see that: two walks and one walk answer the same,
 * and the second walk is only a bill.
 *
 * It is `./names.browsertest.ts`'s `copies` idiom — count reads of the accessor
 * a memo is built over, since the memo reads it once per run — asked of the
 * LEAF rather than of the input, because what is being counted here is the walk
 * and not the run.
 */
const live = () => {
  const [held, setHeld] = createSignal<ReadonlyMap<string, Head>>(new Map())
  let reads = 0
  const entries: HeadEntries = {
    keys: () => [...held().keys()],
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
      put: (next: ReadonlyMap<string, Head>) => setHeld(next),
      reads: () => reads,
      stop: dispose,
    }
  })
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
 * WHAT THE APP DOES per frame is what a case here does: `./App.tsx` reads
 * `faces()` (twice — `opensAt` and the `ServedProvider`) and hands `broken()`
 * to the sidebar. So a case puts a frame, reads both, and says how many leaves
 * that took. `n`, for `n` files. Not `2n`.
 */
test("one frame reads each head once, not once per reading", () => {
  const directory = live()
  directory.put(new Map([["house.olai", head(1)], ["garden.olai", head(1)]]))
  directory.faces()
  directory.broken()
  expect(directory.reads()).toBe(2)
  directory.stop()
})

test("a frame naming one file walks the set once, not twice", () => {
  const directory = live()
  directory.put(new Map([["house.olai", head(1)], ["garden.olai", head(1)]]))
  directory.faces()
  directory.broken()
  const before = directory.reads()
  // One file rewritten — the frame the batched `heads` deltas actually deliver.
  directory.put(new Map([["house.olai", head(2)], ["garden.olai", head(1)]]))
  directory.faces()
  directory.broken()
  expect(directory.reads() - before).toBe(2)
  directory.stop()
})

test("two readers of the faces are still one walk", () => {
  // `./App.tsx` asks twice per frame, and the answer is held rather than
  // recomputed — which is the whole of what a memo was buying here.
  const directory = live()
  directory.put(new Map([["house.olai", head(1)], ["garden.olai", head(1)]]))
  const faces = directory.faces()
  const once = directory.reads()
  expect(directory.faces()).toBe(faces)
  expect(directory.reads()).toBe(once)
  directory.stop()
})

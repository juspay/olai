/**
 * The directory's readings: what ONE FRAME costs to produce them, and which of
 * them hold still across a frame that said nothing about them.
 *
 * `heads` is served with batched `deltas`, so what reaches this tab is the
 * files that moved and nothing about the ones that did not — and a write in
 * this vault moves one. The directory used to read that frame by walking the
 * whole key set (`perf-faces-broken-walk` halved the number of walks; it left
 * the walk whole-set), and it is a fold over the frames now
 * (`directory-heads-fold`). Both shapes answer identically, so only the BILL
 * tells them apart, which is what the counter below is for.
 *
 * The other half is identity. `broken` is read by every `<File>` row of the
 * sidebar (`./Sidebar.tsx`'s `broken.has`) and `paths` has a fold of the vault
 * kept against the very array (`./served.tsx`, `./file/matching.ts`); a fresh
 * value per frame said "a frame arrived" where the question was "did the
 * unreadable files / the files change"
 * (docs/brainstorming/reactivity-after-the-flip.md §4.2). Those cases are
 * identity assertions for that reason, not for taste.
 *
 * A MEMO TEST rather than a test of the fold alone, because the accumulator on
 * its own would pass with nothing wired to it — and because two of the four
 * states the directory answers in (`undefined` before a frame, `undefined`
 * after a contained throw) exist only once the fold is registered.
 *
 * UNDER THE BROWSER CONDITION, and it has to be: `bun test` resolves SolidJS's
 * SERVER build, where a memo NEVER RE-RUNS — so every case here would pass
 * having asserted that a value nothing recomputed is the value it was. That is
 * the trap `./settled.browsertest.ts`'s header names, and the filename is what
 * keeps the two runs apart.
 */

import { expect, test } from "bun:test"
import { type Accessor, createRoot, createSignal, untrack } from "solid-js"

import type { BrokenFile } from "@olai/format"
import type { Head, Manifest } from "@olai/surface"
import type { CollectionFoldOptions } from "@kolu/surface/solid"

import { createDirectory, type HeadEntries } from "./directory.ts"

/** A head as the wire carries one, with only the fields this module reads.
 *
 *  `broken` is behind a GETTER, and that is the whole probe: every reading of
 *  the directory answers by asking a head what it holds, so one read of this
 *  field is one step of a walk over the set — and how many of them a frame
 *  costs is the size of the work that frame did. No assertion about a VALUE can
 *  see that: a walk of the whole set and a read of the one file that moved
 *  answer the same, and the difference between them is only a bill. It is
 *  `./names.browsertest.ts`'s `copies` idiom, moved onto the leaf now that the
 *  directory is handed frames rather than taking a key set. */
const heads = () => {
  let reads = 0
  const head = (rev: number, broken: BrokenFile | null = null): Head =>
    ({
      rev,
      face: { path: "x", kind: "outline" },
      get broken() {
        reads += 1
        return broken
      },
    }) as unknown as Head
  return { head, reads: () => reads }
}

const unreadable = (file: string, message: string): BrokenFile => ({
  file,
  errors: [{ code: "not-json", file, line: 1, message }],
})

/**
 * A live directory over a hand-driven frame source — the whole of what
 * `createDirectory` asks for (`HeadEntries`: a `fold` to register and a `byKey`
 * for the one member that watches a single file).
 *
 * THE FAKE FOLD HONOURS THE FRAMEWORK'S CONTRACT, because that contract is half
 * of what is under test (`@kolu/surface`'s `solid/useCollection.ts`):
 *
 *   - `init` is answered from the store's own entries, and every SNAPSHOT
 *     re-seeds every registered fold — a reconnect is indistinguishable from a
 *     first connect, so the accumulator it produces is a fresh one.
 *   - a DELTA is delivered verbatim, and only once there is an accumulator for
 *     it to land on.
 *   - the accessor is `equals: false`: the framework cannot know whether a
 *     consumer's accumulator is a value, so it must never decide that a frame
 *     changed nothing. That is exactly why the memos inside `createDirectory`
 *     have to be the ones cashing the fold's identity, and a fake with a
 *     defaulted `equals` would hide it.
 *   - `invalidate` is the state a THROWING `init`/`step` leaves behind, which
 *     the framework contains and reports loudly: the accumulator goes back to
 *     `undefined` and stays there until the next snapshot re-seeds it. This
 *     fold cannot throw — it walks a frame with `Set` and `Map` — so the state
 *     is reachable here only by naming it, and it is a state the directory has
 *     to have an answer for whether or not this consumer is what produced it.
 *
 * `snapshot` and `delta` are the two frames, so a case is the frames it pushed
 * and what it says about the answer between them.
 */
const live = () => {
  const { head, reads } = heads()
  const store = new Map<string, Head>()
  /** Every registered fold's three moves, as the framework's own `FoldSlot`
   *  reduces one to. */
  interface Slot {
    seed: (entries: [string, Head][]) => void
    step: (upserts: [string, Head][], removes: string[]) => void
    invalidate: () => void
  }
  const slots: Slot[] = []
  const [manifest, setManifest] = createSignal<Manifest | undefined>(undefined)

  const entries: HeadEntries = {
    byKey: (file) => (store.has(file) ? () => store.get(file) : undefined),
    fold: <A,>(options: CollectionFoldOptions<string, Head, A>): Accessor<A | undefined> => {
      const [held, setHeld] = createSignal<A | undefined>(undefined, { equals: false })
      slots.push({
        seed: (all) => setHeld(() => options.init(all)),
        // A delta is a NO-OP while there is no accumulator for it to land on —
        // the framework's rule, and the reason an invalidated fold stays
        // invalidated however many frames arrive before the next snapshot.
        step: (upserts, removes) => {
          const was = untrack(held)
          if (was === undefined) return
          setHeld(() =>
            options.step(was, { kind: "delta", upserts, removes })
          )
        },
        invalidate: () => setHeld(() => undefined),
      })
      return held
    },
  }

  return createRoot((dispose) => {
    const directory = createDirectory(entries, manifest)
    return {
      head,
      reads,
      manifest: directory.manifest,
      paths: directory.paths,
      broken: directory.broken,
      /** A FULL-SET frame: the wire's first, and every reconnect. */
      snapshot: (all: [string, Head][]) => {
        store.clear()
        for (const [file, entry] of all) store.set(file, entry)
        for (const slot of slots) slot.seed([...store])
      },
      /** ONE coalesced delta frame, as the wire speaks one. */
      delta: (
        upserts: [string, Head][] = [],
        removes: string[] = [],
      ) => {
        for (const [file, entry] of upserts) store.set(file, entry)
        for (const file of removes) store.delete(file)
        for (const slot of slots) slot.step(upserts, removes)
      },
      /** What the framework leaves behind when a fold's own callback threw —
       *  see the header. */
      invalidate: () => {
        for (const slot of slots) slot.invalidate()
      },
      loaded: () => setManifest({}),
      never: () => setManifest(null),
      stop: dispose,
    }
  })
}

/** The frame every case starts from: a loaded manifest, two files, both
 *  readings taken — which is what `./App.tsx` does with a directory once per
 *  frame (`opensAt` and the `ServedProvider` read `paths()`, the sidebar is
 *  handed `broken()`). */
const twoFiles = () => {
  const directory = live()
  directory.loaded()
  directory.snapshot([
    ["house.olai", directory.head(1)],
    ["garden.olai", directory.head(1)],
  ])
  directory.paths()
  directory.broken()
  return directory
}

// ── what one frame costs, which is the whole change ─────────────────────

/**
 * `directory-heads-fold`, pinned by counting.
 *
 * `perf-faces-broken-walk` left one walk per frame and said so as a BOUND
 * rather than a total, precisely so that the walk getting cheaper would not go
 * red under a name claiming the opposite. This is that: a frame naming one file
 * of two costs ONE head read, where the bound allowed two and the shape it
 * replaced spent them.
 *
 * A TOTAL rather than a bound now, and the difference is what the fold buys: a
 * frame's cost is a fact about the FRAME and no longer about the directory, so
 * there is a number to state. The two files are two so that "the frame" and
 * "the set" are different sizes at all; the claim is that only the first one is
 * paid for.
 */
test("a frame naming one file reads that file and no other", () => {
  const directory = twoFiles()
  const before = directory.reads()
  directory.delta([["house.olai", directory.head(2)]])
  directory.paths()
  directory.broken()
  expect(directory.reads() - before).toBe(1)
  directory.stop()
})

test("a frame that moved no member hands back the very paths it was holding", () => {
  // The identity half, and it is worth as much as the read count: `served.tsx`
  // holds this list under a membership compare and `file/matching.ts` keeps a
  // fold of the vault against the very array, so a fresh list per frame is a
  // walk of the vault for a frame that said nothing about which files there
  // are.
  const directory = twoFiles()
  const paths = directory.paths()
  directory.delta([["house.olai", directory.head(2)]])
  expect(directory.paths()).toBe(paths)
  directory.stop()
})

test("a file arriving is a new list, in path order", () => {
  // ...and this is the frame that DOES rebuild it. The order is a fact about
  // the paths (`./paths.ts`), so a file that arrives last still lands where its
  // name puts it.
  const directory = twoFiles()
  const paths = directory.paths()
  directory.delta([["attic.olai", directory.head(1)]])
  expect(directory.paths()).not.toBe(paths)
  expect(directory.paths()).toEqual(["attic.olai", "garden.olai", "house.olai"])
  directory.stop()
})

test("a file leaving is a new list without it", () => {
  const directory = twoFiles()
  directory.delta([], ["house.olai"])
  expect(directory.paths()).toEqual(["garden.olai"])
  directory.stop()
})

test("a remove of a file this directory never held changes nothing, and says so by identity", () => {
  // The socket's own requirement: the server's tick coalescer resolves an
  // upsert-then-remove inside one producer tick to a BARE remove, so a file
  // born and dead within one tick reaches a fold as a remove it has no key for.
  const directory = twoFiles()
  const paths = directory.paths()
  const broken = directory.broken()
  directory.delta([], ["never-served.olai"])
  expect(directory.paths()).toBe(paths)
  expect(directory.broken()).toBe(broken)
  directory.stop()
})

test("two readers of the paths are one answer, not two", () => {
  // `./App.tsx` asks twice per frame, and the answer is held rather than
  // recomputed — which is what the memo over the fold is buying.
  const directory = twoFiles()
  const paths = directory.paths()
  const once = directory.reads()
  expect(directory.paths()).toBe(paths)
  expect(directory.reads()).toBe(once)
  directory.stop()
})

test("a reconnect is the same files, and deliberately not the same list", () => {
  // A snapshot RE-SEEDS every registered fold, and `init` has no previous
  // accumulator to hand back — so a link flap mints a fresh list naming the
  // same files. That is the case `./served.tsx`'s membership compare exists
  // for, and the reason it stays there rather than following the walk it used
  // to guard.
  const directory = twoFiles()
  const paths = directory.paths()
  directory.snapshot([
    ["garden.olai", directory.head(1)],
    ["house.olai", directory.head(1)],
  ])
  expect(directory.paths()).not.toBe(paths)
  expect(directory.paths()).toEqual(paths)
  directory.stop()
})

// ── the unreadable files, which hold still for a different reason ───────

test("a frame that broke nothing leaves the broken map where it was", () => {
  const directory = twoFiles()
  const first = directory.broken()
  // One file rewritten — a new head, a new frame — and nothing about it
  // unreadable.
  directory.delta([["house.olai", directory.head(2)]])
  expect(directory.broken()).toBe(first)
  directory.stop()
})

test("a file that stops parsing is a new answer", () => {
  const directory = twoFiles()
  const first = directory.broken()
  directory.delta([[
    "house.olai",
    directory.head(2, unreadable("house.olai", "not JSON")),
  ]])
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect([...now.keys()]).toEqual(["house.olai"])
  directory.stop()
})

test("a file that is still broken for another reason is a new answer", () => {
  // The case a key-set comparison would miss, and it is the pane drawing the
  // errors that would go on showing the previous parse failure.
  const directory = twoFiles()
  directory.delta([[
    "house.olai",
    directory.head(2, unreadable("house.olai", "not JSON")),
  ]])
  const first = directory.broken()
  directory.delta([[
    "house.olai",
    directory.head(3, unreadable("house.olai", "no id")),
  ]])
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect(now.get("house.olai")?.errors[0]?.message).toBe("no id")
  directory.stop()
})

test("a file that parses again is a new answer", () => {
  const directory = twoFiles()
  directory.delta([[
    "house.olai",
    directory.head(2, unreadable("house.olai", "not JSON")),
  ]])
  const first = directory.broken()
  directory.delta([["house.olai", directory.head(3)]])
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect(now.size).toBe(0)
  directory.stop()
})

test("a broken file removed is a new answer without it", () => {
  const directory = twoFiles()
  directory.delta([[
    "house.olai",
    directory.head(2, unreadable("house.olai", "not JSON")),
  ]])
  const first = directory.broken()
  directory.delta([], ["house.olai"])
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect(now.size).toBe(0)
  expect(directory.paths()).toEqual(["garden.olai"])
  directory.stop()
})

// ── and the states, which the manifest is what answers ──────────────────

test("before the first frame there is no set, whatever the manifest says", () => {
  // The state the fold and the cell can disagree about, and the one this change
  // put in the manifest's care: the cell can say a directory loaded on the
  // frame before this tab is holding one, and an empty directory is a real
  // answer that looks exactly the same.
  const directory = live()
  directory.loaded()
  expect(directory.manifest()).toBeUndefined()
  expect(directory.paths()).toEqual([])
  expect(directory.broken().size).toBe(0)
  directory.stop()
})

test("a directory that never loaded says so, and does not wait for a frame", () => {
  // `null` OUTRANKS the fold's silence: no head is coming for a directory that
  // failed to load, so the error report IS the page.
  const directory = live()
  directory.never()
  expect(directory.manifest()).toBeNull()
  directory.stop()
})

test("a set that arrives is a directory", () => {
  const directory = twoFiles()
  expect(directory.manifest()).not.toBeUndefined()
  expect(directory.paths()).toEqual(["garden.olai", "house.olai"])
  directory.stop()
})

test("a fold left holding nothing reads as still reading, not as an empty vault", () => {
  // What the framework leaves behind when a fold's own callback threw: it is
  // contained, reported loudly, and the accumulator is invalidated until the
  // next snapshot re-seeds it. Answering that with an empty directory would
  // blank the sidebar of a vault full of files and give no reader a way to tell.
  const directory = twoFiles()
  directory.invalidate()
  expect(directory.manifest()).toBeUndefined()
  expect(directory.paths()).toEqual([])
  expect(directory.broken().size).toBe(0)
  directory.stop()
})

test("...and the next snapshot is a directory again", () => {
  const directory = twoFiles()
  directory.invalidate()
  directory.snapshot([["shed.olai", directory.head(1)]])
  expect(directory.manifest()).not.toBeUndefined()
  expect(directory.paths()).toEqual(["shed.olai"])
  directory.stop()
})

test("...and the frames in between land on nothing rather than on a hole", () => {
  // The framework's own rule for an invalidated fold, and the reason the state
  // is not self-healing: applying later deltas onto a base that failed to build
  // is how a fold goes silently wrong, so a delta is a no-op until a snapshot
  // has built one again.
  const directory = twoFiles()
  directory.invalidate()
  directory.delta([["attic.olai", directory.head(1)]])
  expect(directory.manifest()).toBeUndefined()
  expect(directory.paths()).toEqual([])
  directory.stop()
})

test("the empty answers are one value each, not a fresh one per read", () => {
  // So that a reader drawn while there is no set settles rather than being told
  // it has a new empty answer every time it asks.
  const directory = live()
  expect(directory.paths()).toBe(directory.paths())
  expect(directory.broken()).toBe(directory.broken())
  directory.stop()
})

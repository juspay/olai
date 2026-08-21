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
 * its own would pass with nothing wired to it — and because the state that made
 * this change hard is not the accumulator's to answer at all: a fold holding
 * NOTHING (before its first frame, and again after a throw the framework
 * contained) is what the manifest absorbs, so only a whole directory can be
 * asked about it.
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
import type { CollectionDelta } from "@kolu/surface/define"

import { createDirectory, type HeadEntries } from "./directory.ts"

const unreadable = (file: string, message: string): BrokenFile => ({
  file,
  errors: [{ code: "not-json", file, line: 1, message }],
})

/**
 * A live directory over a hand-driven frame source — the whole of what
 * `createDirectory` asks for (`HeadEntries`: a `fold` to register, and a
 * `byKey` for the one member that watches a single file).
 *
 * `wrote` MINTS A HEAD as the wire carries one, and its `broken` is behind a
 * GETTER, which is the whole probe: every reading of the directory answers by
 * asking a head what it holds, so one read of that field is one step of a walk
 * over the set — and how many of them a frame costs is the size of the work that
 * frame did. No assertion about a VALUE can see that: a walk of the whole set
 * and a read of the one file that moved answer the same, and the difference
 * between them is only a bill. It is `./names.browsertest.ts`'s `copies` idiom,
 * moved onto the leaf now that the directory is handed frames rather than taking
 * a key set.
 *
 * THE FAKE FOLD HONOURS THE FRAMEWORK'S FRAME LOOP, because that contract is
 * half of what is under test (`@kolu/surface`'s `solid/useCollection.ts`):
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
 *     `undefined` and stays there until the next snapshot re-seeds it. It is a
 *     VERB HERE and a `containThrow` there, because this fold cannot throw — it
 *     walks a frame with a `Set` and a `Map` — so the state is reachable only by
 *     naming it, and it is a state the directory must answer for whether or not
 *     this consumer is what produced it.
 *
 * WHAT IT DOES NOT MODEL is the framework's REGISTRATION-time behaviour — the
 * throw when `fold()` is called with no reactive owner, and the immediate seed a
 * fold registering mid-stream is given. Neither is a fact about this module:
 * `createDirectory` registers once, under the app's own root, before any frame.
 *
 * `snapshot` and `delta` are the two frames, so a case is the frames it pushed
 * and what it says about the answer between them.
 */
const live = () => {
  let reads = 0
  /** A head as the wire carries one, with only the fields this module reads. */
  const wrote = (rev: number, broken: BrokenFile | null = null): Head =>
    ({
      rev,
      face: { path: "x", kind: "outline" },
      get broken() {
        reads += 1
        return broken
      },
    }) as unknown as Head

  /** The client store the framework owns, kept because `byKey` reads it — which
   *  is the whole of what `Directory.head` is. */
  const store = new Map<string, Head>()
  /** Every registered fold's moves. An array because the framework holds a SET
   *  of them; this module registers one. */
  const slots: Array<{
    seed: (entries: [string, Head][]) => void
    step: (frame: CollectionDelta<string, Head>) => void
    invalidate: () => void
  }> = []
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
        step: (frame) => {
          const was = untrack(held)
          if (was === undefined) return
          setHeld(() => options.step(was, frame))
        },
        invalidate: () => setHeld(() => undefined),
      })
      return held
    },
  }

  return createRoot((dispose) => {
    const directory = createDirectory(entries, manifest)
    return {
      wrote,
      reads: () => reads,
      manifest: directory.manifest,
      paths: directory.paths,
      broken: directory.broken,
      head: directory.head,
      /** THE FULL-SET FRAME THE FRAMEWORK WOULD REBUILD — the store's own
       *  entries, which is what a fold is seeded with whichever frame put them
       *  there (`syntheticSnapshot`). It is what a RECONNECT delivers, and that
       *  is not a shortcut: the snapshot arm is VALUE-diffed, so an entry the
       *  wire re-serialized unchanged keeps the object the store already held
       *  and the fresh copy is dropped on the floor. A case that re-minted its
       *  heads would be testing a reconnect in which every file also changed. */
      held: (): [string, Head][] => [...store],
      /** A FULL-SET frame: the wire's first, and every reconnect. */
      snapshot: (all: [string, Head][]) => {
        store.clear()
        for (const [file, entry] of all) store.set(file, entry)
        for (const slot of slots) slot.seed(all)
      },
      /** ONE coalesced delta frame, as the wire speaks one — the framework's own
       *  type, so what this fake hands over is what the wire would. */
      delta: (upserts: [string, Head][] = [], removes: string[] = []) => {
        for (const [file, entry] of upserts) store.set(file, entry)
        for (const file of removes) store.delete(file)
        const frame: CollectionDelta<string, Head> = { kind: "delta", upserts, removes }
        for (const slot of slots) slot.step(frame)
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
type Live = ReturnType<typeof live>

const twoFiles = (): Live => {
  const directory = live()
  directory.loaded()
  directory.snapshot([
    ["house.olai", directory.wrote(1)],
    ["garden.olai", directory.wrote(1)],
  ])
  directory.paths()
  directory.broken()
  return directory
}

/** One file stops parsing, or stops parsing for a new reason — the frame the
 *  broken-map cases are all about, with the revision and the complaint the only
 *  things that vary. */
const broke = (directory: Live, rev: number, message: string) =>
  directory.delta([["house.olai", directory.wrote(rev, unreadable("house.olai", message))]])

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
  directory.delta([["house.olai", directory.wrote(2)]])
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
  directory.delta([["house.olai", directory.wrote(2)]])
  expect(directory.paths()).toBe(paths)
  directory.stop()
})

test("a file arriving is a new list, in path order", () => {
  // ...and this is the frame that DOES rebuild it. The order is a fact about
  // the paths (`./paths.ts`), so a file that arrives last still lands where its
  // name puts it.
  const directory = twoFiles()
  const paths = directory.paths()
  directory.delta([["attic.olai", directory.wrote(1)]])
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
  directory.snapshot(directory.held())
  expect(directory.paths()).not.toBe(paths)
  expect(directory.paths()).toEqual(paths)
  // ...AND THE RE-SORT HAPPENS ONCE, which is the half that makes the trade
  // bounded rather than merely paid. The frame after the flap moves no member,
  // so what it hands back is the list the re-seed minted — not a third one. A
  // fold that re-sorted per frame would satisfy the two lines above and cost
  // the vault on every frame after them.
  const reseeded = directory.paths()
  directory.delta([["house.olai", directory.wrote(2)]])
  expect(directory.paths()).toBe(reseeded)
  directory.stop()
})

test("a reconnect with an unreadable file keeps the map it had", () => {
  // THE DUAL, and the reason `broken` keeps a `sameMap` `equals` where nothing
  // per-frame needs one: `init` starts from nothing, so a re-seed over a
  // directory holding one unreadable file mints a fresh map saying exactly what
  // the old one said. The sidebar's tree is a memo over this value, so without
  // the compare a link flap would rebuild the tree of a directory nothing
  // happened to.
  const directory = twoFiles()
  broke(directory, 2, "not JSON")
  const broken = directory.broken()
  directory.snapshot(directory.held())
  expect(directory.broken()).toBe(broken)
  expect(directory.broken().get("house.olai")?.errors[0]?.message).toBe("not JSON")
  directory.stop()
})

test("...and a reconnect that MENDS one is a new answer all the same", () => {
  // The compare may not swallow the flap that actually said something.
  const directory = twoFiles()
  broke(directory, 2, "not JSON")
  const broken = directory.broken()
  directory.snapshot([
    ["garden.olai", directory.wrote(1)],
    ["house.olai", directory.wrote(3)],
  ])
  expect(directory.broken()).not.toBe(broken)
  expect(directory.broken().size).toBe(0)
  directory.stop()
})

// ── the unreadable files, which hold still for a different reason ───────

test("a frame that broke nothing leaves the broken map where it was", () => {
  const directory = twoFiles()
  const first = directory.broken()
  // One file rewritten — a new head, a new frame — and nothing about it
  // unreadable.
  directory.delta([["house.olai", directory.wrote(2)]])
  expect(directory.broken()).toBe(first)
  directory.stop()
})

test("a file that stops parsing is a new answer", () => {
  const directory = twoFiles()
  const first = directory.broken()
  broke(directory, 2, "not JSON")
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect([...now.keys()]).toEqual(["house.olai"])
  directory.stop()
})

test("a file that is still broken for another reason is a new answer", () => {
  // The case a key-set comparison would miss, and it is the pane drawing the
  // errors that would go on showing the previous parse failure.
  const directory = twoFiles()
  broke(directory, 2, "not JSON")
  const first = directory.broken()
  broke(directory, 3, "no id")
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect(now.get("house.olai")?.errors[0]?.message).toBe("no id")
  directory.stop()
})

test("a file that parses again is a new answer", () => {
  const directory = twoFiles()
  broke(directory, 2, "not JSON")
  const first = directory.broken()
  directory.delta([["house.olai", directory.wrote(3)]])
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect(now.size).toBe(0)
  directory.stop()
})

test("a broken file removed is a new answer without it", () => {
  const directory = twoFiles()
  broke(directory, 2, "not JSON")
  const first = directory.broken()
  directory.delta([], ["house.olai"])
  const now = directory.broken()
  expect(now).not.toBe(first)
  expect(now.size).toBe(0)
  expect(directory.paths()).toEqual(["garden.olai"])
  directory.stop()
})

test("one file's revision moves when that file does, and not when another does", () => {
  // `Directory.head` is the one member that is NOT in the fold, and the line is
  // deliberate: this asks one key what revision it is at, where the fold
  // accumulates the SET. A reader watching one file (`./served.tsx`'s
  // `useHead`, for an `.html` preview) must not be woken by a write three
  // folders away.
  const directory = twoFiles()
  const house = directory.head(() => "house.olai")
  expect(house()).toBe(1)
  directory.delta([["house.olai", directory.wrote(2)]])
  expect(house()).toBe(2)
  directory.delta([["garden.olai", directory.wrote(9)]])
  expect(house()).toBe(2)
  directory.stop()
})

test("a file this directory does not hold is at no revision at all", () => {
  const directory = twoFiles()
  expect(directory.head(() => "nowhere.olai")()).toBeUndefined()
  directory.delta([], ["house.olai"])
  expect(directory.head(() => "house.olai")()).toBeUndefined()
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
  directory.snapshot([["shed.olai", directory.wrote(1)]])
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
  directory.delta([["attic.olai", directory.wrote(1)]])
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

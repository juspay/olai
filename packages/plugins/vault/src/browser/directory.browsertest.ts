/** Under the browser condition, and it has to be: `bun test` resolves SolidJS's
 *  server build, where a memo never re-runs. */

import { expect, test, spyOn } from "bun:test"
import { type Accessor, createRoot, createSignal, untrack } from "solid-js"

import type { FileKindsState } from "../file-surface.ts"
import type { BrokenFile } from "@olai/format"
import type { Head, Manifest } from "../wire.ts"
import type { CollectionFoldOptions } from "@kolu/surface/solid"
import type { CollectionDelta } from "@kolu/surface/define"

import { createDirectory, type HeadEntries } from "./directory.ts"

const unreadable = (file: string, message: string): BrokenFile => ({
  file,
  errors: [{ code: "not-json", file, line: 1, message }],
})

const live = () => {
  let reads = 0
  const wrote = (rev: number, broken: BrokenFile | null = null): Head =>
    ({
      rev,
      face: { path: "x", kind: "outline" },
      get broken() {
        reads += 1
        return broken
      },
    }) as unknown as Head

  const store = new Map<string, Head>()
  const slots: Array<{
    seed: (entries: [string, Head][]) => void
    step: (frame: CollectionDelta<string, Head>) => void
    invalidate: () => void
  }> = []
  const [fileKinds, publishClaims] = createSignal<FileKindsState | null>(null)
  const [manifest, setManifest] = createSignal<Manifest | undefined>(undefined)

  const entries: HeadEntries = {
    byKey: (file) => (store.has(file) ? () => store.get(file) : undefined),
    fold: <A,>(options: CollectionFoldOptions<string, Head, A>): Accessor<A | undefined> => {
      const [held, setHeld] = createSignal<A | undefined>(undefined, { equals: false })
      slots.push({
        seed: (all) => setHeld(() => options.init(all)),
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
    const directory = createDirectory(entries, manifest, fileKinds)
    return {
      wrote,
      publishClaims,
      claims: directory.claims,
      kindOf: directory.kindOf,
      outlineRow: directory.outlineRow,
      reads: () => reads,
      standing: directory.standing,
      paths: directory.paths,
      members: directory.members,
      broken: directory.broken,
      head: directory.head,
      held: (): [string, Head][] => [...store],
      snapshot: (all: [string, Head][]) => {
        store.clear()
        for (const [file, entry] of all) store.set(file, entry)
        for (const slot of slots) slot.seed(all)
      },
      delta: (upserts: [string, Head][] = [], removes: string[] = []) => {
        for (const [file, entry] of upserts) store.set(file, entry)
        for (const file of removes) store.delete(file)
        const frame: CollectionDelta<string, Head> = { kind: "delta", upserts, removes }
        for (const slot of slots) slot.step(frame)
      },
      invalidate: () => {
        for (const slot of slots) slot.invalidate()
      },
      loaded: () => setManifest({}),
      never: () => setManifest(null),
      stop: dispose,
    }
  })
}

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

const broke = (directory: Live, rev: number, message: string) =>
  directory.delta([["house.olai", directory.wrote(rev, unreadable("house.olai", message))]])

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
  const directory = twoFiles()
  const paths = directory.paths()
  directory.delta([["house.olai", directory.wrote(2)]])
  expect(directory.paths()).toBe(paths)
  directory.stop()
})

test("a file arriving is a new list, in path order", () => {
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
  const directory = twoFiles()
  const paths = directory.paths()
  const broken = directory.broken()
  directory.delta([], ["never-served.olai"])
  expect(directory.paths()).toBe(paths)
  expect(directory.broken()).toBe(broken)
  directory.stop()
})

test("two readers of the paths are one answer, not two", () => {
  const directory = twoFiles()
  const paths = directory.paths()
  const once = directory.reads()
  expect(directory.paths()).toBe(paths)
  expect(directory.reads()).toBe(once)
  directory.stop()
})

test("a reconnect is the same files, and deliberately not the same list", () => {
  const directory = twoFiles()
  const paths = directory.paths()
  directory.snapshot(directory.held())
  expect(directory.paths()).not.toBe(paths)
  expect(directory.paths()).toEqual(paths)
  const reseeded = directory.paths()
  directory.delta([["house.olai", directory.wrote(2)]])
  expect(directory.paths()).toBe(reseeded)
  directory.stop()
})

test("a reconnect with an unreadable file keeps the map it had", () => {
  const directory = twoFiles()
  broke(directory, 2, "not JSON")
  const broken = directory.broken()
  directory.snapshot(directory.held())
  expect(directory.broken()).toBe(broken)
  expect(directory.broken().get("house.olai")?.errors[0]?.message).toBe("not JSON")
  directory.stop()
})

test("...and a reconnect that MENDS one is a new answer all the same", () => {
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

test("a frame that broke nothing leaves the broken map where it was", () => {
  const directory = twoFiles()
  const first = directory.broken()
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

test("before the first frame there is no set, whatever the manifest says", () => {
  const directory = live()
  directory.loaded()
  expect(directory.standing()).toBe("reading")
  expect(directory.paths()).toEqual([])
  expect(directory.broken().size).toBe(0)
  directory.stop()
})

test("a directory that never loaded says so, and does not wait for a frame", () => {
  const directory = live()
  directory.never()
  expect(directory.standing()).toBe("never")
  directory.stop()
})

test("a set that arrives is a directory", () => {
  const directory = twoFiles()
  expect(directory.standing()).toBe("loaded")
  expect(directory.paths()).toEqual(["garden.olai", "house.olai"])
  directory.stop()
})

test("a vault with no files in it is a directory too, once the cell has said so", () => {
  const directory = live()
  directory.loaded()
  directory.snapshot([])
  expect(directory.standing()).toBe("loaded")
  expect(directory.paths()).toEqual([])
  directory.stop()
})

test("a fold left holding nothing reads as still reading, not as an empty vault", () => {
  const directory = twoFiles()
  directory.invalidate()
  expect(directory.standing()).toBe("reading")
  expect(directory.paths()).toEqual([])
  expect(directory.broken().size).toBe(0)
  directory.stop()
})

test("...and the next snapshot is a directory again", () => {
  const directory = twoFiles()
  directory.invalidate()
  directory.snapshot([["shed.olai", directory.wrote(1)]])
  expect(directory.standing()).toBe("loaded")
  expect(directory.paths()).toEqual(["shed.olai"])
  directory.stop()
})

test("...and the frames in between land on nothing rather than on a hole", () => {
  const directory = twoFiles()
  directory.invalidate()
  directory.delta([["attic.olai", directory.wrote(1)]])
  expect(directory.standing()).toBe("reading")
  expect(directory.paths()).toEqual([])
  directory.stop()
})

test("the empty answers are one value each, not a fresh one per read", () => {
  const directory = live()
  expect(directory.paths()).toBe(directory.paths())
  expect(directory.broken()).toBe(directory.broken())
  directory.stop()
})

test("a tab holding files is holding a directory, whatever the cell still says", () => {
  const directory = live()
  directory.never()
  directory.snapshot([
    ["house.olai", directory.wrote(1)],
    ["garden.olai", directory.wrote(1)],
  ])
  expect(directory.paths()).toEqual(["garden.olai", "house.olai"])
  expect(directory.standing()).toBe("loaded")
  directory.stop()
})

test("...and a delta is the same proof as a snapshot", () => {
  const directory = live()
  directory.never()
  directory.snapshot([])
  expect(directory.standing()).toBe("never")
  directory.delta([["house.olai", directory.wrote(1)]])
  expect(directory.standing()).toBe("loaded")
  directory.stop()
})

test("...and the error report is not lost, only held until this tab is holding nothing", () => {
  const directory = twoFiles()
  directory.never()
  expect(directory.standing()).toBe("loaded")
  directory.snapshot([])
  expect(directory.standing()).toBe("never")
  directory.stop()
})

test("retiring the wire and republishing claims replaces the directory's kind reading", () => {
  const directory = live()
  const claim = { kind: "first", exts: [".drawing"] as const, holds: "bytes" as const, kept: false, fetched: true, noun: "drawing", article: "a" as const }
  directory.publishClaims({ claims: [claim], outlineRow: "configured" })
  directory.snapshot([["a.drawing", directory.wrote(1)]])
  expect(directory.kindOf("a.drawing")).toBe("first")
  const previous = directory.claims()
  directory.invalidate()
  directory.publishClaims(null)
  expect(directory.kindOf("a.drawing")).toBeNull()
  directory.publishClaims({ claims: [{ ...claim, kind: "returned" }], outlineRow: "next" })
  directory.snapshot([["a.drawing", directory.wrote(2)]])
  expect(directory.paths()).toEqual(["a.drawing"])
  expect(directory.kindOf("a.drawing")).toBe("returned")
  expect(directory.outlineRow()).toBe("next")
  expect(previous.byKind.has("first")).toBe(true)
  expect(previous.byKind.has("returned")).toBe(false)
  directory.stop()
})

test("an overlapping claims frame degrades to empty and a later frame reconnects", () => {
  const directory = live()
  const first = { kind: "first", exts: [".drawing"] as const, holds: "bytes" as const, kept: false, fetched: true, noun: "drawing", article: "a" as const }
  directory.publishClaims({ claims: [first], outlineRow: "configured" })
  expect(directory.kindOf("a.drawing")).toBe("first")
  const logged = spyOn(console, "warn").mockImplementation(() => {})
  try {
    directory.publishClaims({ claims: [first, { ...first, kind: "overlap" }], outlineRow: "configured" })
    expect(directory.claims().byKind.size).toBe(0)
    expect(logged).toHaveBeenCalledTimes(1)
  } finally { logged.mockRestore() }
  expect(directory.claims().byKind.size).toBe(0)
  expect(directory.kindOf("a.drawing")).toBeNull()
  directory.publishClaims({ claims: [first], outlineRow: "configured" })
  expect(directory.kindOf("a.drawing")).toBe("first")
  directory.stop()
})

test("membership snapshots react independently and never mutate older readings", () => {
  const directory = twoFiles()
  const before = directory.members()
  directory.delta([["house.olai", directory.wrote(2)]])
  expect(directory.members()).toBe(before)
  directory.delta([["attic.olai", directory.wrote(3)]])
  expect(directory.members()).not.toBe(before)
  expect(directory.members().has("attic.olai")).toBe(true)
  expect(before.has("attic.olai")).toBe(false)
  const added = directory.members()
  directory.delta([], ["attic.olai"])
  expect(directory.members().has("attic.olai")).toBe(false)
  expect(added.has("attic.olai")).toBe(true)
  directory.stop()
})

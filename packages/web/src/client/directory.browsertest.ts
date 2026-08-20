/**
 * The directory's readings, and the one of them that has to HOLD STILL.
 *
 * `broken` is a `Map` minted per run over a collection that publishes a frame
 * for every write anywhere in the vault, and what reads it is every `<File>`
 * row of the sidebar (`./Sidebar.tsx`'s `broken.has`). Without an `equals` the
 * identity of that map said "a frame arrived" rather than "the unreadable files
 * changed", which is what these cases are about
 * (docs/brainstorming/reactivity-after-the-flip.md §4.2).
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

/** The collection, as two signals: which paths there are, and what each holds.
 *  `byKey` hands back an accessor per call, exactly as the framework's does. */
const heads = () => {
  const [held, setHeld] = createSignal<ReadonlyMap<string, Head>>(new Map())
  const entries: HeadEntries = {
    keys: () => [...held().keys()],
    byKey: (file: string): Accessor<Head | undefined> | undefined =>
      held().has(file) ? () => held().get(file) : undefined,
  }
  return { entries, put: (next: ReadonlyMap<string, Head>) => setHeld(next) }
}

test("a frame that broke nothing leaves the broken map where it was", () => {
  createRoot((dispose) => {
    const { entries, put } = heads()
    put(new Map([["house.olai", head(1)], ["garden.olai", head(1)]]))
    const directory = createDirectory(entries, () => ({}))
    const first = directory.broken()
    // One file rewritten — a new head, a new entry, a new frame — and nothing
    // about it unreadable.
    put(new Map([["house.olai", head(2)], ["garden.olai", head(1)]]))
    expect(directory.broken()).toBe(first)
    dispose()
  })
})

test("a file that stops parsing is a new answer", () => {
  createRoot((dispose) => {
    const { entries, put } = heads()
    put(new Map([["house.olai", head(1)]]))
    const directory = createDirectory(entries, () => ({}))
    const first = directory.broken()
    put(new Map([["house.olai", head(2, unreadable("house.olai", "not JSON"))]]))
    const now = directory.broken()
    expect(now).not.toBe(first)
    expect([...now.keys()]).toEqual(["house.olai"])
    dispose()
  })
})

test("a file that is still broken for another reason is a new answer", () => {
  // The case a key-set comparison would miss, and it is the pane drawing the
  // errors that would go on showing the previous parse failure.
  createRoot((dispose) => {
    const { entries, put } = heads()
    put(new Map([["house.olai", head(1, unreadable("house.olai", "not JSON"))]]))
    const directory = createDirectory(entries, () => ({}))
    const first = directory.broken()
    put(new Map([["house.olai", head(2, unreadable("house.olai", "no id"))]]))
    const now = directory.broken()
    expect(now).not.toBe(first)
    expect(now.get("house.olai")?.errors[0]?.message).toBe("no id")
    dispose()
  })
})

test("a file that parses again is a new answer", () => {
  createRoot((dispose) => {
    const { entries, put } = heads()
    put(new Map([["house.olai", head(1, unreadable("house.olai", "not JSON"))]]))
    const directory = createDirectory(entries, () => ({}))
    const first = directory.broken()
    put(new Map([["house.olai", head(2)]]))
    const now = directory.broken()
    expect(now).not.toBe(first)
    expect(now.size).toBe(0)
    dispose()
  })
})

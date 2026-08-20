/**
 * The names table's one rule: it moves when a NAME moved, and not when a frame
 * did.
 *
 * The defect it is written against is the audit's 2.10
 * (`docs/brainstorming/reactivity-after-the-flip.md`). The store merges every
 * frame with `reconcile(next, { key: null })` and no `merge`, so every element
 * of `reading.names` is a fresh object on every frame — and the table was built
 * by a memo that read them, so it handed out a new closure whenever anything
 * anywhere on the page changed. Its readers are the leaves of a page: every
 * `NodeTitle`'s face memo, every `EdgeRefs` row, every `NodeRefs` key. On a page
 * of a thousand rows, all of them re-ran for a keystroke in one title that named
 * nothing.
 *
 * A FRESH ARRAY OF FRESH OBJECTS is what a frame is spelled as here, rather
 * than a store written through `writeWrappedValue`: what the rule turns on is
 * that nothing off the wire is `===` what came before it, and a plain literal
 * says that without asking this file to hold a second copy of kolu's merge.
 * `packages/web/README.md` names where the merge itself is pinned.
 *
 * `.browsertest.ts` FOR `./settled.browsertest.ts`'s REASON, which that file
 * argues in full: `bun test` resolves SolidJS's SERVER build, where a memo never
 * re-runs — so every case below would pass under it having computed nothing.
 * The second command of the same `just test` leg names this path.
 */

import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import type { Named, PageReading } from "@olai/format"

import { createNames } from "./names.ts"

/** A reading carrying nothing but the field this module reads — fresh objects
 *  every time, which is what a frame off the wire is. */
const frame = (...names: ReadonlyArray<readonly [string, string]>): PageReading =>
  ({
    names: names.map(([id, title]): Named => ({ id, title, file: "house.olai" })),
  }) as unknown as PageReading

const driving = <A>(
  first: PageReading,
  body: (
    write: (next: PageReading) => void,
    table: () => (id: string) => Named | undefined,
  ) => A,
): A =>
  createRoot((dispose) => {
    const [reading, setReading] = createSignal<PageReading>(first)
    const names = createNames(reading)
    try {
      return body((next) => setReading(next), names)
    } finally {
      dispose()
    }
  })

test("an identical frame is not a new table", () =>
  driving(frame(["herbs", "the herb bed"]), (write, table) => {
    const held = table()
    expect(held("herbs")?.title).toBe("the herb bed")
    // The same names, said again — every object of it new, as every frame's is.
    write(frame(["herbs", "the herb bed"]))
    expect(table()).toBe(held)
  }))

test("a title that changed IS a new table", () =>
  driving(frame(["herbs", "the herb bed"]), (write, table) => {
    const held = table()
    write(frame(["herbs", "the herb bed by the gate"]))
    expect(table()).not.toBe(held)
    expect(table()("herbs")?.title).toBe("the herb bed by the gate")
  }))

test("a name arriving or leaving IS a new table", () =>
  driving(frame(["herbs", "the herb bed"]), (write, table) => {
    const one = table()
    write(frame(["herbs", "the herb bed"], ["mint", "split the mint"]))
    const two = table()
    expect(two).not.toBe(one)
    expect(two("mint")?.title).toBe("split the mint")
    write(frame(["herbs", "the herb bed"]))
    const three = table()
    expect(three).not.toBe(two)
    expect(three("mint")).toBeUndefined()
  }))

test("an id the page does not point at is undefined, and stays that way", () =>
  driving(frame(["herbs", "the herb bed"]), (_write, table) => {
    expect(table()("nowhere")).toBeUndefined()
  }))

test("a reading that has not arrived is an empty table, and holds", () =>
  createRoot((dispose) => {
    const [reading, setReading] = createSignal<PageReading | undefined>(undefined)
    const names = createNames(reading)
    const held = names()
    expect(held("herbs")).toBeUndefined()
    // Still nothing, said a second time: a pane waiting for its first answer
    // must not re-run every leaf of the page it is about to draw.
    setReading(undefined)
    expect(names()).toBe(held)
    dispose()
  }))

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

import { writeWrappedValue } from "@kolu/surface/solid"
import { expect, test } from "bun:test"
import { createMemo, createRoot, createSignal } from "solid-js"
import { createStore } from "solid-js/store"

import type { Named, PageReading } from "@olai/format"
import { surface } from "@olai/surface"

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

// ── and what the rule is still WORTH, over the real merge ──────────────

/**
 * The cases above spell a frame as a fresh array of fresh objects, because that
 * is what the RULE is about and it says so without this file holding a second
 * copy of kolu's merge. These ask a different question — whether the rule still
 * EARNS ITS PLACE now that `@olai/surface`'s `page` stream declares what
 * identifies a row (`arrayKey: "key"`, juspay/kolu#2190) — and that one can only
 * be asked of the merge itself, with the key the app actually ships.
 *
 * The declaration moved the ground under this module, and the measurement is
 * why the `equals` STAYS rather than going with the rest of the campaign's
 * stand-ins. `names` carries no `key`, so it merges BY POSITION: a repeated
 * frame writes nothing into it, and neither does a frame in which only a ROW
 * moved. Both of those used to wake the copy and be stopped by the comparison;
 * they no longer wake it at all, and for them the `equals` is now dead weight.
 * What is left is the case position cannot help with — a NAVIGATION, where the
 * subscription blanks and its first frame is a whole new value with nothing to
 * merge into, so every reader wakes whatever the value says. Two pages naming
 * the same ids is the ordinary case (a zoom in, a zoom out, the same outline
 * reached twice), and that is the one the comparison still earns.
 *
 * `copies` counts the copy memo's own runs, by counting reads of the accessor
 * it is built over: `createNames` reads its input inside that memo and nowhere
 * else, so a run and a read are the same event. A zero is the claim — it is not
 * enough to show the table held, because a table can hold because the memo was
 * stopped OR because it never ran, and those are two different facts about
 * whether this file is still paying for anything.
 */
const DECLARED = surface.spec.streams.page.arrayKey

/** A page with a row AND names, so a frame can move one and leave the other
 *  alone — the shape the `page` stream actually carries. */
const reading = (
  title: string,
  ...names: ReadonlyArray<readonly [string, string]>
): PageReading =>
  ({
    shows: {
      kind: "outline",
      file: "house.olai",
      rows: [{
        kind: "node",
        key: "/kitchen",
        at: { file: "house.olai", line: 1, node: { id: "kitchen", ord: "a0", title } },
        shows: { file: "house.olai", line: 1, node: { id: "kitchen", ord: "a0", title } },
        blocked: [],
        under: 0,
        children: [],
      }],
    },
    names: names.map(([id, named]): Named => ({ id, title: named, file: "house.olai" })),
  }) as unknown as PageReading

/** The store one pane holds, written the way the wire writes one — and the
 *  count of how often the copy inside `createNames` had to run at all. */
const merged = () =>
  createRoot((dispose) => {
    const [store, setStore] = createStore<{ v: PageReading | undefined }>({ v: undefined })
    // `./reading.tsx`'s HOLD, spelled here because it is part of what is being
    // measured: a pane does not hand this module the raw subscription, it hands
    // it the last answer kept standing across the next question. Without it the
    // blank between two pages would reach the table as an empty one and the
    // navigation case below would be measuring a beat the app does not have.
    const held = createMemo<PageReading | undefined>((was) => store.v ?? was, undefined)
    let copies = 0
    const table = createNames(() => {
      copies += 1
      return held()
    })
    return {
      write: (next: PageReading) => writeWrappedValue(setStore, next, DECLARED),
      /** What the framework does to a subscription the moment its input moves,
       *  before the new question's first frame. */
      blank: () => setStore("v", undefined),
      table,
      copies: () => copies,
      stop: dispose,
    }
  })

test("a repeated frame does not reach the copy at all any more", () => {
  const store = merged()
  store.write(reading("kitchen remodel", ["herbs", "the herb bed"]))
  const held = store.table()
  expect(held("herbs")?.title).toBe("the herb bed")
  const ran = store.copies()
  store.write(reading("kitchen remodel", ["herbs", "the herb bed"]))
  expect(store.table()).toBe(held)
  expect(store.copies()).toBe(ran)
  store.stop()
})

test("a ROW moving does not reach the copy either — names merge in place", () => {
  const store = merged()
  store.write(reading("kitchen remodel", ["herbs", "the herb bed"]))
  const held = store.table()
  const ran = store.copies()
  store.write(reading("kitchen remodel today", ["herbs", "the herb bed"]))
  expect(store.table()).toBe(held)
  expect(store.copies()).toBe(ran)
  store.stop()
})

test("a NAVIGATION does, and this is what the equals is still for", () => {
  const store = merged()
  store.write(reading("kitchen remodel", ["herbs", "the herb bed"]))
  const held = store.table()
  const ran = store.copies()
  store.blank()
  store.write(reading("the herb bed", ["herbs", "the herb bed"]))
  // The copy DID run — there was nothing for the first frame of a new question
  // to merge into, so the store adopted it whole...
  expect(store.copies()).toBeGreaterThan(ran)
  // ...and the comparison is what keeps every `NodeTitle` face memo and every
  // `EdgeRefs` row on the arriving page from re-running for a table that says
  // exactly what the last one said.
  expect(store.table()).toBe(held)
  store.stop()
})

test("...and a name that actually changed is still a new table across one", () => {
  const store = merged()
  store.write(reading("kitchen remodel", ["herbs", "the herb bed"]))
  const held = store.table()
  store.blank()
  store.write(reading("the herb bed", ["herbs", "the herb bed by the gate"]))
  expect(store.table()).not.toBe(held)
  expect(store.table()("herbs")?.title).toBe("the herb bed by the gate")
  store.stop()
})

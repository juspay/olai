import { expect, test } from "bun:test"
import { createMemo, createRoot, createSignal } from "solid-js"

import type { Named, PageReading } from "@olai/format"
import { surface } from "../surface.ts"

import { named, page, row, wired } from "./frame.testlib.ts"
import { createNames } from "./names.ts"

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
): A => {
  const state = createRoot((dispose) => {
    const [reading, write] = createSignal<PageReading>(first)
    return { dispose, write, table: createNames(reading) }
  })
  try { return body(state.write, state.table) } finally { state.dispose() }
}

test("an identical frame is not a new table", () =>
  driving(frame(["herbs", "the herb bed"]), (write, table) => {
    const held = table()
    expect(held("herbs")?.title).toBe("the herb bed")
    write(frame(["herbs", "the herb bed"]))
    expect(table()).toBe(held)
  }))

test("a title that changed updates the same table", () =>
  driving(frame(["herbs", "the herb bed"]), (write, table) => {
    const held = table()
    write(frame(["herbs", "the herb bed by the gate"]))
    expect(table()).toBe(held)
    expect(table()("herbs")?.title).toBe("the herb bed by the gate")
  }))

test("a name arriving or leaving updates the same table", () =>
  driving(frame(["herbs", "the herb bed"]), (write, table) => {
    const one = table()
    write(frame(["herbs", "the herb bed"], ["mint", "split the mint"]))
    const two = table()
    expect(two).toBe(one)
    expect(two("mint")?.title).toBe("split the mint")
    write(frame(["herbs", "the herb bed"]))
    const three = table()
    expect(three).toBe(two)
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
    setReading(undefined)
    expect(names()).toBe(held)
    dispose()
  }))

const DECLARED = surface.spec.streams.page.arrayKey

const reading = (rowTitle: string, herbTitle: string): PageReading =>
  page([row("/kitchen", "kitchen", rowTitle)], [named("herbs", herbTitle)])

const merged = () =>
  createRoot((dispose) => {
    const store = wired(DECLARED)
    const held = createMemo<PageReading | undefined>((was) => store.reading() ?? was, undefined)
    let copies = 0
    const table = createNames(() => {
      copies += 1
      return held()
    })
    return { ...store, table, copies: () => copies, stop: dispose }
  })

test("a repeated frame does not reach the copy at all any more", () => {
  const store = merged()
  store.write(reading("kitchen remodel", "the herb bed"))
  const table = store.table()
  expect(table("herbs")?.title).toBe("the herb bed")
  const ran = store.copies()
  store.write(reading("kitchen remodel", "the herb bed"))
  expect(store.table()).toBe(table)
  expect(store.copies()).toBe(ran)
  store.stop()
})

test("a ROW moving does not reach the copy either — names merge in place", () => {
  const store = merged()
  store.write(reading("kitchen remodel", "the herb bed"))
  const table = store.table()
  const ran = store.copies()
  store.write(reading("kitchen remodel today", "the herb bed"))
  expect(store.table()).toBe(table)
  expect(store.copies()).toBe(ran)
  store.stop()
})

test("a NAVIGATION does, and this is what the equals is still for", () => {
  const store = merged()
  store.write(reading("kitchen remodel", "the herb bed"))
  const table = store.table()
  const ran = store.copies()
  store.blank()
  store.write(reading("the herb bed", "the herb bed"))
  expect(store.copies()).toBeGreaterThan(ran)
  expect(store.table()).toBe(table)
  store.stop()
})

test("...and a name that actually changed is still a new table across one", () => {
  const store = merged()
  store.write(reading("kitchen remodel", "the herb bed"))
  const table = store.table()
  store.blank()
  store.write(reading("the herb bed", "the herb bed by the gate"))
  expect(store.table()).toBe(table)
  expect(store.table()("herbs")?.title).toBe("the herb bed by the gate")
  store.stop()
})

test("a navigation with the pane AND the chrome looking up builds the table once", () => {
  const store = merged()
  store.write(reading("kitchen remodel", "the herb bed"))
  const pane = store.table
  const chrome = store.table
  expect(chrome()("herbs")?.title).toBe("the herb bed")
  expect(chrome()).toBe(pane())
  const ran = store.copies()
  store.blank()
  store.write(reading("the herb bed", "the herb bed"))
  expect(pane()("herbs")?.title).toBe("the herb bed")
  expect(chrome()("herbs")?.title).toBe("the herb bed")
  expect(store.copies()).toBe(ran + 1)
  expect(chrome()).toBe(pane())
  store.stop()
})

test("renaming one reference leaves other titles' bindings alone", () => {
  const drive = createRoot(dispose => {
    const [reading, write] = createSignal(frame(["herbs", "bed"], ["mint", "mint"]))
    const table = createNames(reading)
    let herbs = 0
    let mint = 0
    const herbTitle = createMemo(() => { herbs++; return table()("herbs")?.title })
    const mintTitle = createMemo(() => { mint++; return table()("mint")?.title })
    return { dispose, write, herbTitle, mintTitle, counts: () => [herbs, mint] }
  })
  try {
    expect(drive.counts()).toEqual([1, 1])
    drive.write(frame(["herbs", "new bed"], ["mint", "mint"]))
    expect(drive.herbTitle()).toBe("new bed")
    expect(drive.mintTitle()).toBe("mint")
    expect(drive.counts()).toEqual([2, 1])
  } finally { drive.dispose() }
})

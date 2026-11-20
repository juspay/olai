import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import type { Licence, PageReading } from "@olai/format"

import { createLicences, type Kind, type Licences } from "./licences.ts"

const frame = (...licences: ReadonlyArray<Licence>): PageReading =>
  ({ licences }) as unknown as PageReading

const pty = (word: string): Licence => ({
  from: "roadmap/lanes.olai",
  prop: "pty",
  value: "c56b6183",
  word,
})

const checkout: Licence = {
  from: "roadmap/lanes.olai",
  prop: "checkout",
  value: ".worktrees/tp",
  word: "worktree",
}

const driving = <A>(
  first: PageReading,
  body: (write: (next: PageReading) => void, table: () => Licences) => A,
): A => {
  const state = createRoot((dispose) => {
    const [reading, write] = createSignal<PageReading>(first)
    return { dispose, write, table: createLicences(reading) }
  })
  try { return body(state.write, state.table) } finally { state.dispose() }
}

const asked = (table: Licences, prop: string, value: string) =>
  table("roadmap/lanes.olai", prop, value)

const word = (said: string) => said as Kind

test("an identical frame is not a new table", () =>
  driving(frame(pty("terminal")), (write, table) => {
    const held = table()
    expect(asked(held, "pty", "c56b6183")).toBe(word("terminal"))
    write(frame(pty("terminal")))
    expect(table()).toBe(held)
  }))

test("a WORD that changed updates the same table", () =>
  driving(frame(pty("terminal")), (write, table) => {
    const held = table()
    write(frame(pty("worktree")))
    expect(table()).toBe(held)
    expect(asked(table(), "pty", "c56b6183")).toBe(word("worktree"))
  }))

test("a licence arriving or leaving updates the same table", () =>
  driving(frame(pty("terminal")), (write, table) => {
    const one = table()
    write(frame(pty("terminal"), checkout))
    const two = table()
    expect(two).toBe(one)
    expect(asked(two, "checkout", ".worktrees/tp")).toBe(word("worktree"))
    write(frame(pty("terminal")))
    const three = table()
    expect(three).toBe(two)
    expect(asked(three, "checkout", ".worktrees/tp")).toBeUndefined()
  }))

test("a value the page says nothing about is undefined — which is what keeps it a plain chip", () =>
  driving(frame(pty("terminal")), (_write, table) => {
    expect(asked(table(), "terminal", "c56b6183")).toBeUndefined()
    expect(asked(table(), "pty", "somethingelse")).toBeUndefined()
    expect(table()("board.olai", "pty", "c56b6183")).toBeUndefined()
  }))

test("a reading that has not arrived is an empty table, and holds", () =>
  createRoot((dispose) => {
    const [reading, setReading] = createSignal<PageReading | undefined>(undefined)
    const licences = createLicences(reading)
    const held = licences()
    expect(asked(held, "pty", "c56b6183")).toBeUndefined()
    setReading(undefined)
    expect(licences()).toBe(held)
    dispose()
  }))

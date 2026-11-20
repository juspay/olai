import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import type { Door, PageReading } from "@olai/format"

import { createDoors, type Doors } from "./doors.ts"

const frame = (...doors: ReadonlyArray<Door>): PageReading =>
  ({ doors }) as unknown as PageReading

const brief = (file: string): Door => ({
  from: "roadmap/features.olai",
  prop: "brief",
  value: "briefs/tp.md",
  opens: { kind: "document", file },
})

const agent = (titled: boolean): Door => ({
  from: "roadmap/features.olai",
  prop: "agent",
  value: "grok",
  opens: { kind: "node", id: "grok", titled },
})

const driving = <A>(
  first: PageReading,
  body: (write: (next: PageReading) => void, table: () => Doors) => A,
): A => {
  const state = createRoot((dispose) => {
    const [reading, write] = createSignal<PageReading>(first)
    return { dispose, write, table: createDoors(reading) }
  })
  try { return body(state.write, state.table) } finally { state.dispose() }
}

const asked = (table: Doors, prop: string, value: string) =>
  table("roadmap/features.olai", prop, value)

test("an identical frame is not a new table", () =>
  driving(frame(brief("briefs/tp.md")), (write, table) => {
    const held = table()
    expect(asked(held, "brief", "briefs/tp.md"))
      .toEqual({ kind: "document", file: "briefs/tp.md" })
    write(frame(brief("briefs/tp.md")))
    expect(table()).toBe(held)
  }))

test("an answer that changed updates the same table", () =>
  driving(frame(brief("briefs/tp.md")), (write, table) => {
    const held = table()
    write(frame(brief("briefs/renamed.md")))
    expect(table()).toBe(held)
    expect(asked(table(), "brief", "briefs/tp.md"))
      .toEqual({ kind: "document", file: "briefs/renamed.md" })
  }))

test("...and so does a face that changed, with the value standing still", () =>
  driving(frame(agent(false)), (write, table) => {
    const held = table()
    write(frame(agent(true)))
    expect(table()).toBe(held)
    expect(asked(table(), "agent", "grok"))
      .toEqual({ kind: "node", id: "grok", titled: true })
  }))

test("a door arriving or leaving updates the same table", () =>
  driving(frame(brief("briefs/tp.md")), (write, table) => {
    const one = table()
    write(frame(brief("briefs/tp.md"), agent(true)))
    const two = table()
    expect(two).toBe(one)
    expect(asked(two, "agent", "grok")).toEqual({ kind: "node", id: "grok", titled: true })
    write(frame(brief("briefs/tp.md")))
    const three = table()
    expect(three).toBe(two)
    expect(asked(three, "agent", "grok")).toBeUndefined()
  }))

test("a value the page says nothing about is undefined — which is what keeps it text", () =>
  driving(frame(brief("briefs/tp.md")), (_write, table) => {
    expect(asked(table(), "worktree", ".worktrees/tp")).toBeUndefined()
    expect(table()("board.olai", "brief", "briefs/tp.md")).toBeUndefined()
  }))

test("a reading that has not arrived is an empty table, and holds", () =>
  createRoot((dispose) => {
    const [reading, setReading] = createSignal<PageReading | undefined>(undefined)
    const doors = createDoors(reading)
    const held = doors()
    expect(asked(held, "brief", "briefs/tp.md")).toBeUndefined()
    setReading(undefined)
    expect(doors()).toBe(held)
    dispose()
  }))

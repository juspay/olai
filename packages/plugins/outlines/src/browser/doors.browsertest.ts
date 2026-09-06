/**
 * The doors table's one rule, which is `./names.browsertest.ts`'s one question
 * over: it moves when an ANSWER moved, and not when a frame did.
 *
 * The defect it is written against is the same one, and the argument for the
 * comparison is `./doors.ts`'s: a NAVIGATION blanks the subscription, so the
 * arriving page's first frame has nothing to merge into and the store adopts it
 * whole — every reader wakes, whatever the value says. Two pages drawing the
 * same lane board is the ordinary case, and every chip of the arriving page
 * would otherwise re-run for a table saying exactly what the last one said.
 *
 * A FRESH ARRAY OF FRESH OBJECTS is what a frame is spelled as here, for the
 * reason the names suite spells one that way: what the rule turns on is that
 * nothing off the wire is `===` what came before it, and a plain literal says
 * so without this file holding a second copy of kolu's merge.
 *
 * `.browsertest.ts` FOR `./settled.browsertest.ts`'s REASON: `bun test` resolves
 * SolidJS's SERVER build, where a memo never re-runs — so every case below would
 * pass under it having computed nothing. The second command of the same
 * `just test` leg names this path.
 */

import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import type { Door, PageReading } from "@olai/format"

import { createDoors, type Doors } from "./doors.ts"

/** A reading carrying nothing but the field this module reads. The cast is what
 *  says so: there is no `shows` here at all, because the rule these cases are
 *  about is a rule about the doors table and nothing else. */
const frame = (...doors: ReadonlyArray<Door>): PageReading =>
  ({ doors }) as unknown as PageReading

/** One answer, spelled fresh each call — a `brief` on a board row opening the
 *  document it names, which is the value the whole feature was built for. */
const brief = (file: string): Door => ({
  from: "roadmap/features.olai",
  prop: "brief",
  value: "briefs/tp.md",
  opens: { kind: "document", file },
})

/** ...and a ref answer beside it, whose `titled` is the one field of an answer
 *  that can move without the value moving: a key re-declared from `text` to
 *  `ref` changes what every chip of it DRAWS. */
const agent = (titled: boolean): Door => ({
  from: "roadmap/features.olai",
  prop: "agent",
  value: "grok",
  opens: { kind: "node", id: "grok", titled },
})

const driving = <A>(
  first: PageReading,
  body: (write: (next: PageReading) => void, table: () => Doors) => A,
): A =>
  createRoot((dispose) => {
    const [reading, setReading] = createSignal<PageReading>(first)
    const doors = createDoors(reading)
    try {
      return body((next) => setReading(next), doors)
    } finally {
      dispose()
    }
  })

const asked = (table: Doors, prop: string, value: string) =>
  table("roadmap/features.olai", prop, value)

test("an identical frame is not a new table", () =>
  driving(frame(brief("briefs/tp.md")), (write, table) => {
    const held = table()
    expect(asked(held, "brief", "briefs/tp.md"))
      .toEqual({ kind: "document", file: "briefs/tp.md" })
    // The same answers, said again — every object of it new, as every frame's is.
    write(frame(brief("briefs/tp.md")))
    expect(table()).toBe(held)
  }))

test("an answer that changed IS a new table", () =>
  driving(frame(brief("briefs/tp.md")), (write, table) => {
    const held = table()
    write(frame(brief("briefs/renamed.md")))
    expect(table()).not.toBe(held)
    expect(asked(table(), "brief", "briefs/tp.md"))
      .toEqual({ kind: "document", file: "briefs/renamed.md" })
  }))

test("...and so does a face that changed, with the value standing still", () =>
  // The case a comparison over the triple alone would miss: nothing about
  // WHICH value this is has moved, and what the chip draws has.
  driving(frame(agent(false)), (write, table) => {
    const held = table()
    write(frame(agent(true)))
    expect(table()).not.toBe(held)
    expect(asked(table(), "agent", "grok"))
      .toEqual({ kind: "node", id: "grok", titled: true })
  }))

test("a door arriving or leaving IS a new table", () =>
  driving(frame(brief("briefs/tp.md")), (write, table) => {
    const one = table()
    write(frame(brief("briefs/tp.md"), agent(true)))
    const two = table()
    expect(two).not.toBe(one)
    expect(asked(two, "agent", "grok")).toEqual({ kind: "node", id: "grok", titled: true })
    write(frame(brief("briefs/tp.md")))
    const three = table()
    expect(three).not.toBe(two)
    expect(asked(three, "agent", "grok")).toBeUndefined()
  }))

test("a value the page says nothing about is undefined — which is what keeps it text", () =>
  driving(frame(brief("briefs/tp.md")), (_write, table) => {
    expect(asked(table(), "worktree", ".worktrees/tp")).toBeUndefined()
    // The same words under the same key, written in ANOTHER file, are another
    // question — which is the whole reason the lookup is a triple.
    expect(table()("board.olai", "brief", "briefs/tp.md")).toBeUndefined()
  }))

test("a reading that has not arrived is an empty table, and holds", () =>
  createRoot((dispose) => {
    const [reading, setReading] = createSignal<PageReading | undefined>(undefined)
    const doors = createDoors(reading)
    const held = doors()
    expect(asked(held, "brief", "briefs/tp.md")).toBeUndefined()
    // Still nothing, said a second time: a pane waiting for its first answer
    // must not re-run every chip of the page it is about to draw.
    setReading(undefined)
    expect(doors()).toBe(held)
    dispose()
  }))

/**
 * The licences table's one rule, which is `./doors.browsertest.ts`'s exactly:
 * it moves when an ANSWER moved, and not when a frame did.
 *
 * The defect it is written against is the same one, and the argument for the
 * comparison is `./licences.ts`'s: a NAVIGATION blanks the subscription, so the
 * arriving page's first frame has nothing to merge into and the store adopts it
 * whole — every reader wakes, whatever the value says. Two pages drawing the
 * same lane board is the ordinary case, and every dressed property of the
 * arriving page would otherwise re-run for a table saying exactly what the last
 * one said. A dressed property is the expensive kind: what re-runs is a
 * terminal door's whole subscription, not a chip's text.
 *
 * A FRESH ARRAY OF FRESH OBJECTS is what a frame is spelled as here, for the
 * reason its two siblings spell one that way: what the rule turns on is that
 * nothing off the wire is `===` what came before it.
 *
 * `.browsertest.ts` FOR `./settled.browsertest.ts`'s REASON: `bun test` resolves
 * SolidJS's SERVER build, where a memo never re-runs — so every case below would
 * pass under it having computed nothing. The second command of the same
 * `just test` leg names this path.
 */

import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"

import type { Licence, PageReading } from "@olai/format"

import { createLicences, type Licences } from "./licences.ts"

/** A reading carrying nothing but the field this module reads. The cast is what
 *  says so: there is no `shows` here at all, because the rule these cases are
 *  about is a rule about the licences table and nothing else. */
const frame = (...licences: ReadonlyArray<Licence>): PageReading =>
  ({ licences }) as unknown as PageReading

/** One answer, spelled fresh each call — and the KEY is not the word, which is
 *  the whole case the old shape could not draw: the vault declared a column it
 *  calls `pty` to be the kind `terminal`. */
const pty = (word: string): Licence => ({
  from: "roadmap/lanes.org",
  prop: "pty",
  value: "c56b6183",
  word,
})

/** ...and one for a second key, so the arriving-and-leaving case has something
 *  to arrive. */
const checkout: Licence = {
  from: "roadmap/lanes.org",
  prop: "checkout",
  value: ".worktrees/tp",
  word: "worktree",
}

const driving = <A>(
  first: PageReading,
  body: (write: (next: PageReading) => void, table: () => Licences) => A,
): A =>
  createRoot((dispose) => {
    const [reading, setReading] = createSignal<PageReading>(first)
    const licences = createLicences(reading)
    try {
      return body((next) => setReading(next), licences)
    } finally {
      dispose()
    }
  })

const asked = (table: Licences, prop: string, value: string) =>
  table("roadmap/lanes.org", prop, value)

test("an identical frame is not a new table", () =>
  driving(frame(pty("terminal")), (write, table) => {
    const held = table()
    expect(asked(held, "pty", "c56b6183")).toBe("terminal")
    // The same answers, said again — every object of it new, as every frame's is.
    write(frame(pty("terminal")))
    expect(table()).toBe(held)
  }))

test("a WORD that changed IS a new table", () =>
  // A vault re-declaring a key from one plugin's kind to another's: the value
  // stands still and the face it wears is a different plugin's.
  driving(frame(pty("terminal")), (write, table) => {
    const held = table()
    write(frame(pty("worktree")))
    expect(table()).not.toBe(held)
    expect(asked(table(), "pty", "c56b6183")).toBe("worktree")
  }))

test("a licence arriving or leaving IS a new table", () =>
  // LEAVING is the one that matters most here and is not symmetric with the
  // doors table's: a licence withdrawn is a live face coming OFF the page —
  // the vault stopped declaring the key, or the serve stopped running the
  // plugin — and a reader who kept the old table would keep drawing it.
  driving(frame(pty("terminal")), (write, table) => {
    const one = table()
    write(frame(pty("terminal"), checkout))
    const two = table()
    expect(two).not.toBe(one)
    expect(asked(two, "checkout", ".worktrees/tp")).toBe("worktree")
    write(frame(pty("terminal")))
    const three = table()
    expect(three).not.toBe(two)
    expect(asked(three, "checkout", ".worktrees/tp")).toBeUndefined()
  }))

test("a value the page says nothing about is undefined — which is what keeps it a plain chip", () =>
  driving(frame(pty("terminal")), (_write, table) => {
    // A KEY SPELLED AS THE KIND claims nothing, which is the behaviour change
    // this whole table exists to make true: the vault declared `pty`, not
    // `terminal`, so a property somebody happened to call `terminal` is text.
    expect(asked(table(), "terminal", "c56b6183")).toBeUndefined()
    // ...and the same key with another value is another question, since the
    // answer is per drawn VALUE and not per key.
    expect(asked(table(), "pty", "somethingelse")).toBeUndefined()
    // The same words under the same key, written in ANOTHER file, are another
    // question too — which is the whole reason the lookup is a triple.
    expect(table()("board.org", "pty", "c56b6183")).toBeUndefined()
  }))

test("a reading that has not arrived is an empty table, and holds", () =>
  createRoot((dispose) => {
    const [reading, setReading] = createSignal<PageReading | undefined>(undefined)
    const licences = createLicences(reading)
    const held = licences()
    expect(asked(held, "pty", "c56b6183")).toBeUndefined()
    // Still nothing, said a second time: a pane waiting for its first answer
    // must not re-run every face of the page it is about to draw.
    setReading(undefined)
    expect(licences()).toBe(held)
    dispose()
  }))

/**
 * THE DOOR THE JOURNAL OFFERS, benched as a function of the reading it is
 * handed — which is the whole of its contract.
 *
 * Everything about the ANSWER is `@olai/format`'s and is pinned there
 * (`agenda.test.ts`, `dates.test.ts`); what is this file's is the three things
 * the door itself decides: that it is about the snapshot it was GIVEN, that a
 * date which is not a day is refused in words, and that a value which is not a
 * reading is refused in words rather than dying inside somebody else's fiber.
 */

import type { OutlineSet, Reading } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { Effect } from "effect"
import { describe, expect, test } from "bun:test"

import { answerFor, door, KEY, readingIn, WORD } from "./agenda.ts"

const SET = (): OutlineSet =>
  setOf({
    "work.olai": [
      `{"id":"permit","ord":"a0","title":"file the permit","todo":true,"date":"2026-08-03"}`,
      `{"id":"posts","ord":"a1","title":"dig the post holes","doing":true,"date":"2026-08-09"}`,
      `{"id":"slab","ord":"a2","title":"pour the slab","todo":true,"date":"2026-09-02"}`,
    ].join("\n"),
    "life.olai": [
      `{"id":"mum","ord":"a0","title":"mum's birthday","date":"2026-08-09"}`,
    ].join("\n"),
  })

const reading = (): Reading => readingOf(SET())

/** The answer, or the refusal thrown — the shape a consumer that expects one
 *  reads it in. */
const read = (at: unknown, date: string) => Effect.runSync(door.read({ at, date }))

/** ...and the refusal as a VALUE, for the two asks that are about being
 *  refused. */
const refused = (at: unknown, date: string) =>
  Effect.runSync(Effect.result(door.read({ at, date })))

/** The titles one run of day groups draws, flattened — what a consumer would
 *  put in a sentence, and enough to say WHICH rows came back. */
const titles = (
  groups: ReadonlyArray<
    { readonly nodes: ReadonlyArray<{ readonly shows: { readonly node: { readonly title: string } } }> }
  >,
): ReadonlyArray<string> => groups.flatMap((group) => group.nodes.map((one) => one.shows.node.title))

describe("journal.agenda", () => {
  test("the key is the fiber's own word composed with the local one", () => {
    // The composition is the RUNTIME's (`Offers.own`); this holds the two
    // halves the doc and the fixture spell, so a rename of either is red here
    // rather than a consumer waiting for ever on a key nobody offers.
    expect(KEY).toBe(`journal.${WORD}`)
  })

  test("the day's own rows come back situated, occurrences included", () => {
    const answer = read(reading(), "2026-08-09")
    expect(answer.date).toBe("2026-08-09")
    // A birthday is on the DAY and is nobody's owed work, which is the
    // difference between the two halves of this answer.
    expect([...titles(answer.dated)].sort()).toEqual(["dig the post holes", "mum's birthday"])
    expect(answer.dated.map((group) => group.file).sort()).toEqual(["life.olai", "work.olai"])
  })

  test("...and what is owed as of that day, on the same reading", () => {
    const answer = read(reading(), "2026-08-09")
    expect(answer.agenda.overdue.map((day) => day.date)).toEqual(["2026-08-03"])
    expect(titles(answer.agenda.overdue.flatMap((day) => day.groups)))
      .toEqual(["file the permit"])
    expect(titles(answer.agenda.today)).toEqual(["dig the post holes"])
    expect(answer.agenda.upcoming.map((day) => day.date)).toEqual(["2026-09-02"])
  })

  test("the answer is about the reading handed in, not one the journal chose", () => {
    // The same door, two snapshots, one call apart: the second knows about
    // nodes the first has never seen. A door that read the vault for itself
    // could not tell these two asks apart.
    const empty = readingOf(setOf({ "work.olai": "" }))
    expect(titles(read(empty, "2026-08-09").dated)).toEqual([])
    expect(titles(read(reading(), "2026-08-09").dated)).toHaveLength(2)
  })

  test("a date that is not a day is refused in words that quote it", () => {
    const answer = refused(reading(), "2026-08")
    expect(answer._tag).toBe("Failure")
    expect(answer._tag === "Failure" ? answer.failure.reason : "")
      .toContain("`2026-08` is not a day")
  })

  test("a value that is not a reading is refused rather than guessed at", () => {
    for (const wrong of [null, undefined, "a reading", 7, {}, { derived: null }]) {
      const answer = refused(wrong, "2026-08-09")
      expect(answer._tag).toBe("Failure")
      expect(answer._tag === "Failure" ? answer.failure.reason : "")
        .toContain("is not a vault reading")
    }
  })

  test("the narrowing is a claim about `derived`, and says so", () => {
    expect(readingIn(reading())).not.toBeNull()
    expect(readingIn({ derived: {} })).not.toBeNull()
    expect(readingIn({ set: {} })).toBeNull()
  })

  test("the builder and the door agree, so a bench may spend either", () => {
    const at = reading()
    expect(answerFor(at, "2026-08-09")).toEqual(read(at, "2026-08-09"))
  })
})

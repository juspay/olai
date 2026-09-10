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

import { type AgendaGroup, answerFor, door, KEY, readingIn, WORD } from "./agenda.ts"
import { name } from "./wire.ts"

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

/** The titles one run of groups draws, flattened — what a consumer would put in
 *  a sentence, and enough to say WHICH rows came back. */
const titles = (groups: ReadonlyArray<AgendaGroup>): ReadonlyArray<string> =>
  groups.flatMap((group) => group.nodes.map((one) => one.title))

describe("journal.agenda", () => {
  /**
   * THE KEY, HELD AGAINST THE LITERAL FOUR OTHER FILES SPELL — the doc's
   * example, the fixture's copy of it, `@olai/server`'s `worked.test.ts`, and
   * this plugin's own page.
   *
   * IT WAS A TAUTOLOGY: `expect(KEY).toBe(`journal.${WORD}`)` over a `KEY` that
   * was itself the literal `"journal.agenda"`, which is one hardcoded `journal`
   * compared to another and can only fail if somebody edits one of them alone.
   * `KEY` is composed from `name` now, so this asserts the whole chain the
   * runtime walks: the row's `id` is the fiber's name (`@olai/bundle` proves a
   * plugin answers to the id its row is bound under), `Offers.own` stamps the
   * key from that name, and the string below is what a consumer must write.
   */
  test("the key is the plugin's own name composed with the local word", () => {
    expect(KEY).toBe("journal.agenda")
    expect(KEY).toBe(`${name}.${WORD}`)
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

  /**
   * THE ROW IS THIS DOOR'S OWN SHAPE, field by field.
   *
   * The one assertion in this file that is about the BOUNDARY rather than about
   * the reading: the answer used to hand out `@olai/format`'s `DayGroup`, whose
   * rows carry an ancestry trail, blockers, a rollup and a line number and whose
   * shape has moved for the journal's own pages. What a consumer that cannot be
   * recompiled gets is these four fields, so they are named here — and a fifth
   * appearing is a deliberate widening rather than the floor leaking through.
   */
  test("a row is four fields, and the mark is `null` on an occurrence", () => {
    const [group] = read(reading(), "2026-08-09").dated
      .filter((one) => one.file === "life.olai")
    const [birthday] = group?.nodes ?? []
    expect(birthday).toEqual({
      id: "mum",
      title: "mum's birthday",
      date: "2026-08-09",
      status: null,
    })
    const [work] = read(reading(), "2026-08-09").agenda.today
      .flatMap((one) => one.nodes)
    expect(work?.status).toBe("doing")
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

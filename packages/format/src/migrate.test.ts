/**
 * The migration, and the one property that matters about it: every mark, every
 * instant, every date and every edge means afterwards exactly what it meant
 * before.
 *
 * That is not asserted example by example — it is MEASURED. {@link meaningOf}
 * reads the six facts off an old record by hand, in the old vocabulary; the
 * accessors every reading in olai now uses read the same six off what came out;
 * and `survives` compares them. A corpus goes through it, so the claim covers
 * shapes nobody thought to write a case for rather than only the ones somebody
 * did.
 */

import { expect, test } from "bun:test"
import { Result } from "effect"

import { type Meaning, meaningOf, migrateOutline, migrateRecord } from "./migrate.ts"
import { isMirror, type Node } from "./node.ts"
import { parseOutline } from "./parse.ts"
import { dateOf, EDGE_FIELDS, listOf, markOf, sinceOf } from "./props.ts"
import { serializeNode, serializeOutline } from "./write.ts"
import { outlineOf } from "./fixtures.testlib.ts"

/** What the new format answers about a record, in the same six terms
 *  {@link meaningOf} reads off the old one. The two sides of the property. */
const meaningAfter = (node: Node): Meaning => {
  // A mirror carries no properties and never carried any of the seven fields,
  // so it has no meaning in these terms — and the corpus holds none. Narrowed
  // rather than cast, so this stays true if one ever does.
  if (isMirror(node)) return { mark: undefined, since: undefined, date: undefined, edges: {} }
  return {
    mark: markOf(node),
    since: sinceOf(node),
    date: dateOf(node),
    edges: Object.fromEntries(
      EDGE_FIELDS.flatMap((field) => {
        const held = listOf(node, field)
        return held.length === 0 ? [] : [[field, held]]
      }),
    ),
  }
}

/** One old record, migrated, with both readings of its meaning. */
const across = (line: string) => {
  const before = JSON.parse(line) as Record<string, unknown>
  const result = migrateRecord(before)
  if (result.kind === "refused") {
    throw new Error(`expected \`${line}\` to migrate, got refused: ${result.why}`)
  }
  // `unchanged` is a real answer for a record with none of the seven fields on
  // it — a plain bullet — and the property holds of it too: nothing survives
  // nothing. It is the record itself that goes on to be read.
  const after = result.kind === "unchanged" ? before : result.record
  return {
    was: meaningOf(before),
    is: meaningAfter(after as unknown as Node),
    record: after,
  }
}

/**
 * A CORPUS, not a list of cases — every combination of mark × value shape,
 * crossed with the presence of a date and of each edge. The point of generating
 * it is that nobody chose it: a hand-written table tests the shapes its author
 * remembered, and the two that bite are always the ones they did not (a dated
 * `todo`, a `blocks` on a node that also has `after`).
 */
const CORPUS: ReadonlyArray<string> = (() => {
  const marks = [
    ``,
    `,"done":true`,
    `,"done":"2026-08-11T15:40:03-04:00"`,
    `,"done":"2026-08-11"`,
    `,"doing":true`,
    `,"doing":"2026-07-20"`,
    `,"todo":true`,
    `,"todo":"2026-08-11"`,
  ]
  const dates = [``, `,"date":"2026-08-10"`, `,"date":"2026-08-10T14:30:00Z"`]
  const edges = [
    ``,
    `,"after":["a"]`,
    `,"see":["b","c"]`,
    `,"blocks":["d"]`,
    `,"after":["a"],"blocks":["d"],"see":["b"]`,
  ]
  const lines: Array<string> = []
  for (const mark of marks) {
    for (const date of dates) {
      for (const edge of edges) {
        lines.push(`{"id":"n","ord":"a0","title":"a node"${mark}${date}${edge}}`)
      }
    }
  }
  return lines
})()

test("the corpus is big enough to be worth calling one", () => {
  // A floor rather than a count: the loop below is only as good as what it
  // walks, and a generator that quietly produced three lines would be a green
  // run that proved almost nothing.
  expect(CORPUS.length).toBeGreaterThan(100)
})

test("every mark, instant, date and edge survives the migration exactly", () => {
  for (const line of CORPUS) {
    const { was, is } = across(line)
    expect({ line, ...is }).toEqual({ line, ...was })
  }
})

/**
 * The instant, both ways round, said on its own because it is the one fact that
 * changed shape rather than only address.
 *
 * A mark held `true` OR a string, and those two are now `since` absent and
 * `since` present. Nothing else in the record has a spelling that means
 * something different from the one it had, so nothing else needs saying twice.
 */
test("`true` becomes an absent `since`, and a string becomes its value", () => {
  expect(across(`{"id":"n","ord":"a0","title":"t","doing":true}`).record["props"])
    .toEqual({ status: "doing" })
  expect(across(`{"id":"n","ord":"a0","title":"t","doing":"2026-07-20"}`).record["props"])
    .toEqual({ status: "doing", since: "2026-07-20" })
  // A dated `todo` is legal, is written by no verb, and is exactly the value a
  // migration written from the ops layer's habits would have dropped.
  expect(across(`{"id":"n","ord":"a0","title":"t","todo":"2026-08-11"}`).record["props"])
    .toEqual({ status: "todo", since: "2026-08-11" })
})

test("everything that is not one of the seven fields is carried over untouched", () => {
  const { record } = across(
    `{"id":"n","parent":"p","ord":"a0","title":"t","desc":"a note","doc":"x.md","done":true}`,
  )
  expect(record).toEqual({
    id: "n",
    parent: "p",
    ord: "a0",
    title: "t",
    desc: "a note",
    doc: "x.md",
    props: { status: "done" },
  })
})

/** A mirror has none of the seven and never did, so it is not a record this
 *  step has anything to say about — and `unchanged` is what keeps its file from
 *  being rewritten for nothing. */
test("a mirror is untouched", () => {
  expect(migrateRecord(JSON.parse(`{"id":"m","parent":"p","ord":"a0","mirror":"x"}`)))
    .toEqual({ kind: "unchanged" })
})

// ── idempotence ────────────────────────────────────────────────────────

/**
 * The second start does nothing, and it does nothing WITHOUT being told that a
 * first start happened.
 *
 * There is no marker file and no version stamp: a file already in the new shape
 * answers `unchanged` because it carries none of the old fields, which is a
 * property of the file rather than of a memory somewhere. That is what makes
 * the sweep safe to run on every boot for ever — including on a directory where
 * half the files came from a colleague's already-migrated vault.
 */
test("migrating twice is migrating once", () => {
  const old = CORPUS.join("\n") + "\n"
  const first = migrateOutline(old)
  if (first.kind !== "migrated") throw new Error("expected the corpus to migrate")

  const text = serializeOutline(first.records)
  expect(migrateOutline(text)).toEqual({ kind: "unchanged" })
})

test("a file already in the new shape is not rewritten at all", () => {
  expect(migrateOutline(`{"id":"n","ord":"a0","title":"t","props":{"status":"done"}}\n`))
    .toEqual({ kind: "unchanged" })
  expect(migrateOutline(`{"id":"n","ord":"a0","title":"t"}\n`))
    .toEqual({ kind: "unchanged" })
})

// ── what it declines ───────────────────────────────────────────────────

/**
 * Four records it will not carry across, and the file keeps every byte for
 * each of them.
 *
 * All four are records no set could load before this change either, which is
 * what makes declining the safe answer rather than a cop-out: nothing that ever
 * worked stops working, and the human sees what they wrote rather than a
 * cleaned-up half of it.
 */
test("a record carrying two marks stops its file, and says which two", () => {
  const result = migrateOutline(
    `{"id":"a","ord":"a","title":"t","done":true}\n` +
      `{"id":"b","ord":"b","title":"t","done":true,"doing":"2026-08-10"}\n`,
  )
  expect(result.kind).toBe("left")
  if (result.kind !== "left") return
  expect(result.why).toEqual([
    { line: 2, why: expect.stringContaining("`done` and `doing`") as unknown as string },
  ])
})

test("a record carrying an old field AND props stops its file", () => {
  const result = migrateOutline(
    `{"id":"a","ord":"a","title":"t","done":true,"props":{"date":"2026-08-10"}}\n`,
  )
  expect(result.kind).toBe("left")
  if (result.kind !== "left") return
  expect(result.why[0]?.why).toContain("no rule for merging them")
})

/**
 * The one that is about the REWRITE rather than the meaning, and the one a
 * migration is most likely to get wrong quietly.
 *
 * A migrated file is written by the writer, which emits the fields it knows and
 * no others. So a record carrying `titel` would come back without it — the step
 * whose entire promise is faithfulness deleting the typo the validator was
 * about to name. It is declined instead, and the bytes stay put so the
 * validator still gets to name it.
 */
test("a record carrying a field the format has no place for stops its file", () => {
  const result = migrateOutline(`{"id":"a","ord":"a","title":"t","done":true,"titel":"oops"}\n`)
  expect(result.kind).toBe("left")
  if (result.kind !== "left") return
  expect(result.why[0]?.why).toContain("`titel`")

  // And the proof that the caution is not theoretical: serialising such a
  // record without the guard is exactly the data loss described above.
  expect(serializeNode(
    JSON.parse(`{"id":"a","ord":"a","title":"t","titel":"oops"}`) as Node,
  )).toBe(`{"id":"a","ord":"a","title":"t"}`)
})

/**
 * The fourth, and the one this file got wrong the first time: a field the
 * format DOES define, holding a value it never could.
 *
 * A corpus again rather than a table, because the mistake was precisely a
 * shape nobody thought to write a case for. Every line below was `bad-record`
 * on the binary this change replaces, and the two claims are made together:
 * the migration declines it, and the CURRENT parser still refuses the bytes it
 * left behind. That pair is what "a named error stays named" means — declining
 * would be no better than laundering if the file the sweep walked away from
 * then loaded clean.
 */
const MALFORMED: ReadonlyArray<{ field: string; value: string; line: string }> = (() => {
  const cross = (fields: ReadonlyArray<string>, values: ReadonlyArray<string>) =>
    fields.flatMap((field) =>
      values.map((value) => ({
        field,
        value,
        line: `{"id":"n","ord":"a0","title":"t","${field}":${value}}`,
      }))
    )
  return [
    // `""` is in this list on purpose and is the subtlest of them: the old
    // schema ACCEPTED it and the validator then said `bad-date`. The writer
    // omits fields holding nothing, so a migration that copied it would produce
    // a node that is simply finished, and the complaint would be gone.
    ...cross(["done", "doing", "todo"], [`false`, `1`, `null`, `[]`, `{}`, `""`]),
    ...cross(["date"], [`true`, `[]`, `""`, `7`, `{"day":"2026-08-10"}`]),
    ...cross(["after", "see", "blocks"], [`"y"`, `true`, `7`, `{"0":"y"}`]),
  ]
})()

test("a legacy field holding a value it could never hold stops its file", () => {
  expect(MALFORMED.length).toBeGreaterThan(30)

  for (const { field, value, line } of MALFORMED) {
    const result = migrateOutline(line + "\n")
    expect({ line, kind: result.kind }).toEqual({ line, kind: "left" })
    if (result.kind !== "left") continue
    // NAMED, not merely refused: the reason quotes the field and the value it
    // holds, so the human reads what is wrong with the line rather than that
    // something is.
    expect({ line, why: result.why[0]?.why }).toEqual({
      line,
      why: expect.stringContaining(`\`${field}\` holds ${value}`) as unknown as string,
    })

    // And the bytes it left behind are still a file that does not load, which
    // is the other half of the claim: the complaint the old binary made about
    // this line is a complaint the current one still makes.
    expect({ line, loads: Result.isSuccess(parseOutline("a.olai", line + "\n")) })
      .toEqual({ line, loads: false })
  }
})

/**
 * The two that would have gone through quietly, said as themselves, because a
 * corpus proves the class and an example is what a reader remembers.
 *
 * `{"done":false}` had no mark at all under the old schema — it was a record
 * that would not load. Read as "the key is present", it becomes a task somebody
 * finished. `{"date":true}` is the same mistake pointing the other way: read as
 * "copy it if it is a string", the date simply stops existing.
 */
test("`{\"done\":false}` is not a finished task, and `{\"date\":true}` does not vanish", () => {
  const done = migrateRecord(JSON.parse(`{"id":"n","ord":"a0","title":"t","done":false}`))
  expect(done.kind).toBe("refused")
  if (done.kind === "refused") expect(done.why).toContain("`done` holds false")

  const date = migrateRecord(JSON.parse(`{"id":"n","ord":"a0","title":"t","date":true}`))
  expect(date.kind).toBe("refused")
  if (date.kind === "refused") expect(date.why).toContain("`date` holds true")
})

/**
 * An empty LIST is the one shape in that neighbourhood that is carried rather
 * than declined, and it is carried as absence.
 *
 * It is not a malformed value: the old schema accepted it, the old writer
 * omitted it, and `targetsOf` answered nothing about it. So it means on both
 * sides of the change exactly what no `see` at all means, and the record it
 * migrates to is the record with no `see` at all.
 */
test("an empty edge list is absence, and migrates to absence", () => {
  const empty = migrateRecord(JSON.parse(`{"id":"n","ord":"a0","title":"t","see":[],"done":true}`))
  expect(empty).toEqual({
    kind: "migrated",
    record: { id: "n", ord: "a0", title: "t", props: { status: "done" } },
  })
})

/**
 * A list holding something that is not an id is NOT declined, and that is the
 * arm doing its job rather than overreaching.
 *
 * The value has somewhere to go — `props` holds lists — so it is carried across
 * verbatim and the validator says the same thing about it afterwards as before.
 * Refusing here would be this module judging records, which is the parser's job
 * and the reason the other three arms are all about what a REWRITE would lose.
 */
test("a list holding a non-id is carried across, and still refused by the parser", () => {
  const line = `{"id":"n","ord":"a0","title":"t","after":["a",7]}`
  const result = migrateOutline(line + "\n")
  expect(result.kind).toBe("migrated")
  if (result.kind !== "migrated") return
  expect(Result.isFailure(parseOutline("a.olai", serializeOutline(result.records)))).toBe(true)
})

test("a line that is not JSON stops its file rather than being judged", () => {
  const result = migrateOutline(`{"id":"a","ord":"a","title":"t","done":true}\n{"id":"b",\n`)
  expect(result.kind).toBe("left")
  if (result.kind !== "left") return
  expect(result.why).toEqual([{ line: 2, why: "this line is not JSON" }])
})

// ── the whole thing, read back ─────────────────────────────────────────

/**
 * The end-to-end claim, in one test: an old file goes in, comes out, and PARSES
 * — under the current schema, with the current validator's per-line rules — and
 * every node in it means what its old line meant.
 *
 * The other tests compare records; this one compares a FILE against what the
 * format now accepts, which is the thing the boot sweep actually has to be true
 * of. A migration whose output did not parse would pass every property above
 * and take the vault away on the next start.
 */
test("a migrated file parses, and every node still means what it meant", () => {
  const old = CORPUS.map((line, at) =>
    line.replace(`"id":"n"`, `"id":"n${at}"`).replace(`"ord":"a0"`, `"ord":"a${at}"`)
  )
  // The edges name ids nothing declares, which is a SET-level complaint and
  // deliberately not this file's business: `outlineOf` is the per-line reader.
  const result = migrateOutline(old.join("\n") + "\n")
  if (result.kind !== "migrated") throw new Error(`expected a migration, got ${result.kind}`)

  const outline = outlineOf(serializeOutline(result.records))
  expect(outline.nodes.length).toBe(old.length)

  for (const [at, located] of outline.nodes.entries()) {
    const was = meaningOf(JSON.parse(old[at] as string) as Record<string, unknown>)
    expect({ at, ...meaningAfter(located.node) }).toEqual({ at, ...was })
  }
})

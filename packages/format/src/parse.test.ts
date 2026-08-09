import { expect, test } from "bun:test"
import { Result } from "effect"

import type { OutlineError } from "./errors.ts"
import { parseOutline } from "./parse.ts"
import type { Outline } from "./set.ts"

/** The errors of a line-level failure. Written as a helper so every test below
 *  reads as "this text, these errors" and nothing else. */
const errorsOf = (contents: string, file = "a.jsonl"): ReadonlyArray<OutlineError> => {
  const parsed = parseOutline(file, contents)
  if (Result.isSuccess(parsed)) {
    throw new Error(`expected \`${contents}\` to be rejected, but it parsed`)
  }
  return parsed.failure
}

const outlineOf = (contents: string, file = "a.jsonl"): Outline => {
  const parsed = parseOutline(file, contents)
  if (Result.isFailure(parsed)) {
    throw new Error(
      `expected \`${contents}\` to parse: ${parsed.failure.map((e) => e.message).join("; ")}`,
    )
  }
  return parsed.success
}

const first = (errors: ReadonlyArray<OutlineError>): OutlineError => {
  const [error] = errors
  if (error === undefined) throw new Error("expected at least one error")
  return error
}

const codes = (errors: ReadonlyArray<OutlineError>): ReadonlyArray<string> =>
  errors.map((error) => error.code)

const messages = (errors: ReadonlyArray<OutlineError>): string =>
  errors.map((error) => error.message).join("\n")

// The line the format is documented with, whole. If the canonical example from
// docs/format.md ever stopped parsing, every other test here would be checking
// a format nobody writes.
test("the spec's own example line is a node", () => {
  const outline = outlineOf(
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","date":"2026-08-10","after":["demo"]}`,
  )
  expect(outline.file).toBe("a.jsonl")
  expect(outline.nodes.length).toBe(1)
  expect(outline.nodes[0]?.line).toBe(1)
  // Stored verbatim: the reader hands back exactly the fields on disk, because
  // the writer has to be able to reproduce them.
  expect(outline.nodes[0]?.node).toEqual({
    id: "order",
    parent: "kitchen",
    ord: "a1",
    title: "order the new cabinets",
    date: "2026-08-10",
    after: ["demo"],
  })
})

// The cheapest possible corruption — a half-written line from a crashed editor
// or a git conflict marker — has to name its line rather than blow up the load.
test("a line that is not JSON is an error about that line", () => {
  const errors = errorsOf(`{"id":"a","ord":"a","title":"fine"}\n{"id":"b",`)
  expect(codes(errors)).toEqual(["not-json"])
  expect(first(errors).line).toBe(2)
})

// `JSON.parse` accepts scalars and arrays, so "valid JSON" is not "a record".
// Pasting a whole JSON array into a .jsonl is the mistake people actually make,
// and it should be told what it did rather than shown a schema issue.
test("valid JSON that is not an object says which shape it got", () => {
  expect(codes(errorsOf(`[{"id":"a"}]`))).toEqual(["not-an-object"])
  expect(first(errorsOf(`[{"id":"a"}]`)).message).toContain("an array")
  expect(first(errorsOf(`3`)).message).toContain("a number")
  expect(first(errorsOf(`null`)).message).toContain("null")
})

// A field with the right name and the wrong type is the classic hand-edit, and
// the message has to name the field — "expected string" alone is unusable.
test("a field of the wrong type is a bad-record naming the field", () => {
  const errors = errorsOf(`{"id":"a","ord":1,"title":"t"}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toContain("`ord`")
})

// The field set is closed. A field this format does not define is a typo or a
// stale writer, and dropping it silently would make the file and the view
// disagree about what the outline says.
test("an unknown field is rejected rather than ignored", () => {
  const errors = errorsOf(`{"id":"a","ord":"a","title":"t","colour":"red"}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toContain("`colour`")
})

// `id`, `ord` and `title` are what the spec's table leaves unqualified, so a
// record missing one is not a record at all.
test("a missing required key is reported by name", () => {
  const errors = errorsOf(`{"id":"a","title":"t"}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toBe("`ord` is required and missing")
})

// A mirror is a placement of a node that already exists: every descriptive
// field has an authoritative copy at the target, so a second copy here could
// only ever disagree with it. The mirror struct carries no such field, so this
// is the schema's own excess-property refusal rather than a hand-written scan
// — and it names each offending field on its own, one error per field.
test("a mirror carrying a descriptive field is refused, per field", () => {
  const errors = errorsOf(
    `{"id":"m","parent":"p","ord":"a","mirror":"order","title":"a second copy","date":"2026-08-10"}`,
  )
  expect(codes(errors)).toEqual(["bad-record", "bad-record"])
  expect(messages(errors)).toContain("`title` is not a field of this format")
  expect(messages(errors)).toContain("`date` is not a field of this format")
})

// Not just the descriptive fields: the mirror shape is `{id, parent?, ord,
// mirror}` and NOTHING else, so a field a regular node may legally carry is
// still excess here — which is the whole point of the two structs.
test("a mirror is refused every field outside its own shape", () => {
  for (const field of [`"done":true`, `"desc":"x"`, `"see":["a"]`, `"colour":"red"`]) {
    const errors = errorsOf(`{"id":"m","ord":"a","mirror":"x",${field}}`)
    expect(codes(errors)).toEqual(["bad-record"])
    expect(first(errors).message).toContain("is not a field of this format")
  }
  // And the placement fields it does own are accepted, so the refusal above is
  // about the shape rather than about mirrors carrying anything at all.
  expect(outlineOf(`{"id":"m","parent":"p","ord":"a","mirror":"x"}`).nodes.length).toBe(1)
})

// Which arm a line is decoded as is decided by `mirror` being present, before
// the schema runs. That is what lets a record missing its title hear the rule
// it broke instead of a union's report that neither shape matched.
test("a record with no mirror is judged as a node, and misses its title by name", () => {
  const errors = errorsOf(`{"id":"a","ord":"a"}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toBe("`title` is required and missing")
})

// Ids reach URLs, wire keys and `#tag`-adjacent text, so their shape is
// checked rather than assumed.
test("an id that is not a slug is a bad-id", () => {
  expect(codes(errorsOf(`{"id":"a b","ord":"a","title":"t"}`))).toEqual(["bad-id"])
  expect(codes(errorsOf(`{"id":"","ord":"a","title":"t"}`))).toEqual(["bad-id"])
  // The slug alphabet, in full — letters, digits, `_` and `-`.
  expect(outlineOf(`{"id":"A_z-09","ord":"a","title":"t"}`).nodes.length).toBe(1)
})

// The two states are exclusive. A merge that kept both sides of an edit is
// exactly how a record ends up claiming both, and it must not load.
test("done and doing together is refused", () => {
  const errors = errorsOf(`{"id":"a","ord":"a","title":"t","done":true,"doing":"2026-08-10"}`)
  expect(codes(errors)).toEqual(["done-and-doing"])
})

// Shape is not enough: `2026-02-30` matches the pattern and is still not a
// day, and a date the calendar rejects would silently vanish from the day view.
test("a date is checked against the calendar, not just the pattern", () => {
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","date":"2026-02-30"}`)))
    .toEqual(["bad-date"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","date":"2026-13-01"}`)))
    .toEqual(["bad-date"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","date":"10 Aug 2026"}`)))
    .toEqual(["bad-date"])
})

// Both spellings are legal and both are written back verbatim: a date-only
// `date` must not have to become a datetime to be accepted.
test("date-only and full datetime are both accepted, on every dated field", () => {
  const outline = outlineOf(
    `{"id":"a","ord":"a","title":"t","done":"2026-08-10","date":"2026-08-10T14:30:00Z"}\n` +
      `{"id":"b","ord":"b","title":"t","doing":"2026-08-10T14:30:00.500+05:30","date":"2028-02-29"}\n` +
      `{"id":"c","ord":"c","title":"t","done":true}`,
  )
  expect(outline.nodes.length).toBe(3)
})

// Readers tolerate blank lines; `file:line` still has to be the line an editor
// shows, so skipping a blank must not shift the count.
test("blank lines are skipped without shifting line numbers", () => {
  const errors = errorsOf(
    `{"id":"a","ord":"a","title":"t"}\n\n   \n{"id":"b","ord":"b"}\n`,
  )
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).line).toBe(4)
  // The trailing newline the format requires is itself a blank final line.
  expect(outlineOf(`{"id":"a","ord":"a","title":"t"}\n`).nodes.length).toBe(1)
})

// A file is decoded whole or not at all: the good lines of a broken file are
// withheld so the set-wide validator never guesses that `kitchen` is unknown
// when the line declaring it is the one that failed.
test("one bad line yields no nodes from the whole file", () => {
  const parsed = parseOutline(
    "a.jsonl",
    `{"id":"a","ord":"a","title":"t"}\n{"id":"b",\n{"id":"c","ord":"c","title":"t"}`,
  )
  expect(Result.isFailure(parsed)).toBe(true)
  if (Result.isSuccess(parsed)) throw new Error("unreachable")
  expect(parsed.failure.length).toBe(1)
})

// Every issue, not the first: a record with three wrong fields should cost one
// edit and one reload, not three.
test("several schema issues on one line come back together", () => {
  const errors = errorsOf(`{"id":1,"ord":2,"title":"t","colour":"red"}`)
  expect(errors.length).toBe(3)
  expect(new Set(codes(errors))).toEqual(new Set(["bad-record"]))
  expect(messages(errors)).toContain("`id`")
  expect(messages(errors)).toContain("`ord`")
  expect(messages(errors)).toContain("`colour`")
})

// The same holds for the rules the record answers by itself — they are all
// checked, and they all name the same line.
test("several record-level rules can fail on one line", () => {
  const errors = errorsOf(
    `{"id":"a b","ord":"a","title":"t","done":"2026-02-30","doing":true}`,
  )
  expect(codes(errors).slice().sort()).toEqual(["bad-date", "bad-id", "done-and-doing"])
  expect(errors.every((error) => error.line === 1)).toBe(true)
  expect(errors.every((error) => error.file === "a.jsonl")).toBe(true)
})

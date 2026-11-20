import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Result } from "effect"

import type { OutlineError } from "@olai/format"
import { FIXTURE_FILE } from "@olai/format/testlib"
const outlineOf = (text: string, file = FIXTURE_FILE) => Result.getOrThrow(parseOutline(file, text, TEST_CLAIMS))
import { parseOutline } from "olai-plugin-outline-olai/format"
import { serializeOutline } from "olai-plugin-outline-olai/format"
const errorsOf = (
  contents: string,
  file = FIXTURE_FILE,
): ReadonlyArray<OutlineError> => {
  const parsed = parseOutline(file, contents, TEST_CLAIMS)
  if (Result.isSuccess(parsed)) {
    throw new Error(`expected \`${contents}\` to be rejected, but it parsed`)
  }
  return parsed.failure
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

test("the spec's own example line is a node", () => {
  const outline = outlineOf(
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","date":"2026-08-10","after":["demo"]}`,
  )
  expect(String(outline.path)).toBe("a.olai")
  expect(outline.nodes.length).toBe(1)
  expect(outline.nodes[0]?.line).toBe(1)
  expect(outline.nodes[0]?.node).toEqual({
    id: "order",
    parent: "kitchen",
    ord: "a1",
    title: "order the new cabinets",
    date: "2026-08-10",
    after: ["demo"],
  })
})

test("a line that is not JSON is an error about that line", () => {
  const errors = errorsOf(`{"id":"a","ord":"a","title":"fine"}\n{"id":"b",`)
  expect(codes(errors)).toEqual(["not-json"])
  expect(first(errors).line).toBe(2)
})

test("valid JSON that is not an object says which shape it got", () => {
  expect(codes(errorsOf(`[{"id":"a"}]`))).toEqual(["not-an-object"])
  expect(first(errorsOf(`[{"id":"a"}]`)).message).toContain("an array")
  expect(first(errorsOf(`3`)).message).toContain("a number")
  expect(first(errorsOf(`null`)).message).toContain("null")
})

test("a field of the wrong type is a bad-record naming the field", () => {
  const errors = errorsOf(`{"id":"a","ord":1,"title":"t"}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toContain("`ord`")
})

test("an unknown field is rejected rather than ignored", () => {
  const errors = errorsOf(`{"id":"a","ord":"a","title":"t","colour":"red"}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toContain("`colour`")
})

test("any key is allowed inside `custom`, and the top level stays closed", () => {
  const node = outlineOf(
    `{"id":"a","ord":"a","title":"t","custom":{"pr":"https://x/1","isbn":"978-…","tags":["home"]}}`,
  ).nodes[0]?.node
  expect(node).toMatchObject({
    custom: { pr: "https://x/1", isbn: "978-…", tags: ["home"] },
  })
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","pr":"https://x/1"}`)))
    .toEqual(["bad-record"])
})

test("a custom value that is neither text nor a list of it is a bad-record", () => {
  const errors = errorsOf(`{"id":"a","ord":"a","title":"t","custom":{"count":3}}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toContain("custom.count")
})

test("a missing required key is reported by name", () => {
  const errors = errorsOf(`{"id":"a","title":"t"}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toBe("`ord` is required and missing")
})

test("a mirror carrying a descriptive field is refused, per field", () => {
  const errors = errorsOf(
    `{"id":"m","parent":"p","ord":"a","mirror":"order","title":"a second copy","date":"2026-08-10"}`,
  )
  expect(codes(errors)).toEqual(["bad-record", "bad-record"])
  expect(messages(errors)).toContain("`title` is not a field of this format")
  expect(messages(errors)).toContain("`date` is not a field of this format")
})

test("a mirror is refused every field outside its own shape", () => {
  for (const field of [`"done":true`, `"desc":"x"`, `"see":["a"]`, `"colour":"red"`]) {
    const errors = errorsOf(`{"id":"m","ord":"a","mirror":"x",${field}}`)
    expect(codes(errors)).toEqual(["bad-record"])
    expect(first(errors).message).toContain("is not a field of this format")
  }
  expect(outlineOf(`{"id":"m","parent":"p","ord":"a","mirror":"x"}`).nodes.length).toBe(1)
})

test("a record with no mirror is judged as a node, and misses its title by name", () => {
  const errors = errorsOf(`{"id":"a","ord":"a"}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toBe("`title` is required and missing")
})

test("an id that is not mentionable is a bad-id", () => {
  expect(codes(errorsOf(`{"id":"a b","ord":"a","title":"t"}`))).toEqual(["bad-id"])
  expect(codes(errorsOf(`{"id":"","ord":"a","title":"t"}`))).toEqual(["bad-id"])
  expect(codes(errorsOf(`{"id":"dot.ted","ord":"a","title":"t"}`))).toEqual(["bad-id"])
  expect(outlineOf(`{"id":"A_z-09","ord":"a","title":"t"}`).nodes.length).toBe(1)
  expect(outlineOf(`{"id":"work/olai","ord":"a","title":"t"}`).nodes.length).toBe(1)
})

test("two marks on one record are refused", () => {
  const errors = errorsOf(`{"id":"a","ord":"a","title":"t","done":true,"doing":"2026-08-10"}`)
  expect(codes(errors)).toEqual(["several-marks"])
  expect(errors[0]?.message).toContain("`done` and `doing`")

  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","doing":true,"todo":true}`)))
    .toEqual(["several-marks"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","done":true,"todo":true}`)))
    .toEqual(["several-marks"])

  expect(outlineOf(`{"id":"a","ord":"a","title":"t","todo":true}`).nodes[0]?.node)
    .toEqual({ id: "a", ord: "a", title: "t", todo: true })
  expect(outlineOf(`{"id":"a","ord":"a","title":"t","todo":"2026-08-11"}`).nodes.length)
    .toBe(1)
})

test("the cancelled mark round-trips, and is exclusive with the other three", () => {
  const line = `{"id":"a","ord":"a","title":"t","cancelled":"2026-08-25T15:40:03-04:00"}`
  const parsed = outlineOf(line)
  expect(parsed.nodes[0]?.node).toEqual({
    id: "a",
    ord: "a",
    title: "t",
    cancelled: "2026-08-25T15:40:03-04:00",
  })
  expect(serializeOutline(parsed.nodes.map((one) => one.node))).toBe(`${line}\n`)

  expect(outlineOf(`{"id":"a","ord":"a","title":"t","cancelled":true}`).nodes[0]?.node)
    .toEqual({ id: "a", ord: "a", title: "t", cancelled: true })

  for (const other of [`"done":true`, `"doing":true`, `"todo":true`]) {
    expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","cancelled":true,${other}}`)))
      .toEqual(["several-marks"])
  }
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","cancelled":"2026-02-30"}`)))
    .toEqual(["bad-date"])
})

test("started round-trips, and is held to the same ISO rule as the marks", () => {
  const line = `{"id":"a","ord":"a","title":"t","doing":true,"started":"2026-08-29T09:52:00-04:00"}`
  const parsed = outlineOf(line)
  expect(parsed.nodes[0]?.node).toEqual({
    id: "a",
    ord: "a",
    title: "t",
    doing: true,
    started: "2026-08-29T09:52:00-04:00",
  })
  expect(serializeOutline(parsed.nodes.map((one) => one.node))).toBe(`${line}\n`)

  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","started":"2026-08-29"}`)))
    .toEqual(["bad-date"])

  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","started":true}`)))
    .toEqual(["bad-record"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","started":"2026-02-30"}`)))
    .toEqual(["bad-date"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","started":"yesterday"}`)))
    .toEqual(["bad-date"])

  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","started":"2026-02-30T10:00:00Z"}`)))
    .toEqual(["bad-date"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","started":"2026-13-01T10:00:00Z"}`)))
    .toEqual(["bad-date"])
})

test("worked round-trips, and is held to whole seconds", () => {
  const line = `{"id":"a","ord":"a","title":"t","done":"2026-08-29T12:26:44-04:00","started":"2026-08-29T09:52:00-04:00","worked":9284}`
  const parsed = outlineOf(line)
  expect(parsed.nodes[0]?.node).toEqual({
    id: "a",
    ord: "a",
    title: "t",
    done: "2026-08-29T12:26:44-04:00",
    started: "2026-08-29T09:52:00-04:00",
    worked: 9284,
  })
  expect(serializeOutline(parsed.nodes.map((one) => one.node))).toBe(`${line}\n`)

  expect(
    outlineOf(`{"id":"a","ord":"a","title":"t","doing":true,"started":"2026-08-29T09:52:00-04:00","worked":0}`)
      .nodes[0]?.node,
  ).toMatchObject({ worked: 0 })

  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","worked":true}`)))
    .toEqual(["bad-record"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","worked":12.5}`)))
    .toEqual(["bad-record"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","worked":-7}`)))
    .toEqual(["bad-record"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","worked":"9284"}`)))
    .toEqual(["bad-record"])
})

test("a date is checked against the calendar, not just the pattern", () => {
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","date":"2026-02-30"}`)))
    .toEqual(["bad-date"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","date":"2026-13-01"}`)))
    .toEqual(["bad-date"])
  expect(codes(errorsOf(`{"id":"a","ord":"a","title":"t","date":"10 Aug 2026"}`)))
    .toEqual(["bad-date"])
})

test("a repeat rule this grammar does not have is refused, naming the line", () => {
  const errors = errorsOf(
    `{"id":"a","ord":"a","title":"t","date":"2026-08-17","repeat":"every 2 weeks"}`,
  )
  expect(codes(errors)).toEqual(["bad-repeat"])
  expect(errors[0]?.message).toContain("every 2 weeks")
  expect(errors[0]?.message).toContain("every week on <weekday>")
  expect(errors[0]?.line).toBe(1)
})

test("a repeat with no date is refused, and told which field is missing", () => {
  const errors = errorsOf(
    `{"id":"a","ord":"a","title":"t","repeat":"every week on monday"}`,
  )
  expect(codes(errors)).toEqual(["bad-repeat"])
  expect(errors[0]?.message).toContain("`date`")
})

test("a dated node with a rule of the grammar loads", () => {
  const outline = outlineOf(
    `{"id":"a","ord":"a","title":"t","date":"2026-08-17","repeat":"every week on monday"}\n` +
      `{"id":"b","ord":"b","title":"t","date":"2026-08-17T09:00:00-04:00","repeat":"every day"}`,
  )
  expect(outline.nodes.length).toBe(2)
})

test("date-only and full datetime are both accepted, on every dated field", () => {
  const outline = outlineOf(
    `{"id":"a","ord":"a","title":"t","done":"2026-08-10","date":"2026-08-10T14:30:00Z"}\n` +
      `{"id":"b","ord":"b","title":"t","doing":"2026-08-10T14:30:00.500+05:30","date":"2028-02-29"}\n` +
      `{"id":"c","ord":"c","title":"t","done":true}`,
  )
  expect(outline.nodes.length).toBe(3)
})

test("blank lines are skipped without shifting line numbers", () => {
  const errors = errorsOf(
    `{"id":"a","ord":"a","title":"t"}\n\n   \n{"id":"b","ord":"b"}\n`,
  )
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).line).toBe(4)
  expect(outlineOf(`{"id":"a","ord":"a","title":"t"}\n`).nodes.length).toBe(1)
})

test("one bad line yields no nodes from the whole file", () => {
  const parsed = parseOutline(
    "a.olai",
    `{"id":"a","ord":"a","title":"t"}\n{"id":"b",\n{"id":"c","ord":"c","title":"t"}`, TEST_CLAIMS
  )
  expect(Result.isFailure(parsed)).toBe(true)
  if (Result.isSuccess(parsed)) throw new Error("unreachable")
  expect(parsed.failure.length).toBe(1)
})

test("several schema issues on one line come back together", () => {
  const errors = errorsOf(`{"id":1,"ord":2,"title":"t","colour":"red"}`)
  expect(errors.length).toBe(3)
  expect(new Set(codes(errors))).toEqual(new Set(["bad-record"]))
  expect(messages(errors)).toContain("`id`")
  expect(messages(errors)).toContain("`ord`")
  expect(messages(errors)).toContain("`colour`")
})

test("several record-level rules can fail on one line", () => {
  const errors = errorsOf(
    `{"id":"a b","ord":"a","title":"t","done":"2026-02-30","doing":true}`,
  )
  expect(codes(errors).slice().sort()).toEqual(["bad-date", "bad-id", "several-marks"])
  expect(errors.every((error) => error.line === 1)).toBe(true)
  expect(errors.every((error) => error.file === "a.olai")).toBe(true)
})

test("top-level doc is an unknown key; custom doc remains ordinary text", () => {
  const errors = errorsOf(`{"id":"a","ord":"a","title":"t","doc":"notes.md"}`)
  expect(codes(errors)).toEqual(["bad-record"])
  expect(first(errors).message).toContain("`doc`")
  expect(Result.isSuccess(parseOutline("a.olai", `{"id":"a","ord":"a","title":"t","custom":{"doc":"notes.md"}}`, TEST_CLAIMS))).toBe(true)
})

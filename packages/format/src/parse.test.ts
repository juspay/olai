import { expect, test } from "bun:test"
import { Result } from "effect"

import type { Node } from "./node.ts"
import { isIsoInstant, parseOutline } from "./parse.ts"
import { serializeOutline } from "./write.ts"

const errorsOf = (contents: string) => {
  const parsed = parseOutline("test.org", contents)
  if (Result.isSuccess(parsed)) throw new Error("fixture unexpectedly parsed")
  return parsed.failure
}

const nodesOf = (contents: string): ReadonlyArray<Node> => {
  const parsed = parseOutline("test.org", contents)
  if (Result.isFailure(parsed)) {
    throw new Error(parsed.failure.map((error) => `${error.line}: ${error.message}`).join("; "))
  }
  return parsed.success.nodes.map((located) => located.node)
}

test("Org2 headings and drawers decode to OLAI records", () => {
  const nodes: ReadonlyArray<Node> = [
    { id: "root", ord: "a0", title: "the root", todo: true },
    { id: "child", parent: "root", ord: "a0", title: "the child", see: ["root"] },
  ]
  expect(nodesOf(serializeOutline(nodes))).toEqual(nodes)
})

test("a hand edit to a property becomes the OLAI field", () => {
  const before = serializeOutline([{ id: "a", ord: "a0", title: "before" }])
  const after = before.replace(`:OLAI_TITLE: "before"`, `:OLAI_TITLE: "after"`)
  expect(nodesOf(after)).toEqual([{ id: "a", ord: "a0", title: "after" }])
})

test("heading hierarchy supplies parentage when OLAI_PARENT is absent", () => {
  const text =
    `* parent\n:PROPERTIES:\n:ID: p\n:OLAI_KIND: regular\n:OLAI_ORD: "a"\n:OLAI_TITLE: "parent"\n:END:\n\n` +
    `** child\n:PROPERTIES:\n:ID: c\n:OLAI_KIND: regular\n:OLAI_ORD: "a"\n:OLAI_TITLE: "child"\n:END:\n`
  expect(nodesOf(text)).toEqual([
    { id: "p", ord: "a", title: "parent" },
    { id: "c", parent: "p", ord: "a", title: "child" },
  ])
})

test("explicit parentage survives an intermediate manual refile", () => {
  const text = serializeOutline([
    { id: "p", ord: "a", title: "parent" },
    { id: "c", parent: "p", ord: "a", title: "child" },
  ]).replace("** child", "* child")
  expect(nodesOf(text)[1]).toEqual({ id: "c", parent: "p", ord: "a", title: "child" })
})

test("mirrors decode without descriptive fields of their own", () => {
  const nodes: ReadonlyArray<Node> = [
    { id: "target", ord: "a", title: "target" },
    { id: "placed", ord: "b", mirror: "target" },
  ]
  expect(nodesOf(serializeOutline(nodes))).toEqual(nodes)
})

test("arbitrary Markdown titles and descriptions round-trip exactly", () => {
  const node: Node = {
    id: "a",
    ord: "a",
    title: "TODO *bold* :tag:",
    desc: "line one\n* heading\n#+end_src\n:END:",
  }
  expect(nodesOf(serializeOutline([node]))).toEqual([node])
})

test("document-level Org content is refused instead of silently lost", () => {
  const errors = errorsOf("#+TITLE: not an OLAI record\n\nprose\n")
  expect(errors.every((error) => error.code === "bad-record")).toBe(true)
  expect(errors[0]?.message).toContain("document-level Org content")
})

test("a heading needs exactly one drawer", () => {
  expect(errorsOf("* no drawer\n")[0]?.message).toContain("exactly one property drawer")
})

test("duplicate and unknown properties are refused", () => {
  const text = serializeOutline([{ id: "a", ord: "a", title: "a" }])
    .replace(":END:", ":ID: again\n:COLOUR: red\n:END:")
  const messages = errorsOf(text).map((error) => error.message)
  expect(messages.some((message) => message.includes("appears more than once"))).toBe(true)
  expect(messages.some((message) => message.includes("not an OLAI record field"))).toBe(true)
})

test("malformed JSON property values name the property", () => {
  const text = serializeOutline([{ id: "a", ord: "a", title: "a" }])
    .replace(`:OLAI_ORD: "a"`, `:OLAI_ORD: [not-json]`)
  expect(errorsOf(text)[0]?.message).toContain("`OLAI_ORD` is not valid JSON")
})

test("missing and wrongly typed required fields are named", () => {
  const missing = serializeOutline([{ id: "a", ord: "a", title: "a" }])
    .replace(`:OLAI_ORD: "a"\n`, "")
  expect(errorsOf(missing).some((error) => error.message.includes("`ord` is required"))).toBe(true)

  const wrong = serializeOutline([{ id: "a", ord: "a", title: "a" }])
    .replace(`:OLAI_ORD: "a"`, `:OLAI_ORD: 1`)
  expect(errorsOf(wrong).some((error) => error.message.includes("`ord`"))).toBe(true)
})

test("record-level rules still run after Org decoding", () => {
  const text = serializeOutline([{
    id: "bad id",
    ord: "a",
    title: "a",
    done: "2026-02-30",
    doing: true,
  }])
  const codes = errorsOf(text).map((error) => error.code).sort()
  expect(codes).toEqual(["bad-date", "bad-id", "several-marks"])
})

test("one bad heading withholds every node in that file", () => {
  const text = serializeOutline([
    { id: "a", ord: "a", title: "a" },
    { id: "b", ord: "b", title: "b" },
  ]).replace(`:OLAI_ORD: "b"`, ":OLAI_ORD: nope")
  const parsed = parseOutline("test.org", text)
  expect(Result.isFailure(parsed)).toBe(true)
})

test("ISO checking remains shape plus calendar reality", () => {
  expect(isIsoInstant("2026-08-10")).toBe(true)
  expect(isIsoInstant("2026-08-10T14:30:00Z")).toBe(true)
  expect(isIsoInstant("2026-02-30")).toBe(false)
  expect(isIsoInstant("10/08/2026")).toBe(false)
})

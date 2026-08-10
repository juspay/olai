import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import type { MirrorNode, Node, RegularNode } from "./node.ts"
import { parseOutline } from "./parse.ts"
import { serializeNode, serializeOutline } from "./write.ts"

const regular = (fields: Partial<RegularNode>): RegularNode => ({
  id: "n",
  ord: "a0",
  title: "a node",
  ...fields,
})

describe("serializeNode", () => {
  test("canonical field order, whatever order the object was built in", () => {
    const node: RegularNode = {
      see: ["x"],
      title: "order the cabinets",
      ord: "a1",
      id: "order",
      date: "2026-08-10",
      parent: "kitchen",
      after: ["demo"],
    }
    expect(serializeNode(node)).toBe(
      `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets",` +
        `"date":"2026-08-10","after":["demo"],"see":["x"]}`,
    )
  })

  test("absent fields are omitted, never null and never empty", () => {
    expect(serializeNode(regular({}))).toBe(`{"id":"n","ord":"a0","title":"a node"}`)
  })

  test("a mirror carries only its four", () => {
    const mirror: MirrorNode = { id: "m", parent: "p", ord: "a0", mirror: "target" }
    expect(serializeNode(mirror)).toBe(
      `{"id":"m","parent":"p","ord":"a0","mirror":"target"}`,
    )
  })

  test("a note's newlines are escaped, so a record is still one line", () => {
    const line = serializeNode(regular({ desc: "first\nsecond\n\nthird" }))
    expect(line.includes("\n")).toBe(false)
  })
})

describe("serializeOutline", () => {
  test("one record per line and exactly one trailing newline", () => {
    const nodes: ReadonlyArray<Node> = [
      regular({ id: "a" }),
      regular({ id: "b", ord: "a1" }),
      regular({ id: "c", ord: "a2" }),
    ]
    const text = serializeOutline(nodes)
    expect(text.endsWith("\n")).toBe(true)
    expect(text.endsWith("\n\n")).toBe(false)
    expect(text.split("\n")).toHaveLength(4)
    expect(text.split("\n").at(-1)).toBe("")
  })

  test("no nodes is an empty file, not a blank line", () => {
    expect(serializeOutline([])).toBe("")
  })

  /**
   * The 2026-08-09 incident, as a test: a multi-record write produced two
   * records glued onto one line, and the file that came out was one no reader
   * could parse. The assertion is not "the string looks right" — it is that
   * every line of what came out parses back to the record that went in, for
   * every shape of record the format has.
   */
  test("a multi-record write can never glue or split a line", () => {
    const nodes: ReadonlyArray<Node> = [
      regular({ id: "root", title: "Kitchen #home" }),
      regular({
        id: "child",
        parent: "root",
        ord: "a0",
        title: "order the cabinets",
        desc: "measure first\n\n- the wall is not square\n- the floor is not level",
        date: "2026-08-10",
        done: "2026-08-11",
        after: ["root"],
      }),
      { id: "mirrored", parent: "root", ord: "a1", mirror: "child" },
      regular({ id: "quotes", parent: "root", ord: "a2", title: `he said "no"` }),
      regular({ id: "unicode", parent: "root", ord: "a3", title: "café — naïve 日本語" }),
    ]

    const text = serializeOutline(nodes)
    expect(text.split("\n")).toHaveLength(nodes.length + 1)

    const parsed = parseOutline("round-trip.jsonl", text)
    if (Result.isFailure(parsed)) {
      throw new Error(
        `the bytes this writer produced do not parse: ${
          parsed.failure.map((error) => `${error.line}: ${error.message}`).join("; ")
        }`,
      )
    }
    expect(parsed.success.nodes.map((located) => located.node)).toEqual([...nodes])
    expect(parsed.success.nodes.map((located) => located.line)).toEqual([1, 2, 3, 4, 5])
  })

  test("literal UTF-8, not \\u escapes", () => {
    expect(serializeOutline([regular({ title: "café" })])).toBe(
      `{"id":"n","ord":"a0","title":"café"}\n`,
    )
  })
})

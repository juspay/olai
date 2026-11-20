import { TEST_CLAIMS } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { MirrorNode, type Node, RegularNode } from "@olai/format"
import { parseOutline } from "olai-plugin-outline-olai/format"
import { serializeNode, serializeOutline } from "olai-plugin-outline-olai/format"

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

  test("an optional field holding nothing is not written at all", () => {
    const empty = serializeNode(
      regular({
        after: [],
        blocks: [],
        see: [],
        desc: "",
        date: null as unknown as string,
      }),
    )
    expect(empty).toBe(`{"id":"n","ord":"a0","title":"a node"}`)
    expect(empty).toBe(serializeNode(regular({})))
  })

  test("a non-empty array is written, so the rule is about EMPTY and not arrays", () => {
    expect(serializeNode(regular({ after: ["demo"], see: [] }))).toBe(
      `{"id":"n","ord":"a0","title":"a node","after":["demo"]}`,
    )
  })

  test("a required field is never dropped, however empty it is", () => {
    expect(serializeNode(regular({ title: "" }))).toBe(
      `{"id":"n","ord":"a0","title":""}`,
    )
    const mirror: MirrorNode = { id: "m", ord: "a0", mirror: "" }
    expect(serializeNode(mirror)).toBe(`{"id":"m","ord":"a0","mirror":""}`)
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

  test("custom keys are written alphabetically, whatever order the map holds", () => {
    expect(
      serializeNode(regular({ custom: { pr: "https://x/1", agent: "opus", terminal: "485c" } })),
    ).toBe(
      `{"id":"n","ord":"a0","title":"a node",` +
        `"custom":{"agent":"opus","pr":"https://x/1","terminal":"485c"}}`,
    )
  })

  test("a custom key holding nothing is not written, and an empty map is no field", () => {
    expect(serializeNode(regular({ custom: { pr: "", tags: [] } })))
      .toBe(`{"id":"n","ord":"a0","title":"a node"}`)
    expect(serializeNode(regular({ custom: {} })))
      .toBe(serializeNode(regular({})))
  })

  test("custom is written last, after every field the format gives a meaning", () => {
    expect(serializeNode(regular({ custom: { pr: "https://x/1" }, see: ["y"], date: "2026-08-10" })))
      .toBe(
        `{"id":"n","ord":"a0","title":"a node","date":"2026-08-10","see":["y"],` +
          `"custom":{"pr":"https://x/1"}}`,
      )
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
      regular({
        id: "hollow",
        parent: "root",
        ord: "a4",
        title: "nothing on it",
        after: [],
        see: [],
        desc: "",
      }),
    ]

    const expected: ReadonlyArray<Node> = nodes.map((node) =>
      node.id === "hollow"
        ? { id: "hollow", parent: "root", ord: "a4", title: "nothing on it" }
        : node
    )

    const text = serializeOutline(nodes)
    expect(text.split("\n")).toHaveLength(nodes.length + 1)

    const parsed = parseOutline("round-trip.olai", text, TEST_CLAIMS)
    if (Result.isFailure(parsed)) {
      throw new Error(
        `the bytes this writer produced do not parse: ${
          parsed.failure.map((error) => `${error.line}: ${error.message}`).join("; ")
        }`,
      )
    }
    expect(parsed.success.nodes.map((located) => located.node)).toEqual([...expected])
    expect(parsed.success.nodes.map((located) => located.line)).toEqual([1, 2, 3, 4, 5, 6])
  })

  test("literal UTF-8, not \\u escapes", () => {
    expect(serializeOutline([regular({ title: "café" })])).toBe(
      `{"id":"n","ord":"a0","title":"café"}\n`,
    )
  })

  test("every field of both record shapes has a place in the canonical order", () => {
    const ordered = new Set(orderOf(serializeNode(EVERY_REGULAR_FIELD)))
    for (const field of Object.keys(RegularNode.fields)) {
      expect(ordered.has(field)).toBe(true)
    }

    const mirrored = new Set(orderOf(serializeNode(EVERY_MIRROR_FIELD)))
    for (const field of Object.keys(MirrorNode.fields)) {
      expect(mirrored.has(field)).toBe(true)
    }
  })
})

const orderOf = (line: string): ReadonlyArray<string> =>
  Object.keys(JSON.parse(line) as Record<string, unknown>)

const EVERY_REGULAR_FIELD: RegularNode = {
  id: "n",
  parent: "p",
  ord: "a0",
  title: "a node",
  done: true,
  cancelled: true,
  doing: true,
  todo: true,
  started: "2026-08-11T08:30:00-04:00",
  worked: 123,
  date: "2026-08-11",
  repeat: "every week on monday",
  desc: "a note",
  after: ["x"],
  blocks: ["y"],
  see: ["z"],
  created: "2026-08-11T09:00:00-04:00",
  changed: "2026-08-11T10:00:00-04:00",
  custom: { pr: "https://x/1" },
}

const EVERY_MIRROR_FIELD: MirrorNode = {
  id: "m",
  parent: "p",
  ord: "a0",
  mirror: "n",
}

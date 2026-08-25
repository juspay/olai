import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { MirrorNode, type Node, RegularNode } from "./node.ts"
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

  /**
   * The four ways to spell "this node has no note and no edges" produce ONE
   * file. `undefined` is the schema's; `null`, `[]` and `""` are the three a
   * writer can reach for by accident, and docs/format.md's Writing section
   * says none of them may reach a file.
   *
   * The stake is the format's own bet: two files that mean the same thing must
   * not differ byte-for-byte, or a line-based git merge conflicts over nothing.
   */
  test("an optional field holding nothing is not written at all", () => {
    const empty = serializeNode(
      regular({
        after: [],
        blocks: [],
        see: [],
        desc: "",
        // `null` is not in the schema's type, but it is exactly what a writer
        // reaching for "clear this" produces, and it must not reach a file.
        date: null as unknown as string,
        doc: undefined,
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

  /**
   * The asymmetry, stated: a REQUIRED field is emitted whatever it holds.
   *
   * Dropping one makes a line the reader rejects outright — `\`title\` is
   * required and missing` — which is strictly worse than handing an odd value
   * to the validator that is about to see it anyway. The write gate validates
   * the whole set before any of these bytes are renamed into place.
   */
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

  /**
   * `custom` is the one field whose value has an INSIDE, so both writing rules
   * have to hold one level in as well: canonical order, and one spelling of
   * absence.
   *
   * A map straight from JSON carries whatever order somebody's editor left, and
   * two files that mean the same thing must not differ byte for byte — the
   * whole reason the fields above have a canonical order at all.
   */
  test("custom keys are written alphabetically, whatever order the map holds", () => {
    expect(
      serializeNode(regular({ custom: { pr: "https://x/1", agent: "opus", terminal: "485c" } })),
    ).toBe(
      `{"id":"n","ord":"a0","title":"a node",` +
        `"custom":{"agent":"opus","pr":"https://x/1","terminal":"485c"}}`,
    )
  })

  test("a custom key holding nothing is not written, and an empty map is no field", () => {
    // The `{"after":[]}` conflict-about-nothing, one level in: a key emptied
    // and a key removed are one file, so they cannot be two maps on disk.
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
      // Every empty spelling, in the middle of a real write: the record that
      // comes back has none of these keys, so the round-trip below compares it
      // against the one WITHOUT them.
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

    /** The same records as they will read back — the empty fields gone. */
    const expected: ReadonlyArray<Node> = nodes.map((node) =>
      node.id === "hollow"
        ? { id: "hollow", parent: "root", ord: "a4", title: "nothing on it" }
        : node
    )

    const text = serializeOutline(nodes)
    expect(text.split("\n")).toHaveLength(nodes.length + 1)

    const parsed = parseOutline("round-trip.olai", text)
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

  /**
   * The writer emits the fields it has an ORDER for, so a field the record
   * schema gained and that list did not would be dropped on the next write —
   * data that parsed, lost, by a writer every layer above believes. Which
   * fields EXIST now comes from the schema, so only the order is hand-written;
   * this is what makes forgetting to place a new one loud instead of lossy.
   * `todo` was exactly that edit.
   */
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

/** The keys of a serialized record, in the order the writer wrote them. */
const orderOf = (line: string): ReadonlyArray<string> =>
  Object.keys(JSON.parse(line) as Record<string, unknown>)

/** Every optional field carrying something, so nothing is omitted for being
 *  empty and what comes back is the writer's whole vocabulary. A field added
 *  to the schema without a value here fails the test above by its absence. */
const EVERY_REGULAR_FIELD: RegularNode = {
  id: "n",
  parent: "p",
  ord: "a0",
  title: "a node",
  done: true,
  cancelled: true,
  doing: true,
  todo: true,
  date: "2026-08-11",
  repeat: "every week on monday",
  desc: "a note",
  doc: "notes.md",
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

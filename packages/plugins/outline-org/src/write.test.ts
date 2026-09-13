import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { MirrorNode, type Node, RegularNode } from "@olai/format"
import { TEST_CLAIMS } from "./claims.testlib.ts"
import { parseOutline, serializeNode, serializeOutline } from "./format.ts"

const regular = (fields: Partial<RegularNode> = {}): RegularNode => ({
  id: "n",
  ord: "a0",
  title: "a node",
  ...fields,
})

describe("serializeNode", () => {
  test("writes one Org heading with native identity and ordered properties", () => {
    const text = serializeNode(regular({
      id: "order",
      parent: "kitchen",
      title: "order the cabinets",
      date: "2026-08-10",
      after: ["demo"],
      see: ["x"],
    }))
    expect(text).toBe(
      `* order the cabinets\n` +
        `:PROPERTIES:\n` +
        `:ID: order\n` +
        `:OLAI_KIND: regular\n` +
        `:OLAI_PARENT: "kitchen"\n` +
        `:OLAI_ORD: "a0"\n` +
        `:OLAI_TITLE: "order the cabinets"\n` +
        `:OLAI_DATE: "2026-08-10"\n` +
        `:OLAI_AFTER: ["demo"]\n` +
        `:OLAI_SEE: ["x"]\n` +
        `:END:`,
    )
  })

  test("omits optional fields that hold nothing", () => {
    const empty = serializeNode(regular({
      after: [],
      blocks: [],
      see: [],
      desc: "",
      custom: { blank: "", tags: [] },
    }))
    expect(empty).toBe(serializeNode(regular()))
    expect(empty).not.toContain("OLAI_DESC")
    expect(empty).not.toContain("OLAI_CUSTOM")
  })

  test("a required field is never dropped, however empty it is", () => {
    expect(serializeNode(regular({ title: "" }))).toContain(`:OLAI_TITLE: ""`)
    const mirror: MirrorNode = { id: "m", parent: "p", ord: "a0", mirror: "target" }
    const text = serializeNode(mirror)
    expect(text).toContain(":OLAI_KIND: mirror")
    expect(text).toContain(`:OLAI_MIRROR: "target"`)
    expect(text).not.toContain("OLAI_TITLE")
  })

  test("JSON-encodes arbitrary multiline Markdown on one property line", () => {
    const text = serializeNode(regular({ desc: "first\n* heading\n#+end_src" }))
    expect(text).toContain(`:OLAI_DESC: "first\\n* heading\\n#+end_src"`)
    expect(text.split("\n").filter((line) => line.startsWith(":OLAI_DESC:"))).toHaveLength(1)
  })

  test("custom keys are written alphabetically, whatever order the map holds", () => {
    const text = serializeNode(regular({
      custom: { pr: "https://x/1", agent: "opus", terminal: "485c" },
    }))
    expect(text).toContain(
      `:OLAI_CUSTOM: {"agent":"opus","pr":"https://x/1","terminal":"485c"}`,
    )
  })

  test("the heading face carries hostile bytes replaced; the title keeps them", () => {
    const title = "first\n* not-a-heading \"quoted\""
    const text = serializeNode(regular({ title }))
    // One structural heading line, whatever the title held.
    expect(text.split("\n")[0]).toBe("* first ↩ * not-a-heading \"quoted\"")
    expect(text).toContain(`:OLAI_TITLE: ${JSON.stringify(title)}`)
  })
})

describe("serializeOutline", () => {
  test("renders parentage as heading hierarchy and mirrors as headings", () => {
    const nodes: ReadonlyArray<Node> = [
      regular({ id: "root", title: "Kitchen" }),
      regular({ id: "child", parent: "root", title: "order" }),
      { id: "placed", parent: "root", ord: "a1", mirror: "child" },
    ]
    const text = serializeOutline(nodes)
    expect(text).toContain("* Kitchen\n")
    expect(text).toContain("** order\n")
    expect(text).toContain("** mirror of child\n")
    expect(text.endsWith("\n")).toBe(true)
    expect(text.endsWith("\n\n")).toBe(false)
  })

  test("an empty outline remains an empty file", () => {
    expect(serializeOutline([])).toBe("")
  })

  test("round-trips every record field and adversarial prose exactly", () => {
    const nodes: ReadonlyArray<Node> = [
      regular({
        id: "root",
        title: "TODO *Markdown* :tag:",
        done: "2026-08-29T12:26:44-04:00",
        started: "2026-08-29T09:52:00-04:00",
        worked: 9284,
        date: "2026-08-30",
        desc: "first\n* heading-looking\n#+end_src\n:PROPERTIES:",
        after: ["prior"],
        blocks: ["later"],
        see: ["related"],
        created: "2026-08-29T09:00:00-04:00",
        changed: "2026-08-29T12:26:44-04:00",
        custom: { agent: "opus", labels: ["one", "two"] },
      }),
      regular({ id: "child", parent: "root", ord: "a1", title: "child" }),
      { id: "placed", parent: "root", ord: "a2", mirror: "child" },
    ]
    const parsed = parseOutline("round-trip.org", serializeOutline(nodes), TEST_CLAIMS)
    if (Result.isFailure(parsed)) {
      throw new Error(
        `the bytes this writer produced do not parse: ${
          parsed.failure.map((error) => error.message).join("; ")
        }`,
      )
    }
    expect(parsed.success.nodes.map((located) => located.node)).toEqual([...nodes])
    expect(parsed.success.nodes.map((located) => located.line)).toEqual([1, 20, 29])
  })

  test("keeps literal UTF-8", () => {
    const text = serializeOutline([regular({ title: "café — 日本語" })])
    expect(text).toContain("* café — 日本語")
    expect(text).toContain(`:OLAI_TITLE: "café — 日本語"`)
  })

  /**
   * The writer emits the fields it has an ORDER for, so a field the record
   * schema gained and that list did not would be dropped on the next write —
   * data that parsed, lost, by a writer every layer above believes. Which
   * fields EXIST now comes from the schema, so only the order is hand-written;
   * this is what makes forgetting to place a new one loud instead of lossy.
   */
  test("every field of both record shapes has a place in the canonical order", () => {
    const ordered = new Set(fieldsOf(serializeNode(EVERY_REGULAR_FIELD)))
    for (const field of Object.keys(RegularNode.fields)) {
      expect(ordered.has(field as keyof RegularNode), field).toBe(true)
    }

    const mirrored = new Set(fieldsOf(serializeNode(EVERY_MIRROR_FIELD)))
    for (const field of Object.keys(MirrorNode.fields)) {
      expect(mirrored.has(field as keyof MirrorNode), field).toBe(true)
    }
  })
})

/** The record fields a serialized heading carries, from its drawer's keys. */
const fieldsOf = (text: string): ReadonlyArray<string> => {
  const fields: Array<string> = []
  for (const line of text.split("\n")) {
    const property = /^:([A-Z_]+): /.exec(line)?.[1]
    if (property === undefined) continue
    if (property === "ID") fields.push("id")
    if (property.startsWith("OLAI_")) fields.push(property.slice("OLAI_".length).toLowerCase())
  }
  return fields.filter((field) => field !== "kind")
}

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

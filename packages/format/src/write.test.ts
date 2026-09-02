import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import type { MirrorNode, Node, RegularNode } from "./node.ts"
import { parseOutline } from "./parse.ts"
import { serializeNode, serializeOutline } from "./write.ts"

const regular = (fields: Partial<RegularNode> = {}): RegularNode => ({
  id: "n",
  ord: "a0",
  title: "a node",
  ...fields,
})

describe("serializeNode", () => {
  test("writes one Org heading with native identity and ordered OLAI properties", () => {
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

  test("keeps required empty values and mirror shape", () => {
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

  test("writes custom keys canonically", () => {
    const text = serializeNode(regular({
      custom: { pr: "https://x/1", agent: "opus", terminal: "485c" },
    }))
    expect(text).toContain(
      `:OLAI_CUSTOM: {"agent":"opus","pr":"https://x/1","terminal":"485c"}`,
    )
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
        doc: "notes.md",
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
    const parsed = parseOutline("round-trip.org", serializeOutline(nodes))
    if (Result.isFailure(parsed)) {
      throw new Error(parsed.failure.map((error) => error.message).join("; "))
    }
    expect(parsed.success.nodes.map((located) => located.node)).toEqual([...nodes])
    expect(parsed.success.nodes.map((located) => located.line)).toEqual([1, 21, 30])
  })

  test("an empty outline remains an empty file", () => {
    expect(serializeOutline([])).toBe("")
  })

  test("keeps literal UTF-8", () => {
    const text = serializeOutline([regular({ title: "café — 日本語" })])
    expect(text).toContain("* café — 日本語")
    expect(text).toContain(`:OLAI_TITLE: "café — 日本語"`)
  })
})

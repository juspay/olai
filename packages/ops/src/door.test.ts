import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import {
  NO_KINDS,
  type OutlineSet,
  type WriteRequest as Request,
} from "@olai/format"

import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { type Barred, barred, doorRefusal } from "./door.ts"

import { plan, scoping } from "./plan.ts"

const vault = (): OutlineSet => setOf({
  "house.olai": [
    `{"id":"house","ord":"a0","title":"House"}`,
    `{"id":"kitchen","parent":"house","ord":"a0","title":"Kitchen"}`,
    `{"id":"sink","parent":"kitchen","ord":"a0","title":"the sink"}`,
    `{"id":"tap","parent":"kitchen","ord":"a1","title":"the tap","custom":{"approved":"always","chat-agent-sleep":"on"}}`,
    `{"id":"roof","parent":"house","ord":"a1","title":"the roof"}`,
  ].join("\n"),
}, [
  ["spare.md", "a document the door may rewrite\n"],
  ["notes/plan.md", "---\nchat-agent-session: claude:a1\ntopic: kitchen\n---\n# Plan\n"],
])

const SEATING = "chat-agent-session"

const APPROVAL = "approved"

const SAYS_SEATS = "it is what seats a conversation on a node"
const SAYS_APPROVES = "it is a person's approval of code"

const SLEEPING = "chat-agent-sleep"
const SAYS_SLEEPING = "it is whether olai may tidy this chat on its own"

const forbidden = new Map([
  [SEATING, SAYS_SEATS],
  [APPROVAL, SAYS_APPROVES],
  [SLEEPING, SAYS_SLEEPING],
])

const SAYS_TIDY = "olai is tidying this node's memory, and a turn nobody is watching writes only inside it"

const asked = (request: Request, keys: ReadonlyMap<string, string> = forbidden) => {
  const at = readingOf(vault())
  const planned = plan(scoping(at, steady(), NO_KINDS, "outline-olai"), request)
  if (Result.isFailure(planned)) throw new Error(planned.failure.message)
  return barred(keys, at.derived, planned.success, at.set)
}

const deep = (): OutlineSet => setOf({
  "chain.olai": Array.from({ length: 11 }, (_, at) => 10 - at)
    .map((level) =>
      `{"id":"d${level}"${level === 0 ? "" : `,"parent":"d${level - 1}"`},"ord":"a0","title":"level ${level}"}`)
    .join("\n"),
}, [["spare.md", "a document the door may rewrite\n"]])

const askedUnder = (request: Request, under: string, set: OutlineSet = vault(), stop?: ReadonlySet<string>) => {
  const at = readingOf(set)
  const planned = plan(scoping(at, steady(), NO_KINDS, "outline-olai"), request)
  if (Result.isFailure(planned)) throw new Error(planned.failure.message)
  return barred(forbidden, at.derived, planned.success, at.set, { under, says: SAYS_TIDY, stop })
}

describe("a confined session", () => {
  test("writes inside the subtree land, wherever the file is", () => {
    expect(askedUnder({ op: "done", id: "kitchen" }, "kitchen")).toBeNull()
    expect(askedUnder({ op: "done", id: "sink" }, "kitchen")).toBeNull()
    expect(askedUnder({ op: "add", parent: "sink", title: "buy a washer" }, "kitchen")).toBeNull()
    expect(askedUnder({ op: "prop", id: "tap", key: APPROVAL, value: "no" }, "kitchen"))
      .toEqual({ why: "key", id: "tap", title: "the tap", key: APPROVAL, says: SAYS_APPROVES })
  })

  test("a write outside is refused, and so is a row carried out of it", () => {
    expect(askedUnder({ op: "done", id: "roof" }, "kitchen"))
      .toEqual({ why: "outside", id: "roof", title: "the roof", says: SAYS_TIDY })
    expect(askedUnder({ op: "done", id: "house" }, "kitchen"))
      .toEqual({ why: "outside", id: "house", title: "House", says: SAYS_TIDY })
    expect(askedUnder({ op: "move", id: "sink", parent: "roof" }, "kitchen"))
      .toEqual({ why: "outside", id: "sink", title: "the sink", says: SAYS_TIDY })
    expect(askedUnder({ op: "move", id: "sink", parent: "tap" }, "kitchen")).toBeNull()
  })

  test("the fence reaches the bottom of a chain ten deep", () => {
    expect(askedUnder({ op: "done", id: "d10" }, "d0", deep())).toBeNull()
    expect(askedUnder({ op: "add", parent: "d10", title: "one deeper" }, "d0", deep())).toBeNull()
    expect(askedUnder({ op: "done", id: "d0" }, "d10", deep()))
      .toEqual({ why: "outside", id: "d0", title: "level 0", says: SAYS_TIDY })
  })

  test("a nested node agent's own subtree is outside the fence", () => {
    const others = new Set(["sink"])
    expect(askedUnder({ op: "done", id: "tap" }, "kitchen", vault(), others)).toBeNull()
    expect(askedUnder({ op: "done", id: "sink" }, "kitchen", vault(), others))
      .toEqual({ why: "outside", id: "sink", title: "the sink", says: SAYS_TIDY })
  })

  test("the refusal says why, in the fence's own words", () => {
    expect(doorRefusal({ why: "outside", id: "roof", title: "the roof", says: SAYS_TIDY }))
      .toContain(SAYS_TIDY)
    expect(doorRefusal({ why: "trash", says: SAYS_TIDY })).toContain(SAYS_TIDY)
  })
})

describe("node-agent write rule", () => {
  test("writes land anywhere in the vault, including outside the seat's subtree", () => {
    expect(asked({ op: "done", id: "kitchen" })).toBeNull()
    expect(asked({ op: "done", id: "sink" })).toBeNull()
    expect(asked({ op: "add", parent: "sink", title: "buy a washer" })).toBeNull()
    expect(asked({ op: "done", id: "roof" })).toBeNull()
    expect(asked({ op: "move", id: "sink", parent: "roof" })).toBeNull()
    expect(asked({ op: "move", id: "roof", parent: "kitchen" })).toBeNull()
  })

  test("a document write and a file delete land", () => {
    expect(asked({ op: "create-doc", file: "notes.md", text: "hello" })).toBeNull()
    expect(asked({ op: "doc", file: "spare.md", text: "rewritten" })).toBeNull()
    expect(asked({ op: "delete", file: "spare.md" })).toBeNull()
  })

  test("a forbidden property is forbidden even on the agent's own node", () => {
    expect(asked({ op: "prop", id: "kitchen", key: SEATING, value: "claude:s2" }))
      .toEqual({ why: "key", id: "kitchen", title: "Kitchen", key: SEATING, says: SAYS_SEATS })
  })

  test("...and the approval one is refused on a node the agent otherwise owns", () => {
    expect(asked({ op: "prop", id: "kitchen", key: APPROVAL, value: "always" }))
      .toEqual({ why: "key", id: "kitchen", title: "Kitchen", key: APPROVAL, says: SAYS_APPROVES })
    expect(asked({
      op: "apply",
      ops: [{ op: "prop", id: "sink", key: APPROVAL, value: "always" }],
    })?.why).toBe("key")
    expect(
      asked({ op: "add", parent: "sink", title: "a plugin", props: { [APPROVAL]: "always" } })?.why,
    ).toBe("key")
  })

  test("...and taking one off is writing it, because the rule reads a movement", () => {
    expect(asked({ op: "prop", id: "tap", key: APPROVAL, value: null })?.why).toBe("key")
  })

  test("...and the sleeping mark is refused on the agent's own node too", () => {
    expect(asked({ op: "prop", id: "kitchen", key: SLEEPING, value: "on" }))
      .toEqual({ why: "key", id: "kitchen", title: "Kitchen", key: SLEEPING, says: SAYS_SLEEPING })
    expect(asked({ op: "prop", id: "tap", key: SLEEPING, value: null })?.why).toBe("key")
  })

  test("a closed rule's refusal does not walk the plan", () => {
    expect(doorRefusal({ why: "closed" })).toContain("conversation has been reaped")
  })

  test("the refusal quotes the clause the rule carried for that key", () => {
    const reached = asked({ op: "prop", id: "kitchen", key: APPROVAL, value: "always" })
    if (reached === null) throw new Error("the forbidden write landed")
    const words = doorRefusal(reached)
    expect(words).toContain(SAYS_APPROVES)
    expect(words).not.toContain(SAYS_SEATS)
    expect(words).not.toContain("nearest node agent")
  })
})

describe("file-scoped agent reservation", () => {
  const file = "_olai/Settings.olai"
  const keys = new Map([["on", { file: "settings.olai", says: "a person's choice" }]])
  const check = (request: Request, value?: string) => {
    const at = readingOf(setOf({
      [file]: JSON.stringify({ id: "example", ord: "a0", title: "example",
        ...(value === undefined ? {} : { custom: { on: value } }) }),
      "notes.olai": '{"id":"notes","ord":"a0","title":"notes"}',
    }))
    const result = plan(scoping(at, steady(), NO_KINDS, "outline-olai"), request)
    if (Result.isFailure(result)) throw new Error(result.failure.message)
    return barred(keys, at.derived, result.success, at.set)
  }

  const keyOf = (reached: Barred | null): string | undefined =>
    reached !== null && reached.why === "key" ? reached.key : undefined

  test("both directions, removal, and a batch reach the same reservation", () => {
    for (const value of ["yes", "no", null]) {
      expect(keyOf(check({ op: "prop", id: "example", key: "on", value }, value === "yes" ? "no" : "yes"))).toBe("on")
    }
    expect(keyOf(check({ op: "apply", ops: [{ op: "prop", id: "example", key: "on", value: "yes" }] }))).toBe("on")
  })

  test("behaviour knobs and ordinary files remain writable", () => {
    expect(check({ op: "prop", id: "example", key: "interval", value: "30s" }, "yes")).toBeNull()
    expect(check({ op: "prop", id: "notes", key: "on", value: "yes" })).toBeNull()
  })

  test("moving or trashing its namespace cannot remove the choice", () => {
    expect(keyOf(check({ op: "trash", id: "example" }, "yes"))).toBe("on")
    expect(keyOf(check({ op: "move", id: "example", parent: "notes" }, "yes"))).toBe("on")
  })

  test("a duplicate namespace cannot shadow an existing choice", () => {
    const at = readingOf(setOf({ [file]: '{"id":"example","ord":"a1","title":"example","custom":{"on":"no"}}' }))
    const nodes = at.derived.nodes.map(one => one.node)
    const shadow = readingOf(setOf({ [file]: '{"id":"shadow","ord":"a0","title":"example"}' })).derived.nodes[0]!.node
    expect(keyOf(barred(keys, at.derived, { files: [{ file, nodes: [shadow, ...nodes] }], id: "shadow", title: "example", file, summary: "shadow" }, at.set))).toBe("on")
  })

  test("a shallower empty file cannot mask an existing choice", () => {
    const at = readingOf(setOf({ [file]: '{"id":"example","ord":"a0","title":"example","custom":{"on":"no"}}' }))
    expect(keyOf(barred(keys, at.derived, { files: [{ file: "SETTINGS.olai", nodes: [] }], id: "", title: "", file: "SETTINGS.olai", summary: "mask file" }, at.set))).toBe("on")
  })
})

describe("a reserved key in a document's front matter", () => {
  const note = "notes/plan.md"
  const block = (said: string) => `---\n${said}topic: kitchen\n---\n# Plan\n`

  test("writing, changing or dropping the binding in a note is refused", () => {
    for (const text of [
      block("chat-agent-session: grok\n"),
      block(""),
      "# Plan\n",
    ]) {
      expect(asked({ op: "doc", file: note, text }))
        .toEqual({ why: "document", file: note, key: SEATING, says: SAYS_SEATS })
    }
    expect(asked({ op: "doc", file: "spare.md", text: "---\nchat-agent-session: claude\n---\nhi\n" }))
      .toEqual({ why: "document", file: "spare.md", key: SEATING, says: SAYS_SEATS })
    expect(asked({ op: "delete", file: note }))
      .toEqual({ why: "document", file: note, key: SEATING, says: SAYS_SEATS })
  })

  test("a write that leaves the key where it was lands", () => {
    expect(asked({ op: "doc", file: note, text: "---\nchat-agent-session: claude:a1\ntopic: hinges\n---\n# Hinges\n" }))
      .toBeNull()
    expect(asked({ op: "doc", file: note, text: "---\ntopic: kitchen\nchat-agent-session: claude:a1\nowner: alice\n---\n" }))
      .toBeNull()
    expect(asked({ op: "doc", file: "spare.md", text: "rewritten\n" })).toBeNull()
    expect(asked({ op: "create-doc", file: "notes/new.md", text: "# New\n" })).toBeNull()
  })

  test("the refusal names the file, and says why in the ticket's words", () => {
    const words = doorRefusal({ why: "document", file: note, key: SEATING, says: SAYS_SEATS })
    expect(words).toContain(note)
    expect(words).toContain(SEATING)
    expect(words).toContain(SAYS_SEATS)
  })
})

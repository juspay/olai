import { expect, test } from "bun:test"

import { frontmatterIn, matterWith, proseIn } from "./frontmatter.ts"

test("a closed block at the top of the file is not prose", () => {
  expect(proseIn("---\ntitle: x\n---\n\n# Real\n")).toBe("\n# Real\n")
  expect(proseIn("---\n---\n# Real\n")).toBe("# Real\n")
  expect(proseIn("# Real\n")).toBe("# Real\n")
  expect(proseIn("")).toBe("")
})

test("an unclosed block is not frontmatter at all", () => {
  expect(proseIn("---\ntitle: x\n\n# Real\n")).toBe("---\ntitle: x\n\n# Real\n")
  expect(frontmatterIn("---\ntitle: x\n\n# Real\n")).toEqual({})
})

test("only the first line opens the block, and only as three dashes", () => {
  expect(proseIn("Prose.\n\n---\ntitle: x\n---\n")).toBe("Prose.\n\n---\ntitle: x\n---\n")
  expect(proseIn("----\ntitle: x\n---\n# Real\n")).toBe("----\ntitle: x\n---\n# Real\n")
  expect(proseIn(" ---\ntitle: x\n---\n# Real\n")).toBe(" ---\ntitle: x\n---\n# Real\n")
})

test("the closing fence is the same three dashes and nothing else", () => {
  expect(proseIn("---\na: 1\n----\n# Real\n")).toBe("---\na: 1\n----\n# Real\n")
  expect(proseIn("---\na: 1\n ---\n# Real\n")).toBe("---\na: 1\n ---\n# Real\n")
  expect(proseIn("---\na: 1\n...\n# Real\n")).toBe("---\na: 1\n...\n# Real\n")
  expect(proseIn("--- \na: 1\n---\t\n# Real\n")).toBe("# Real\n")
  expect(frontmatterIn("--- \na: 1\n---\t\n# Real\n")).toEqual({ a: "1" })
})

test("a CRLF file opens and closes the same block", () => {
  expect(proseIn("---\r\ntitle: x\r\n---\r\n# Real\r\n")).toBe("# Real\r\n")
  expect(frontmatterIn("---\r\ntitle: x\r\n---\r\n")).toEqual({ title: "x" })
})

test("a plain scalar is the text somebody typed", () => {
  expect(frontmatterIn("---\ntitle: The kitchen plan\nstage: 2\nopen: true\n---\n")).toEqual({
    title: "The kitchen plan",
    stage: "2",
    open: "true",
  })
  expect(frontmatterIn("---\npr: https://github.com/x/y/pull/1\n---\n")).toEqual({
    pr: "https://github.com/x/y/pull/1",
  })
  expect(frontmatterIn("---\nhttps://x.test\n---\n")).toEqual({})
})

test("a comment is not a value and not a key", () => {
  expect(frontmatterIn("---\n# a note\ntitle: x # and another\n---\n")).toEqual({ title: "x" })
  expect(frontmatterIn("---\ntopic: kitchen#2\n---\n")).toEqual({ topic: "kitchen#2" })
  expect(frontmatterIn("---\npr: #176\n---\n")).toEqual({})
  expect(frontmatterIn('---\npr: "#176"\n---\n')).toEqual({ pr: "#176" })
})

test("a quoted scalar keeps what the quotes hold", () => {
  expect(frontmatterIn('---\ntitle: "x: y # z"\n---\n')).toEqual({ title: "x: y # z" })
  expect(frontmatterIn("---\ntitle: 'it''s here'\n---\n")).toEqual({ title: "it's here" })
  expect(frontmatterIn('---\ntitle: "say \\"go\\""\n---\n')).toEqual({ title: 'say "go"' })
  expect(frontmatterIn('---\npath: "a\\nb"\n---\n')).toEqual({ path: "a\\nb" })
  expect(frontmatterIn('---\ntitle: "x" and more\n---\n')).toEqual({})
})

test("a list is a list, flow or block", () => {
  expect(frontmatterIn("---\nowners: [alice, bob]\n---\n")).toEqual({ owners: ["alice", "bob"] })
  expect(frontmatterIn('---\nowners: ["a, b", c]\n---\n')).toEqual({ owners: ["a, b", "c"] })
  expect(frontmatterIn("---\nowners:\n  - alice\n  - bob\n---\n")).toEqual({
    owners: ["alice", "bob"],
  })
  expect(frontmatterIn("---\nowners:\n- alice\n- bob\nstage: 2\n---\n")).toEqual({
    owners: ["alice", "bob"],
    stage: "2",
  })
})

test("a key holding nothing is a key the document does not carry", () => {
  expect(frontmatterIn("---\ntitle:\nstage: 2\n---\n")).toEqual({ stage: "2" })
  expect(frontmatterIn('---\ntitle: ""\n---\n')).toEqual({})
  expect(frontmatterIn("---\nowners: []\n---\n")).toEqual({})
  expect(frontmatterIn("---\n\n---\n")).toEqual({})
})

test("a key written twice keeps its first claim", () => {
  expect(frontmatterIn("---\ntitle: first\ntitle: second\n---\n")).toEqual({ title: "first" })
})

test("a value with no shape a property can hold is a key that is not there", () => {
  const body = [
    "---",
    "author:",
    "  name: alice",
    "  team: kitchen",
    "notes: |",
    "  a block scalar",
    "point: { x: 1 }",
    "nested: [[a], b]",
    "anchored: &one x",
    "aliased: *one",
    "tagged: !!str 5",
    "stage: 2",
    "---",
  ].join("\n")
  expect(frontmatterIn(body)).toEqual({ stage: "2" })
})

test("a refused member refuses the list", () => {
  expect(frontmatterIn("---\nowners:\n  - alice\n  - { b: 1 }\n---\n")).toEqual({})
  expect(frontmatterIn("---\nowners: [alice, [bob]]\n---\n")).toEqual({})
  expect(frontmatterIn("---\nowners:\n  -\n  - bob\n---\n")).toEqual({})
})

test("a # in a flow sequence refuses the list, quoted is how it is written", () => {
  expect(frontmatterIn("---\ntags: [#home, #kitchen]\n---\n")).toEqual({})
  expect(frontmatterIn("---\ntags: [#home]\n---\n")).toEqual({})
  expect(frontmatterIn("---\ntags: [a, #b]\n---\n")).toEqual({})
  expect(frontmatterIn("---\ntags: [a #b, c]\n---\n")).toEqual({})
  expect(frontmatterIn("---\ntags: [a, b #c]\n---\n")).toEqual({})
  expect(frontmatterIn("---\ntags: ['#home', '#kitchen']\n---\n"))
    .toEqual({ tags: ["#home", "#kitchen"] })
  expect(frontmatterIn("---\ntags: [kitchen#2, x]\n---\n"))
    .toEqual({ tags: ["kitchen#2", "x"] })
})

test("a block whose whole content is a sequence carries no properties", () => {
  expect(frontmatterIn("---\n- alice\n- bob\n---\n")).toEqual({})
})

const SEAT = "chat-agent-session"

test("a key set reads back as that value, and the prose is untouched", () => {
  const was = "---\ntopic: kitchen\n---\n# Plan\n\nbuy hinges\n"
  const now = matterWith(was, [[SEAT, "claude:a1"]])
  expect(now).toBe("---\ntopic: kitchen\nchat-agent-session: claude:a1\n---\n# Plan\n\nbuy hinges\n")
  expect(frontmatterIn(now)[SEAT]).toBe("claude:a1")
  expect(frontmatterIn(now).topic).toBe("kitchen")
  expect(proseIn(now)).toBe(proseIn(was))
})

test("a key the block already writes is replaced where it stands", () => {
  const was = "---\nchat-agent-session: claude\ntopic: kitchen\n---\nhi\n"
  expect(matterWith(was, [[SEAT, "grok:b2"]]))
    .toBe("---\nchat-agent-session: grok:b2\ntopic: kitchen\n---\nhi\n")
})

test("everything the writer was not asked about keeps its bytes", () => {
  const was = "---\n# the block a person wrote\nowner:\n  name: alice\nweird:   spaced   \ntopic: [a, b]\n\n---\nhi\n"
  const now = matterWith(was, [[SEAT, "claude"]])
  expect(now).toBe(
    "---\n# the block a person wrote\nowner:\n  name: alice\nweird:   spaced   \ntopic: [a, b]\n\nchat-agent-session: claude\n---\nhi\n",
  )
})

test("a block is made at the top of a file that has none", () => {
  expect(matterWith("# Plan\n", [[SEAT, "claude"]])).toBe("---\nchat-agent-session: claude\n---\n# Plan\n")
  expect(matterWith("", [[SEAT, "claude"]])).toBe("---\nchat-agent-session: claude\n---\n")
  expect(matterWith("# Plan\n", [[SEAT, null]])).toBe("# Plan\n")
})

test("an unclosed `---` is not a block, so the new one goes above it", () => {
  const was = "---\ntopic: kitchen\n# Plan\n"
  const now = matterWith(was, [[SEAT, "claude"]])
  expect(now).toBe("---\nchat-agent-session: claude\n---\n---\ntopic: kitchen\n# Plan\n")
  expect(frontmatterIn(now)).toEqual({ [SEAT]: "claude" })
  expect(proseIn(now)).toBe(was)
})

test("taking the last key off takes the block with it", () => {
  expect(matterWith("---\nchat-agent-session: claude\n---\n# Plan\n", [[SEAT, null]])).toBe("# Plan\n")
  expect(matterWith("---\ntopic: kitchen\nchat-agent-session: claude\n---\nhi\n", [[SEAT, null]]))
    .toBe("---\ntopic: kitchen\n---\nhi\n")
  expect(matterWith("---\ntopic: kitchen\n---\nhi\n", [[SEAT, null]])).toBe("---\ntopic: kitchen\n---\nhi\n")
  expect(matterWith("---\n# mine\nchat-agent-session: claude\n---\nhi\n", [[SEAT, null]]))
    .toBe("---\n# mine\n---\nhi\n")
})

test("a key holding a block list is replaced WHOLE", () => {
  const was = "---\nowners:\n  - alice\n  - bob\ntopic: kitchen\n---\nhi\n"
  expect(matterWith(was, [["owners", "alice"]])).toBe("---\nowners: alice\ntopic: kitchen\n---\nhi\n")
  expect(matterWith(was, [["owners", null]])).toBe("---\ntopic: kitchen\n---\nhi\n")
})

test("a key written twice is one key, so every entry of it goes", () => {
  const was = "---\ntopic: kitchen\nchat-agent-session: claude\nchat-agent-session: grok\n---\nhi\n"
  expect(matterWith(was, [[SEAT, null]])).toBe("---\ntopic: kitchen\n---\nhi\n")
  expect(matterWith(was, [[SEAT, "grok:b2"]]))
    .toBe("---\ntopic: kitchen\nchat-agent-session: grok:b2\n---\nhi\n")
})

test("a value is quoted exactly when the plain spelling would not read back", () => {
  const held = (value: string) => frontmatterIn(matterWith("---\ntopic: kitchen\n---\n", [["said", value]])).said
  const written = (value: string) => matterWith("---\ntopic: kitchen\n---\n", [["said", value]]).split("\n")[2]
  for (const value of ["claude:a1", "kitchen#2", "beside", 'say "hi"', "x: y", "-", "a\\b"]) {
    expect(written(value)).toBe(`said: ${value}`)
    expect(held(value)).toBe(value)
  }
  for (const value of ["a # b", "[a, b]", "  padded  ", "'quoted'", "#176", '"both"']) {
    expect(written(value)?.startsWith(`said: "`)).toBe(true)
    expect(held(value)).toBe(value)
  }
})

test("a file written on Windows keeps its line endings", () => {
  const was = "---\r\ntopic: kitchen\r\nchat-agent-session: claude\r\n---\r\n# Plan\r\n"
  const now = matterWith(was, [[SEAT, "grok"], ["chat-opens", "beside"]])
  expect(now).toBe("---\r\ntopic: kitchen\r\nchat-agent-session: grok\r\nchat-opens: beside\r\n---\r\n# Plan\r\n")
  expect(frontmatterIn(now)).toEqual({ topic: "kitchen", [SEAT]: "grok", "chat-opens": "beside" })
  expect(proseIn(now)).toBe("# Plan\r\n")
  expect(matterWith("# Plan\r\n", [[SEAT, "claude"]])).toBe("---\r\nchat-agent-session: claude\r\n---\r\n# Plan\r\n")
})

test("several changes land in one pass, including a set and a removal", () => {
  const was = "---\nchat-agent-session: claude\nchat-opens: beside\ntopic: kitchen\n---\nhi\n"
  expect(matterWith(was, [[SEAT, null], ["chat-opens", null]])).toBe("---\ntopic: kitchen\n---\nhi\n")
  expect(matterWith(was, [[SEAT, "grok"], ["chat-opens", "alone"], ["topic", null]]))
    .toBe("---\nchat-agent-session: grok\nchat-opens: alone\n---\nhi\n")
  expect(matterWith(was, [[SEAT, "grok"], [SEAT, null]])).toBe("---\nchat-opens: beside\ntopic: kitchen\n---\nhi\n")
  expect(matterWith("---\ntopic: kitchen\n---\nhi\n", [["said", "a"], ["said", "b"]]))
    .toBe("---\ntopic: kitchen\nsaid: b\n---\nhi\n")
})

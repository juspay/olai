/**
 * The `---` block: where it ends, and what a reader gets out of it.
 *
 * Two rules, and this file is the RULES THEMSELVES, written out: what
 * `proseIn` and `frontmatterIn` answer, corner by corner, in the vocabulary of
 * this package alone. Nothing here reaches for a library.
 *
 * That is deliberate, and it is half of a pair. Neither rule is ours to invent
 * — a `.md` in somebody's vault is read by GitHub, by an editor, by a static
 * site builder — so each is FENCED against the real thing in a file of its
 * own, where the library lives as a devDependency and nothing ships it:
 *
 *   - WHERE IT ENDS — `@olai/web`'s `markdown/frontmatter.test.ts`, which
 *     renders every corner below through `remark-frontmatter` and through
 *     `proseIn` and requires the same page.
 *   - WHAT A VALUE IS — `./frontmatter.library.test.ts`, which asks `yaml`
 *     the same lines and requires that we agree, refuse together, or are
 *     narrower for a reason the module header argues by name.
 *
 * So the sentences below are the readable statement of the rule and those two
 * are what keep it honest. Both include, deliberately, the REFUSALS: a key
 * this reading will not read is a key the document does not carry, and that
 * has to be as pinned as the ones it does.
 */

import { expect, test } from "bun:test"

import { proseIn } from "@olai/prose/frontmatter.ts"
import { frontmatterIn, matterWith } from "./frontmatter.ts"

// ── where the block ends ───────────────────────────────────────────────

test("a closed block at the top of the file is not prose", () => {
  expect(proseIn("---\ntitle: x\n---\n\n# Real\n")).toBe("\n# Real\n")
  // An empty block is still a block.
  expect(proseIn("---\n---\n# Real\n")).toBe("# Real\n")
  // …and a body that carries none is handed straight back.
  expect(proseIn("# Real\n")).toBe("# Real\n")
  expect(proseIn("")).toBe("")
})

// The expensive corner, and the one the scanner this replaced got wrong: it
// read everything after an unclosed `---` as frontmatter, so a document that
// opened with a thematic break lost every heading it had. What the renderer
// draws is a rule and a paragraph, and this is that answer.
test("an unclosed block is not frontmatter at all", () => {
  expect(proseIn("---\ntitle: x\n\n# Real\n")).toBe("---\ntitle: x\n\n# Real\n")
  expect(frontmatterIn("---\ntitle: x\n\n# Real\n")).toEqual({})
})

// The fence is the FIRST line and it is exactly three dashes. A `---` further
// down is the thematic break it has always been.
test("only the first line opens the block, and only as three dashes", () => {
  expect(proseIn("Prose.\n\n---\ntitle: x\n---\n")).toBe("Prose.\n\n---\ntitle: x\n---\n")
  expect(proseIn("----\ntitle: x\n---\n# Real\n")).toBe("----\ntitle: x\n---\n# Real\n")
  expect(proseIn(" ---\ntitle: x\n---\n# Real\n")).toBe(" ---\ntitle: x\n---\n# Real\n")
})

// Neither a longer rule nor an indented one closes it, and YAML's own `...`
// does not either — the yaml preset takes the dash fence alone.
test("the closing fence is the same three dashes and nothing else", () => {
  expect(proseIn("---\na: 1\n----\n# Real\n")).toBe("---\na: 1\n----\n# Real\n")
  expect(proseIn("---\na: 1\n ---\n# Real\n")).toBe("---\na: 1\n ---\n# Real\n")
  expect(proseIn("---\na: 1\n...\n# Real\n")).toBe("---\na: 1\n...\n# Real\n")
  // Trailing whitespace is what a line ending drags along, on either fence.
  expect(proseIn("--- \na: 1\n---\t\n# Real\n")).toBe("# Real\n")
  expect(frontmatterIn("--- \na: 1\n---\t\n# Real\n")).toEqual({ a: "1" })
})

// A file written on Windows is the same document as one written anywhere else.
test("a CRLF file opens and closes the same block", () => {
  expect(proseIn("---\r\ntitle: x\r\n---\r\n# Real\r\n")).toBe("# Real\r\n")
  expect(frontmatterIn("---\r\ntitle: x\r\n---\r\n")).toEqual({ title: "x" })
})

// ── what a value is ────────────────────────────────────────────────────

test("a plain scalar is the text somebody typed", () => {
  expect(frontmatterIn("---\ntitle: The kitchen plan\nstage: 2\nopen: true\n---\n")).toEqual({
    title: "The kitchen plan",
    // A number and a boolean arrive as TEXT, which is `./custom.ts`'s standing
    // ruling: a value that wants to be a number can be one the day a reading
    // needs it.
    stage: "2",
    open: "true",
  })
  // A colon inside a value is a colon; a colon with no space after it is not a
  // separator, so a bare URL is not a key.
  expect(frontmatterIn("---\npr: https://github.com/x/y/pull/1\n---\n")).toEqual({
    pr: "https://github.com/x/y/pull/1",
  })
  expect(frontmatterIn("---\nhttps://x.test\n---\n")).toEqual({})
})

test("a comment is not a value and not a key", () => {
  expect(frontmatterIn("---\n# a note\ntitle: x # and another\n---\n")).toEqual({ title: "x" })
  // A `#` with no whitespace in front of it is part of the word.
  expect(frontmatterIn("---\ntopic: kitchen#2\n---\n")).toEqual({ topic: "kitchen#2" })
  // …and one directly after the colon's space starts a comment, so the key
  // holds nothing at all.
  expect(frontmatterIn("---\npr: #176\n---\n")).toEqual({})
  expect(frontmatterIn('---\npr: "#176"\n---\n')).toEqual({ pr: "#176" })
})

test("a quoted scalar keeps what the quotes hold", () => {
  expect(frontmatterIn('---\ntitle: "x: y # z"\n---\n')).toEqual({ title: "x: y # z" })
  expect(frontmatterIn("---\ntitle: 'it''s here'\n---\n")).toEqual({ title: "it's here" })
  expect(frontmatterIn('---\ntitle: "say \\"go\\""\n---\n')).toEqual({ title: 'say "go"' })
  // Every other backslash sequence is left as written rather than guessed at.
  expect(frontmatterIn('---\npath: "a\\nb"\n---\n')).toEqual({ path: "a\\nb" })
  // A closing quote that is not the last character is a value this does not
  // read, so the key is one the document does not carry.
  expect(frontmatterIn('---\ntitle: "x" and more\n---\n')).toEqual({})
})

test("a list is a list, flow or block", () => {
  expect(frontmatterIn("---\nowners: [alice, bob]\n---\n")).toEqual({ owners: ["alice", "bob"] })
  expect(frontmatterIn('---\nowners: ["a, b", c]\n---\n')).toEqual({ owners: ["a, b", "c"] })
  expect(frontmatterIn("---\nowners:\n  - alice\n  - bob\n---\n")).toEqual({
    owners: ["alice", "bob"],
  })
  // YAML lets a block sequence sit at the key's own indent, and so does this.
  expect(frontmatterIn("---\nowners:\n- alice\n- bob\nstage: 2\n---\n")).toEqual({
    owners: ["alice", "bob"],
    stage: "2",
  })
})

// The writer's own rule for absence, read one map in (`./write.ts`'s
// `nothing`): a key holding nothing is a key the document does not carry, so
// `title:` and no `title` at all are one document.
test("a key holding nothing is a key the document does not carry", () => {
  expect(frontmatterIn("---\ntitle:\nstage: 2\n---\n")).toEqual({ stage: "2" })
  expect(frontmatterIn('---\ntitle: ""\n---\n')).toEqual({})
  expect(frontmatterIn("---\nowners: []\n---\n")).toEqual({})
  expect(frontmatterIn("---\n\n---\n")).toEqual({})
})

// A later line silently replacing an earlier one is the kind of thing a person
// has to run the parser to see — so the first claim is the one that stands,
// exactly as the id table does it (`./derive.ts`'s `byId`).
test("a key written twice keeps its first claim", () => {
  expect(frontmatterIn("---\ntitle: first\ntitle: second\n---\n")).toEqual({ title: "first" })
})

// The refusals, and the shape of them: ONE KEY at a time. A block this reading
// cannot follow whole still hands over every key it can, because a document is
// not a file that fails to parse — it is prose with a record on top, and the
// prose is the part a reader came for.
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

// An item this reading refuses takes the whole list with it, because a list a
// reader would see one member short is worse than a key they can see is
// missing.
test("a refused member refuses the list", () => {
  expect(frontmatterIn("---\nowners:\n  - alice\n  - { b: 1 }\n---\n")).toEqual({})
  expect(frontmatterIn("---\nowners: [alice, [bob]]\n---\n")).toEqual({})
  expect(frontmatterIn("---\nowners:\n  -\n  - bob\n---\n")).toEqual({})
})

/**
 * A `#` IN A FLOW SEQUENCE refuses the list, and it is worth its own case
 * because the shape is so inviting: `tags: [#home, #kitchen]` reads like a
 * list of two tags and is a list to nobody. A plain scalar may not OPEN with a
 * `#`, so `yaml` refuses that document outright; and a `#` with whitespace in
 * front of it opens a COMMENT that runs to the end of the line, taking the
 * closing bracket with it, so `[a #b, c]` is a sequence nobody closed. Reading
 * either as the members left over would be handing back a list assembled out
 * of what a comment ate.
 *
 * `./frontmatter.library.test.ts` holds every line here against the real
 * parser, which refuses all five and reads both spellings that work.
 */
test("a # in a flow sequence refuses the list, quoted is how it is written", () => {
  expect(frontmatterIn("---\ntags: [#home, #kitchen]\n---\n")).toEqual({})
  expect(frontmatterIn("---\ntags: [#home]\n---\n")).toEqual({})
  expect(frontmatterIn("---\ntags: [a, #b]\n---\n")).toEqual({})
  expect(frontmatterIn("---\ntags: [a #b, c]\n---\n")).toEqual({})
  expect(frontmatterIn("---\ntags: [a, b #c]\n---\n")).toEqual({})
  // The two spellings that DO work, so the refusal above reads as a rule
  // rather than as "hashes are unwelcome": quote the member, or write a `#`
  // with no whitespace in front of it.
  expect(frontmatterIn("---\ntags: ['#home', '#kitchen']\n---\n"))
    .toEqual({ tags: ["#home", "#kitchen"] })
  expect(frontmatterIn("---\ntags: [kitchen#2, x]\n---\n"))
    .toEqual({ tags: ["kitchen#2", "x"] })
})

// A stray `- item` above every key belongs to nothing — a top-level sequence
// is a YAML document with no keys in it, and a document's properties are keys.
test("a block whose whole content is a sequence carries no properties", () => {
  expect(frontmatterIn("---\n- alice\n- bob\n---\n")).toEqual({})
})

// ── and the block, WRITTEN ─────────────────────────────────────────────
//
// The writer's whole promise is in two halves, and every case below is one of
// them: the keys it was handed say what they were told to say, and every other
// byte of the file is the byte it was. So the assertions are mostly literal
// text — a splice is only as good as what it left alone.

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
  // A comment, a key this reading refuses to read, a nested map, odd spacing
  // and a blank line: none of it is the writer's to tidy.
  const was = "---\n# the block a person wrote\nowner:\n  name: alice\nweird:   spaced   \ntopic: [a, b]\n\n---\nhi\n"
  const now = matterWith(was, [[SEAT, "claude"]])
  expect(now).toBe(
    "---\n# the block a person wrote\nowner:\n  name: alice\nweird:   spaced   \ntopic: [a, b]\n\nchat-agent-session: claude\n---\nhi\n",
  )
})

test("a block is made at the top of a file that has none", () => {
  expect(matterWith("# Plan\n", [[SEAT, "claude"]])).toBe("---\nchat-agent-session: claude\n---\n# Plan\n")
  expect(matterWith("", [[SEAT, "claude"]])).toBe("---\nchat-agent-session: claude\n---\n")
  // ...and a file nothing is set in is the file it was.
  expect(matterWith("# Plan\n", [[SEAT, null]])).toBe("# Plan\n")
})

test("an unclosed `---` is not a block, so the new one goes above it", () => {
  // `matterIn`'s rule, kept by the writer: micromark reads an unclosed fence
  // as prose, so writing into it would be writing into somebody's text.
  const was = "---\ntopic: kitchen\n# Plan\n"
  const now = matterWith(was, [[SEAT, "claude"]])
  expect(now).toBe("---\nchat-agent-session: claude\n---\n---\ntopic: kitchen\n# Plan\n")
  expect(frontmatterIn(now)).toEqual({ [SEAT]: "claude" })
  expect(proseIn(now)).toBe(was)
})

test("taking the last key off takes the block with it", () => {
  expect(matterWith("---\nchat-agent-session: claude\n---\n# Plan\n", [[SEAT, null]])).toBe("# Plan\n")
  // ...and taking one of two off leaves the other one where it was.
  expect(matterWith("---\ntopic: kitchen\nchat-agent-session: claude\n---\nhi\n", [[SEAT, null]]))
    .toBe("---\ntopic: kitchen\n---\nhi\n")
  // A key that is not there is nothing to remove.
  expect(matterWith("---\ntopic: kitchen\n---\nhi\n", [[SEAT, null]])).toBe("---\ntopic: kitchen\n---\nhi\n")
  // A block holding only a COMMENT is not empty: those are bytes somebody
  // wrote, and the writer takes nobody's writing off a file.
  expect(matterWith("---\n# mine\nchat-agent-session: claude\n---\nhi\n", [[SEAT, null]]))
    .toBe("---\n# mine\n---\nhi\n")
})

test("a key holding a block list is replaced WHOLE", () => {
  const was = "---\nowners:\n  - alice\n  - bob\ntopic: kitchen\n---\nhi\n"
  expect(matterWith(was, [["owners", "alice"]])).toBe("---\nowners: alice\ntopic: kitchen\n---\nhi\n")
  // ...and removing one takes its items with it, rather than leaving a list
  // under nothing.
  expect(matterWith(was, [["owners", null]])).toBe("---\ntopic: kitchen\n---\nhi\n")
})

test("a key written twice is one key, so every entry of it goes", () => {
  // `propsIn` reads the FIRST claim, so a removal that left the second behind
  // would uncover a value nobody could see.
  const was = "---\ntopic: kitchen\nchat-agent-session: claude\nchat-agent-session: grok\n---\nhi\n"
  expect(matterWith(was, [[SEAT, null]])).toBe("---\ntopic: kitchen\n---\nhi\n")
  expect(matterWith(was, [[SEAT, "grok:b2"]]))
    .toBe("---\ntopic: kitchen\nchat-agent-session: grok:b2\n---\nhi\n")
})

test("a value is quoted exactly when the plain spelling would not read back", () => {
  const held = (value: string) => frontmatterIn(matterWith("---\ntopic: kitchen\n---\n", [["said", value]])).said
  const written = (value: string) => matterWith("---\ntopic: kitchen\n---\n", [["said", value]]).split("\n")[2]
  // PLAIN wherever this module's own reading hands the line back as the value
  // — which is nearly everything, including a good deal YAML would let a
  // cautious writer quote out of habit.
  for (const value of ["claude:a1", "kitchen#2", "beside", 'say "hi"', "x: y", "-", "a\\b"]) {
    expect(written(value)).toBe(`said: ${value}`)
    expect(held(value)).toBe(value)
  }
  // ...and QUOTED where it would not: a comment the value is not, a flow
  // sequence, quotes the reading would take off, whitespace it would trim.
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
  // ...and the block a Windows file gets when it had none is written the same
  // way, rather than one line of it arriving with a bare `\n`.
  expect(matterWith("# Plan\r\n", [[SEAT, "claude"]])).toBe("---\r\nchat-agent-session: claude\r\n---\r\n# Plan\r\n")
})

test("several changes land in one pass, including a set and a removal", () => {
  const was = "---\nchat-agent-session: claude\nchat-opens: beside\ntopic: kitchen\n---\nhi\n"
  expect(matterWith(was, [[SEAT, null], ["chat-opens", null]])).toBe("---\ntopic: kitchen\n---\nhi\n")
  expect(matterWith(was, [[SEAT, "grok"], ["chat-opens", "alone"], ["topic", null]]))
    .toBe("---\nchat-agent-session: grok\nchat-opens: alone\n---\nhi\n")
  // The LAST word about one key wins, and it is one entry either way.
  expect(matterWith(was, [[SEAT, "grok"], [SEAT, null]])).toBe("---\nchat-opens: beside\ntopic: kitchen\n---\nhi\n")
  expect(matterWith("---\ntopic: kitchen\n---\nhi\n", [["said", "a"], ["said", "b"]]))
    .toBe("---\ntopic: kitchen\nsaid: b\n---\nhi\n")
})

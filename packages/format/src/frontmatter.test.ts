/**
 * The `---` block: where it ends, and what a reader gets out of it.
 *
 * Two rules with two very different failure modes, so they are two sections
 * below. WHERE IT ENDS has to agree with micromark, because the browser
 * renders through `remark-frontmatter` — a disagreement there is a page that
 * hides a block the face read, or a face that read a document's first
 * paragraph as a record. `@olai/web`'s `markdown/slugs.test.ts` is the other
 * half of that pair, holding this rule to the real pipeline over bodies that
 * carry one; these are the corners a rendered `<h1>` cannot show.
 *
 * WHAT A VALUE IS has no such twin, because nothing else in this app reads
 * YAML. What it has instead is a stated subset (`./frontmatter.ts`'s header),
 * and these are the sentences of it — including, deliberately, the refusals:
 * a key this reading will not read is a key the document does not carry, and
 * that has to be as pinned as the ones it does.
 */

import { expect, test } from "bun:test"

import { frontmatterIn, proseIn } from "./frontmatter.ts"

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

// A stray `- item` above every key belongs to nothing — a top-level sequence
// is a YAML document with no keys in it, and a document's properties are keys.
test("a block whose whole content is a sequence carries no properties", () => {
  expect(frontmatterIn("---\n- alice\n- bob\n---\n")).toEqual({})
})

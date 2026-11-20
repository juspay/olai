import { expect, test } from "bun:test"

import { NodeId, type Address } from "./address.ts"
import { referencesOf } from "./backlinks.ts"
import { readingOf, setOf } from "./fixtures.testlib.ts"
import type { Reading } from "./validate.ts"

const atNode = (id: string): Address => ({ kind: "node", id: NodeId.make(id) })

const viewOf = (
  files: Record<string, string>,
  documents: ReadonlyArray<string | readonly [file: string, text: string]> = [],
): Reading => readingOf(setOf(files, documents))
const said = (view: Reading, id: string): ReadonlyArray<string> =>
  referencesOf(view, atNode(id)).map((one) =>
    `${"file" in one.source ? one.source.node.id : one.source.path} ${one.ways.join("+")}`
  )

const HOUSE = {
  "house.olai": `{"id":"kitchen","ord":"a","title":"kitchen remodel"}\n` +
    `{"id":"order","parent":"kitchen","ord":"a","title":"order the cabinets","see":["herbs"]}\n` +
    `{"id":"install","parent":"kitchen","ord":"b","title":"install them","desc":"after @herbs is in"}`,
  "garden.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
}

test("a `see` lands on the node it names, and so does a word in a note", () => {
  expect(said(viewOf(HOUSE), "herbs")).toEqual(["order see", "install mention"])
})

test("nothing refers to a node nobody has written about", () => {
  expect(referencesOf(viewOf(HOUSE), atNode("kitchen"))).toEqual([])
  expect(referencesOf(viewOf(HOUSE), atNode("nobody"))).toEqual([])
})

test("one record doing both is one referrer saying both, edge first", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"both","ord":"b","title":"see @herbs","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["both see+mention"])
})

test("`@word` is a reference exactly when a record claims the word", () => {
  const files = { "a.olai": `{"id":"note","ord":"a","title":"ask @alice about it"}` }
  expect(referencesOf(viewOf(files), atNode("alice"))).toEqual([])
  const claimed = viewOf({ ...files, "b.olai": `{"id":"alice","ord":"a","title":"Alice"}` })
  expect(said(claimed, "alice")).toEqual(["note mention"])
})

test("a `#topic` spelled like an id is not a reference, and the `@` beside it is", () => {
  const view = viewOf({
    "garden.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
    "house.olai": `{"id":"ask","ord":"a","title":"ask @herbs about the pots"}\n` +
      `{"id":"topic","ord":"b","title":"seed order","desc":"filed under #herbs"}`,
  })
  expect([...view.derived.taggedBy.keys()].sort()).toEqual(["#herbs", "@herbs"])
  expect(said(view, "herbs")).toEqual(["ask mention"])
})

test("a mention that arrives with the node it names is a reference at once", () => {
  const view = viewOf({
    "a.olai": `{"id":"note","ord":"a","title":"ask @alice about it"}\n` +
      `{"id":"alice","ord":"b","title":"Alice"}`,
  })
  expect(said(view, "alice")).toEqual(["note mention"])
})

test("a body's `@mention` of a node is a reference, with the file as its source", () => {
  const view = viewOf({
    "garden.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
  }, [["notes/garden.md", "# the garden\n\nwater the @herbs every morning"]])
  expect(said(view, "herbs")).toEqual(["notes/garden.md mention"])
})

test("a body's link onto the node is a reference, way `link`", () => {
  const view = viewOf({
    "garden.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
  }, [["notes/garden.md", "# the garden\n\n[the herb bed](#herbs) is outside"]])
  expect(said(view, "herbs")).toEqual(["notes/garden.md link"])
})

test("a reference to a PLACEMENT of this node is a reference to this node", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"herbs"}\n` +
      `{"id":"points","ord":"b","title":"points","see":["m"]}`,
    "deep/c.olai": `{"id":"m2","ord":"a","mirror":"m"}\n` +
      `{"id":"says","ord":"b","title":"about @m2"}`,
  })
  expect(said(view, "herbs")).toEqual(["points see", "says mention"])
})

test("a record never refers to itself, through its own prose or its own placement", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed","desc":"this is @herbs","see":["m"]}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"herbs"}`,
  })
  expect(referencesOf(view, atNode("herbs"))).toEqual([])
})

test("what is put away is on the Trash and nowhere else", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"live","ord":"b","title":"live","see":["herbs"]}`,
    "_olai/Trash.olai": `{"id":"gone","ord":"a","title":"about @herbs","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["live see"])
})

test("a leftover Archive.olai is not a referrer either", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"live","ord":"b","title":"live","see":["herbs"]}`,
    "Archive.olai": `{"id":"old","ord":"a","title":"about @herbs","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["live see"])
})

test("the referrers come in corpus order, whichever index found them", () => {
  const view = viewOf({
    "a.olai": `{"id":"early","ord":"a","title":"about @herbs"}`,
    "b.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"late","ord":"b","title":"late","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["early mention", "late see"])
})

test("a record's note linking the node is a reference, way `link`", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"note","ord":"b","title":"note","desc":"see [the bed](#herbs) outside"}`,
  })
  expect(said(view, "herbs")).toEqual(["note link"])
})

test("a document and its headings are the same referrer question", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
  }, [["notes/plan.md", "# plan\n\nsee [the bed](#herbs) or [the doc](notes/plan.md)"]])
  expect(said(view, "herbs")).toEqual(["notes/plan.md link"])
})

test("the referrers come in byPath order, so a directory sorts before the file beside it", () => {
  const view = viewOf({
    "wing.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"plan","ord":"b","title":"plan","see":["herbs"]}`,
    "wing/held.olai": `{"id":"held","ord":"a","title":"held"}\n` +
      `{"id":"also","ord":"b","title":"also","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["also see", "plan see"])
})

test("markdown the browser skips: a `@id` that still starts a word IS a mention", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"spanned","ord":"b","title":"spanned","desc":"write \`see @herbs here\` please"}\n` +
      `{"id":"fenced","ord":"c","title":"fenced","desc":"\`\`\`\\n@herbs do this\\n\`\`\`"}\n` +
      `{"id":"indented","ord":"d","title":"indented","desc":"    @herbs do this"}\n` +
      `{"id":"linked","ord":"e","title":"linked","desc":"see [@herbs](https://example.invalid)"}`,
  })
  expect(said(view, "herbs")).toEqual([
    "spanned mention",
    "fenced mention",
    "indented mention",
    "linked mention",
  ])
})

test("...and a TIGHT code span is not one, on either side", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"tight","ord":"b","title":"tight","desc":"write \`@herbs\` in the note"}`,
  })
  expect(referencesOf(view, atNode("herbs"))).toEqual([])
})

test("and the divergence runs the OTHER way too: emphasis is styled and is not a mention", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"emphasised","ord":"b","title":"emphasised","desc":"see *@herbs* today"}\n` +
      `{"id":"strong","ord":"c","title":"strong","desc":"see **@herbs** today"}`,
  })
  expect(referencesOf(view, atNode("herbs"))).toEqual([])
})

test("a word inside another word is not a mention", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"mail","ord":"b","title":"write to sam@herbs.example","desc":"filed under #herbs"}`,
  })
  expect(referencesOf(view, atNode("herbs"))).toEqual([])
})
/**
 * WHICH properties a result row draws, and in what order — without a browser.
 *
 * The ordering is the whole of the decision (`./props.ts`), and it is exactly
 * the kind that goes quietly wrong inside a component: a line that has to be
 * ellipsized shows its FRONT, so what leads decides what a reader of a narrow
 * panel actually sees.
 */

import { DocumentPath, NodeId } from "@olai/format"
import type { DocumentHit, NodeHit } from "@olai/surface"
import { expect, test } from "bun:test"

import { documentProps, nodeProps } from "./props.ts"

/** A hit carrying whatever the case under test needs. The fields a row does not
 *  read are still here because a `NodeHit` has them. */
const hitOf = (
  custom: Record<string, string | ReadonlyArray<string>> | undefined,
  matchedProps?: ReadonlyArray<string>,
): NodeHit => ({
  at: { kind: "node", id: NodeId.make("lane") },
  id: "lane",
  title: "a lane",
  file: "roadmap.olai",
  line: 1,
  path: [],
  ...(custom === undefined ? {} : { custom }),
  ...(matchedProps === undefined ? {} : { matchedProps }),
})

test("a node carrying no property draws no line", () => {
  expect(nodeProps(hitOf(undefined))).toEqual([])
})

/** The FILE's order — the order the record holds its keys in — when the query
 *  asked about none of them. There is no second sort: "most interesting
 *  property" is not a fact this app has, and a ranking here would be one
 *  invented; nor is there a re-sort, which is what makes this case assert a map
 *  whose keys are NOT alphabetical. */
test("without a property in the query, the file's own order stands", () => {
  expect(nodeProps(hitOf({ pr: "…/192", agent: "claude-opus" })).map((p) => p.key))
    .toEqual(["pr", "agent"])
})

/** The point of the field: what answered the query leads, where an ellipsis
 *  cannot reach it. */
test("a matched key leads, and says it is why the row is here", () => {
  const drawn = nodeProps(hitOf({ pr: "…/192", agent: "claude-opus" }, ["pr"]))
  expect(drawn.map((p) => p.key)).toEqual(["pr", "agent"])
  expect(drawn.map((p) => p.matched)).toEqual([true, false])
})

/** Several matched keys keep the QUERY's order among themselves, and the rest
 *  keep the file's — two halves, each already in the order it wants. */
test("several matched keys lead in the order the query named them", () => {
  const drawn = nodeProps(
    hitOf({ agent: "claude-opus", pr: "…/192", source: "inbox" }, ["source", "pr"]),
  )
  expect(drawn.map((p) => p.key)).toEqual(["source", "pr", "agent"])
})

/** A list value is drawn as its members joined — the DRAWER's rule, reached
 *  rather than re-spelled, so one node does not read two ways on two
 *  surfaces. */
test("a key holding a list is drawn the way the drawer draws it", () => {
  expect(nodeProps(hitOf({ tags: ["walnut", "birch"] }))[0])
    .toEqual({ key: "tags", value: "walnut, birch", matched: false })
})

/** A key named by the query that the node does not carry cannot be drawn — the
 *  server only ever names keys it matched, and this is the row refusing to
 *  invent a line if that ever stopped being true. */
test("a named key the node does not carry draws nothing", () => {
  expect(nodeProps(hitOf({ agent: "claude-opus" }, ["isbn"])).map((p) => p.key))
    .toEqual(["agent"])
})

/**
 * THE OTHER KIND OF ROW, drawing the same line out of the other kind of map.
 *
 * A document's properties are the YAML frontmatter at the top of the `.md`
 * (`@olai/format`'s `frontmatter.ts`), and a `prop:` query answers with both
 * kinds in ONE ranked list — so the ordering a reader sees may not depend on
 * which kind a row happens to be. One rule below both entry points is what
 * makes that true; this is the case that would catch a second one.
 */
test("a document's frontmatter draws the row a node's map draws", () => {
  const document: DocumentHit = {
    at: { kind: "document", path: DocumentPath.make("notes/plan.md") },
    title: "The plan",
    props: { agent: "claude-opus", pr: "…/192", owners: ["alice", "bob"] },
    matchedProps: ["pr"],
  }
  expect(documentProps(document)).toEqual(
    nodeProps(hitOf({ agent: "claude-opus", pr: "…/192", owners: ["alice", "bob"] }, ["pr"])),
  )
  expect(documentProps(document).map((p) => p.key)).toEqual(["pr", "agent", "owners"])
})

test("a document carrying no frontmatter draws no line", () => {
  expect(documentProps({
    at: { kind: "document", path: DocumentPath.make("brief.md") },
    title: "Brief",
  })).toEqual([])
})

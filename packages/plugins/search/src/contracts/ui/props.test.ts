import { DocumentPath, NodeId } from "@olai/format"
import type { DocumentHit, NodeHit } from "@olai/format"
import { expect, test } from "bun:test"

import { documentProps, nodeProps } from "olai-plugin-search/ui/props.ts"

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
  pathIds: [],
  ...(custom === undefined ? {} : { custom }),
  ...(matchedProps === undefined ? {} : { matchedProps }),
})

test("a node carrying no property draws no line", () => {
  expect(nodeProps(hitOf(undefined))).toEqual([])
})

test("without a property in the query, the file's own order stands", () => {
  expect(nodeProps(hitOf({ pr: "…/192", agent: "claude-opus" })).map((p) => p.key))
    .toEqual(["pr", "agent"])
})

test("a matched key leads, and says it is why the row is here", () => {
  const drawn = nodeProps(hitOf({ pr: "…/192", agent: "claude-opus" }, ["pr"]))
  expect(drawn.map((p) => p.key)).toEqual(["pr", "agent"])
  expect(drawn.map((p) => p.matched)).toEqual([true, false])
})

test("several matched keys lead in the order the query named them", () => {
  const drawn = nodeProps(
    hitOf({ agent: "claude-opus", pr: "…/192", source: "inbox" }, ["source", "pr"]),
  )
  expect(drawn.map((p) => p.key)).toEqual(["source", "pr", "agent"])
})

test("a key holding a list is drawn the way the drawer draws it", () => {
  expect(nodeProps(hitOf({ tags: ["walnut", "birch"] }))[0])
    .toEqual({ key: "tags", value: "walnut, birch", matched: false })
})

test("a named key the node does not carry draws nothing", () => {
  expect(nodeProps(hitOf({ agent: "claude-opus" }, ["isbn"])).map((p) => p.key))
    .toEqual(["agent"])
})

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

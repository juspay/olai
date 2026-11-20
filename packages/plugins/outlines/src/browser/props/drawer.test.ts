import { customOf, type RegularNode } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { customEntries, drawerEntries, systemEntries } from "olai-plugin-outlines/property-values"

const nodeOf = (record: string): RegularNode =>
  recordsOf(setOf({ "a.olai": record }))[0]?.node as RegularNode

test("the id is always a line, because nothing else on the page says it", () => {
  expect(systemEntries(nodeOf(`{"id":"order","ord":"a0","title":"t"}`)))
    .toEqual([{ key: "id", value: "order", values: ["order"], system: true, listed: false }])
})

test("the mark is one line, with its instant when it has one", () => {
  expect(systemEntries(nodeOf(`{"id":"n","ord":"a0","title":"t","doing":true}`))[1])
    .toEqual({ key: "status", value: "doing", values: ["doing"], system: true, listed: false })
  expect(systemEntries(nodeOf(`{"id":"n","ord":"a0","title":"t","done":"2026-08-01"}`))[1])
    .toEqual({
      key: "status",
      value: "done 2026-08-01",
      values: ["done 2026-08-01"],
      system: true,
      listed: false,
    })
})

test("a date is a line; a note and the edges are not", () => {
  const node = nodeOf(
    `{"id":"n","ord":"a0","title":"t","date":"2026-08-10","desc":"a note","see":["y"],"after":["z"]}`,
  )
  expect(systemEntries(node).map((entry) => entry.key)).toEqual(["id", "date"])
})

test("the stamps are drawn when the node has them, and never invented", () => {
  expect(systemEntries(nodeOf(`{"id":"n","ord":"a0","title":"t"}`)).map((one) => one.key))
    .toEqual(["id"])
  const stamped = nodeOf(
    `{"id":"n","ord":"a0","title":"t","created":"2026-08-11T09:00:00-04:00","changed":"2026-08-15T14:00:00-04:00"}`,
  )
  expect(systemEntries(stamped).map((one) => one.key)).toEqual(["id", "created", "changed"])
})

test("the custom half is what somebody added, and nothing else", () => {
  const node = nodeOf(
    `{"id":"n","ord":"a0","title":"t","done":true,"date":"2026-08-10","custom":{"pr":"https://x/1"}}`,
  )
  expect(customEntries(customOf(node))).toEqual([
    { key: "pr", value: "https://x/1", values: ["https://x/1"], system: false, listed: false },
  ])
  expect(drawerEntries(node).map((entry) => entry.key)).toEqual(["id", "status", "date", "pr"])
})

test("the custom chips are in the file's own order, whatever order that is", () => {
  const canonical = nodeOf(
    `{"id":"n","ord":"a0","title":"t","custom":{"agent":"claude-opus","pr":"https://x/1","terminal":"485cd9bb"}}`,
  )
  expect(customEntries(customOf(canonical)).map((entry) => entry.key))
    .toEqual(["agent", "pr", "terminal"])

  const handWritten = nodeOf(
    `{"id":"n","ord":"a0","title":"t","custom":{"terminal":"485cd9bb","agent":"claude-opus","pr":"https://x/1"}}`,
  )
  expect(customEntries(customOf(handWritten)).map((entry) => entry.key))
    .toEqual(["terminal", "agent", "pr"])
})

test("a list is drawn joined, says that it is one, and keeps its members", () => {
  const node = nodeOf(`{"id":"n","ord":"a0","title":"t","custom":{"tags":["a","b"]}}`)
  expect(customEntries(customOf(node)))
    .toEqual([{ key: "tags", value: "a, b", values: ["a", "b"], system: false, listed: true }])
})

test("a value that is TEXT is one member, so the run has one rule and not two", () => {
  const node = nodeOf(`{"id":"n","ord":"a0","title":"t","custom":{"agent":"claude-opus"}}`)
  expect(customEntries(customOf(node))[0]?.values).toEqual(["claude-opus"])
  expect(customEntries(customOf(node))[0]?.listed).toBe(false)
})

test("a document's frontmatter is the same run, over the map", () => {
  expect(customEntries({
    agent: "claude-opus",
    owners: ["alice", "bob"],
    date: "2026-09-01",
  }).map((entry) => entry.key)).toEqual(["agent", "owners", "date"])
  expect(customEntries({ owners: ["alice", "bob"] }))
    .toEqual([{
      key: "owners",
      value: "alice, bob",
      values: ["alice", "bob"],
      system: false,
      listed: true,
    }])
})

test("row placement omits only the contributed kind; the page retains every property", () => {
  const node = nodeOf('{"id":"n","ord":"a0","title":"node","custom":{"binding":"claude:session","plain":"visible"}}')
  const placement = {
    kind: (key: string) => key === "binding" ? "chat-agent-session" : "text",
    at: (kind: string) => kind === "chat-agent-session" ? { inRows: false } : undefined,
  }
  expect(customEntries(customOf(node), placement).map(entry => entry.key)).toEqual(["plain"])
  expect(customEntries(customOf(node)).map(entry => entry.key)).toEqual(["binding", "plain"])
  expect(drawerEntries(node).filter(entry => !entry.system).map(entry => entry.key)).toEqual(["binding", "plain"])
})

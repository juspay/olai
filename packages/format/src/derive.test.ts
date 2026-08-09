import { expect, test } from "bun:test"
import { Result } from "effect"

import {
  countedChildren,
  derive,
  type Row,
  rowsOf,
  type Status,
  titleParts,
} from "./derive.ts"
import type { Located } from "./node.ts"
import { parseOutline } from "./parse.ts"

/** Fixtures are JSONL, parsed — the derivation runs on exactly the records a
 *  file produces, including their line numbers, which are part of the answer
 *  (sibling ties break on them). */
const nodesOf = (contents: string, file = "a.jsonl"): ReadonlyArray<Located> => {
  const parsed = parseOutline(file, contents)
  if (Result.isFailure(parsed)) {
    throw new Error(`fixture does not parse: ${parsed.failure.map((e) => e.message).join("; ")}`)
  }
  return parsed.success.nodes
}

/** Several files' worth, flat — the shape every rule and every walk wants. */
const setOf = (files: Record<string, string>): ReadonlyArray<Located> =>
  Object.entries(files).flatMap(([file, contents]) => nodesOf(contents, file))

const statusesOf = (contents: string): ReadonlyMap<string, Status> =>
  derive(nodesOf(contents)).status

const ids = (nodes: ReadonlyArray<Located>): ReadonlyArray<string> =>
  nodes.map((located) => located.node.id)

/** A row's tree, flattened to `key kind` — the two facts a renderer switches
 *  on, and the two this file is about. */
const shape = (rows: ReadonlyArray<Row>): ReadonlyArray<string> =>
  rows.flatMap((row) => [`${row.key} ${row.kind}`, ...shape(row.children)])

// ── the indexes ────────────────────────────────────────────────────────

// A leaf is the only node allowed to store a status, so a leaf is the only
// place the stored value is read back as-is.
test("a leaf reports what it stores", () => {
  const status = statusesOf(
    `{"id":"a","ord":"a","title":"a","done":true}\n` +
      `{"id":"b","ord":"b","title":"b","doing":"2026-08-10"}\n` +
      `{"id":"c","ord":"c","title":"c"}`,
  )
  expect(status.get("a")).toBe("done")
  expect(status.get("b")).toBe("doing")
  expect(status.get("c")).toBe("open")
})

// A parent's status is the sum of its children — the one rule the validator
// refuses to let anyone store, so this is where it actually lives.
test("a parent is the sum of its children", () => {
  const done = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","done":true}`,
  )
  expect(done.get("p")).toBe("done")

  // Some finished is activity, even with nothing explicitly under way.
  const partly = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2"}`,
  )
  expect(partly.get("p")).toBe("doing")

  const open = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1"}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2"}`,
  )
  expect(open.get("p")).toBe("open")
})

// The rule has to hold through a whole branch, not one level: a grandparent's
// status is computed from statuses that were themselves computed.
test("a parent of parents composes rather than looking one level down", () => {
  const status = statusesOf(
    `{"id":"top","ord":"a","title":"top"}\n` +
      `{"id":"mid","parent":"top","ord":"a","title":"mid"}\n` +
      `{"id":"leaf1","parent":"mid","ord":"a","title":"l1","done":true}\n` +
      `{"id":"leaf2","parent":"mid","ord":"b","title":"l2"}\n` +
      `{"id":"other","parent":"top","ord":"b","title":"other"}`,
  )
  expect(status.get("mid")).toBe("doing")
  // `other` is open and `mid` is doing, so the top is under way — not open.
  expect(status.get("top")).toBe("doing")
})

// A mirror shows a node, so it shows that node's status; a checkbox that
// disagreed with the one two lines up would make mirrors unusable.
test("a mirror reports its target's status, however deep the target's own is", () => {
  const status = statusesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
      `{"id":"m","ord":"b","mirror":"p"}`,
  )
  expect(status.get("p")).toBe("done")
  expect(status.get("m")).toBe("done")
})

// A mirror is a placement, not a second obligation. If it counted, showing a
// node in a second place could flip an unrelated parent out of "done".
test("a mirror child does not count toward the status of the node it sits under", () => {
  const contents = `{"id":"open","ord":"z","title":"somewhere else"}\n` +
    `{"id":"p","ord":"a","title":"p"}\n` +
    `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
    `{"id":"m","parent":"p","ord":"b","mirror":"open"}`
  const derived = derive(nodesOf(contents))
  expect(derived.status.get("m")).toBe("open")
  expect(derived.status.get("p")).toBe("done")

  // The mirror is still a child for *placement* — it renders under `p`…
  expect(ids(derived.children.get("p") ?? [])).toEqual(["c", "m"])
  // …and still not one for *status*, which is the set the validator lists.
  expect(ids(countedChildren(derived, "p"))).toEqual(["c"])
})

// `ord` is a fractional index over base62, so plain string comparison IS the
// sort. Anything that treated it as a number would put `a10` after `a2`, and
// an insert between two siblings would land in the wrong place.
test("siblings sort by string comparison of ord, never numerically", () => {
  const derived = derive(nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"two","parent":"p","ord":"a2","title":"two"}\n` +
      `{"id":"ten","parent":"p","ord":"a10","title":"ten"}\n` +
      `{"id":"upper","parent":"p","ord":"Z","title":"upper"}`,
  ))
  expect(ids(derived.children.get("p") ?? [])).toEqual(["upper", "ten", "two"])
})

// Two siblings can legitimately share an `ord` after a merge. File order
// decides, rather than whatever the engine's sort happens to do, so two loads
// of the same file render in the same order.
test("equal ords break on line, not on sort stability", () => {
  const derived = derive(nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"later","parent":"p","ord":"m","title":"later"}\n` +
      `{"id":"earlier","parent":"p","ord":"m","title":"earlier"}`,
  ))
  expect(ids(derived.children.get("p") ?? [])).toEqual(["later", "earlier"])
})

// The validator reports a duplicate id on the SECOND record and points back at
// the first, which only reads as advice if every other reference still means
// the first one. `byId` and that error therefore have to pick the same record,
// or a set with one duplicate would report a second, invented dangling edge.
test("a duplicated id resolves to the record that claimed it first", () => {
  const within = derive(nodesOf(
    `{"id":"x","ord":"a","title":"first"}\n{"id":"x","ord":"b","title":"second"}`,
  ))
  expect(within.byId.get("x")?.line).toBe(1)

  const across = derive(setOf({
    "a.jsonl": `{"id":"x","ord":"a","title":"first"}`,
    "b.jsonl": `{"id":"x","ord":"a","title":"second"}`,
  }))
  expect([across.byId.get("x")?.file, across.byId.get("x")?.line]).toEqual(["a.jsonl", 1])
  // One entry per id, not one per record: the map is an index, not a list.
  expect(across.byId.size).toBe(1)
})

// ── the drawable tree ──────────────────────────────────────────────────

// A mirror is expanded in place, because a pointer the reader has to go and
// follow is not a second location — it is a footnote. So the row says it is a
// mirror, and its children are the TARGET's, drawn under the mirror's own key.
test("a mirror row is drawn with its target's children", () => {
  const nodes = nodesOf(
    `{"id":"p","ord":"b","title":"p"}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
      `{"id":"m","ord":"a","mirror":"p"}`,
  )
  const rows = rowsOf(derive(nodes), nodes, "a.jsonl")
  const [mirror, node] = rows
  expect(mirror?.kind).toBe("mirror")
  // `at` is the record occupying the place; `shows` is what is drawn there.
  expect(mirror?.at.node.id).toBe("m")
  expect(mirror?.shows?.node.id).toBe("p")
  expect(mirror?.children.map((row) => row.at.node.id)).toEqual(["c"])
  // And it shows the target's status, the same one the index computed.
  expect(mirror?.status).toBe("done")
  expect(node?.kind).toBe("node")
  expect(node?.shows).toBe(node?.at)
})

// A row's key is the identity of the PLACE, not of the node. The same node
// reached through two routes is two rows on screen, and folding one must not
// fold the other — which is only true if their keys differ.
test("one node reached through two places has two keys", () => {
  const nodes = nodesOf(
    `{"id":"p","ord":"b","title":"p"}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c"}\n` +
      `{"id":"m","ord":"a","mirror":"p"}`,
  )
  const rows = shape(rowsOf(derive(nodes), nodes, "a.jsonl"))
  expect(rows).toEqual(["/m mirror", "/m/c node", "/p node", "/p/c node"])
  expect(new Set(rows).size).toBe(rows.length)
})

// A mirror whose target is not in the set is a place with nothing to show. It
// is named as such rather than silently dropped — the validator has already
// refused the set, and the reader is looking at it to find out why.
test("a mirror with no target is a dangling row with no children", () => {
  const nodes = nodesOf(`{"id":"m","ord":"a","mirror":"gone"}`)
  const rows = rowsOf(derive(nodes), nodes, "a.jsonl")
  expect(rows.map((row) => row.kind)).toEqual(["dangling"])
  expect(rows[0]?.shows).toBeUndefined()
  expect(rows[0]?.children).toEqual([])
})

// The headline case for the cycle guard: a mirror of `a` placed inside `a`.
// Drawing `a` draws the mirror, which draws `a`. The validator refuses this
// set — and the rows are drawn anyway, because its own error messages quote
// derived status. A renderer that hung is a worse way to learn about a bug
// than a marked stub, so this test failing looks like a timeout.
test("a mirror inside its own subtree is a cycle stub, not a hang", () => {
  const nodes = nodesOf(
    `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"a"}`,
  )
  expect(shape(rowsOf(derive(nodes), nodes, "a.jsonl"))).toEqual(["/a node", "/a/m cycle"])

  // Any depth, not just directly under the target: the guard is the ancestors
  // of the place, not the parent of the mirror.
  const deep = nodesOf(
    `{"id":"a","ord":"a","title":"a"}\n` +
      `{"id":"b","parent":"a","ord":"a","title":"b"}\n` +
      `{"id":"m","parent":"b","ord":"b","mirror":"a"}`,
  )
  expect(shape(rowsOf(derive(deep), deep, "a.jsonl")))
    .toEqual(["/a node", "/a/b node", "/a/b/m cycle"])
})

// Every `.jsonl` is an independent tree, so the rows of a file are its own
// roots — the set is flat and carries every file's nodes, so the filtering is
// what makes "the rows of this file" mean anything at all.
test("roots are the requested file's own top-level nodes, in ord order", () => {
  const nodes = setOf({
    "a.jsonl": `{"id":"second","ord":"b","title":"b"}\n` +
      `{"id":"first","ord":"a","title":"a"}\n` +
      `{"id":"kid","parent":"first","ord":"a","title":"kid"}`,
    "b.jsonl": `{"id":"elsewhere","ord":"a","title":"elsewhere"}`,
  })
  const derived = derive(nodes)
  expect(shape(rowsOf(derived, nodes, "a.jsonl")))
    .toEqual(["/first node", "/first/kid node", "/second node"])
  expect(shape(rowsOf(derived, nodes, "b.jsonl"))).toEqual(["/elsewhere node"])
  // A file with no nodes of its own draws nothing, rather than everything.
  expect(rowsOf(derived, nodes, "c.jsonl")).toEqual([])
})

// ── titles ─────────────────────────────────────────────────────────────

/** The tags of a title, in reading order — what a filter runs on, assembled
 *  from the parts because the format stores no tag list. */
const tags = (title: string): ReadonlyArray<string> =>
  titleParts(title).flatMap((part) => (part.kind === "tag" ? [part.tag] : []))

// Tags live inline in the title verbatim — the format stores no tag list — so
// the split is what the view renders, and it has to keep the text intact.
test("a title splits into text and tags, and rejoins to itself", () => {
  const parts = titleParts("call #alice about #work/olai now")
  expect(parts).toEqual([
    { kind: "text", text: "call " },
    { kind: "tag", tag: "alice" },
    { kind: "text", text: " about " },
    // A `/` is part of the tag, so `#work/olai` is one tag and not two.
    { kind: "tag", tag: "work/olai" },
    { kind: "text", text: " now" },
  ])
  expect(
    parts.map((part) => (part.kind === "tag" ? `#${part.tag}` : part.text)).join(""),
  ).toBe("call #alice about #work/olai now")
})

// A bare `#` is punctuation people write ("issue #, see below"); treating it as
// an empty tag would style the rest of the line as one.
test("a bare hash is text", () => {
  expect(titleParts("issue # 42")).toEqual([{ kind: "text", text: "issue # 42" }])
  expect(tags("issue # 42")).toEqual([])
})

// The tags come out in reading order, over the same alphabet ids use plus `/`,
// so a filter reading them off the parts sees the title as written.
test("tags come out in reading order, over the tag alphabet", () => {
  expect(tags("#b then #a then #b again")).toEqual(["b", "a", "b"])
  expect(tags("#Tag-1 #tag_2")).toEqual(["Tag-1", "tag_2"])
})

// ── loops ──────────────────────────────────────────────────────────────

// Derivation runs against sets the validator has already condemned — its own
// error messages quote derived status — so a loop must produce a stub, not a
// hung renderer. This test failing looks like a timeout, which is the point.
test("a cyclic set derives without hanging", () => {
  const parents = statusesOf(
    `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  )
  expect(parents.get("a")).toBe("open")
  expect(parents.get("b")).toBe("open")

  const mirrors = statusesOf(
    `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
  )
  expect(mirrors.get("m1")).toBe("open")
  expect(mirrors.get("m2")).toBe("open")

  // A mirror whose target was never declared is the other walk that could have
  // gone looking for a node that is not there.
  expect(statusesOf(`{"id":"m","ord":"a","mirror":"gone"}`).get("m")).toBe("open")
})

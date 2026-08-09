import { expect, test } from "bun:test"
import { Result } from "effect"

import {
  childIndex,
  countedChildren,
  rootsOf,
  type Status,
  statusIndex,
  tagsOf,
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

const statusesOf = (contents: string): ReadonlyMap<string, Status> => {
  const all = nodesOf(contents)
  return statusIndex(all, childIndex(all))
}

const ids = (nodes: ReadonlyArray<Located>): ReadonlyArray<string> =>
  nodes.map((located) => located.node.id)

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
  const status = statusesOf(
    `{"id":"open","ord":"z","title":"somewhere else"}\n` +
      `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
      `{"id":"m","parent":"p","ord":"b","mirror":"open"}`,
  )
  expect(status.get("m")).toBe("open")
  expect(status.get("p")).toBe("done")

  const all = nodesOf(
    `{"id":"open","ord":"z","title":"somewhere else"}\n` +
      `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"c","parent":"p","ord":"a","title":"c","done":true}\n` +
      `{"id":"m","parent":"p","ord":"b","mirror":"open"}`,
  )
  const children = childIndex(all)
  // The mirror is still a child for *placement* — it renders under `p`…
  expect(ids(children.get("p") ?? [])).toEqual(["c", "m"])
  // …and still not one for *status*, which is the set the validator lists.
  expect(ids(countedChildren(children, "p"))).toEqual(["c"])
})

// `ord` is a fractional index over base62, so plain string comparison IS the
// sort. Anything that treated it as a number would put `a10` after `a2`, and
// an insert between two siblings would land in the wrong place.
test("siblings sort by string comparison of ord, never numerically", () => {
  const all = nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"two","parent":"p","ord":"a2","title":"two"}\n` +
      `{"id":"ten","parent":"p","ord":"a10","title":"ten"}\n` +
      `{"id":"upper","parent":"p","ord":"Z","title":"upper"}`,
  )
  expect(ids(childIndex(all).get("p") ?? [])).toEqual(["upper", "ten", "two"])
  // Roots of a file sort the same way, by the same comparison.
  expect(ids(rootsOf(nodesOf(
    `{"id":"second","ord":"b","title":"b"}\n{"id":"first","ord":"a","title":"a"}`,
  )))).toEqual(["first", "second"])
})

// Two siblings can legitimately share an `ord` after a merge. File order
// decides, rather than whatever the engine's sort happens to do, so two loads
// of the same file render in the same order.
test("equal ords break on line, not on sort stability", () => {
  const all = nodesOf(
    `{"id":"p","ord":"a","title":"p"}\n` +
      `{"id":"later","parent":"p","ord":"m","title":"later"}\n` +
      `{"id":"earlier","parent":"p","ord":"m","title":"earlier"}`,
  )
  expect(ids(childIndex(all).get("p") ?? [])).toEqual(["later", "earlier"])
})

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
  expect(tagsOf("issue # 42")).toEqual([])
})

// The tag list is what a filter runs on: in reading order, and each tag once,
// however many times the title says it.
test("tagsOf keeps order and drops repeats", () => {
  expect(tagsOf("#b then #a then #b again")).toEqual(["b", "a"])
  expect(tagsOf("#Tag-1 #tag_2")).toEqual(["Tag-1", "tag_2"])
})

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

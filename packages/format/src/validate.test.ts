import { expect, test } from "bun:test"
import { Result } from "effect"

import { isCrossFile, type OutlineError } from "./errors.ts"
import { setOf } from "./fixtures.testlib.ts"
import { resolveRelative, validate } from "./validate.ts"

const errorsOf = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
): ReadonlyArray<OutlineError> => {
  const result = validate(setOf(files, documents))
  if (Result.isSuccess(result)) throw new Error("expected this set to be rejected")
  return result.failure
}

const expectValid = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
): void => {
  const set = setOf(files, documents)
  const result = validate(set)
  if (Result.isFailure(result)) {
    throw new Error(
      `expected a valid set: ${result.failure.map((e) => `${e.file}:${e.line} ${e.message}`).join("; ")}`,
    )
  }
  // The set comes back as it went in — the validator judges, it does not
  // reshape, so what the browser subscribes to is what the reader found.
  expect(result.success).toBe(set)
  expect(result.success.files.length).toBe(Object.keys(files).length)
}

const only = (errors: ReadonlyArray<OutlineError>): OutlineError => {
  const [error] = errors
  if (error === undefined || errors.length !== 1) {
    throw new Error(`expected exactly one error, got ${errors.length}`)
  }
  return error
}

const codes = (errors: ReadonlyArray<OutlineError>): ReadonlyArray<string> =>
  errors.map((error) => error.code)

// A set that exercises every relation at once has to be accepted, or the tests
// below would only prove the validator says no.
test("a set using every relation loads clean", () => {
  expectValid(
    {
      "home.jsonl": `{"id":"kitchen","ord":"a","title":"kitchen #reno"}\n` +
        `{"id":"demo","parent":"kitchen","ord":"a","title":"demolition","done":"2026-08-01"}\n` +
        `{"id":"order","parent":"kitchen","ord":"b","title":"order cabinets","after":["demo"],"see":["budget"],"doc":"notes/cabinets.md"}\n`,
      "work.jsonl": `{"id":"budget","ord":"a","title":"the budget","blocks":["order"]}\n` +
        `{"id":"m","ord":"b","mirror":"order"}\n`,
    },
    ["notes/cabinets.md"],
  )
})

// The set is flat: `files` is the list found on disk and the nodes are one
// list. A `.jsonl` holding no nodes is still a file of the set — which is why
// `files` is not derived from `nodes`, and why an empty one is not an error.
test("a file with no nodes is a member of the set, not a problem with it", () => {
  expectValid({
    "empty.jsonl": ``,
    "a.jsonl": `{"id":"a","ord":"a","title":"a"}\n`,
  })
})

// Ids are the identity of the whole set, so the duplicate is the second claim,
// not the first — and the first has to be a link, because "it is already taken"
// without saying by what is a search.
test("a duplicate id is reported on the second record, pointing at the first", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"x","ord":"a","title":"one"}`,
      "b.jsonl": `{"id":"x","ord":"a","title":"two"}`,
    }),
  )
  expect(error.code).toBe("duplicate-id")
  expect([error.file, error.line]).toEqual(["b.jsonl", 1])
  expect(error.related).toEqual([
    { file: "a.jsonl", line: 1, note: "first declared here" },
  ])
  // And it is the shape the error view groups separately: two files are
  // implicated, so neither of them is "the broken one".
  expect(isCrossFile(error)).toBe(true)
})

// An unknown reference is nearly always a misspelling, and naming the
// candidate turns a search of the whole set into one keystroke.
test("an unknown parent suggests the near id", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"kitchen","ord":"a","title":"k"}\n` +
        `{"id":"sink","parent":"kitchn","ord":"b","title":"s"}`,
    }),
  )
  expect(error.code).toBe("unknown-parent")
  expect(error.line).toBe(2)
  expect(error.message).toContain("did you mean `kitchen`?")
})

// The suggestion is only worth printing when it is plausible. Offering the one
// unrelated id in the file as a guess would train people to ignore the line.
test("an unknown parent nothing resembles gets no did-you-mean", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"kitchen","ord":"a","title":"k"}\n` +
        `{"id":"sink","parent":"zzz","ord":"b","title":"s"}`,
    }),
  )
  expect(error.code).toBe("unknown-parent")
  expect(error.message).not.toContain("did you mean")
})

// Every `.jsonl` is an independent tree. A parent that resolves in another file
// is the one unknown-parent case that is not a typo, so it gets its own code
// and is told what to use instead.
test("a parent in another file is a foreign-parent, not an unknown one", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"kitchen","ord":"a","title":"k"}`,
      "b.jsonl": `{"id":"sink","parent":"kitchen","ord":"a","title":"s"}`,
    }),
  )
  expect(error.code).toBe("foreign-parent")
  expect([error.file, error.line]).toEqual(["b.jsonl", 1])
  expect(error.message).toContain("`mirror`")
  expect(error.related).toEqual([
    { file: "a.jsonl", line: 1, note: "the parent lives here" },
  ])
})

// A mirror is a placement, not a container: children hang off the node the
// mirror points at. Allowing this would give one node two child lists.
test("a child of a mirror is refused", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"k","ord":"a","title":"k"}\n` +
        `{"id":"m","ord":"b","mirror":"k"}\n` +
        `{"id":"c","parent":"m","ord":"c","title":"c"}`,
    }),
  )
  expect(error.code).toBe("parent-not-a-node")
  expect(error.line).toBe(3)
  expect(error.related?.[0]).toEqual({ file: "a.jsonl", line: 2, note: "the mirror is here" })
})

// A parent loop makes every tree walk in the system non-terminating, and it is
// exactly what a git merge of two moves can produce.
test("a parent cycle is one error naming the whole loop", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
        `{"id":"b","parent":"a","ord":"b","title":"b"}`,
    }),
  )
  expect(error.code).toBe("parent-cycle")
  // Anchored at the earliest record of the loop, so two loads report it the
  // same way.
  expect(error.line).toBe(1)
  expect(error.message).toContain("`a` → `b` → `a`")
  expect(error.related).toEqual([{ file: "a.jsonl", line: 2, note: "also in the loop" }])
})

// Every relation field resolves against the whole set, and the message has to
// say which field was the dangling one — a node can carry four.
test("a dangling target is reported for mirror, after, blocks and see alike", () => {
  const errors = errorsOf({
    "a.jsonl": `{"id":"a","ord":"a","title":"a","after":["no1"],"blocks":["no2"],"see":["no3"]}\n` +
      `{"id":"m","ord":"b","mirror":"no4"}`,
  })
  expect(codes(errors)).toEqual([
    "unknown-target",
    "unknown-target",
    "unknown-target",
    "unknown-target",
  ])
  expect(errors.map((error) => error.message.replace(/^`(\w+)`.*$/, "$1"))).toEqual([
    "after",
    "blocks",
    "see",
    "mirror",
  ])
})

// `after` is the ordering constraint the views schedule by; a loop in it means
// nothing in the loop can start first.
test("an after cycle is refused", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"a","ord":"a","title":"a","after":["b"]}\n` +
        `{"id":"b","ord":"b","title":"b","after":["a"]}`,
    }),
  )
  expect(error.code).toBe("after-cycle")
  expect(error.message).toContain("`a` → `b` → `a`")
})

// `blocks` is sugar for the same edge reversed, normalised in exactly one
// place. A loop written entirely in `blocks` is the same loop and must be
// caught by the same rule — two graphs would eventually disagree.
test("a cycle written only in blocks is the same after-cycle", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"a","ord":"a","title":"a","blocks":["b"]}\n` +
        `{"id":"b","ord":"b","title":"b","blocks":["a"]}`,
    }),
  )
  expect(error.code).toBe("after-cycle")
  expect(error.message).toContain("`a` → `b` → `a`")
})

// Containment that closes a loop through a mirror never finishes expanding, so
// the browser would render forever.
test("mirrors that show each other are a mirror-cycle", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
    }),
  )
  expect(error.code).toBe("mirror-cycle")
  expect(error.message).toContain("`m1` → `m2` → `m1`")
  expect(error.related).toEqual([{ file: "a.jsonl", line: 2, note: "also in the loop" }])
})

// The headline case, and the reason the check exists: a mirror of `a` placed
// INSIDE `a`. Drawing `a` draws the mirror, which draws `a` — a renderer that
// believed the file would never stop. Nothing about this record is wrong on
// its own; it is only wrong where it sits.
test("a mirror placed inside the subtree it shows is a mirror-cycle", () => {
  const errors = errorsOf({
    "a.jsonl": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"a"}`,
  })
  expect(codes(errors)).toEqual(["mirror-cycle"])
})

// And it holds across files, which is the case mirrors exist for.
test("a mirror is still a cycle when the subtree it shows lives elsewhere", () => {
  const errors = errorsOf({
    "a.jsonl": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"b"}`,
    "b.jsonl": `{"id":"b","ord":"a","title":"b"}\n{"id":"n","parent":"b","ord":"b","mirror":"a"}`,
  })
  expect(codes(errors)).toContain("mirror-cycle")
})

// The same loop said twice in two vocabularies helps nobody: a cycle with no
// mirror in it is a parent cycle and only that.
test("a pure parent cycle is not also reported as a mirror-cycle", () => {
  const errors = errorsOf({
    "a.jsonl": `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  })
  expect(codes(errors)).toEqual(["parent-cycle"])
})

// `doc` is a reference like any other, so it is checked like any other — and
// against the files actually served, since a path that resolves nowhere is a
// note nobody will ever see again.
test("a doc naming no served file is refused, and says what it resolved to", () => {
  const error = only(
    errorsOf({ "a.jsonl": `{"id":"a","ord":"a","title":"a","doc":"notes/a.md"}` }, []),
  )
  expect(error.code).toBe("missing-doc")
  expect(error.message).toContain("resolves to `notes/a.md`")
})

// "Attached" means relative to the outline that names it, so a doc beside the
// outline's directory — the `../` case — is a normal, valid attachment.
test("a doc reached through ../ resolves against the outline's directory", () => {
  expectValid(
    { "sub/plan.jsonl": `{"id":"a","ord":"a","title":"a","doc":"../notes/a.md"}` },
    ["notes/a.md"],
  )
  // The resolver is pure path arithmetic — no disk, or the validator would be
  // a second reader.
  expect(resolveRelative("sub/plan.jsonl", "../notes/a.md")).toBe("notes/a.md")
  expect(resolveRelative("sub/plan.jsonl", "./a.md")).toBe("sub/a.md")
  expect(resolveRelative("plan.jsonl", "notes/a.md")).toBe("notes/a.md")
})

// The rule the format leans on: if a parent's status could be both stored and
// derived, a merge could make the two disagree and nothing would notice. The
// refusal names the children that are in the way, as data.
test("done stored above unfinished children lists them", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"p","ord":"a","title":"p","done":true}\n` +
        `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
        `{"id":"c2","parent":"p","ord":"b","title":"c2"}\n` +
        `{"id":"c3","parent":"p","ord":"c","title":"c3","doing":true}`,
    }),
  )
  expect(error.code).toBe("stored-derived-state")
  expect(error.line).toBe(1)
  expect(error.message).toContain("2 of 3 children that are not done")
  expect(error.related).toEqual([
    { file: "a.jsonl", line: 3, note: "`c2` is open" },
    { file: "a.jsonl", line: 4, note: "`c3` is doing" },
  ])
})

// The other wording, and the subtler half of the rule: even when the stored
// value agrees with what would be computed, storing it is the error — the
// agreement is what stops being true after the next edit.
test("done stored above children that are all done is still refused", () => {
  const error = only(
    errorsOf({
      "a.jsonl": `{"id":"p","ord":"a","title":"p","done":true}\n` +
        `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
        `{"id":"c2","parent":"p","ord":"b","title":"c2","done":true}`,
    }),
  )
  expect(error.code).toBe("stored-derived-state")
  expect(error.message).toContain("computed from this node's 2 children")
  // Nothing to link, so the key is absent rather than empty — the same rule
  // the format applies to its own fields.
  expect(error.related).toBeUndefined()
})

// A mirror is a second view of a node, not a second obligation: a node whose
// only child is a mirror is still a leaf, and a leaf may say what it is.
test("a mirror child does not make its host a parent", () => {
  expectValid({
    "a.jsonl": `{"id":"x","ord":"z","title":"elsewhere"}\n` +
      `{"id":"p","ord":"a","title":"p","done":true}\n` +
      `{"id":"m","parent":"p","ord":"a","mirror":"x"}`,
  })
})

// Two loads of the same broken set produce the same list — that is what lets a
// human diff two error views and a test assert on the first error.
test("errors come back sorted by file, then line", () => {
  const errors = errorsOf({
    "b.jsonl": `{"id":"b1","parent":"nope","ord":"a","title":"b"}`,
    "a.jsonl": `{"id":"a1","ord":"a","title":"a","see":["nope"]}\n` +
      `{"id":"a2","parent":"nope","ord":"b","title":"a"}`,
  })
  expect(errors.map((error) => `${error.file}:${error.line}`)).toEqual([
    "a.jsonl:1",
    "a.jsonl:2",
    "b.jsonl:1",
  ])
})

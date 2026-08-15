import { expect, test } from "bun:test"
import { Result } from "effect"

import { isCrossFile, type OutlineError } from "./errors.ts"
import { setOf } from "./fixtures.testlib.ts"
import type { OutlineSet } from "./set.ts"
import { validate } from "./validate.ts"

const errorsOf = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
  broken: Record<string, string> = {},
): ReadonlyArray<OutlineError> => {
  const result = validate(setOf(files, documents, broken))
  if (Result.isSuccess(result)) throw new Error("expected this set to be rejected")
  return result.failure
}

const expectValid = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
  broken: Record<string, string> = {},
): OutlineSet => {
  const set = setOf(files, documents, broken)
  const result = validate(set)
  if (Result.isFailure(result)) {
    throw new Error(
      `expected a valid set: ${result.failure.map((e) => `${e.file}:${e.line} ${e.message}`).join("; ")}`,
    )
  }
  // The set comes back as it went in — the validator judges, it does not
  // reshape, so what the browser subscribes to is what the reader found.
  expect(result.success).toBe(set)
  expect(result.success.files.length).toBe(
    Object.keys(files).length + Object.keys(broken).length,
  )
  return result.success
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
      "home.olai": `{"id":"kitchen","ord":"a","title":"kitchen #reno"}\n` +
        `{"id":"demo","parent":"kitchen","ord":"a","title":"demolition","props":{"status":"done","since":"2026-08-01"}}\n` +
        `{"id":"order","parent":"kitchen","ord":"b","title":"order cabinets","props":{"after":["demo"],"see":["budget"]},"doc":"notes/cabinets.md"}\n`,
      "work.olai": `{"id":"budget","ord":"a","title":"the budget","props":{"blocks":["order"]}}\n` +
        `{"id":"m","ord":"b","mirror":"order"}\n`,
    },
    ["notes/cabinets.md"],
  )
})

// The set is flat: `files` is the list found on disk and the nodes are one
// list. A `.olai` holding no nodes is still a file of the set — which is why
// `files` is not derived from `nodes`, and why an empty one is not an error.
test("a file with no nodes is a member of the set, not a problem with it", () => {
  expectValid({
    "empty.olai": ``,
    "a.olai": `{"id":"a","ord":"a","title":"a"}\n`,
  })
})

// Ids are the identity of the whole set, so the duplicate is the second claim,
// not the first — and the first has to be a link, because "it is already taken"
// without saying by what is a search.
test("a duplicate id is reported on the second record, pointing at the first", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"x","ord":"a","title":"one"}`,
      "b.olai": `{"id":"x","ord":"a","title":"two"}`,
    }),
  )
  expect(error.code).toBe("duplicate-id")
  expect([error.file, error.line]).toEqual(["b.olai", 1])
  expect(error.related).toEqual([
    { file: "a.olai", line: 1, note: "first declared here" },
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
      "a.olai": `{"id":"kitchen","ord":"a","title":"k"}\n` +
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
      "a.olai": `{"id":"kitchen","ord":"a","title":"k"}\n` +
        `{"id":"sink","parent":"zzz","ord":"b","title":"s"}`,
    }),
  )
  expect(error.code).toBe("unknown-parent")
  expect(error.message).not.toContain("did you mean")
})

// Every `.olai` is an independent tree. A parent that resolves in another file
// is the one unknown-parent case that is not a typo, so it gets its own code
// and is told what to use instead.
test("a parent in another file is a foreign-parent, not an unknown one", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"kitchen","ord":"a","title":"k"}`,
      "b.olai": `{"id":"sink","parent":"kitchen","ord":"a","title":"s"}`,
    }),
  )
  expect(error.code).toBe("foreign-parent")
  expect([error.file, error.line]).toEqual(["b.olai", 1])
  expect(error.message).toContain("`mirror`")
  expect(error.related).toEqual([
    { file: "a.olai", line: 1, note: "the parent lives here" },
  ])
})

// A mirror is a placement, not a container: children hang off the node the
// mirror points at. Allowing this would give one node two child lists.
test("a child of a mirror is refused", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"k","ord":"a","title":"k"}\n` +
        `{"id":"m","ord":"b","mirror":"k"}\n` +
        `{"id":"c","parent":"m","ord":"c","title":"c"}`,
    }),
  )
  expect(error.code).toBe("parent-not-a-node")
  expect(error.line).toBe(3)
  expect(error.related?.[0]).toEqual({ file: "a.olai", line: 2, note: "the mirror is here" })
})

// A parent loop makes every tree walk in the system non-terminating, and it is
// exactly what a git merge of two moves can produce.
test("a parent cycle is one error naming the whole loop", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
        `{"id":"b","parent":"a","ord":"b","title":"b"}`,
    }),
  )
  expect(error.code).toBe("parent-cycle")
  // Anchored at the earliest record of the loop, so two loads report it the
  // same way.
  expect(error.line).toBe(1)
  expect(error.message).toContain("`a` → `b` → `a`")
  expect(error.related).toEqual([{ file: "a.olai", line: 2, note: "also in the loop" }])
})

// Every relation field resolves against the whole set, and the message has to
// say which field was the dangling one — a node can carry four.
test("a dangling target is reported for mirror, after, blocks and see alike", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","ord":"a","title":"a","props":{"after":["no1"],"blocks":["no2"],"see":["no3"]}}\n` +
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
      "a.olai": `{"id":"a","ord":"a","title":"a","props":{"after":["b"]}}\n` +
        `{"id":"b","ord":"b","title":"b","props":{"after":["a"]}}`,
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
      "a.olai": `{"id":"a","ord":"a","title":"a","props":{"blocks":["b"]}}\n` +
        `{"id":"b","ord":"b","title":"b","props":{"blocks":["a"]}}`,
    }),
  )
  expect(error.code).toBe("after-cycle")
  expect(error.message).toContain("`a` → `b` → `a`")
})

// The same loop closed THROUGH A PLACEMENT. An edge may name a mirror — an id
// is an id — and what it names is the node standing there, which is how the
// view resolves it when it draws both of these as blocked. So the graph this
// rule walks resolves it too (`derive`'s `orderings`, in terms of nodes at both
// ends). Before that, the walk stepped onto a record carrying no edges of its
// own and stopped: a set nobody can start anywhere in loaded clean, with two
// rows saying `blocked` at each other for ever.
test("an after cycle closing through a mirror is refused", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"x","ord":"a","title":"x","props":{"after":["m"]}}\n` +
        `{"id":"y","ord":"b","title":"y","props":{"after":["x"]}}`,
      "b.olai": `{"id":"m","ord":"a","mirror":"y"}`,
    }),
  )
  expect(error.code).toBe("after-cycle")
  // Named as the NODES it deadlocks between, which is what a person has to
  // edit — the placement is not one of them.
  expect(error.message).toContain("`x` → `y` → `x`")
})

// The one place the two `after` rules deliberately part company, locked from
// the side that exempts NOTHING. Blockedness lets archived work out at both
// ends — it is over, so nothing waits on it and nothing tells it it cannot
// start — while a loop is a claim about the FILE: nothing in it can start
// first, whether or not somebody has put half of it away. Without this test a
// future "skip archived in findCycles" stays green.
test("an after cycle through the archive is still refused", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"live","ord":"a","title":"live","props":{"status":"doing","after":["old"]}}`,
      "Archive.olai": `{"id":"old","ord":"a","title":"old","props":{"status":"done","after":["live"]}}`,
    }),
  )
  expect(error.code).toBe("after-cycle")
  // Anchored at the earliest record of the loop, which here is the archived
  // one — the report is about the file, and the archive is a file in the set.
  expect(error.message).toContain("`old` → `live` → `old`")
})

// Containment that closes a loop through a mirror never finishes expanding, so
// the browser would render forever.
test("mirrors that show each other are a mirror-cycle", () => {
  const error = only(
    errorsOf({
      "a.olai": `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
    }),
  )
  expect(error.code).toBe("mirror-cycle")
  expect(error.message).toContain("`m1` → `m2` → `m1`")
  expect(error.related).toEqual([{ file: "a.olai", line: 2, note: "also in the loop" }])
})

// The headline case, and the reason the check exists: a mirror of `a` placed
// INSIDE `a`. Drawing `a` draws the mirror, which draws `a` — a renderer that
// believed the file would never stop. Nothing about this record is wrong on
// its own; it is only wrong where it sits.
test("a mirror placed inside the subtree it shows is a mirror-cycle", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"a"}`,
  })
  expect(codes(errors)).toEqual(["mirror-cycle"])
})

// And it holds across files, which is the case mirrors exist for.
test("a mirror is still a cycle when the subtree it shows lives elsewhere", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"b"}`,
    "b.olai": `{"id":"b","ord":"a","title":"b"}\n{"id":"n","parent":"b","ord":"b","mirror":"a"}`,
  })
  expect(codes(errors)).toContain("mirror-cycle")
})

// The same loop said twice in two vocabularies helps nobody: a cycle with no
// mirror in it is a parent cycle and only that.
test("a pure parent cycle is not also reported as a mirror-cycle", () => {
  const errors = errorsOf({
    "a.olai": `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  })
  expect(codes(errors)).toEqual(["parent-cycle"])
})

// `doc` is a reference like any other, so it is checked like any other — and
// against the files actually served, since a path that resolves nowhere is a
// note nobody will ever see again.
test("a doc naming no served file is refused, and says what it resolved to", () => {
  const error = only(
    errorsOf({ "a.olai": `{"id":"a","ord":"a","title":"a","doc":"notes/a.md"}` }, []),
  )
  expect(error.code).toBe("missing-doc")
  expect(error.message).toContain("resolves to `notes/a.md`")
})

// "Attached" means relative to the outline that names it, so a doc beside the
// outline's directory — the `../` case — is a normal, valid attachment.
test("a doc reached through ../ resolves against the outline's directory", () => {
  expectValid(
    { "sub/plan.olai": `{"id":"a","ord":"a","title":"a","doc":"../notes/a.md"}` },
    ["notes/a.md"],
  )
  // The arithmetic behind it is `documents.ts`'s, and it is tested there.
})

// A mark is a stored fact about the node that carries it, and there is no rule
// here about what hangs under it. The rule that used to be — no stored derived
// state — existed only to keep a computed status and a written one from
// disagreeing; nothing computes one now, so there is nothing to disagree with
// (resolved 2026-08-11).
test("a mark on a node with children is a set that loads", () => {
  // Every shape the old rule refused, in one file: a mark over unfinished
  // tasks, a mark over children that are all done, and a mark over children
  // that are all plain notes.
  expectValid({
    "a.olai": `{"id":"p","ord":"a","title":"p","props":{"status":"done","since":"2026-08-11"}}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","props":{"status":"done"}}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","props":{"status":"doing"}}\n` +
      `{"id":"q","ord":"b","title":"q","props":{"status":"done"}}\n` +
      `{"id":"q1","parent":"q","ord":"a","title":"q1","props":{"status":"done"}}\n` +
      `{"id":"notes","ord":"c","title":"read this book","props":{"status":"todo","since":"2026-08-11"}}\n` +
      `{"id":"n1","parent":"notes","ord":"a","title":"chapter three is the good one"}`,
  })
})

// The merge that used to break the set: mark a leaf in one branch, add a task
// child under it in another, and a clean textual merge produced a file nothing
// would load. Both edits are line-wise, so both survive — and now so does the
// set they make.
test("a merge that marks a leaf and gives it a child still loads", () => {
  expectValid({
    "a.olai": `{"id":"leaf","ord":"a","title":"leaf","props":{"status":"done","since":"2026-08-10"}}\n` +
      `{"id":"arrived","parent":"leaf","ord":"a","title":"arrived from the other branch","props":{"status":"todo"}}`,
  })
})

// Two loads of the same broken set produce the same list — that is what lets a
// human diff two error views and a test assert on the first error.
test("errors come back sorted by file, then line", () => {
  const errors = errorsOf({
    "b.olai": `{"id":"b1","parent":"nope","ord":"a","title":"b"}`,
    "a.olai": `{"id":"a1","ord":"a","title":"a","props":{"see":["nope"]}}\n` +
      `{"id":"a2","parent":"nope","ord":"b","title":"a"}`,
  })
  expect(errors.map((error) => `${error.file}:${error.line}`)).toEqual([
    "a.olai:1",
    "a.olai:2",
    "b.olai:1",
  ])
})

// ── files that did not parse ────────────────────────────────────────────

// The hybrid error scope (resolved 2026-08-09). One unreadable file is a HOLE:
// the outlines that parsed are still a set, still valid, still on screen, and
// the broken one carries its own errors to render in its own place.
test("a file that did not parse leaves the rest of the set valid", () => {
  const set = expectValid(
    { "garden.olai": `{"id":"garden","ord":"a","title":"garden"}` },
    [],
    { "house.olai": `{"id":"kitchen","ord":"a",title:"kitchen"}` },
  )
  expect(set.broken.map((file) => file.file)).toEqual(["house.olai"])
  expect(set.broken[0]?.errors.map((error) => error.code)).toEqual(["not-json"])
})

// The staging rule, applied across files rather than within one: the ids the
// unreadable file would have declared are missing, so `elsewhere` may well be
// in there. Reporting it would be a guess, and the guess would name the wrong
// file — so the report is the parse error, which is the cause.
test("a target that the unreadable file might declare is not reported as unknown", () => {
  const errors = errorsOf(
    { "garden.olai": `{"id":"garden","ord":"a","title":"g","props":{"see":["elsewhere"]}}` },
    [],
    { "house.olai": `{"id":"kitchen","ord":"a",title:"kitchen"}` },
  )
  expect(codes(errors)).toEqual(["not-json"])
  expect(errors[0]?.file).toBe("house.olai")
})

// The other half of the same rule. A missing file can HIDE a duplicate but
// cannot invent one, so this error stands — and the parse error is reported
// beside it, because both have to be fixed and one pass should be enough.
test("an error the unreadable file cannot explain is reported with it", () => {
  const errors = errorsOf(
    {
      "a.olai": `{"id":"x","ord":"a","title":"one"}`,
      "b.olai": `{"id":"x","ord":"a","title":"two"}`,
    },
    [],
    { "c.olai": `{"id":"y","ord":"a",title:"three"}` },
  )
  expect(codes(errors)).toEqual(["duplicate-id", "not-json"])
})

// `parent` may not cross files, so an unresolved one is refused whichever file
// the id was going to be in: unknown if nothing declares it, foreign if the
// unreadable file did. Withholding it would be withholding an error that is
// certain, only to re-report it in different words one fix later.
test("an unknown parent is reported even when a file did not parse", () => {
  const errors = errorsOf(
    { "a.olai": `{"id":"sink","parent":"nowhere","ord":"a","title":"s"}` },
    [],
    { "b.olai": `{"id":"y","ord":"a",title:"y"}` },
  )
  expect(codes(errors)).toEqual(["unknown-parent", "not-json"])
})

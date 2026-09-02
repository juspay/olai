import { expect, test } from "bun:test"
import { Result } from "effect"

import { rowsOf } from "./derive.ts"
import { bodiedDocument, type Document } from "./document.ts"
import { implicatedBy, isCrossFile, type OutlineError } from "./errors.ts"
import { blamed, type Verdict, verdictOf } from "./verdict.ts"
import {
  decodedOf,
  findingsIn,
  outlineOf,
  recordsOf,
  setOf,
  validatedOf,
} from "./fixtures.testlib.ts"
import {
  assemble,
  brokenBy,
  brokenIn,
  documentAt,
  type OutlineSet,
  outlinePaths,
  outlinesIn,
  withDocuments,
} from "./set.ts"
import { following, type Previous, type Reading, reading, validate } from "./validate.ts"

/**
 * THE REPORT a set produces — the rows a reader is shown, in presentation
 * order.
 *
 * A validation no longer REFUSES over any of these: since the per-file ruling
 * it answers with the directory, published with the broken files' content
 * withheld, and the rows ride on those files ({@link findingsIn} reads them
 * back). So the assertions below are unchanged — they were always about the
 * report — and what changed is the door they come through. The DEGRADATION
 * itself is asserted separately, below, where the sets are small enough to name
 * which file went dark.
 */
const errorsOf = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
  broken: Record<string, string> = {},
): ReadonlyArray<OutlineError> => findingsIn(validatedOf(files, documents, broken))

/** The same, and WHICH FILES the set was left holding nothing for — in path
 *  order, which is the order `blamed` files them in. */
const degradedBy = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
  broken: Record<string, string> = {},
): { readonly set: OutlineSet; readonly dark: ReadonlyArray<string> } => {
  const set = validatedOf(files, documents, broken)
  return { set, dark: set.broken.map((entry) => entry.file) }
}

/**
 * …and NOT the same helper, which is why this one keeps its own body: it
 * asserts what a valid load leaves ALONE — the very set that went in, the
 * derivation over the set's own records by identity, and one outline per file
 * handed over — and it says which findings it did not expect when it throws.
 * {@link validatedOf} unwraps; this one is a test.
 */
const expectValid = (
  files: Record<string, string>,
  documents: ReadonlyArray<string> = [],
  broken: Record<string, string> = {},
): OutlineSet => {
  const set = setOf(files, documents, broken)
  const result = validate(set)
  if (Result.isFailure(result)) {
    throw new Error(
      `expected a valid set: ${
        result.failure.findings.map((e) => `${e.file}:${e.line} ${e.message}`).join("; ")
      }`,
    )
  }
  // The set comes back as it went in — the validator judges, it does not
  // reshape, so what the browser subscribes to is what the reader found. What
  // is added is the derivation the rules were run over, paired with it.
  expect(result.success.set).toBe(set)
  // The derivation holds the SET'S OWN records — flattened out of the
  // outlines, one list, each entry the same object the set carries. Identity
  // is what the rules turn on (a duplicate id is "the record `byId` kept is
  // not THIS record"), so it is identity that is checked.
  const records = recordsOf(set)
  expect(result.success.derived.nodes.length).toBe(records.length)
  expect(result.success.derived.nodes.every((at, index) => at === records[index])).toBe(
    true,
  )
  expect(outlinePaths(result.success.set).length).toBe(
    Object.keys(files).length + Object.keys(broken).length,
  )
  return result.success.set
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
      "home.org": `{"id":"kitchen","ord":"a","title":"kitchen #reno"}\n` +
        `{"id":"demo","parent":"kitchen","ord":"a","title":"demolition","done":"2026-08-01"}\n` +
        `{"id":"order","parent":"kitchen","ord":"b","title":"order cabinets","after":["demo"],"see":["budget"],"doc":"notes/cabinets.md"}\n`,
      "work.org": `{"id":"budget","ord":"a","title":"the budget","blocks":["order"]}\n` +
        `{"id":"m","ord":"b","mirror":"order"}\n`,
    },
    ["notes/cabinets.md"],
  )
})

// ── the view a validation is offered ───────────────────────────────────
//
// A validation may be handed the reading it FOLLOWS and what has moved since,
// and then the view its rules run over is patched rather than built
// (`./patch.ts`). What that rests on is that the view is about THIS set: the
// rules read the two against each other by identity — a duplicate id is "the
// record `byId` kept is not this record" — so a view of some other moment does
// not merely go stale, it condemns every record in the set as a duplicate of
// itself.

test("a view that is not about this set is not the view the rules run over", () => {
  const before = setOf({
    "a.org": `{"id":"x","ord":"a","title":"one"}`,
    "b.org": `{"id":"y","ord":"a","title":"two"}`,
  })
  const first = validate(before)
  if (Result.isFailure(first)) throw new Error("expected the first set to be valid")

  // A delta that claims nothing moved, about a set where something did — the
  // shape a caller with a wrong idea of what changed would hand over.
  const after = setOf({
    "a.org": `{"id":"x","ord":"a","title":"edited"}`,
    "b.org": `{"id":"y","ord":"a","title":"two"}`,
  })
  const answer = validate(after, {
    read: first.success,
    delta: { upserts: [], removes: [] },
  })

  if (Result.isFailure(answer)) {
    throw new Error(
      `expected the set in hand to be judged: ${
        answer.failure.findings.map((e) => e.code).join(", ")
      }`,
    )
  }
  // The view is the set's own, whichever way it was reached — the same
  // records, in the same order, as objects and not as copies.
  const records = recordsOf(after)
  expect(answer.success.derived.nodes.every((at, index) => at === records[index])).toBe(
    true,
  )
  expect(answer.success.derived.byId.get("x")).toBe(records[0])
})

// The check that decides between the two is asked FILE BY FILE, of the view's
// own grouping — never by flattening the set to compare two lists of every
// record in the directory (`./validate.ts`'s `isSet`). So the three cases below
// are about what that grouping does and does not spell, and each of them
// re-assembles the SAME decoded outlines with one file replaced, which is what
// a probe hands over: the files nobody touched are the very objects the last
// reading was judged against, and the identity the check turns on is real.

/** The next reading's set and the delta that describes it — one file rewritten,
 *  every other outline the same object as before. */
const probed = (
  held: Map<string, Result.Result<Document, Verdict>>,
  read: Reading,
  file: string,
  text: string,
): { readonly set: OutlineSet; readonly previous: Previous } => {
  held.set(file, Result.succeed<Document>(outlineOf(text, file)))
  const set = assemble(held)
  const nodes = recordsOf(set).filter((at) => at.file === file)
  return { set, previous: { read, delta: { upserts: [[file, { nodes }]], removes: [] } } }
}

const judged = (set: OutlineSet, previous?: Previous): Reading => {
  const answer = validate(set, previous)
  if (Result.isFailure(answer)) {
    throw new Error(
      `expected a valid set: ${answer.failure.findings.map((e) => e.code).join(", ")}`,
    )
  }
  return answer.success
}

test("a delta that describes the set is taken, and the view is a patched one", () => {
  const held = decodedOf({
    "a.org": `{"id":"x","ord":"a","title":"one"}`,
    "b.org": `{"id":"y","ord":"a","title":"two"}`,
  })
  const first = judged(assemble(held))
  const { set, previous } = probed(held, first, "a.org", `{"id":"x","ord":"a","title":"edited"}`)
  const answer = judged(set, previous)

  // A LAYER is what only the patcher produces — `derive` builds plain maps — so
  // this is how the suite says the answer came the cheap way rather than
  // through the rebuild the guard falls back to.
  expect(answer.derived.byId instanceof Map).toBe(false)
  expect(answer.derived.byId.get("x")?.node).toMatchObject({ title: "edited" })
  const records = recordsOf(set)
  expect(answer.derived.nodes.every((at, index) => at === records[index])).toBe(true)
  // And the flat list is ONE value however often it is asked for, since the
  // rules above read it five times and a caller reads it after them.
  expect(answer.derived.nodes).toBe(answer.derived.nodes)
})

test("an outline holding nothing is not a disagreement about the set", () => {
  // Absence is how `byFile` spells a file with no records, so a set carrying an
  // empty outline has one more file than the view has keys — which a check
  // stepping the two in lockstep has to expect rather than call a mismatch.
  const held = decodedOf({
    "a.org": `{"id":"x","ord":"a","title":"one"}`,
    "empty.org": ``,
    "z.org": `{"id":"y","ord":"a","title":"two"}`,
  })
  const first = judged(assemble(held))
  const { set, previous } = probed(held, first, "a.org", `{"id":"x","ord":"a","title":"edited"}`)
  const answer = judged(set, previous)

  expect(answer.derived.byId instanceof Map).toBe(false)
  expect(answer.derived.byId.get("x")?.node).toMatchObject({ title: "edited" })
  expect([...answer.derived.byFile.keys()]).toEqual(["a.org", "z.org"])
})

test("a delta that leaves the view holding a file the set lost is thrown away", () => {
  const held = decodedOf({
    "a.org": `{"id":"x","ord":"a","title":"one"}`,
    "b.org": `{"id":"y","ord":"a","title":"two"}`,
  })
  const first = judged(assemble(held))
  // The directory lost b.org and the delta never says so, which the flat
  // comparison this replaced could only see as a length: the view files a
  // record under a path the set does not hold at all.
  held.delete("b.org")
  const set = assemble(held)
  const answer = judged(set, { read: first, delta: { upserts: [], removes: [] } })

  expect([...answer.derived.byFile.keys()]).toEqual(["a.org"])
  expect(answer.derived.byId.has("y")).toBe(false)
  const records = recordsOf(set)
  expect(answer.derived.nodes.every((at, index) => at === records[index])).toBe(true)
})

// The set is flat: `files` is the list found on disk and the nodes are one
// list. A `.org` holding no nodes is still a file of the set — which is why
// `files` is not derived from `nodes`, and why an empty one is not an error.
test("a file with no nodes is a member of the set, not a problem with it", () => {
  expectValid({
    "empty.org": ``,
    "a.org": `{"id":"a","ord":"a","title":"a"}\n`,
  })
})

// Ids are the identity of the whole set, so the duplicate is the second claim,
// not the first — and the first has to be a link, because "it is already taken"
// without saying by what is a search.
test("a duplicate id is reported on the second record, pointing at the first", () => {
  const error = only(
    errorsOf({
      "a.org": `{"id":"x","ord":"a","title":"one"}`,
      "b.org": `{"id":"x","ord":"a","title":"two"}`,
    }),
  )
  expect(error.code).toBe("duplicate-id")
  expect([error.file, error.line]).toEqual(["b.org", 1])
  expect(error.related).toEqual([
    { file: "a.org", line: 1, note: "first declared here" },
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
      "a.org": `{"id":"kitchen","ord":"a","title":"k"}\n` +
        `{"id":"sink","parent":"kitchn","ord":"b","title":"s"}`,
    }),
  )
  expect(error.code).toBe("unknown-parent")
  expect(error.line).toBe(9)
  expect(error.message).toContain("did you mean `kitchen`?")
})

// The suggestion is only worth printing when it is plausible. Offering the one
// unrelated id in the file as a guess would train people to ignore the line.
test("an unknown parent nothing resembles gets no did-you-mean", () => {
  const error = only(
    errorsOf({
      "a.org": `{"id":"kitchen","ord":"a","title":"k"}\n` +
        `{"id":"sink","parent":"zzz","ord":"b","title":"s"}`,
    }),
  )
  expect(error.code).toBe("unknown-parent")
  expect(error.message).not.toContain("did you mean")
})

// Every `.org` is an independent tree. A parent that resolves in another file
// is the one unknown-parent case that is not a typo, so it gets its own code
// and is told what to use instead.
test("a parent in another file is a foreign-parent, not an unknown one", () => {
  const error = only(
    errorsOf({
      "a.org": `{"id":"kitchen","ord":"a","title":"k"}`,
      "b.org": `{"id":"sink","parent":"kitchen","ord":"a","title":"s"}`,
    }),
  )
  expect(error.code).toBe("foreign-parent")
  expect([error.file, error.line]).toEqual(["b.org", 1])
  expect(error.message).toContain("`mirror`")
  // NAMED, NOT BLAMED. The parent's site is where the `parent` went, so a
  // reader can see it; `broken: false` is the rule saying `a.org` is nobody's
  // fault here — the edit is the `parent` on this line, in `b.org`.
  expect(error.related).toEqual([
    { file: "a.org", line: 1, note: "the parent lives here", broken: false },
  ])
  // …and the two planes say different things about it, which is the point:
  // the finding is ABOUT both files, and it BREAKS one.
  expect(implicatedBy(error)).toEqual(["b.org", "a.org"])
  expect(isCrossFile(error)).toBe(false)
  expect(blamed([error]).map((one) => one.file)).toEqual(["b.org"])
})

// A mirror is a placement, not a container: children hang off the node the
// mirror points at. Allowing this would give one node two child lists.
test("a child of a mirror is refused", () => {
  const error = only(
    errorsOf({
      "a.org": `{"id":"k","ord":"a","title":"k"}\n` +
        `{"id":"m","ord":"b","mirror":"k"}\n` +
        `{"id":"c","parent":"m","ord":"c","title":"c"}`,
    }),
  )
  expect(error.code).toBe("parent-not-a-node")
  expect(error.line).toBe(17)
  expect(error.related?.[0]).toEqual({ file: "a.org", line: 9, note: "the mirror is here" })
})

// A parent loop makes every tree walk in the system non-terminating, and it is
// exactly what a git merge of two moves can produce.
test("a parent cycle is one error naming the whole loop", () => {
  const error = only(
    errorsOf({
      "a.org": `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
        `{"id":"b","parent":"a","ord":"b","title":"b"}`,
    }),
  )
  expect(error.code).toBe("parent-cycle")
  // Anchored at the earliest record of the loop, so two loads report it the
  // same way.
  expect(error.line).toBe(1)
  expect(error.message).toContain("`a` → `b` → `a`")
  expect(error.related).toEqual([{ file: "a.org", line: 10, note: "also in the loop" }])
})

// Every relation field resolves against the whole set, and the message has to
// say which field was the dangling one — a node can carry four.
test("a dangling target is reported for mirror, after, blocks and see alike", () => {
  const errors = errorsOf({
    "a.org": `{"id":"a","ord":"a","title":"a","after":["no1"],"blocks":["no2"],"see":["no3"]}\n` +
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

/** The `[line, field]` of every finding, in the order the report holds them —
 *  which is what the three tests below are about. */
const sites = (
  errors: ReadonlyArray<OutlineError>,
): ReadonlyArray<readonly [number, string]> =>
  errors.map((error) => [error.line, error.message.replace(/^`(\w+)`.*$/, "$1")] as const)

// The ORDER two findings at ONE site come out in, which is the whole of what
// moved when this rule stopped walking every record and started answering from
// the reverse index (`check-targets-index`, deferred from #205 and taken in
// #208). The report is sorted by file, line and code, so a difference can only
// show up between findings that tie on all three — two unknown targets on one
// record — and it shows up exactly when an EARLIER record already named one of
// them, since that is what puts its id first among the index's keys. The test
// above is the common case, where nothing else names them and the order is the
// record's own fields; this is the case that moved.
test("two unknown targets on one record come out in the order the corpus first names them", () => {
  const errors = errorsOf({
    "a.org": `{"id":"a","ord":"a","title":"a","see":["zz"]}\n` +
      `{"id":"b","ord":"b","title":"b","after":["aa"],"see":["zz"]}`,
  })
  // `zz` is named on line 1, so it is the first key; `b` names it with `see`
  // and `aa` with `after`, and its two findings follow that rather than the
  // order the record writes its fields in (which would put `after` first).
  expect(sites(errors)).toEqual([[1, "see"], [10, "see"], [10, "after"]])
})

// The fold is per RECORD and per FIELD: what it collapses is a repeat, never a
// relation. Both halves are pinned, because the index one of them comes from
// keys a record by every id it names and could have collapsed either.
test("one unknown id named with two fields is one finding per field", () => {
  const errors = errorsOf({
    "a.org": `{"id":"a","ord":"a","title":"a","after":["gone"],"see":["gone"]}`,
  })
  expect(sites(errors)).toEqual([[1, "after"], [1, "see"]])
})

test("the same unknown id named twice in one field is one finding, not two", () => {
  // Only a hand-edited file can hold this — no op writes a repeat — and two
  // copies of one sentence at one site tell a reader nothing the first did not.
  const errors = errorsOf({
    "a.org": `{"id":"a","ord":"a","title":"a","after":["gone","gone"]}`,
  })
  expect(sites(errors)).toEqual([[1, "after"]])
})

// `after` is the ordering constraint the views schedule by; a loop in it means
// nothing in the loop can start first.
test("an after cycle is refused", () => {
  const error = only(
    errorsOf({
      "a.org": `{"id":"a","ord":"a","title":"a","after":["b"]}\n` +
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
      "a.org": `{"id":"a","ord":"a","title":"a","blocks":["b"]}\n` +
        `{"id":"b","ord":"b","title":"b","blocks":["a"]}`,
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
      "a.org": `{"id":"x","ord":"a","title":"x","after":["m"]}\n` +
        `{"id":"y","ord":"b","title":"y","after":["x"]}`,
      "b.org": `{"id":"m","ord":"a","mirror":"y"}`,
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
      "a.org": `{"id":"live","ord":"a","title":"live","doing":true,"after":["old"]}`,
      "_olai/Trash.org": `{"id":"old","ord":"a","title":"old","done":true,"after":["live"]}`,
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
      "a.org": `{"id":"m1","ord":"a","mirror":"m2"}\n{"id":"m2","ord":"b","mirror":"m1"}`,
    }),
  )
  expect(error.code).toBe("mirror-cycle")
  expect(error.message).toContain("`m1` → `m2` → `m1`")
  expect(error.related).toEqual([{ file: "a.org", line: 9, note: "also in the loop" }])
})

// The headline case, and the reason the check exists: a mirror of `a` placed
// INSIDE `a`. Drawing `a` draws the mirror, which draws `a` — a renderer that
// believed the file would never stop. Nothing about this record is wrong on
// its own; it is only wrong where it sits.
test("a mirror placed inside the subtree it shows is a mirror-cycle", () => {
  const errors = errorsOf({
    "a.org": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"a"}`,
  })
  expect(codes(errors)).toEqual(["mirror-cycle"])
})

// And it holds across files, which is the case mirrors exist for.
test("a mirror is still a cycle when the subtree it shows lives elsewhere", () => {
  const errors = errorsOf({
    "a.org": `{"id":"a","ord":"a","title":"a"}\n{"id":"m","parent":"a","ord":"b","mirror":"b"}`,
    "b.org": `{"id":"b","ord":"a","title":"b"}\n{"id":"n","parent":"b","ord":"b","mirror":"a"}`,
  })
  expect(codes(errors)).toContain("mirror-cycle")
})

// The same loop said twice in two vocabularies helps nobody: a cycle with no
// mirror in it is a parent cycle and only that.
test("a pure parent cycle is not also reported as a mirror-cycle", () => {
  const errors = errorsOf({
    "a.org": `{"id":"a","parent":"b","ord":"a","title":"a"}\n` +
      `{"id":"b","parent":"a","ord":"b","title":"b"}`,
  })
  expect(codes(errors)).toEqual(["parent-cycle"])
})

// `doc` is a reference like any other, so it is checked like any other — and
// against the files actually served, since a path that resolves nowhere is a
// note nobody will ever see again.
test("a doc naming no served file is refused, and says what it resolved to", () => {
  const error = only(
    errorsOf({ "a.org": `{"id":"a","ord":"a","title":"a","doc":"notes/a.md"}` }, []),
  )
  expect(error.code).toBe("missing-doc")
  expect(error.message).toContain("resolves to `notes/a.md`")
})

// A `doc` names a DOCUMENT, and the set's bodied list is wider than that: a
// `.html` is read by the same probe and carried in the same field, so a
// membership test alone would have let a node attach one. It may not — the two
// surfaces that draw an attachment are one line of markdown under a row and the
// whole document under a zoomed node, and neither of them is the sealed frame a
// `.html` is shown in. The refusal is the one a path resolving nowhere gets,
// because from a reader's side it is the same thing: no such document.
test("a doc naming a served `.html` is refused, like any other non-document", () => {
  const error = only(
    errorsOf({ "a.org": `{"id":"a","ord":"a","title":"a","doc":"report.html"}` }, [
      "report.html",
    ]),
  )
  expect(error.code).toBe("missing-doc")
  expect(error.message).toContain("resolves to `report.html`")
})

// "Attached" means relative to the outline that names it, so a doc beside the
// outline's directory — the `../` case — is a normal, valid attachment.
test("a doc reached through ../ resolves against the outline's directory", () => {
  expectValid(
    { "sub/plan.org": `{"id":"a","ord":"a","title":"a","doc":"../notes/a.md"}` },
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
    "a.org": `{"id":"p","ord":"a","title":"p","done":"2026-08-11"}\n` +
      `{"id":"c1","parent":"p","ord":"a","title":"c1","done":true}\n` +
      `{"id":"c2","parent":"p","ord":"b","title":"c2","doing":true}\n` +
      `{"id":"q","ord":"b","title":"q","done":true}\n` +
      `{"id":"q1","parent":"q","ord":"a","title":"q1","done":true}\n` +
      `{"id":"notes","ord":"c","title":"read this book","todo":"2026-08-11"}\n` +
      `{"id":"n1","parent":"notes","ord":"a","title":"chapter three is the good one"}`,
  })
})

// The merge that used to break the set: mark a leaf in one branch, add a task
// child under it in another, and a clean textual merge produced a file nothing
// would load. Both edits are line-wise, so both survive — and now so does the
// set they make.
test("a merge that marks a leaf and gives it a child still loads", () => {
  expectValid({
    "a.org": `{"id":"leaf","ord":"a","title":"leaf","done":"2026-08-10"}\n` +
      `{"id":"arrived","parent":"leaf","ord":"a","title":"arrived from the other branch","todo":true}`,
  })
})

// Two loads of the same broken set produce the same list — that is what lets a
// human diff two error views and a test assert on the first error.
test("errors come back sorted by file, then line", () => {
  const errors = errorsOf({
    "b.org": `{"id":"b1","parent":"nope","ord":"a","title":"b"}`,
    "a.org": `{"id":"a1","ord":"a","title":"a","see":["nope"]}\n` +
      `{"id":"a2","parent":"nope","ord":"b","title":"a"}`,
  })
  expect(errors.map((error) => `${error.file}:${error.line}`)).toEqual([
    "a.org:1",
    "a.org:10",
    "b.org:1",
  ])
})

// ── files that did not parse ────────────────────────────────────────────

// The hybrid error scope (resolved 2026-08-09). One unreadable file is a HOLE:
// the outlines that parsed are still a set, still valid, still on screen, and
// the broken one carries its own errors to render in its own place.
test("a file that did not parse leaves the rest of the set valid", () => {
  const set = expectValid(
    { "garden.org": `{"id":"garden","ord":"a","title":"garden"}` },
    [],
    { "house.org": `{"id":"kitchen","ord":"a",title:"kitchen"}` },
  )
  expect(set.broken.map((file) => file.file)).toEqual(["house.org"])
  expect(set.broken[0]?.errors.map((error) => error.code)).toEqual(["bad-record"])
})

// The staging rule, applied across files rather than within one: the ids the
// unreadable file would have declared are missing, so `elsewhere` may well be
// in there. Reporting it would be a guess, and the guess would name the wrong
// file — so the report is the parse error, which is the cause.
test("a target that the unreadable file might declare is not reported as unknown", () => {
  const errors = errorsOf(
    { "garden.org": `{"id":"garden","ord":"a","title":"g","see":["elsewhere"]}` },
    [],
    { "house.org": `{"id":"kitchen","ord":"a",title:"kitchen"}` },
  )
  expect(codes(errors)).toEqual(["bad-record"])
  expect(errors[0]?.file).toBe("house.org")
})

// The other half of the same rule. A missing file can HIDE a duplicate but
// cannot invent one, so this error stands — and the parse error is reported
// beside it, because both have to be fixed and one pass should be enough.
test("an error the unreadable file cannot explain is reported with it", () => {
  const errors = errorsOf(
    {
      "a.org": `{"id":"x","ord":"a","title":"one"}`,
      "b.org": `{"id":"x","ord":"a","title":"two"}`,
    },
    [],
    { "c.org": `{"id":"y","ord":"a",title:"three"}` },
  )
  expect(codes(errors)).toEqual(["duplicate-id", "bad-record"])
})

// `parent` may not cross files, so an unresolved one is refused whichever file
// the id was going to be in: unknown if nothing declares it, foreign if the
// unreadable file did. Withholding it would be withholding an error that is
// certain, only to re-report it in different words one fix later.
test("an unknown parent is reported even when a file did not parse", () => {
  const errors = errorsOf(
    { "a.org": `{"id":"sink","parent":"nowhere","ord":"a","title":"s"}` },
    [],
    { "b.org": `{"id":"y","ord":"a",title:"y"}` },
  )
  expect(codes(errors)).toEqual(["unknown-parent", "bad-record"])
})

// ── typed properties ───────────────────────────────────────────────────
//
// The other half of the fence `@olai/ops` puts in front of a WRITE: a hand edit
// has no door to be refused at, so a value that does not fit what its key
// declares makes the file broken, NAMING THE KEY — exactly how every other
// validation rule reports (`./typing.ts`).

/** A vault that declares three keys, with a roster for the ref to point at.
 *  Spread into each case below with one record replaced, so what an assertion
 *  is about is the value and not the fixture. */
const DECLARING = {
  "_olai/Properties.org": [
    `{"id":"prop-merge","ord":"a0","title":"merge","custom":{"type":"ref"}}`,
    `{"id":"auto","parent":"prop-merge","ord":"a0","title":"automatic"}`,
    `{"id":"human","parent":"prop-merge","ord":"a1","title":"the human merges"}`,
    `{"id":"prop-dispatched","ord":"a1","title":"dispatched","custom":{"type":"date"}}`,
    `{"id":"prop-pr","ord":"a2","title":"pr","custom":{"type":"int"}}`,
  ].join("\n"),
}

test("a declared vault whose values fit loads", () => {
  expectValid({
    ...DECLARING,
    "lanes.org":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"merge":"auto","dispatched":"2026-08-25T10:06:00-04:00","pr":"193"}}`,
  })
})

test("a hand edit that lands a bad value is a broken file naming the key", () => {
  const errors = errorsOf({
    ...DECLARING,
    "lanes.org":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"merge":"AUTO: grok review folded + CI green"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.file).toBe("lanes.org")
  expect(errors[0]?.line).toBe(1)
  expect(errors[0]?.message).toContain("`merge` is `auto` | `human`")
})

test("a bad value's finding names the declaration that judged it", () => {
  const errors = errorsOf({
    ...DECLARING,
    "lanes.org": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"not-a-number"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  // Both halves of the judgement, so whatever asks which FILES the verdict
  // implicates gets the whole of it (`set-across-files` — the value is only
  // wrong relative to a declaration, and that declaration sits in another
  // vault file). `broken: false` is the merge plane the whole shape leans
  // on: NAMED but NOT darkened — the judge's page stays lit, its writes
  // stay admitted, and the ask can still reach it.
  expect(errors[0]?.file).toBe("lanes.org")
  expect(errors[0]?.related).toEqual([
    { file: "_olai/Properties.org", line: 37, note: "declared here", broken: false },
  ])
})

test("one finding per KEY, in canonical custom-key order", () => {
  const errors = errorsOf({
    ...DECLARING,
    "lanes.org":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"#193","dispatched":"whenever"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop", "bad-prop"])
  expect(errors[0]?.message).toContain("`dispatched`")
  expect(errors[1]?.message).toContain("`pr`")
})

// An undeclared key is text and always was — which is the whole of "typing is
// opt-in per key", asked of the file that types three of them.
test("an undeclared key beside declared ones is left entirely alone", () => {
  expectValid({
    ...DECLARING,
    "lanes.org":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"terminal":"a-uuid-with (a remark)","merge":"human"}}`,
  })
})

// The ref value goes stale the way a dangling `after` edge does: nothing about
// the lane changed, and the roster it pointed into did.
test("a ref value whose target is deleted is flagged like a dangling edge", () => {
  const files = {
    "_olai/Properties.org":
      `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}`,
    "agents.org": [
      `{"id":"roster","ord":"a0","title":"the agents"}`,
      `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
      `{"id":"grok","parent":"roster","ord":"a1","title":"Grok"}`,
    ].join("\n"),
    "lanes.org": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"grok"}}`,
  }
  expectValid(files)
  const errors = errorsOf({
    ...files,
    "agents.org": files["agents.org"].split("\n").slice(0, 2).join("\n"),
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.file).toBe("lanes.org")
  expect(errors[0]?.message).toContain("names a node under `roster`")
})

// A `doc` value is resolved against the naming outline's own directory, which
// is the `doc` FIELD's arithmetic and not a second copy of it.
test("a doc value resolves relative to the outline that names it", () => {
  const declaring = {
    "_olai/Properties.org": `{"id":"prop-brief","ord":"a0","title":"brief","custom":{"type":"doc"}}`,
  }
  expectValid({
    ...declaring,
    "orchestrator/lanes.org":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"brief":"../briefs/pdb.md"}}`,
  }, ["briefs/pdb.md"])
  const errors = errorsOf({
    ...declaring,
    "orchestrator/lanes.org":
      `{"id":"lane","ord":"a0","title":"a lane","custom":{"brief":"briefs/pdb.md"}}`,
  }, ["briefs/pdb.md"])
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.message).toContain("orchestrator/briefs/pdb.md")
})

// ── where the recursion grounds ────────────────────────────────────────

test("a declaration the built-in table does not know is a broken declarations file", () => {
  const errors = errorsOf({
    "_olai/Properties.org": `{"id":"p","ord":"a0","title":"stage","custom":{"type":"colour"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.file).toBe("_olai/Properties.org")
  expect(errors[0]?.message).toContain("which is not a property type — write `text` (anything)")
  expect(errors[0]?.message).toContain("`ref` (a child's id; `under` names the parent)")
  expect(errors[0]?.message).toContain("`int` (a digit run)")
})

test("a declaration with no type at all says so", () => {
  const errors = errorsOf({
    "_olai/Properties.org": `{"id":"p","ord":"a0","title":"stage"}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.message).toContain("does not say its `type`")
  expect(errors[0]?.message).toContain("`text` (anything)")
  expect(errors[0]?.message).toContain("`ref` (a child's id; `under` names the parent)")
})

test("`under` on something that is not a ref, and `under` naming nothing", () => {
  expect(
    errorsOf({
      "_olai/Properties.org":
        `{"id":"p","ord":"a0","title":"stage","custom":{"type":"date","under":"roster"}}`,
      "a.org": `{"id":"roster","ord":"a0","title":"the roster"}`,
    })[0]?.message,
  ).toContain("takes its values from nowhere in particular")
  expect(
    errorsOf({
      "_olai/Properties.org":
        `{"id":"p","ord":"a0","title":"stage","custom":{"type":"ref","under":"rostr"}}`,
      "a.org": `{"id":"roster","ord":"a0","title":"the roster"}`,
    })[0]?.message,
  ).toContain("did you mean `roster`?")
})

test("a key declared twice is reported on the SECOND claim, not the first", () => {
  const errors = errorsOf({
    "_olai/Properties.org": [
      `{"id":"p1","ord":"a0","title":"merge","custom":{"type":"int"}}`,
      `{"id":"p2","ord":"a1","title":"merge","custom":{"type":"date"}}`,
    ].join("\n"),
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.line).toBe(10)
  expect(errors[0]?.message).toContain("already declared by an earlier node")
})

test("a variant may not pretend to be a declaration", () => {
  const errors = errorsOf({
    "_olai/Properties.org": [
      `{"id":"prop-merge","ord":"a0","title":"merge","custom":{"type":"ref"}}`,
      `{"id":"auto","parent":"prop-merge","ord":"a0","title":"auto","custom":{"type":"int"}}`,
    ].join("\n"),
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.line).toBe(10)
  expect(errors[0]?.message).toContain("only a TOP-LEVEL node of this file declares one")
})

test("a key spelled like a field, and the two words the bootstrap reserves", () => {
  expect(
    errorsOf({
      "_olai/Properties.org": `{"id":"p","ord":"a0","title":"done","custom":{"type":"text"}}`,
    })[0]?.message,
  ).toContain("`set_done` writes it")
  expect(
    errorsOf({
      "_olai/Properties.org": `{"id":"p","ord":"a0","title":"type","custom":{"type":"text"}}`,
    })[0]?.message,
  ).toContain("says about ITSELF")
})

// The declarations file is found BY NAME, wherever it sits — `pinsIn`'s rule
// one convention over, so a vault keeping one at the root types just the same.
test("the declarations file is found by name wherever it sits", () => {
  const errors = errorsOf({
    "Properties.org": `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
    "lanes.org": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"#193"}}`,
  })
  expect(codes(errors)).toEqual(["bad-prop"])
  expect(errors[0]?.file).toBe("lanes.org")
})

// ── the reading a WRITE leaves ─────────────────────────────────────────
//
// `following` is the other door onto the same two halves, for the caller that
// is WRITING files into a reading it holds rather than holding a set and a
// delta somebody else produced (`@olai/ops`' batch fold). It builds both halves
// out of the one argument, so the whole-corpus disagreement check above has
// nothing to test here and is narrowed to the files that were actually written
// (roadmap `perf-reading-patched-check`).
//
// WHAT THE CASES BELOW ASSERT is the property that check exists to protect,
// stated directly rather than as the cost of stating it: the view a write
// leaves is a view of the SET that write leaves — the same records, filed under
// the same paths, in the same order. The oracle is spelled out here rather than
// imported, because a narrowed door asked to grade itself with its own check
// would be proving nothing.

/** `isSet`'s question, written out as the ORACLE: does this view file exactly
 *  the set's records, per file, in path order and in the set's own order? */
const isAbout = (read: Reading): boolean => {
  const outlines = outlinesIn(read.set).filter((outline) => outline.nodes.length > 0)
  if (read.derived.byFile.size !== outlines.length) return false
  let which = 0
  for (const [file, records] of read.derived.byFile) {
    const outline = outlines[which++]
    if (outline === undefined || outline.path !== file) return false
    if (outline.nodes.length !== records.length) return false
    for (let at = 0; at < records.length; at++) {
      if (records[at] !== outline.nodes[at]) return false
    }
  }
  return true
}

/**
 * Whether the view came the cheap way, asked of a file the write did NOT name.
 *
 * `derive` rebuilds every file's list out of the flat records, so an entry
 * carried across BY IDENTITY is a thing only the patcher produces. That is the
 * signal that holds however the key set moved — "the id table is a layer", one
 * section up, holds only while no file arrives and none goes away.
 */
const carriedAcross = (before: Reading, after: Reading, untouched: string): boolean =>
  before.derived.byFile.get(untouched) !== undefined &&
  after.derived.byFile.get(untouched) === before.derived.byFile.get(untouched)

const vault = (): Reading =>
  reading(
    setOf(
      {
        "a.org": `{"id":"x","ord":"a","title":"one"}`,
        "b.org": `{"id":"y","ord":"a","title":"two"}\n{"id":"z","ord":"b","title":"three"}`,
        "empty.org": ``,
      },
      ["notes/one.md"],
    ),
  )

test("a file rewritten leaves a view of the set it leaves, patched", () => {
  const before = vault()
  const after = following(before, [outlineOf(`{"id":"x","ord":"a","title":"edited"}`, "a.org")])

  // The files this write did not name are carried across by identity, which is
  // the whole of why the corpus does not have to be walked to know they agree.
  expect(carriedAcross(before, after, "b.org")).toBe(true)
  expect(isAbout(after)).toBe(true)
  expect(after.derived.byId.get("x")?.node).toMatchObject({ title: "edited" })
})

test("a file that ARRIVES mid-write reaches the view, and the view is about the set", () => {
  // The shape `@olai/ops`' batch has when an op archives a node: a file the set
  // has never held is minted, and the op after it must be able to name what
  // moved into it (`@olai/ops`' `batch.test.ts`). A delta that missed that file
  // is exactly what the check one section up defends against — and here there
  // is no delta to miss it with, because one list builds both halves.
  const before = vault()
  const after = following(before, [
    outlineOf(`{"id":"w","ord":"a","title":"minted"}`, "_olai/Trash.org"),
  ])

  expect(carriedAcross(before, after, "a.org")).toBe(true)
  expect(isAbout(after)).toBe(true)
  expect(after.derived.byId.get("w")?.file).toBe("_olai/Trash.org")
  // Path order on both sides, which is the other half of "about this set": the
  // minted file sorts first and both halves put it there.
  expect([...after.derived.byFile.keys()]).toEqual(["_olai/Trash.org", "a.org", "b.org"])
})

test("a file EMPTIED leaves no key, which is how a file with no records is spelt", () => {
  const before = vault()
  const after = following(before, [outlineOf(``, "b.org")])

  expect(carriedAcross(before, after, "a.org")).toBe(true)
  expect(isAbout(after)).toBe(true)
  expect(after.derived.byFile.has("b.org")).toBe(false)
  expect(after.derived.byId.has("y")).toBe(false)
})

test("a `.md` written beside an outline moves the set and not the view's records", () => {
  const before = vault()
  const after = following(before, [
    bodiedDocument("notes/one.md", "# rewritten\n\n[the node](#x)\n"),
    outlineOf(`{"id":"x","ord":"a","title":"edited"}`, "a.org"),
  ])

  expect(isAbout(after)).toBe(true)
  expect(documentAt(after.set, "notes/one.md")).toMatchObject({
    body: "# rewritten\n\n[the node](#x)\n",
  })
  // ...and the third member hears about it, which is why `following` hands
  // `repointed` the two SETS rather than the records it wrote: a document write
  // puts no upsert in the delta at all.
  expect(after.pointing.get("#x")?.map((face) => String(face.path))).toEqual(["notes/one.md"])
})

test("writing nothing leaves the reading that stood, identity and all", () => {
  const before = vault()
  const after = following(before, [])

  expect(after.set).toBe(before.set)
  expect(after.derived).toBe(before.derived)
  expect(after.pointing).toBe(before.pointing)
})

test("a written file the view would file differently is not patched onto", () => {
  // THE NARROWED CHECK'S TEETH. The patcher SORTS the records it is handed into
  // line order (`./patch.ts`'s `regrouped`) where the set holds them as the file
  // spells them, so a document whose records did not arrive in line order is a
  // document the two would file differently — and a view that disagrees with
  // the set it is paired with is what makes every record look like a duplicate
  // of itself. Nothing the parser produces is in that state, which is exactly
  // why it is asserted here rather than left to a call path to discover: the
  // narrowing has to decline the patch in the case the whole-corpus check
  // declined it, and it does — same decision, same rebuild, same answer.
  const before = vault()
  const written = outlineOf(
    `{"id":"y","ord":"a","title":"two"}\n{"id":"z","ord":"b","title":"three"}`,
    "b.org",
  )
  const backwards: Document = { ...written, nodes: [...written.nodes].reverse() }
  const after = following(before, [backwards])
  const alsoAfter = reading(withDocuments(before.set, [backwards]), {
    read: before,
    delta: { upserts: [["b.org", { nodes: backwards.nodes }]], removes: [] },
  })

  expect(carriedAcross(before, after, "a.org")).toBe(false)
  expect(carriedAcross(before, alsoAfter, "a.org")).toBe(false)
  expect([...after.derived.byFile.keys()]).toEqual([...alsoAfter.derived.byFile.keys()])
  expect(after.derived.nodes).toEqual(alsoAfter.derived.nodes)
})

test("one path written in two KINDS leaves a view of the set, not of the outline", () => {
  // pi's probe on PR 397, pinned. `withDocuments` decides a path by the LAST
  // document that names it, whatever kind it is; the narrowed check used to
  // build its delta from the last OUTLINE — so a list naming one path in two
  // kinds left the set holding the body and the view holding the outline's
  // records, and the identity check passed because it compared the view against
  // the upsert it had built rather than against the document that survived.
  // That is a view which is not about its set, reached THROUGH the guard rather
  // than caught by it, and an ordinary write after it carries the lie forward.
  //
  // No op the plan layer builds can produce such a list — the two document
  // verbs write no outline at all — but the door is exported, and the argument
  // for the narrowing is that one argument builds both halves. It has to be
  // read the ONE way for that to be true.
  const before = vault()
  const mixed: ReadonlyArray<Document> = [
    outlineOf(`{"id":"q","ord":"a","title":"an outline at this path"}`, "c.org"),
    bodiedDocument("c.org", "a body where the records would have been"),
  ]

  const after = following(before, mixed)
  // THE PROPERTY, and it is the whole of what this pins: the view is about the
  // set. A body holds no records, so the surviving document files nothing —
  // and the outline's id reached nothing, where it used to reach a phantom.
  expect(isAbout(after)).toBe(true)
  expect(after.derived.byFile.has("c.org")).toBe(false)
  expect(after.derived.byId.has("q")).toBe(false)
  // The set really did take the body, which is what makes the view above the
  // interesting answer rather than a write that did nothing.
  expect(documentAt(after.set, "c.org")?.kind).toBe("document")
  // ...and a plain write THROUGH the returned reading stays about its set, so
  // nothing was deferred: the old spelling stayed consistently wrong from here.
  const then = following(after, [outlineOf(`{"id":"x","ord":"a","title":"later"}`, "a.org")])
  expect(isAbout(then)).toBe(true)
  expect(then.derived.byId.has("q")).toBe(false)
})

test("...and where that path HELD records, it is a write the door declines", () => {
  // The other half of the same reading. A body landing where the view files
  // records is a change this delta cannot describe — `byFile` spells "no
  // records" as no key, and there is no upsert for a path whose surviving
  // document is not an outline — so it DECLINES and rebuilds, which is the
  // answer the whole-corpus walk gave on the same input.
  const before = vault()
  const asOutline = outlineOf(`{"id":"q","ord":"a","title":"an outline at this path"}`, "b.org")
  const mixed: ReadonlyArray<Document> = [
    asOutline,
    bodiedDocument("b.org", "a body where the records were"),
  ]

  const after = following(before, mixed)
  expect(isAbout(after)).toBe(true)
  // A rebuild, said the way this file says it: an untouched file's grouping is
  // a fresh array rather than the one the reading came in holding.
  expect(carriedAcross(before, after, "a.org")).toBe(false)
  expect(after.derived.byFile.has("b.org")).toBe(false)
  expect(after.derived.byId.has("y")).toBe(false)
  expect(after.derived.byId.has("q")).toBe(false)

  // And the door it replaced reaches the same answer on the same input, which
  // is the claim this change rests on, made at the input where the narrowing
  // could have parted from the walk.
  const alsoAfter = reading(withDocuments(before.set, mixed), {
    read: before,
    delta: { upserts: [["b.org", { nodes: asOutline.nodes }]], removes: [] },
  })
  expect(isAbout(alsoAfter)).toBe(true)
  expect(alsoAfter.derived.byFile.has("b.org")).toBe(false)
  expect(alsoAfter.derived.byId.has("q")).toBe(false)
})

// ── one broken file degrades alone ─────────────────────────────────────
//
// The human's ruling of 2026-08-29, at the door it is decided behind. A finding
// breaks the FILES IT IS ABOUT: those are published with their content
// withheld, and every other file of the directory is served exactly as it would
// be in a vault with nothing wrong with it. The cases below are the four shapes
// that has — one file, two files, a healthy neighbour pointing INTO a withheld
// one, and a vault where nothing is wrong at all.

test("a broken file is withheld and its neighbours are untouched", () => {
  const { set, dark } = degradedBy({
    "attic.org": `{"id":"attic","ord":"a","title":"the attic"}\n` +
      `{"id":"lamps","ord":"b","title":"the lamps","see":["nobody-declares-this"]}`,
    "cellar.org": `{"id":"cellar","ord":"a","title":"the cellar"}\n` +
      `{"id":"crates","parent":"cellar","ord":"b","title":"the crates"}`,
  })

  // ONE FILE DARK, and it is the one the finding is about.
  expect(dark).toEqual(["attic.org"])
  expect(brokenBy(set).get("attic.org")?.map((one) => one.code)).toEqual(["unknown-target"])
  // It KEEPS ITS PLACE, as an outline with nothing in it — which is what makes
  // the sidebar go on listing a file somebody is in the middle of fixing, and
  // what makes its own page draw rows where its tree was.
  expect(outlinePaths(set)).toEqual(["attic.org", "cellar.org"])
  expect(documentAt(set, "attic.org")).toEqual(outlineOf("", "attic.org"))

  // AND THE NEIGHBOUR IS WHOLE — its records are in the set and its tree draws.
  expect(brokenIn(set, "cellar.org")).toBeUndefined()
})

test("a finding that names two files takes both, and only both", () => {
  const { set, dark } = degradedBy({
    "attic.org": `{"id":"attic","ord":"a","title":"the attic"}\n` +
      `{"id":"boxes","parent":"attic","ord":"b","title":"the boxes"}`,
    "cellar.org": `{"id":"boxes","ord":"a","title":"the crates"}`,
    "shed.org": `{"id":"shed","ord":"a","title":"the shed"}`,
  })

  // `boxes` is claimed twice, in two files, and there is no answer to "which
  // one is broken" — the error view has said so since it was written. So both
  // ends go dark, both carry the same row, and the third file is untouched.
  expect(dark).toEqual(["attic.org", "cellar.org"])
  expect(brokenBy(set).get("attic.org")?.map((one) => one.code)).toEqual(["duplicate-id"])
  expect(brokenBy(set).get("cellar.org")?.map((one) => one.code)).toEqual(["duplicate-id"])
  expect(brokenIn(set, "shed.org")).toBeUndefined()
  // ONE finding, two entries — the very same row object, which is what makes
  // the whole report readable back off the set without a duplicate in it.
  expect(brokenBy(set).get("attic.org")?.[0]).toBe(
    brokenBy(set).get("cellar.org")?.[0] as OutlineError,
  )
  expect(findingsIn(set)).toHaveLength(1)
})

/**
 * A HEALTHY FILE POINTING INTO A BROKEN ONE — the design question the ruling
 * left open, answered by not inventing a finding.
 *
 * `plan.org` mirrors a node that lives in `attic.org`, and `attic.org` is
 * withheld for a duplicate id of its own. The rules ran over the WHOLE set, so
 * the mirror resolved when it was judged and `plan.org` is not implicated by
 * anything. What the reader gets is the dangling face the derivation already
 * draws — `a mirror of X, which no node declares` — in a page that is otherwise
 * completely live.
 *
 * The alternative was to re-run the rules over the degraded set, which would
 * have made one bad file eat its neighbours one revision at a time.
 */
test("a mirror into a withheld file dangles, and does not break the file holding it", () => {
  const { set, dark } = degradedBy({
    "attic.org": `{"id":"attic","ord":"a","title":"the attic"}\n` +
      `{"id":"lamps","parent":"attic","ord":"b","title":"the lamps"}\n` +
      `{"id":"attic","ord":"c","title":"claimed twice"}`,
    "plan.org": `{"id":"plan","ord":"a","title":"the plan"}\n` +
      `{"id":"m","parent":"plan","ord":"b","mirror":"lamps"}`,
  })

  expect(dark).toEqual(["attic.org"])
  expect(brokenIn(set, "plan.org")).toBeUndefined()

  const view = reading(set).derived
  // The target is NAMED and not DECLARED, which is exactly what a dangling
  // edge is — the derivation has had a word for it all along.
  expect(view.byId.has("lamps")).toBe(false)
  expect(view.namedBy.has("lamps")).toBe(true)
  const rows = rowsOf(view, "plan.org")
  const mirror = rows[0]?.children[0]
  expect(mirror?.kind).toBe("dangling")
  expect(mirror?.kind === "dangling" ? mirror.missing : "").toBe("lamps")
})

test("a directory with nothing wrong comes back as the very set it was handed", () => {
  const set = setOf({
    "attic.org": `{"id":"attic","ord":"a","title":"the attic"}`,
    "cellar.org": `{"id":"cellar","ord":"a","title":"the cellar"}`,
  })
  const answer = validate(set)
  if (Result.isFailure(answer)) throw new Error("expected a valid set")
  // IDENTITY, and it is the byte-compatibility claim: a healthy vault pays the
  // withholding nothing at all — not a rebuilt document list, not a second
  // derivation, not a new value for a surface that compares frames by identity.
  expect(answer.success.set).toBe(set)
  expect(answer.success.set.broken).toEqual([])
})

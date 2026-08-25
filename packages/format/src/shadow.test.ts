/**
 * THE ALARM ITSELF — that it can see a difference, and that it cannot take the
 * process down.
 *
 * `./incremental.test.ts` holds the two validators to one answer over corpora;
 * this file holds the thing that would have to NOTICE if they ever stopped
 * agreeing. A differential whose comparator is blind is a green suite that
 * means nothing, and the way to prove a comparator is not blind is to hand it
 * differences rather than to write a validator that is wrong in exactly one way
 * — which is why {@link differing} is a function of two lists and this file is
 * a table.
 *
 * THE OTHER HALF IS THE PROMISE THE HEADER MAKES: impossible to miss, and
 * impossible to crash on. Both are asserted here rather than left as prose — a
 * shadow that threw would be a strictly worse product than the one that shipped
 * without a shadow, and a shadow nobody hears is not one.
 */

import { expect, test } from "bun:test"

import { derive, type Derived } from "./derive.ts"
import { recordsOf, setOf } from "./fixtures.testlib.ts"
import { differing, ledgerOf, shadowed, witnessing } from "./shadow.ts"
import type { Seen } from "./shadow.ts"

const ACCEPTED = { full: true, incremental: true }
const REFUSED = { full: false, incremental: false }

test("the comparator says nothing about two reports that are the same report", () => {
  expect(differing([], [], ACCEPTED)).toBeNull()
  expect(differing(["a.olai:1 one", "b.olai:2 two"], ["a.olai:1 one", "b.olai:2 two"], REFUSED))
    .toBeNull()
})

test("one arm accepting the set and the other refusing it is the worst kind", () => {
  // The verdict, not the wording: after the flip this is a write landing or
  // being turned away differently, which is what a person would feel.
  expect(differing([], ["a.olai:1 one"], { full: true, incremental: false })).toEqual({
    why: "verdict",
    missing: [],
    invented: ["a.olai:1 one"],
  })
})

test("a finding one arm has and the other does not is named in the entry", () => {
  expect(differing(["a.olai:1 one", "b.olai:2 two"], ["a.olai:1 one"], REFUSED)).toEqual({
    why: "findings",
    missing: ["b.olai:2 two"],
    invented: [],
  })
  expect(differing(["a.olai:1 one"], ["a.olai:1 one", "b.olai:2 two"], REFUSED)).toEqual({
    why: "findings",
    missing: [],
    invented: ["b.olai:2 two"],
  })
})

test("a sentence said twice where the other arm said it once is a difference", () => {
  // A plain set difference would call these two lists equal, and the shape it
  // would hide is a rule asked about one record twice — which is exactly what a
  // narrowing that failed to dedupe its candidates would produce.
  expect(differing(["a.olai:1 one"], ["a.olai:1 one", "a.olai:1 one"], REFUSED)).toEqual({
    why: "findings",
    missing: [],
    invented: ["a.olai:1 one"],
  })
})

test("the same findings in a different order is a difference, and its own kind", () => {
  // Real, and quieter than the two above: the report is what a reader reads
  // down, and two loads of one directory promise each other the same order.
  expect(differing(["a.olai:1 one", "a.olai:1 two"], ["a.olai:1 two", "a.olai:1 one"], REFUSED))
    .toEqual({ why: "order", missing: [], invented: [] })
})

// ── the alarm ──────────────────────────────────────────────────────────

const viewOf = (files: Record<string, string>): Derived => derive(recordsOf(setOf(files)))

/** Run something with a witness installed, and hand back what it saw. The
 *  install is undone in a `finally` inside {@link watching} rather than by each
 *  case, so a failing assertion cannot leave the next file's divergences
 *  silenced. */
const watching = (run: () => void): ReadonlyArray<Seen> => {
  const seen: Array<Seen> = []
  witnessing((one) => {
    seen.push(one)
  })
  try {
    run()
  } finally {
    witnessing(null)
  }
  return seen
}

test("a shadow that throws is an entry in the log and nothing else", () => {
  const set = setOf({ "a.olai": `{"id":"one","ord":"a","title":"one"}` })
  const before = viewOf({ "a.olai": `{"id":"one","ord":"a","title":"one"}` })
  const after = viewOf({ "a.olai": `{"id":"one","ord":"a","title":"one edited"}` })
  // A view with no indexes at all — which is not a set anybody can produce, and
  // is the point: what is under test is that a bug in the narrowing costs a
  // write a log line rather than the write.
  const broken = { byFile: after.byFile } as unknown as Derived
  const seen = watching(() => {
    // The first call is what FILES a ledger for `before`, which is what the
    // second one narrows from — there is no other door into that table, and
    // that is deliberate (`./shadow.ts`'s header).
    shadowed(set, undefined, undefined, before, [], new Set())
    shadowed(
      set,
      before,
      { upserts: [["a.olai", { nodes: [] }]], removes: [] },
      broken,
      [],
      new Set(),
    )
  })
  expect(seen.map((one) => one.kind)).toEqual(["cold", "diverged"])
  expect(seen[1]?.divergence?.why).toEqual("threw")
  expect(seen[1]?.divergence?.threw).toBeString()
  // ...and the ledger was still filed, from the FULL arm, so the next
  // validation is not narrowing from a hole.
  expect(ledgerOf(broken)).toEqual({ errors: [], known: new Set() })
})

test("the entry names where to start looking", () => {
  const set = setOf({ "a.olai": `{"id":"one","ord":"a","title":"one"}` })
  const before = viewOf({ "a.olai": `{"id":"one","ord":"a","title":"one"}` })
  const broken = { byFile: before.byFile } as unknown as Derived
  const seen = watching(() => {
    shadowed(set, undefined, undefined, before, [], new Set())
    shadowed(
      set,
      before,
      { upserts: [["a.olai", { nodes: [] }]], removes: ["b.olai"] },
      broken,
      [],
      new Set(),
    )
  })
  expect(seen[1]?.divergence?.touched).toEqual(["a.olai", "b.olai"])
  expect(seen[1]?.divergence?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
})

test("with no witness installed a divergence still reaches stderr", () => {
  // The floor the header promises: a tree that wired nothing still shouts.
  // `console.error` and not a logger, because this package is the bottom of the
  // layering and has none to reach.
  const said: Array<string> = []
  const held = console.error
  console.error = (...args: ReadonlyArray<unknown>) => {
    said.push(args.map(String).join(" "))
  }
  try {
    const set = setOf({ "a.olai": `{"id":"one","ord":"a","title":"one"}` })
    const before = viewOf({ "a.olai": `{"id":"one","ord":"a","title":"one"}` })
    shadowed(set, undefined, undefined, before, [], new Set())
    shadowed(
      set,
      before,
      { upserts: [], removes: [] },
      { byFile: before.byFile } as unknown as Derived,
      [],
      new Set(),
    )
  } finally {
    console.error = held
  }
  expect(said.join("\n")).toContain("THE INCREMENTAL VALIDATOR DIVERGED")
})

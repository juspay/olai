/**
 * THE TAPE'S OWN RULES, asked directly rather than through the five readings
 * that spend them.
 *
 * `@olai/ops`' `standing.equivalence.test.ts` is where the mechanism is proved
 * over a corpus — every question at every revision, the tape asked and the
 * answer rebuilt anyway. What that cannot say is WHY it holds, and this can:
 * each of the tape's rules made against a pair of readings built to test
 * exactly it.
 *
 * The direction matters more than the count. A tape that is too WIDE costs a
 * rebuild that was not needed; a tape that is too NARROW is a wrong page. So
 * nearly every case here is written the narrow way round — move the reading at
 * the place the answer read, and assert the tape NOTICED.
 *
 * MOST OF THESE PAIRS ARE REBUILT rather than patched, which is deliberate and
 * is the harder half: a rebuilt derivation carries nothing forward, so the tape
 * is judged on its VALUE comparisons with the identity fast path taken away.
 * The last case is the other one — a genuinely patched view, where the carrying
 * the whole feature rests on is what answers.
 */

import { expect, test } from "bun:test"

import { Result } from "effect"

import { decodedOf, outlineOf, readingOf, setOf } from "./fixtures.testlib.ts"
import { assemble, nodesIn } from "./set.ts"
import { stillHolds, taping } from "./tape.ts"
import { reading, type Reading } from "./validate.ts"

const ONE = "a.org"
const OTHER = "b.org"

/** One file with a root and a record on it, and a second file beside it —
 *  enough for a keyed read, a walk, and a lookup that finds nothing. */
const files = (
  { title = "as written", day = null as string | null, extra = false } = {},
): Record<string, string> => ({
  [ONE]: [
    JSON.stringify({ id: "r", ord: "a0", title: "root" }),
    JSON.stringify({
      id: "one",
      parent: "r",
      ord: "a1",
      title,
      ...(day === null ? {} : { date: day }),
    }),
  ].join("\n"),
  [OTHER]: JSON.stringify({ id: "s", ord: "a0", title: "elsewhere" }),
  ...(extra ? { "c.org": JSON.stringify({ id: "nobody", ord: "a0", title: "arrived" }) } : {}),
})

const at = (options?: Parameters<typeof files>[0]): Reading => readingOf(setOf(files(options)))

test("a keyed read that found something is held against the value moving", () => {
  const was = at({ day: "2026-03-04" })
  const taped = taping(was)
  // The read a page makes per row it draws.
  expect(taped.reading.derived.byId.get("one")).toBe(was.derived.byId.get("one"))
  // A REBUILT derivation carries no record forward, so this is the value
  // comparison answering: two records equal in every field are two records.
  expect(stillHolds(taped.tape, was, at({ day: "2026-03-04" }))).toBe(false)
})

test("a read of a key nothing answered is held against a record arriving", () => {
  // THE ONE A NAIVE DEPENDENCY SET FORGETS. An answer that asked for an id and
  // was told nothing depends on that nothing: the revision where something
  // starts claiming the id changes what it draws.
  const was = at()
  const taped = taping(was)
  expect(taped.reading.derived.byId.get("nobody")).toBeUndefined()
  expect(stillHolds(taped.tape, was, at({ extra: true }))).toBe(false)
})

test("...and so is a `has`, which is taped like a `get`", () => {
  const was = at()
  const taped = taping(was)
  expect(taped.reading.derived.byId.has("nobody")).toBe(false)
  expect(stillHolds(taped.tape, was, at({ extra: true }))).toBe(false)
})

test("a WALK is held against the whole index", () => {
  const was = at({ day: "2026-03-04" })
  const taped = taping(was)
  // What the calendar's month and the agenda's two directions do.
  expect([...taped.reading.derived.byDay.keys()]).toEqual(["2026-03-04"])
  expect(stillHolds(taped.tape, was, at({ day: "2026-03-05" }))).toBe(false)
  // …and a key that went away entirely, which is the other way a walk moves.
  expect(stillHolds(taped.tape, was, at())).toBe(false)
})

test("a tape that read nothing at all always holds", () => {
  const was = at({ day: "2026-03-04" })
  const taped = taping(was)
  // An answer that is a function of its request alone cannot be moved by any
  // revision, and the tape says so without a special case for it.
  expect(stillHolds(taped.tape, was, at({ title: "something else" }))).toBe(true)
})

test("the same reading holds whatever was read of it", () => {
  const was = at({ day: "2026-03-04" })
  const taped = taping(was)
  taped.reading.derived.byId.get("one")
  void [...taped.reading.derived.byDay]
  void taped.reading.derived.nodes
  void taped.reading.set.documents
  void taped.reading.set.broken
  expect(stillHolds(taped.tape, was, was)).toBe(true)
})

test("the taping view answers exactly what the reading answers", () => {
  // The contract that lets it be handed to the format at all: same answers,
  // same size, same order, same iteration — a `ReadonlyMap` a reader cannot
  // tell from the one it stands for.
  const was = at({ day: "2026-03-04" })
  const view = taping(was).reading
  expect(view.derived.byId.get("one")).toBe(was.derived.byId.get("one"))
  expect(view.derived.byId.has("one")).toBe(true)
  expect(view.derived.byId.size).toBe(was.derived.byId.size)
  expect([...view.derived.byDay]).toEqual([...was.derived.byDay])
  expect([...view.derived.byFile.keys()]).toEqual([...was.derived.byFile.keys()])
  expect([...view.derived.children.values()]).toEqual([...was.derived.children.values()])
  expect([...view.derived.byId.entries()]).toEqual([...was.derived.byId.entries()])
  expect(view.derived.nodes).toBe(was.derived.nodes)
  expect(view.set.documents).toBe(was.set.documents)
  expect(view.set.broken).toBe(was.set.broken)
  const seen: Array<string> = []
  view.derived.byId.forEach((_value, key) => seen.push(key))
  expect(seen).toEqual([...was.derived.byId.keys()])
})

test("the taping view stands in for EVERY field of the derivation", () => {
  // THE FENCE THIS FILE OWES ITS EXISTENCE TO. A view built from the index
  // table alone covers the maps and silently drops everything else, so a field
  // added to `Derived` reads as `undefined` through it — a missing table
  // dressed as an empty one, which is how `perf-agenda-history-walk`'s `days`
  // met the calendar's binary search. The type is what stops the next one
  // (`./tape.ts`'s `LISTS` is exhaustive by `Exclude<keyof Derived, Index>`);
  // this says the wiring agrees with the type.
  const was = at({ day: "2026-03-04" })
  const view = taping(was).reading.derived
  const named = Object.keys(was.derived)
  expect(named.length).toBeGreaterThan(10)
  for (const field of named) {
    const stood = (view as unknown as Record<string, unknown>)[field]
    const real = (was.derived as unknown as Record<string, unknown>)[field]
    expect([field, stood === undefined]).toEqual([field, false])
    // A map is stood in for by a wrapper answering the same entries; anything
    // else is handed over as it is.
    if (real instanceof Map) {
      expect([field, [...(stood as ReadonlyMap<string, unknown>)]])
        .toEqual([field, [...real]])
    } else expect([field, stood]).toEqual([field, real])
  }
})

test("the served files are compared by the FACE, not by the object", () => {
  // `assemble` builds a fresh array per revision, so identity alone would
  // answer `false` every time and the check would be the feature turned off.
  // What is compared is what a reader of the array can possibly have read: it
  // takes a `ReadonlyArray<Face>`, so the face's own equivalence is the
  // question asked in full.
  const was = at()
  const taped = taping(was)
  void taped.reading.set.documents
  expect(stillHolds(taped.tape, was, at())).toBe(true)
  // A file arriving is a served file that moved.
  expect(stillHolds(taped.tape, was, at({ extra: true }))).toBe(false)
})

test("a PATCHED revision carries what it did not touch, and the tape spends it", () => {
  // The case the whole feature rests on and the one the rebuilt pairs above
  // cannot show: a revision that re-files one file leaves every other file's
  // records — and every index it wrote no key into — exactly as they were
  // (`./patch.ts`), so the tape's identity comparison answers without walking
  // anything.
  //
  // ONLY THE FILE THAT MOVED IS DECODED AGAIN, which is what the store does and
  // what makes the patch take at all: `./validate.ts`'s `isSet` compares the
  // patched view against the set BY IDENTITY, so a set re-decoded whole has no
  // relation to the view being patched and the validator rebuilds instead.
  //
  // THE DAY IS IN THE FILE THAT DOES NOT MOVE, which is the whole shape a
  // keystroke has in a real vault: most files hold no date at all, so most
  // edits write no key into the day index and the calendar goes on standing.
  const dated = {
    [ONE]: files()[ONE] as string,
    [OTHER]: JSON.stringify({ id: "s", ord: "a0", title: "elsewhere", date: "2026-03-04" }),
  }
  const decoded = decodedOf(dated)
  const was = readingOf(assemble(decoded))
  decoded.set(
    ONE,
    Result.succeed(outlineOf(files({ title: "typed into" })[ONE] as string, ONE)),
  )
  const set = assemble(decoded)
  // The delta the store's codec builds, one path at a time, out of the files a
  // probe re-decoded (`@olai/ops`' `codec.ts`).
  const now = reading(set, {
    read: was,
    delta: { upserts: [[ONE, { nodes: nodesIn(decoded.get(ONE)) }]], removes: [] },
  })
  // The other file's record is the object it already was — the patch took.
  expect(now.derived.byId.get("s")).toBe(was.derived.byId.get("s"))

  // An answer that read only the OTHER file holds…
  const untouched = taping(was)
  untouched.reading.derived.byId.get("s")
  untouched.reading.derived.children.get("s")
  expect(stillHolds(untouched.tape, was, now)).toBe(true)

  // …and one that read the record that moved does not.
  const touched = taping(was)
  touched.reading.derived.byId.get("one")
  expect(stillHolds(touched.tape, was, now)).toBe(false)

  // The day index was written no key by this edit, so a walk of it carries
  // too — which is what lets a keystroke leave the calendar alone.
  const calendar = taping(was)
  void [...calendar.reading.derived.byDay.keys()]
  expect(now.derived.byDay).toBe(was.derived.byDay)
  expect(stillHolds(calendar.tape, was, now)).toBe(true)
})

/**
 * WHAT ONE FILE WRITTEN INTO A SET COSTS — and that it costs the same ANSWER.
 *
 * {@link withDocuments} is what the batch fold does between two ops
 * (`@olai/ops`' `following.ts`, roadmap `perf-batch-assemble`), and it replaced
 * `assemble(apart(set) + the written files)`: a fresh map of every served path
 * and a full path SORT of it, per op. Two claims come out of that, and this file
 * is both of them:
 *
 *   - THE ANSWER IS THE SAME ANSWER. The documents in path order, the `broken`
 *     list, a file that arrives, a file that was broken and is written — all of
 *     it identical to re-assembling, which is what makes the fold's
 *     intermediates the sets they always were. Held over a generated directory
 *     rather than over a fixture, because the interesting cases are ORDER cases:
 *     a path that sorts first, one that sorts last, one that lands between two
 *     others, and the pair `./paths.ts` exists for — a file and a directory
 *     sharing a name.
 *   - THE SORT IS GONE. Counted by wrapping the COMPARATOR the order is made
 *     with, which is the only honest instrument here: everything else about the
 *     two arms is the same O(files) pass over an array of references, and the
 *     comparisons are what sits on top of it. So the count is `byPath` calls per
 *     write, and the claim is that it stops GROWING with the directory — a
 *     binary search where it was a pass over every served path. The measured
 *     before-figure is linear rather than `n log n`, for a reason the case
 *     itself writes down; it is still the whole directory, per op, for a write
 *     that touched one file.
 */

import { expect, mock, test } from "bun:test"
import { Result } from "effect"

import { byPath } from "./paths.ts"

/** The comparator, COPIED OUT before the mock below is installed — an ESM
 *  import is a live binding and `mock.module` rewrites it in place, so a wrapper
 *  that called the imported name would call itself (`./suggest.walks.test.ts`
 *  spells out the same dance). */
const real = byPath

let compares = 0
mock.module("./paths.ts", () => ({
  byPath: (one: string, other: string): number => {
    compares++
    return real(one, other)
  },
}))

const { apart, assemble, outlinePaths, withDocuments } = await import("./set.ts")
const { bodiedDocument, outlineDocument } = await import("./document.ts")
const { orgFixture } = await import("./fixtures.testlib.ts")
const { parseOutline } = await import("./parse.ts")
const { verdictOf } = await import("./verdict.ts")

/** A directory with the shapes an ORDER can go wrong at: nested paths, a file
 *  and a directory sharing a name (`wing.org` beside `wing/…`), a dotted
 *  `_olai/`, documents beside the outlines, and one file nobody could parse. */
const vault = (files: number) => {
  const decoded = new Map<string, Result.Result<never, never>>()
  const put = (path: string, document: unknown) =>
    decoded.set(path, Result.succeed(document as never))
  put("_olai/Trash.org", outlineDocument("_olai/Trash.org", []))
  put("wing.org", outlineDocument("wing.org", []))
  for (let which = 0; which < files; which++) {
    const name = `wing/room-${String(which).padStart(4, "0")}.org`
    const text = `{"id":"n${which}","ord":"a0","title":"room ${which}"}`
    const read = parseOutline(name, orgFixture(text))
    if (Result.isFailure(read)) throw new Error(`fixture ${name} does not parse`)
    put(name, read.success)
    if (which % 5 === 0) put(`notes/${which}.md`, bodiedDocument(`notes/${which}.md`, "# note\n"))
  }
  decoded.set(
    "torn.org",
    Result.fail(
      verdictOf([{ code: "bad-json", file: "torn.org", line: 1, message: "no" }] as never),
    ) as never,
  )
  return assemble(decoded as never)
}

/** One file's worth of records, decoded — what a plan becomes on its way into
 *  the set. */
const written = (path: string, title: string) => {
  // The id is the path with the characters an id may not hold taken out
  // ({@link ./node.ts}'s `ID_SHAPE`) — this fixture is about paths, and every
  // record still needs an id nothing else claims.
  const id = path.replace(/[^A-Za-z0-9_-]/g, "-")
  const read = parseOutline(
    path,
    orgFixture(`{"id":"${id}","ord":"a0","title":"${title}"}`),
  )
  if (Result.isFailure(read)) throw new Error(`${path} does not parse`)
  return read.success
}

/** The arm this replaced: the set taken apart, the files swapped into the map,
 *  and the whole directory assembled again. */
const assembled = (set: ReturnType<typeof vault>, files: ReadonlyArray<ReturnType<typeof written>>) => {
  const decoded = apart(set)
  for (const document of files) decoded.set(document.path, Result.succeed(document))
  return assemble(decoded)
}

const same = (
  set: ReturnType<typeof vault>,
  files: ReadonlyArray<ReturnType<typeof written>>,
  what: string,
): void => {
  expect([what, withDocuments(set, files)]).toEqual([what, assembled(set, files)])
}

test("the splice answers what re-assembling answered", () => {
  const set = vault(40)
  // A file the set already serves, rewritten — the common case, and the one an
  // ordinary batch is made of.
  same(set, [written("wing/room-0007.org", "seven again")], "a file rewritten")
  // A file that ARRIVES, at each end of the order and in the middle of it.
  same(set, [written("aaa.org", "first")], "a file sorting first")
  same(set, [written("zzz.org", "last")], "a file sorting last")
  same(set, [written("wing/room-0007a.org", "between")], "a file sorting between two")
  // The pair `./paths.ts` exists for: a file and a directory sharing a name.
  same(set, [written("wing/room-0007.org/inner.org", "under a name")], "under a shared name")
  // A file the set could not READ, written — it leaves `broken`, exactly as
  // re-assembling from a map that now holds a successful decode leaves it.
  same(set, [written("torn.org", "mended")], "a broken file mended")
  // SEVERAL at once, which is what one op does when it writes a node into one
  // file and a signpost into another.
  same(
    set,
    [
      written("wing/room-0003.org", "three"),
      written("mmm.org", "arriving"),
      written("torn.org", "mended"),
    ],
    "three at once",
  )
  // Nothing at all — the identity a plan with no files would ask for.
  expect(withDocuments(set, [])).toBe(set)
})

test("the order is the set's own, whichever way the set was built", () => {
  const set = vault(12)
  const grown = withDocuments(set, [written("wing.org/inner.org", "under the file")])
  expect(outlinePaths(grown)).toEqual(outlinePaths(assembled(set, [
    written("wing.org/inner.org", "under the file"),
  ])))
  // The promise `assemble` makes, kept by a splice: path order, and the same
  // path order a client sorting for itself would produce.
  expect([...outlinePaths(grown)]).toEqual([...outlinePaths(grown)].sort(real))
})

test("the comparisons per write stop growing with the directory", () => {
  const small = vault(50)
  const large = vault(500)
  const one = written("wing/room-0007.org", "seven again")

  const counted = (run: () => void): number => {
    compares = 0
    run()
    return compares
  }

  const smallSpliced = counted(() => void withDocuments(small, [one]))
  const largeSpliced = counted(() => void withDocuments(large, [one]))
  const smallAssembled = counted(() => void assembled(small, [one]))
  const largeAssembled = counted(() => void assembled(large, [one]))

  // THE SHAPE OF THE BEFORE COLUMN IS THE BUG: the comparisons grow with the
  // DIRECTORY, per op. They grow LINEARLY rather than by `n log n`, and that is
  // worth writing down rather than rounding up — the array `apart` hands the
  // sort is already in path order (it comes off a set that is), and a merge sort
  // over an ordered run spends one comparison per element. So the honest figure
  // for the arm this replaced is about one comparison per served file per op,
  // which is still the whole directory for a write that touched one file.
  expect(largeAssembled).toBeGreaterThan(smallAssembled * 2)
  expect(largeAssembled).toBeGreaterThan(large.documents.length)
  // The splice is a binary search. Twice the log is a ceiling with room in it,
  // not the number this happens to produce — what must not be true is that it
  // scales with the directory.
  expect(largeSpliced).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(large.documents.length)) + 4)
  expect(largeSpliced).toBeLessThan(smallAssembled)
  // ...and it really did the work: a splice that compared nothing would be a
  // splice that looked nothing up.
  expect(smallSpliced).toBeGreaterThan(0)
})

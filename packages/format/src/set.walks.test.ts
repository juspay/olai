import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, mock, test } from "bun:test"
import { Result } from "effect"

import { byPath } from "./paths.ts"

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
const { parseOutline } = await import("./fixtures.testlib.ts")
const { verdictOf } = await import("./verdict.ts")

const vault = (files: number) => {
  const decoded = new Map<string, Result.Result<never, never>>()
  const put = (path: string, document: unknown) =>
    decoded.set(path, Result.succeed(document as never))
  put("_olai/Trash.olai", outlineDocument(TEST_CLAIMS, "_olai/Trash.olai", []))
  put("wing.olai", outlineDocument(TEST_CLAIMS, "wing.olai", []))
  for (let which = 0; which < files; which++) {
    const name = `wing/room-${String(which).padStart(4, "0")}.olai`
    const text = `{"id":"n${which}","ord":"a0","title":"room ${which}"}`
    const read = parseOutline(name, text, TEST_CLAIMS)
    if (Result.isFailure(read)) throw new Error(`fixture ${name} does not parse`)
    put(name, read.success)
    if (which % 5 === 0) put(`notes/${which}.md`, bodiedDocument(TEST_CLAIMS, `notes/${which}.md`, "# note\n"))
  }
  decoded.set(
    "torn.olai",
    Result.fail(
      verdictOf([{ code: "bad-json", file: "torn.olai", line: 1, message: "no" }] as never),
    ) as never,
  )
  return assemble(TEST_CLAIMS, decoded as never)
}

const written = (path: string, title: string) => {
  const id = path.replace(/[^A-Za-z0-9_/-]/g, "-")
  const read = parseOutline(path, `{"id":"${id}","ord":"a0","title":"${title}"}`, TEST_CLAIMS)
  if (Result.isFailure(read)) throw new Error(`${path} does not parse`)
  return read.success
}

const assembled = (set: ReturnType<typeof vault>, files: ReadonlyArray<ReturnType<typeof written>>) => {
  const decoded = apart(set)
  for (const document of files) decoded.set(document.path, Result.succeed(document))
  return assemble(TEST_CLAIMS, decoded)
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
  same(set, [written("wing/room-0007.olai", "seven again")], "a file rewritten")
  same(set, [written("aaa.olai", "first")], "a file sorting first")
  same(set, [written("zzz.olai", "last")], "a file sorting last")
  same(set, [written("wing/room-0007a.olai", "between")], "a file sorting between two")
  same(set, [written("wing/room-0007.olai/inner.olai", "under a name")], "under a shared name")
  same(set, [written("torn.olai", "mended")], "a broken file mended")
  same(
    set,
    [
      written("wing/room-0003.olai", "three"),
      written("mmm.olai", "arriving"),
      written("torn.olai", "mended"),
    ],
    "three at once",
  )
  expect(withDocuments(set, [])).toBe(set)
})

test("the order is the set's own, whichever way the set was built", () => {
  const set = vault(12)
  const grown = withDocuments(set, [written("wing.olai/inner.olai", "under the file")])
  expect(outlinePaths(grown)).toEqual(outlinePaths(assembled(set, [
    written("wing.olai/inner.olai", "under the file"),
  ])))
  expect([...outlinePaths(grown)]).toEqual([...outlinePaths(grown)].sort(real))
})

test("the comparisons per write stop growing with the directory", () => {
  const small = vault(50)
  const large = vault(500)
  const one = written("wing/room-0007.olai", "seven again")

  const counted = (run: () => void): number => {
    compares = 0
    run()
    return compares
  }

  const smallSpliced = counted(() => void withDocuments(small, [one]))
  const largeSpliced = counted(() => void withDocuments(large, [one]))
  const smallAssembled = counted(() => void assembled(small, [one]))
  const largeAssembled = counted(() => void assembled(large, [one]))

  expect(largeAssembled).toBeGreaterThan(smallAssembled * 2)
  expect(largeAssembled).toBeGreaterThan(large.documents.length)
  expect(largeSpliced).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(large.documents.length)) + 4)
  expect(largeSpliced).toBeLessThan(smallAssembled)
  expect(smallSpliced).toBeGreaterThan(0)
})

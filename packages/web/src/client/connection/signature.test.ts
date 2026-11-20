import { expect, test } from "bun:test"

import { restartRows, signatureOf, type Named } from "./signature.ts"

const git = (generation?: number): Named => ({ id: "git", chunk: null, generation })

const kolu = (commit: string): Named & { readonly config: { readonly commit: string } } =>
  ({ id: "kolu", chunk: null, generation: 1, config: { commit } })

test("a config-only frame with the same mount generation does not redial", () => {
  const first = kolu("manual")
  const second = kolu("auto")
  expect(signatureOf([git(3), first])).toBe(signatureOf([git(3), second]))
  expect(restartRows([git(3), first], [git(3), second])).toEqual([])
})

test("a new mount generation redials that row", () => {
  expect(signatureOf([git(4)])).not.toBe(signatureOf([git(3)]))
})

test("a browser-half URL and a reordered roster are both in the signature", () => {
  expect(signatureOf([{ id: "defined", chunk: "/_olai/plugins/defined-1.js", generation: 1 }]))
    .not.toBe(signatureOf([{ id: "defined", chunk: "/_olai/plugins/defined-2.js", generation: 1 }]))
  const one: Named = { id: "one", chunk: null, generation: 2 }
  const two: Named = { id: "two", chunk: null, generation: 1 }
  expect(signatureOf([one, two])).not.toBe(signatureOf([two, one]))
})

test("an older serve's absent generation reads as the first mount", () => {
  expect(signatureOf([{ id: "git", chunk: null }])).toBe(signatureOf([git(0)]))
})

test("a row the tab has not heard a generation for is not restarted on the first roster", () => {
  expect(restartRows([{ id: "git", chunk: null }], [git(1)])).toEqual([])
  expect(restartRows([git(1)], [git(2)])).toEqual(["git"])
  expect(restartRows(
    [{ id: "defined", chunk: "/_olai/plugins/defined-1.js" }],
    [{ id: "defined", chunk: "/_olai/plugins/defined-2.js" }],
  )).toEqual(["defined"])
})

test("no plugins is the empty signature", () => {
  expect(signatureOf([])).toBe("")
})

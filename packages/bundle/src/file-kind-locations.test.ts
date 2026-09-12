import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { locations, location } from "@olai/plugin-api"
import { fileKindKey, forFileClaim } from "@olai/plugin-api/file-kinds"
import { fileKinds, type FileKindDrawing } from "olai-plugin-files/contract"
import { pages, type FilePage } from "olai-plugin-navigation/contract"
import { TESTID } from "olai-plugin-pdf/testids"

// The actual contracts, on the same scoped location registry the renderer
// provides. A container leaving withdraws its readers before their owner dies.
test("glyph and page locations withdraw independently and reattach without a second contribution", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const slots = yield* locations()
  const containers = location<null>("test.containers")
  yield* slots.forOwner("layout").contribute(location("root", "one"), null, { children: [containers] })
  const files = yield* Scope.make(), navigation = yield* Scope.make(), row = yield* Scope.make()
  yield* Scope.provide(slots.forOwner("files").contribute(containers, null, { children: [fileKinds] }), files)
  yield* Scope.provide(slots.forOwner("navigation").contribute(containers, null, { children: [pages] }), navigation)
  const by = { kind: "pdf" }
  const drawing: FileKindDrawing = { by, glyph: () => null, noun: "pdf", article: "a", testid: TESTID.pdfLink }
  const page: FilePage = { by, page: () => null, edits: false }
  let acquired = 0, released = 0
  yield* Scope.provide(slots.forOwner("pdf.glyph").contribute(fileKinds, drawing, {
    key: fileKindKey(by),
    activate: Effect.acquireRelease(Effect.sync(() => { acquired++ }), () => Effect.sync(() => { released++ })),
  }), row)
  yield* Scope.provide(slots.forOwner("pdf.page").contribute(pages, page, { key: fileKindKey(by) }), row)
  yield* slots.settled
  expect(slots.read(fileKinds)[0]?.value).toBe(drawing)
  expect(slots.read(pages)[0]?.value).toBe(page)
  const duplicate = yield* Effect.exit(Effect.scoped(slots.forOwner("other").contribute(fileKinds, drawing, { key: fileKindKey(by) })))
  expect(Exit.isFailure(duplicate)).toBe(true)
  expect(slots.read(fileKinds)[0]?.value).toBe(drawing)
  yield* Scope.close(files, Exit.void)
  yield* slots.settled
  expect(slots.read(fileKinds)).toEqual([])
  expect(slots.read(pages)[0]?.value).toBe(page)
  expect(released).toBe(1)
  const returned = yield* Scope.make()
  yield* Scope.provide(slots.forOwner("files").contribute(containers, null, { children: [fileKinds] }), returned)
  yield* slots.settled
  expect(acquired).toBe(2)
  expect(slots.read(fileKinds)[0]?.value).toBe(drawing)
  yield* Scope.close(navigation, Exit.void)
  yield* slots.settled
  expect(slots.read(pages)).toEqual([])
  expect(slots.read(fileKinds)[0]?.value).toBe(drawing)
  yield* Scope.close(row, Exit.void)
  yield* slots.settled
  expect(slots.read(fileKinds)).toEqual([])
  expect(released).toBe(2)
  yield* Scope.close(returned, Exit.void)
}))))

test("the same node renderer covers a new format on both locations", () => {
  const by = { holds: "nodes" } as const
  const glyph = { by, glyph: () => null }
  const page = { by, page: () => null, edits: true }
  const claim = { kind: "another-format", holds: "nodes" } as const
  expect(forFileClaim(claim, [glyph])).toBe(glyph)
  expect(forFileClaim(claim, [page])).toBe(page)
})

import { expect, test } from "bun:test"
import { fileKindKey, forFileClaim, type FileKindKey } from "./file-kinds.ts"

test("a kind contribution wins over a holds contribution regardless of arrival order", () => {
  const held = { by: { holds: "nodes" } as const, face: "records" }
  const exact = { by: { kind: "second-format" }, face: "special" }
  const claim = { kind: "second-format", holds: "nodes" } as const
  expect(forFileClaim(claim, [held, exact])).toBe(exact)
  expect(forFileClaim(claim, [exact, held])).toBe(exact)
  expect(forFileClaim({ ...claim, kind: "third-format" }, [exact, held])).toBe(held)
  expect(forFileClaim(claim, [held])).toBe(held)
  expect(forFileClaim(claim, [])).toBeUndefined()
  expect(forFileClaim(undefined, [held, exact])).toBeUndefined()
})

test("row names and holds names cannot collide in a location's key namespace", () => {
  const keys: FileKindKey[] = [{ kind: "nodes" }, { holds: "nodes" }, { kind: "holds:nodes" }]
  expect(new Set(keys.map(fileKindKey)).size).toBe(keys.length)
})

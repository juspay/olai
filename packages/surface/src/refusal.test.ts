import { expect, test } from "bun:test"
import { refusalIn } from "./refusal.ts"

test("unbranded, incomplete and unrelated tool text is not a refusal", () => {
  for (const text of ["permission denied", "{}", "surface-mcp: unavailable", "surface-mcp: `x` was refused (usage): "]) expect(refusalIn(text)).toBeUndefined()
})

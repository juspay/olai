/** The node walker must never widen into a prose reader (2026-09-01 picker defect). */
import { expect, test } from "bun:test"
import { wake } from "./wake.ts"

test("the doorbell walks nodes", () => {
  const walks: "nodes" = wake.walks
  expect(walks).toBe("nodes")
})

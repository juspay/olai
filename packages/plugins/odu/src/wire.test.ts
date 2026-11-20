import { expect, test } from "bun:test"

import { keyings } from "@olai/surface/testlib"

import { surface } from "./wire.ts"

test("the ci cell's key reaches BOTH its arrays — the runs, and the nodes inside each", () => {
  expect(surface.spec.cells.ci.arrayKey).toBe("id")
  const declared = surface.spec.cells.ci.arrayKey
  const found = keyings(
    surface.spec.cells.ci.schema as unknown as { readonly ast: Parameters<typeof keyings>[0]["ast"] },
    declared,
  )
  expect(found.get("runs")).toBe("keyed")
  expect(found.get("runs[].cells")).toBe("keyed")
  expect([...found.keys()].sort()).toEqual(["runs", "runs[].cells"])
})

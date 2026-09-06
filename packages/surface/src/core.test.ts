import { expect, test } from "bun:test"
import { surface } from "./core.ts"
import { hostSurface } from "./host.ts"
test("the permanent wire is process management without notebook capabilities", () => {
  expect([...surface.group.requests.keys()].sort()).toEqual([
    "surface/app/get", "surface/plugins/get", "surface/plugins/set",
    "surface/system/clockNow", "surface/system/identity", "surface/system/live", "surface/who/get",
  ])
  expect(hostSurface).toBe(surface)
})

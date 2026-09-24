import { expect, test } from "bun:test"
import { surface } from "./core.ts"
// `hostSurface` is `export { surface as hostSurface } from "./core.ts"`, so
// asserting the two are the same value asked nothing a rename would not
// already break the build over.
test("the permanent wire is process management without notebook capabilities", () => {
  expect([...surface.group.requests.keys()].sort()).toEqual([
    "surface/app/get", "surface/plugins/configure", "surface/plugins/get", "surface/plugins/set",
    "surface/system/clockNow", "surface/system/identity", "surface/system/live", "surface/who/get",
  ])
})

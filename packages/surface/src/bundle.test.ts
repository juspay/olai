import { describe, expect, test } from "bun:test"

import { ASSET_PREFIX, chunkFile, chunkUrl } from "./bundle.ts"

describe("what a split chunk is called", () => {
  test("the module's own name, a hash, and `.js`", () => {
    expect(chunkFile("pipeline").test("pipeline-ansc95q0.js")).toBe(true)
    expect(chunkUrl("pipeline").test(`${ASSET_PREFIX}pipeline-ansc95q0.js`)).toBe(true)
  })

  test("a file name matches only as a WHOLE name", () => {
    expect(chunkFile("pipeline").test("md-pipeline-ansc95q0.js")).toBe(false)
    expect(chunkFile("pipeline").test("pipeline-ansc95q0.js.map")).toBe(false)
    expect(chunkFile("pipeline").test("pipeline.js")).toBe(false)
  })

  test("a URL matches only under the hashed dir", () => {
    expect(chunkUrl("pipeline").test("/pipeline-ansc95q0.js")).toBe(false)
    expect(chunkUrl("pipeline").test(`${ASSET_PREFIX}Dropdown-b7b7k8tm.js`)).toBe(false)
  })

  test("the two agree about the same chunk", () => {
    const file = "Dropdown-b7b7k8tm.js"
    expect(chunkFile("Dropdown").test(file)).toBe(
      chunkUrl("Dropdown").test(`${ASSET_PREFIX}${file}`),
    )
  })
})

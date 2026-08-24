/**
 * The bundler's chunk-naming rule, held to what it claims.
 *
 * Cheap, and worth having for one reason: everything built on this rule fails
 * QUIETLY when it drifts. A build whose pattern stopped matching would ship a
 * shell preloading nothing; a scenario whose pattern stopped matching reports
 * "the page never asked". These cases are what a reader can check the rule
 * against without running a build.
 */

import { describe, expect, test } from "bun:test"

import { ASSET_PREFIX, chunkFile, chunkUrl } from "./bundle.ts"

describe("what a split chunk is called", () => {
  test("the module's own name, a hash, and `.js`", () => {
    expect(chunkFile("pipeline").test("pipeline-ansc95q0.js")).toBe(true)
    expect(chunkUrl("pipeline").test(`${ASSET_PREFIX}pipeline-ansc95q0.js`)).toBe(true)
  })

  test("a file name matches only as a WHOLE name", () => {
    // The build reads names out of its own asset report, so a chunk whose name
    // merely ends in this module's would be the wrong file to preload.
    expect(chunkFile("pipeline").test("md-pipeline-ansc95q0.js")).toBe(false)
    expect(chunkFile("pipeline").test("pipeline-ansc95q0.js.map")).toBe(false)
    expect(chunkFile("pipeline").test("pipeline.js")).toBe(false)
  })

  test("a URL matches only under the hashed dir", () => {
    // A scenario holds a chunk up by routing this, and a vault file called
    // `pipeline-x.js` is a page this app serves at `/` — routing that would be
    // holding up somebody's own file.
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

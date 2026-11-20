import { readFileSync } from "node:fs"
import * as path from "node:path"

import { expect, test } from "bun:test"

import { MEMBERS, PACKAGES, sourcesUnder } from "./tree.testlib.ts"


const SELF = path.relative(PACKAGES, import.meta.filename)

const MECHANICS: ReadonlyArray<string> = [
  "createSurfaceSocket",
  "createLiveSignal",
  "surfaceClientsHealth",
  "createSurfaceReadout",
  "fuseGroups",
  "fuseFaces",
  "mergeDisjointGroups",
  "assertHandlersMatchGroup",
  "superviseTerminalSource",
]

const SOURCES: ReadonlyArray<{ file: string; code: string }> = MEMBERS
  .flatMap((member) => sourcesUnder(path.join(PACKAGES, member)))
  .filter((full) => /\.tsx?$/.test(full))
  .map((full) => ({ file: path.relative(PACKAGES, full), code: readFileSync(full, "utf8") }))
  .filter((one) => one.file !== SELF)

const HARNESSES: ReadonlyArray<string> = [
  "createSurfaceSocket @ server/src/faces.test.ts",
  "createSurfaceSocket @ server/src/who.test.ts",
  "createSurfaceSocket @ server/src/profiles.test.ts",
  "createSurfaceSocket @ server/src/serve.test.ts",
]

test("no olai source calls a wire mechanic the framework performs", () => {
  const found = MECHANICS.flatMap((name) => {
    const call = new RegExp(`\\b${name}\\s*\\(`)
    return SOURCES.filter((one) => call.test(one.code)).map((one) => `${name} @ ${one.file}`)
  })
  expect(found.sort()).toEqual([...HARNESSES].sort())
})

test("...because the seam that performs them is called, exactly once", () => {
  const seam = SOURCES.filter((one) => /\bconnectSurfaces\s*\(/.test(one.code))
  expect(seam.map((one) => one.file)).toHaveLength(1)
})

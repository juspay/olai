import { readFileSync } from "node:fs"
import * as path from "node:path"

import { describe, expect, test } from "bun:test"

const SRC = import.meta.dirname

const sourcesIn = (dir: string): ReadonlyArray<string> =>
  [...new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: path.join(SRC, dir) })]
    .map((one) => path.join(dir, one))
    .sort()

const specifiersOf = (file: string): ReadonlyArray<string> =>
  [
    ...readFileSync(path.join(SRC, file), "utf8")
      .matchAll(/(?:\bfrom\s*|^\s*import\s*|\bimport\(\s*)["']([^"'\n]+)["']/gm),
  ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

const APPLIANCE_TIER = [
  /^@kolu\/(?!surface)/,
  /^@xterm\//,
  /^terminal-themes(\/|$)/,
  /^olai-plugin-kolu\/appliance(\/|$)/,
] as const

const THE_VAULT = /^@olai\/format(\/|$)/

const reaching = (dir: string, rules: ReadonlyArray<RegExp>): ReadonlyArray<string> =>
  sourcesIn(dir).flatMap((file) =>
    [...new Set(specifiersOf(file))]
      .filter((spec) => rules.some((rule) => rule.test(spec)))
      .map((spec) => `${file}: ${spec}`)
  ).sort()

describe("the tenant's two face directories", () => {
  test("the reading is not vacuous", () => {
    expect(sourcesIn("appliance").length).toBeGreaterThan(10)
    expect(sourcesIn("browser").length).toBeGreaterThan(3)
    expect(reaching("appliance", [...APPLIANCE_TIER]).length).toBeGreaterThan(8)
  })

  test("`src/browser/` names no part of the appliance's tier", () => {
    expect(reaching("browser", [...APPLIANCE_TIER])).toEqual([])
  })

  test("`src/appliance/` names no part of the vault's vocabulary", () => {
    expect(reaching("appliance", [THE_VAULT])).toEqual([])
  })
})

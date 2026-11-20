import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

import { BUNDLE_NAMES as PLUGIN_NAMES } from "./rows.ts"
import { PLUGIN_TESTID, TESTID } from "./testids.ts"
import { TESTID as boot } from "@olai/web/client/testids.ts"
import { TESTID as primitives } from "@olai/ui-primitives/testids.ts"
import { TESTID as markdown } from "@olai/markdown-ui/testids.ts"
import { TESTID as history } from "@olai/edit-history/testids.ts"

const WITH_TESTIDS = PLUGIN_NAMES.filter((name) => {
  const manifest = JSON.parse(readFileSync(new URL(`../../plugins/${name}/package.json`, import.meta.url), "utf8"))
  return Object.hasOwn(manifest.exports ?? {}, "./testids")
})

const TABLES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = await Promise.all(
  WITH_TESTIDS.map(async (name) => {
    const door = (await import(`olai-plugin-${name}/testids`)) as {
      TESTID: Readonly<Record<string, string>>
    }
    return [name, door.TESTID] as const
  }),
)

test("the bundle catalogue keeps every owner distinct, including shared renderers", () => {
  const tables = [boot, primitives, markdown, history, ...TABLES.map(([, table]) => table)]
  const keys = tables.flatMap(table => Object.keys(table))
  const values = tables.flatMap(table => Object.values(table))
  expect(new Set(keys).size).toBe(keys.length)
  expect(new Set(values).size).toBe(values.length)
  expect(Object.keys(TESTID).length).toBe(keys.length)
})

test("the permanent web host owns only its boot overlay identifiers", () => {
  expect(boot).toEqual({ offline: "offline", reload: "reload" })
})

describe("the plugins' testids are disjoint", () => {
  test("the sweep is actually reading the tables, and some of them have rows", () => {
    expect(TABLES.length).toBe(WITH_TESTIDS.length)
    expect(TABLES.filter(([, table]) => Object.keys(table).length > 0).length)
      .toBeGreaterThan(1)
  })

  test("no two plugins claim one KEY — a spread would drop one silently", () => {
    const seen = new Map<string, string>()
    const clashes: Array<string> = []
    for (const [name, table] of TABLES) {
      for (const key of Object.keys(table)) {
        const first = seen.get(key)
        if (first !== undefined) clashes.push(`${key}: ${first} and ${name}`)
        else seen.set(key, name)
      }
    }
    expect(clashes).toEqual([])
    expect(Object.keys(PLUGIN_TESTID).length).toBe(seen.size)
  })

  test("no two plugins claim one VALUE — one selector may name one component", () => {
    const seen = new Map<string, string>()
    const clashes: Array<string> = []
    for (const [name, table] of TABLES) {
      for (const [key, id] of Object.entries(table)) {
        const first = seen.get(id)
        if (first !== undefined) clashes.push(`"${id}": ${first} and ${name}/${key}`)
        else seen.set(id, `${name}/${key}`)
      }
    }
    expect(clashes).toEqual([])
  })
})

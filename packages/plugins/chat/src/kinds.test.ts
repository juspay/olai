import { expect, test } from "bun:test"

import { kindWordOf } from "@olai/plugin-api"

import { OPENS_KIND, OPENS_TYPE, SLEEPING_KIND, SLEEPING_TYPE, SLEPT_KIND, SLEPT_TYPE, SESSION_KIND, SESSION_TYPE } from "./binding.ts"
import { kinds } from "./kinds.ts"
import { name } from "./wire.ts"

test("the word `./binding.ts` writes out is the word the registry composes", () => {
  expect(SESSION_TYPE).toBe(kindWordOf(name, SESSION_KIND))
  expect(SLEPT_TYPE).toBe(kindWordOf(name, SLEPT_KIND))
  expect(SLEEPING_TYPE).toBe(kindWordOf(name, SLEEPING_KIND))
  expect(OPENS_TYPE).toBe(kindWordOf(name, OPENS_KIND))
})

test("...and it decomposes back to this plugin and this kind, hyphen and all", () => {
  for (
    const [bare, composed] of [
      [SESSION_KIND, SESSION_TYPE],
      [SLEPT_KIND, SLEPT_TYPE],
      [SLEEPING_KIND, SLEEPING_TYPE],
      [OPENS_KIND, OPENS_TYPE],
    ] as const
  ) {
    expect(composed.slice(0, composed.indexOf("-"))).toBe(name)
    expect(composed.slice(composed.indexOf("-") + 1)).toBe(bare)
  }
})

test("the contribution names the bare word, and its clause names the composed one", () => {
  const session = kinds[0]
  expect(session.kind).toBe(SESSION_KIND)
  expect(session.takes).toContain(SESSION_TYPE)
  const slept = kinds[1]
  expect(slept.kind).toBe(SLEPT_KIND)
  expect(slept.takes).toContain(SLEPT_TYPE)
  const sleeping = kinds[2]
  expect(sleeping.kind).toBe(SLEEPING_KIND)
  expect(sleeping.takes).toContain(SLEEPING_TYPE)
  const opens = kinds[3]
  expect(opens.kind).toBe(OPENS_KIND)
  expect(opens.takes).toContain(OPENS_TYPE)
})

test("the sleeping mark admits the two words a person writes, and nothing else", () => {
  const sleeping = kinds[2]
  expect(sleeping.admits("on")).toBe(true)
  expect(sleeping.admits("off")).toBe(true)
  expect(sleeping.admits(" on ")).toBe(true)
  expect(sleeping.admits("ON")).toBe(false)
  expect(sleeping.admits("true")).toBe(false)
  expect(sleeping.admits("")).toBe(false)
  expect(sleeping.admits("on, but not on Fridays")).toBe(false)
})

test("the opens switch admits the two words a note's front matter can carry", () => {
  const opens = kinds[3]
  expect(opens.admits("alone")).toBe(true)
  expect(opens.admits("beside")).toBe(true)
  expect(opens.admits(" beside ")).toBe(true)
  expect(opens.admits("Beside")).toBe(false)
  expect(opens.admits("true")).toBe(false)
  expect(opens.admits("")).toBe(false)
})

test("the memo kind admits what the format's own instant is, and refuses prose", () => {
  const slept = kinds[1]
  expect(slept.admits("2026-10-13T03:12:45+05:30")).toBe(true)
  expect(slept.admits("2026-10-13")).toBe(true)
  expect(slept.admits("2026-10-13 03:12 (tidied the health rows)")).toBe(false)
  expect(slept.admits("")).toBe(false)
})

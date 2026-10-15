/**
 * THE COMPOSED WORD, HELD TO THE COMPOSITION — the one claim `./binding.ts`
 * cannot make about itself.
 *
 * `SESSION_TYPE` is a LITERAL there, and it has to be: that module publishes two
 * words behind a door with an empty import graph, so another plugin pays one
 * file for a string it genuinely depends on — and composing the word means
 * importing this plugin's `name`, which is a graph. The trade is a second
 * spelling of a composition somebody else performs, and a second spelling is a
 * thing that drifts.
 *
 * So it is held here, against the REAL composition over this plugin's REAL name:
 * `@olai/plugin-api`'s `kindWordOf`, which is the function the `Kinds` service
 * calls off the registering fiber and the one `Slots` calls in the tab. Rename
 * this plugin and the literal is red on this line rather than silently naming a
 * column no vault will ever carry.
 *
 * `@olai/bundle`'s `kinds.test.ts` makes the same agreement one floor up, over
 * every tenant's constant and what the assembled bundle actually composes. This
 * one is narrower and lands earlier: it needs no bundle, so a build that will
 * not compose at all still gets the claim run against it.
 */

import { expect, test } from "bun:test"

import { kindWordOf } from "@olai/plugin-api"

import { SLEEPING_KIND, SLEEPING_TYPE, SLEPT_KIND, SLEPT_TYPE, SESSION_KIND, SESSION_TYPE } from "./binding.ts"
import { kinds } from "./kinds.ts"
import { name } from "./wire.ts"

test("the word `./binding.ts` writes out is the word the registry composes", () => {
  expect(SESSION_TYPE).toBe(kindWordOf(name, SESSION_KIND))
  expect(SLEPT_TYPE).toBe(kindWordOf(name, SLEPT_KIND))
  expect(SLEEPING_TYPE).toBe(kindWordOf(name, SLEEPING_KIND))
})

test("...and it decomposes back to this plugin and this kind, hyphen and all", () => {
  // THE BARE WORD CARRIES A HYPHEN OF ITS OWN, which is the one thing about this
  // kind that is not like the tenants'. `kindWordOf` splits at the FIRST hyphen
  // and fences the separator out of the PLUGIN half only, so `chat-agent-session`
  // is `chat` and `agent-session` rather than `chat-agent` and `session` — and
  // the composition stays injective. Asserted rather than assumed, because the
  // whole safety of a built-in declaration rests on a claimed key carrying this
  // plugin's name and nobody else's.
  for (
    const [bare, composed] of [
      [SESSION_KIND, SESSION_TYPE],
      [SLEPT_KIND, SLEPT_TYPE],
      [SLEEPING_KIND, SLEEPING_TYPE],
    ] as const
  ) {
    expect(composed.slice(0, composed.indexOf("-"))).toBe(name)
    expect(composed.slice(composed.indexOf("-") + 1)).toBe(bare)
  }
})

test("the contribution names the bare word, and its clause names the composed one", () => {
  // The registry prefixes `kind`, so a row that offered the composed word would
  // be declared `chat-chat-agent-session`. The CLAUSE is the other way round: it
  // is what a refusal says out loud, and what a person has to type is the
  // composed word.
  const session = kinds[0]
  expect(session.kind).toBe(SESSION_KIND)
  expect(session.takes).toContain(SESSION_TYPE)
  const slept = kinds[1]
  expect(slept.kind).toBe(SLEPT_KIND)
  expect(slept.takes).toContain(SLEPT_TYPE)
  const sleeping = kinds[2]
  expect(sleeping.kind).toBe(SLEEPING_KIND)
  expect(sleeping.takes).toContain(SLEEPING_TYPE)
})

test("the sleeping mark admits the two words a person writes, and nothing else", () => {
  // THE ONE KIND A PERSON WRITES BY HAND, so its admission is the one a vault
  // can get wrong in the drawer: `on` and `off` are the value, the key being
  // absent is the same as `off` (the reading's business, not this one's), and a
  // sentence about sleeping is not an answer to whether to sleep.
  const sleeping = kinds[2]
  expect(sleeping.admits("on")).toBe(true)
  expect(sleeping.admits("off")).toBe(true)
  expect(sleeping.admits(" on ")).toBe(true)
  expect(sleeping.admits("ON")).toBe(false)
  expect(sleeping.admits("true")).toBe(false)
  expect(sleeping.admits("")).toBe(false)
  expect(sleeping.admits("on, but not on Fridays")).toBe(false)
})

test("the memo kind admits what the format's own instant is, and refuses prose", () => {
  // The value rule is the format's date rule rather than a second reading of
  // what a date is: what `stampOf` mints is admitted, and everything a person
  // might write beside a date is not.
  const slept = kinds[1]
  expect(slept.admits("2026-10-13T03:12:45+05:30")).toBe(true)
  expect(slept.admits("2026-10-13")).toBe(true)
  expect(slept.admits("2026-10-13 03:12 (tidied the health rows)")).toBe(false)
  expect(slept.admits("")).toBe(false)
})

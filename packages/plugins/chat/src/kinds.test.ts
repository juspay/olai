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

import { SESSION_KIND, SESSION_TYPE } from "./binding.ts"
import { kinds } from "./kinds.ts"
import { name } from "./wire.ts"

test("the word `./binding.ts` writes out is the word the registry composes", () => {
  expect(SESSION_TYPE).toBe(kindWordOf(name, SESSION_KIND))
})

test("...and it decomposes back to this plugin and this kind, hyphen and all", () => {
  // THE BARE WORD CARRIES A HYPHEN OF ITS OWN, which is the one thing about this
  // kind that is not like the tenants'. `kindWordOf` splits at the FIRST hyphen
  // and fences the separator out of the PLUGIN half only, so `chat-agent-session`
  // is `chat` and `agent-session` rather than `chat-agent` and `session` — and
  // the composition stays injective. Asserted rather than assumed, because the
  // whole safety of a built-in declaration rests on a claimed key carrying this
  // plugin's name and nobody else's.
  expect(SESSION_TYPE.slice(0, SESSION_TYPE.indexOf("-"))).toBe(name)
  expect(SESSION_TYPE.slice(SESSION_TYPE.indexOf("-") + 1)).toBe(SESSION_KIND)
})

test("the contribution names the bare word, and its clause names the composed one", () => {
  // The registry prefixes `kind`, so a row that offered the composed word would
  // be declared `chat-chat-agent-session`. The CLAUSE is the other way round: it
  // is what a refusal says out loud, and what a person has to type is the
  // composed word.
  const one = kinds[0]
  expect(one.kind).toBe(SESSION_KIND)
  expect(one.takes).toContain(SESSION_TYPE)
  // ...and the retired spelling is the BARE word, never the composed one: it is
  // the key this kind used to be before chat was a plugin, and it is what
  // `@olai/format`'s `reportLegacyKeys` looks for in a vault written back then.
})

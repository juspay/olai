/**
 * WHAT `--plugins` MEANS — the truth table, and the fence.
 *
 * Two different things, kept apart the way `./gitPolicy.test.ts` keeps them:
 *
 *   - the TRUTH TABLE is what each spelling comes to. Its sharp case is the one
 *     the flag is designed around: `null` and `""` are different answers, and
 *     the whole read-only preferences row rests on being able to tell "nobody
 *     said" from "somebody said none".
 *   - the FENCE is that this general package names no plugin. The sentence a
 *     person reads and the names it refuses are both DERIVED from the registry,
 *     so a third plugin arrives in the help page and in the refusal with no
 *     edit here — and this file asserts that by reading the registry too,
 *     rather than by spelling `kolu` and `odu` and proving only that somebody
 *     typed them twice.
 */

import { expect, test } from "bun:test"

import { DEFAULT_BUNDLE_NAMES } from "@olai/bundle/bundle"
import { PLUGIN_NAMES } from "@olai/bundle/wire"

import { pluginsPin, pluginsSaid } from "./pluginPolicy.ts"

test("nobody having said is not the same answer as saying none", () => {
  // THE DISTINCTION THE WHOLE FLAG IS SHAPED AROUND. A browser draws this row
  // read-only and has to say which of the two it is looking at: a policy the
  // operator typed, or the build's own default. A `--plugins` that defaulted to
  // the full list would have thrown that away at the first parse.
  expect(pluginsPin(null)).toBe(null)
  expect(pluginsPin("")).toEqual([])
})

test("a list is the names in it, however a person spaced them", () => {
  const [first] = PLUGIN_NAMES
  expect(first).toBeDefined()
  expect(pluginsPin(first as string)).toEqual([first as string])
  expect(pluginsPin(PLUGIN_NAMES.join(","))).toEqual([...PLUGIN_NAMES])
  // A person separating with `, ` is not making a mistake, and a trailing
  // comma is not a name that matches nothing.
  expect(pluginsPin(PLUGIN_NAMES.join(", ") + ",")).toEqual([...PLUGIN_NAMES])
})

test("a name this build does not have is refused, with the ones it does", () => {
  // The ONE place an unknown name is answered, and it is where a person typed
  // it. `@olai/plugin-api`'s own `enabled` deliberately refuses nothing.
  expect(() => pluginsPin("nope")).toThrow(/nope/)
  for (const name of PLUGIN_NAMES) {
    expect(() => pluginsPin("nope")).toThrow(new RegExp(name))
  }
})

test("the sentence names every plugin this build has", () => {
  // Derived, not spelled: a plugin added to the registry is offered by the
  // help page with no edit to `./pluginPolicy.ts` and none to this file. The
  // failure this catches is a help page that quietly stops mentioning a thing
  // the flag accepts.
  const said = pluginsSaid()
  for (const name of PLUGIN_NAMES) expect(said).toContain(name)
  expect(said).toContain(`the default is ${DEFAULT_BUNDLE_NAMES.join(", ")}`)
  // The read-only clause is the half a person acts on: it is the sentence that
  // tells somebody looking at a greyed-out preferences row where the decision
  // actually lives.
  expect(said).toContain("read-only")
})

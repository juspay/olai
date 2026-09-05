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

import { DEFAULT_BUNDLE_NAMES } from "@olai/bundle"
import { BUNDLE_NAMES as PLUGIN_NAMES } from "@olai/bundle"

import {
  extraPluginsSaid,
  pluginPin,
  pluginsSaid,
  withoutPluginsSaid,
} from "./pluginPolicy.ts"

test("nobody having said is not the same answer as saying none", () => {
  // THE DISTINCTION THE WHOLE FLAG IS SHAPED AROUND. A browser draws this row
  // read-only and has to say which of the two it is looking at: a policy the
  // operator typed, or the build's own default. A `--plugins` that defaulted to
  // the full list would have thrown that away at the first parse.
  expect(pluginPin(null, null, null)).toEqual({ kind: "omitted" })
  expect(pluginPin("", null, null)).toEqual({ kind: "exact", names: [] })
})

test("a list is the names in it, however a person spaced them", () => {
  const [first] = PLUGIN_NAMES
  expect(first).toBeDefined()
  expect(pluginPin(first as string, null, null)).toEqual({
    kind: "exact",
    names: [first as string],
  })
  expect(pluginPin(PLUGIN_NAMES.join(","), null, null)).toEqual({
    kind: "exact",
    names: [...PLUGIN_NAMES],
  })
  // A person separating with `, ` is not making a mistake, and a trailing
  // comma is not a name that matches nothing.
  expect(pluginPin(PLUGIN_NAMES.join(", ") + ",", null, null)).toEqual({
    kind: "exact",
    names: [...PLUGIN_NAMES],
  })
})

test("a name this build does not have is refused, with the ones it does", () => {
  // The ONE place an unknown name is answered, and it is where a person typed
  // it. `@olai/plugin-api`'s own `enabled` deliberately refuses nothing.
  expect(() => pluginPin("nope", null, null)).toThrow(/nope/)
  for (const name of PLUGIN_NAMES) {
    expect(() => pluginPin("nope", null, null)).toThrow(new RegExp(name))
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
  // THE LASTING-ANSWER CLAUSE is the half a person acts on, and it replaced a
  // `read-only` one. That word was exact while the panel's rows were frozen and
  // the flag was the only way to move them; the loader surface put a switch on
  // the panel, so what somebody at a `--help` page now needs to know is not that
  // they cannot change it — they can — but that what they change there goes with
  // the process, and this flag is what a restart comes back to.
  expect(said).toContain("restart comes back to this flag")
  expect(said).toContain("--extra-plugins")
  expect(said).toContain("--without-plugins")
})

test("the two patch flags name every plugin this build has, and refuse --plugins", () => {
  for (const said of [extraPluginsSaid(), withoutPluginsSaid()]) {
    for (const name of PLUGIN_NAMES) expect(said).toContain(name)
    expect(said).toContain("Cannot be given beside --plugins")
    expect(said).toContain("restart comes back to this flag")
  }
})

test("the three flags compose as one pin, and refuse the two collisions", () => {
  const [first, second] = PLUGIN_NAMES
  if (first === undefined || second === undefined) {
    throw new Error("this claim needs a build with two plugins")
  }

  expect(pluginPin(null, null, null)).toEqual({ kind: "omitted" })
  expect(pluginPin(first, null, null)).toEqual({ kind: "exact", names: [first] })
  expect(pluginPin(null, first, second)).toEqual({
    kind: "delta",
    extra: [first],
    without: [second],
  })
  expect(pluginPin("", null, null)).toEqual({ kind: "exact", names: [] })

  expect(() => pluginPin(first, second, null)).toThrow(
    /already names the exact set/,
  )
  expect(() => pluginPin(first, null, second)).toThrow(
    /already names the exact set/,
  )
  expect(() => pluginPin(null, first, first)).toThrow(
    new RegExp(`${first} is named in both`),
  )
})

test("an unknown name is refused on whichever flag it arrived", () => {
  expect(() => pluginPin("nope", null, null)).toThrow(/--plugins names nope/)
  expect(() => pluginPin(null, "nope", null)).toThrow(/--extra-plugins names nope/)
  expect(() => pluginPin(null, null, "nope")).toThrow(/--without-plugins names nope/)
  for (const name of PLUGIN_NAMES) {
    expect(() => pluginPin(null, "nope", null)).toThrow(new RegExp(name))
  }
})

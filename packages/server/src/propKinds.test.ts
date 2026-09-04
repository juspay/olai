/**
 * THE VOCABULARY FOLLOWS THE FIBERS — the loader surface's other half, benched
 * where the join is made.
 *
 * ## What was true before, and what the switch broke
 *
 * `./propKinds.ts` said, for two phases, that it was READ ONCE at boot and named
 * that a phase boundary: the store's codec is built from this table and holds it
 * for the life of the process, so a plugin that unloaded mid-serve would leave
 * its word in the codec's `enabled` half until the next start. Nothing could
 * unload one, so nothing was wrong.
 *
 * The panel's switch can. Without this, a serve whose kolu row was turned off
 * would go on judging `kolu-terminal` values as terminals — the codec holding a
 * vocabulary taken before the press — until the next boot, silently, which is
 * the shape of failure worth spending a bench on.
 *
 * ## WHY THE CODEC IS THE SUBJECT AND NOT THE STORE
 *
 * The phase's ask is "bench it with a plugin disposed after the store opened",
 * and the mechanism under that sentence is one object: `propKinds` answers a
 * `KindVocabulary`, `codecFor` closes over it, and the store holds the codec
 * forever. So what has to be true is that THE HELD OBJECT MOVES — which is what
 * these cases hold it and ask. Standing a real store up would add a disk, a
 * watcher and a probe to a claim none of them is about, and would test the
 * store's re-validation (which is `./resync.test.ts`'s subject) rather than the
 * vocabulary's currency.
 *
 * The other half — that a re-validation actually HAPPENS after a flip, so a
 * reader sees the new judgement rather than the last published one — is the
 * composition root's `store.refresh("verified")` and is proved end to end, where
 * a person presses the switch and the values change under them.
 */


import type { PropKind } from "@olai/plugin-api"
import {
  definePlugin,
  Kinds,
  mountPlugin,
  openPlugins,
  type Plugins,
  standing,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect } from "effect"

import { propKinds } from "./propKinds.ts"

/** The row that teaches a word, and the word it teaches. A TOY, because what is
 *  being asked is the currency of the table and not which plugin fills it —
 *  and because this file, like every general one, names no plugin of the build.
 *
 *  The composed word is `<row>-<kind>`, minted from the fiber's own name, so
 *  it is spelled here the way the vault would spell it. */
const ROW = "atoyrow"
const KIND = "gadget"
const WORD = `${ROW}-${KIND}`

const gadget: PropKind = {
  kind: KIND,
  takes: "`gadget` (a word)",
  admits: (value) => value === "yes",
}

const teacher = definePlugin({
  name: ROW,
  needs: [Kinds],
  apply: Effect.flatMap(Kinds, (vocabulary) => vocabulary.register(gadget)),
})

/** A runtime with the row up, and the handle that takes it down again — which
 *  is `mountPlugin`'s `dispose`, the same finalizer path a flip runs. */
const teaching = async () => {
  const run = standing()
  const plugins: Plugins = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  const mounted = await run(mountPlugin(plugins.host, teacher))
  return { run, plugins, drop: () => run(mounted.dispose) }
}

/**
 * THE CLAIM, HELD THE WAY THE CODEC HOLDS IT: one object, taken once, asked
 * twice, with a dispose in between.
 *
 * `held` is the variable a `Store` has. If `enabled` were the snapshot it used
 * to be, the second read would answer exactly what the first did — which is the
 * defect, and is what this case fails on.
 */
test("a row disposed after the vocabulary was taken takes its word with it", async () => {
  const { run, plugins, drop } = await teaching()
  const held = await run(propKinds(plugins))

  expect(held.enabled.get(WORD)?.takes).toBe(gadget.takes)

  await drop()

  expect(held.enabled.get(WORD)).toBeUndefined()
  // ...and the map is a MAP still, rather than the reading having gone away
  // with the row: every other word this build teaches is where it was.
  expect(held.enabled.has(WORD)).toBe(false)
})

/**
 * ...AND IT COMES BACK, which is the half a dispose alone cannot show.
 *
 * A flip is two directions and the second one is the one a person presses when
 * they change their mind. The registry's claims are suspended so that a plugin
 * which unloaded and came back is claiming again rather than claiming twice
 * (`@olai/effect-cordis`'s `registry`), and this is that rule seen from the
 * vocabulary's end.
 */
test("and the word returns when the row does, in the same held vocabulary", async () => {
  const { run, plugins, drop } = await teaching()
  const held = await run(propKinds(plugins))

  await drop()
  expect(held.enabled.get(WORD)).toBeUndefined()

  const again = await run(mountPlugin(plugins.host, teacher))
  expect(held.enabled.get(WORD)?.takes).toBe(gadget.takes)
  await run(again.dispose)
})

/**
 * `built` DOES NOT MOVE, and that is the whole of why a file's verdict never
 * depends on a switch somebody pressed.
 *
 * A DECLARATION is refused against what this BINARY has, and every row's module
 * is read for it including the disabled ones — so `{"type":"kolu-terminal"}`
 * stays a legal row on a serve running only odu, and stays legal on a serve
 * where somebody has just switched kolu off. Only the VALUE's judgement moves,
 * which is `enabled`, one field over.
 *
 * The toy row is not a row of this build, so it is in neither half of `built`
 * before or after — which is the assertion: what changed between the two reads
 * is `enabled` and nothing else.
 */
test("what a declaration is refused against does not move when a row does", async () => {
  const { run, plugins, drop } = await teaching()
  const held = await run(propKinds(plugins))
  const before = [...held.built.keys()].sort()

  await drop()

  expect([...held.built.keys()].sort()).toEqual(before)
})

/**
 * WHAT IT COMES TO FOR A VAULT is `@olai/format`'s and is already held there.
 *
 * A word that is not in `enabled` is a key nobody declares, which is plain text
 * — the state every vault that never heard of the plugin is already in, with no
 * finding, because there is nothing wrong. That rule is not new and did not need
 * amending: `typing.ts`'s `withClaims` rides `enabled` rather than `built`
 * precisely so that a plugin which is not running is free, and `typing.test.ts`
 * benches it against a vocabulary handed in with the word taken out.
 *
 * What was new is whether the vocabulary a codec is HOLDING can be that one, and
 * the three cases above are that. The two halves meet end to end, where a person
 * presses the switch and watches the values stop being terminals.
 */

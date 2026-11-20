import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import type { PropKind } from "@olai/plugin-api"
import {
  definePlugin,
  Kinds,
  mountPlugin,

  type Plugins,
  standing,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect } from "effect"

import { propKinds } from "./propKinds.ts"

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

const teaching = async () => {
  const run = standing()
  const plugins: Plugins = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  const mounted = await run(mountPlugin(plugins.host, teacher))
  return { run, plugins, drop: () => run(mounted.dispose) }
}

test("a row disposed after the vocabulary was taken takes its word with it", async () => {
  const { run, plugins, drop } = await teaching()
  const held = await run(propKinds(plugins))

  expect(held.enabled.get(WORD)?.takes).toBe(gadget.takes)

  await drop()

  expect(held.enabled.get(WORD)).toBeUndefined()
  expect(held.enabled.has(WORD)).toBe(false)
})

test("and the word returns when the row does, in the same held vocabulary", async () => {
  const { run, plugins, drop } = await teaching()
  const held = await run(propKinds(plugins))

  await drop()
  expect(held.enabled.get(WORD)).toBeUndefined()

  const again = await run(mountPlugin(plugins.host, teacher))
  expect(held.enabled.get(WORD)?.takes).toBe(gadget.takes)
  await run(again.dispose)
})

test("what a declaration is refused against does not move when a row does", async () => {
  const { run, plugins, drop } = await teaching()
  const held = await run(propKinds(plugins))
  const before = [...held.built.keys()].sort()

  await drop()

  expect([...held.built.keys()].sort()).toEqual(before)
})


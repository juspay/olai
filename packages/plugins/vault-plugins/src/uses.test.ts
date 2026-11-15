/**
 * WHAT A PLUGIN REACHES FOR, read off its own first lines.
 *
 * The claims here are about what a PERSON is shown on the plugin's page while
 * they decide whether to run somebody's code, so each one is written as that
 * reader: the words have to be true, the technical name has to be the thing an
 * author would recognise, and a door this build has never heard of has to be
 * listed rather than swallowed.
 */
import { expect, test } from "bun:test"

import { usesOf } from "./uses.ts"

const said = (server: string, browser: string | null = null) => usesOf(server, browser).map(one => one.said)
const named = (server: string, browser: string | null = null) => usesOf(server, browser).map(one => one.named)

test("a core door is said in plain words with its own name beside it", () => {
  const list = usesOf(`import { definePlugin, Kinds } from "@olai/plugin-api"`)
  expect(list).toEqual([{ said: "Teaches this vault a property kind", named: "Kinds" }])
})

test("the plumbing every plugin has says nothing", () => {
  expect(usesOf(`import { definePlugin, serviceTag } from "@olai/plugin-api"`)).toEqual([])
})

test("a door this build has no sentence for is still listed, by its name", () => {
  expect(usesOf(`import { definePlugin, Aether } from "@olai/plugin-api"`)).toEqual([
    { said: "Uses olai's `Aether`", named: "Aether" },
  ])
})

test("the subpath door a server half typechecks against is the same door", () => {
  expect(named(`import { Kinds } from "@olai/plugin-api/services"`)).toEqual(["Kinds"])
})

test("a key another plugin stands behind names the plugin that offers it", () => {
  expect(usesOf(`const Agenda = serviceTag<X>("journal.agenda")`)).toEqual([
    { said: "Uses what the `journal` plugin offers", named: "journal.agenda" },
  ])
})

test("a slot with a kind word is said as what it draws on", () => {
  expect(usesOf(`yield* slots.register("outline.row.chip", "hex", Swatch)`)).toEqual([
    { said: "Draws on anything wearing `hex`", named: "outline.row.chip · hex" },
  ])
})

test("a slot with no key is said as where it draws", () => {
  expect(named(`yield* slots.register("sidebar.section", { said: "x", body })`)).toEqual(["sidebar.section"])
})

test("a kind a plugin teaches is the one thing it adds to the vault's vocabulary", () => {
  expect(usesOf(`yield* kinds.register({ kind: "hex", takes: "text", admits: ok })`)).toEqual([
    { said: "Adds a property kind to this vault: hex", named: "kind · hex" },
  ])
})

test("both halves are one list, and a door named twice is said once", () => {
  const list = usesOf(
    `import { definePlugin, Kinds } from "@olai/plugin-api"`,
    `import { definePlugin, Slots } from "@olai/plugin-api"\nimport { Kinds } from "@olai/plugin-api"`,
  )
  expect(list.map(one => one.named)).toEqual(["Kinds", "Slots"])
})

test("a type-only import of a door is still a door it names", () => {
  expect(named(`import { definePlugin, type Vault } from "@olai/plugin-api"`)).toEqual(["Vault"])
})

test("the doc's own worked example reads as the page draws it", () => {
  expect(said(
    `import { definePlugin, Kinds } from "@olai/plugin-api"\n`
      + `yield* kinds.register({ kind: "hex", takes: "text", admits: (v) => /^#/.test(v) })`,
    `import { definePlugin, Slots } from "@olai/plugin-api"\n`
      + `yield* slots.register("outline.row.chip", "hex", Swatch)`,
  )).toEqual([
    "Teaches this vault a property kind",
    "Adds a property kind to this vault: hex",
    "Draws something in the app",
    "Draws on anything wearing `hex`",
  ])
})

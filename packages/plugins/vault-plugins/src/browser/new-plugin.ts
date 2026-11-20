import { PLUGIN_FOLDER, WORD } from "@olai/surface"
import { runAsync } from "@olai/web/client/run.ts"
import { atOnce } from "@olai/web/client/settled.ts"
import type { LevelScope, PaletteItem, PaletteOption, PaletteValue } from "olai-plugin-navigation/contract"
import { createMemo, type Accessor } from "solid-js"

import { client } from "../client.ts"
import { slugOf } from "../index.ts"
import { engines } from "./doors.ts"

export const NEW_PLUGIN_ROW = "new-plugin"

export interface Minting {
  readonly taken: () => ReadonlyArray<string>
  readonly go: (word: string) => void
}

export const titleFrom = (sentence: string): string => {
  const words = sentence.toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").split(/\s+/).filter((word) => word !== "")
  let at = 0
  if (at < words.length && OPENERS[words[at]!] === true) at += 1
  const kept: string[] = []
  for (; at < words.length && kept.length < 3; at += 1) {
    const word = words[at]!
    if (FILLER[word] === true) { if (kept.length === 0) continue; break }
    kept.push(word)
  }
  const title = (kept.length === 0 ? words.slice(0, 3) : kept).join(" ")
  return title === "" ? "" : title.charAt(0).toUpperCase() + title.slice(1)
}

const OPENERS: Readonly<Record<string, true>> = {
  show: true, add: true, draw: true, make: true, give: true, put: true, create: true, let: true,
  turn: true, display: true, render: true, build: true, keep: true, track: true, highlight: true,
}

const FILLER: Readonly<Record<string, true>> = {
  a: true, an: true, the: true, my: true, me: true, it: true, that: true, this: true,
  any: true, every: true, all: true, some: true,
  in: true, on: true, of: true, to: true, for: true, with: true, beside: true, next: true,
  from: true, by: true, at: true, into: true, when: true, whenever: true, so: true, and: true, or: true,
}

export interface Folder {
  readonly word: string
  readonly refusal: string | null
}

export const folderOf = (title: string, taken: ReadonlyArray<string>): Folder => {
  const word = slugOf(title)
  if (title.trim() === "") return { word, refusal: "Give it a name." }
  if (!WORD.test(word)) return { word, refusal: "That name can't become a folder — start it with a letter." }
  if (taken.includes(word)) return { word, refusal: `${PLUGIN_FOLDER}${word}/ is taken — pick another name.` }
  return { word, refusal: null }
}

export const saidOf = (folder: Folder): string =>
  folder.refusal ?? `Kept in your vault as ${PLUGIN_FOLDER}${folder.word}/`

const nameLevel = (minting: Minting, sentence: string, engine: string): PaletteValue => ({
  kind: "value",
  placeholder: "Name it…",
  initial: titleFrom(sentence),
  hint: "olai suggested this from what you asked for.",
  options: (scope: LevelScope): Accessor<ReadonlyArray<PaletteOption>> =>
    createMemo<ReadonlyArray<PaletteOption>>((previous) => {
      const label = saidOf(folderOf(scope.typed(), minting.taken()))
      return previous.length === 1 && previous[0]!.label === label ? previous : [{ id: "folder", label }]
    }, []),
  submitLabel: "Start building",
  validate: (text) => folderOf(text, minting.taken()).refusal,
  submit: async (text, _option, signal) => {
    const folder = folderOf(text, minting.taken())
    if (folder.refusal !== null) return { keepOpen: true, said: { tone: "alarm", text: folder.refusal } }
    const result = await runAsync(client().procedures.plugins.mint({ sentence, title: text.trim(), engine }))
    if (signal.aborted) return {}
    if (result._tag === "Failure") return { keepOpen: true, said: { tone: "alarm", text: result.failure.message } }
    minting.go(result.success.name)
    return {}
  },
})

const whoLevel = (minting: Minting) => (scope: LevelScope): Accessor<ReadonlyArray<PaletteItem>> =>
  createMemo<ReadonlyArray<PaletteItem>>(() => {
    const sentence = scope.typed().trim()
    if (sentence === "") return [SAY_SOMETHING]
    const installed = engines()?.installed() ?? []
    if (installed.length === 0) {
      return [{
        id: "new-plugin-by-hand",
        label: "Make the folder anyway",
        place: "No agent is set up on this machine",
        search: "new plugin no agent folder",
        taking: atOnce,
        action: { kind: "level", level: nameLevel(minting, sentence, "") },
      }]
    }
    return installed.map((engine) => ({
      id: `new-plugin-by-${engine.id}`,
      label: engine.name,
      section: "Who builds it",
      search: `new plugin ${engine.name.toLowerCase()}`,
      taking: atOnce,
      action: { kind: "level", level: nameLevel(minting, sentence, engine.id) },
    }))
  }, [])

const SAY_SOMETHING: PaletteItem = {
  id: "new-plugin-say",
  label: "Say what it should do…",
  search: "new plugin",
  taking: atOnce,
  action: {
    kind: "run",
    run: async () => ({
      keepOpen: true,
      said: { tone: "alarm", text: "Say what it should do first — your sentence becomes the README and the builder's first message." },
    }),
  },
}

export const newPluginRow = (minting: Minting): PaletteItem => ({
  id: NEW_PLUGIN_ROW,
  label: "New plugin",
  place: "Plugins",
  search: "new plugin build a plugin ask for a plugin extension",
  taking: atOnce,
  action: {
    kind: "level",
    level: {
      kind: "group",
      placeholder: "What should it do?",
      hint: "One sentence. An agent writes it into your vault as a folder.",
      children: whoLevel(minting),
    },
  },
})

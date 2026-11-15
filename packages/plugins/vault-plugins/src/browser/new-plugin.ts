/**
 * ASK FOR A PLUGIN — ⌘K → **New plugin**, as two palette levels.
 *
 * ## Why the palette, and why two levels
 *
 * Because *New chat* is already there, in the same box, with the same two
 * presses of Enter: say where, say what. Somebody who has started a
 * conversation in this app has already learned this gesture, and asking for a
 * plugin is the same act — a sentence, handed to an agent. A dialog of its own
 * would be a second thing to learn for a shape the product already has, and a
 * button somewhere in the chrome would be a button that is only ever found by
 * accident.
 *
 * NOBODY IS ASKED A PLUGIN QUESTION. There is no word grammar here, no halves,
 * no slots, no services, no engine jargon: the two questions are *what should
 * it do* and *what is it called*, and the second comes with an answer already
 * in the box. Everything else — the folder, the three files, which half gets
 * what — is the serve's business and the builder's.
 *
 * ## The shape the contract allows, and the one place it pinches
 *
 * Level one is a GROUP and level two is a VALUE, which is New chat's shape read
 * in the same order: the sentence is the group's own typed text, its rows are
 * the engines that could build it, and choosing one drills into a value level
 * whose box starts with a name derived from that sentence. It has to be this
 * way round — only a value level carries an `initial`, and only a group level's
 * rows can be a function of what is being typed.
 *
 * The pinch is the folder line. `Kept in your vault as plugins/<word>/` must
 * follow the box as somebody edits the name, and a level's `hint` is a fixed
 * string decided when the level opens. The one per-keystroke surface a value
 * level has is its `options`, so that is where the line goes: ONE option,
 * always chosen, carrying the sentence. It is a label wearing a radio's
 * clothes, and it is the honest trade — a stale folder path under a name
 * somebody is editing is worse than a chip that has no second choice.
 *
 * ## Reachable with nothing in the vault
 *
 * The row is contributed by this row's `palette` component and is offered
 * whether or not the vault defines a single plugin — it is how the first one is
 * asked for. With NO ENGINE installed it still goes through: the level says so,
 * the folder is created with its README, and `mint` answers a `refusal`
 * sentence saying no agent could be started. A vault where somebody writes the
 * two halves by hand is a vault with plugins in it.
 */

import { PLUGIN_FOLDER } from "@olai/surface"
import { runAsync } from "@olai/web/client/run.ts"
import { atOnce } from "@olai/web/client/settled.ts"
import type { LevelScope, PaletteItem, PaletteOption, PaletteValue } from "olai-plugin-navigation/contract"
import { createMemo, type Accessor } from "solid-js"

import { client } from "../client.ts"
import { slugOf } from "../index.ts"
import { WORD } from "../source.ts"
import { engines } from "./doors.ts"

/** The root row's id — the path `PaletteControl.showAt` is given, and the
 *  reason the sidebar's `+` can drill straight to this level. */
export const NEW_PLUGIN_ROW = "new-plugin"

/** What the two levels need from the activation that contributes them: which
 *  words are already spoken for, and where to land once the folder exists. */
export interface Minting {
  /** Every word this serve has — built rows and vault folders alike, so a name
   *  that would collide is refused while it is still being typed. */
  readonly taken: () => ReadonlyArray<string>
  /** Go to the new plugin's page. The palette does not navigate: `mint` answers
   *  an address and where a press lands is the tab's business. */
  readonly go: (word: string) => void
}

/**
 * A NAME, FROM WHAT SOMEBODY ASKED FOR — a suggestion, and the page says as
 * much ("olai suggested this from what you asked for").
 *
 * The rule is deliberately dumb, because a clever one would be wrong in a way
 * nobody could predict: drop a leading imperative and the articles after it,
 * keep the first few words that carry meaning, raise the first letter. *Show a
 * colour swatch beside any hex colour* becomes *Colour swatch*. It is not the
 * name a person would have chosen and it is not trying to be — it is a name
 * already in the box, so the common case is one press of Enter, and the box is
 * an ordinary text field for the case where it is wrong.
 */
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

/** The verbs a request opens with. They say what the person wants done and
 *  nothing about what the plugin IS, which is what a name has to carry. */
const OPENERS: Readonly<Record<string, true>> = {
  show: true, add: true, draw: true, make: true, give: true, put: true, create: true, let: true,
  turn: true, display: true, render: true, build: true, keep: true, track: true, highlight: true,
}

/** Words that carry no subject. A run of them ends the name rather than being
 *  skipped: past the first preposition the sentence has stopped naming the
 *  thing and started describing where it goes. */
const FILLER: Readonly<Record<string, true>> = {
  a: true, an: true, the: true, my: true, me: true, it: true, that: true, this: true,
  any: true, every: true, all: true, some: true,
  in: true, on: true, of: true, to: true, for: true, with: true, beside: true, next: true,
  from: true, by: true, at: true, into: true, when: true, whenever: true, so: true, and: true, or: true,
}

/** What the folder would be called, and why it would not work — one reading,
 *  because the chip under the box and the refusal on Enter must say the same
 *  thing in the same words. */
export interface Folder {
  readonly word: string
  /** The line under the box. */
  readonly said: string
  /** Why this name cannot be taken, or `null`. */
  readonly refusal: string | null
}

export const folderOf = (title: string, taken: ReadonlyArray<string>): Folder => {
  const word = slugOf(title)
  if (title.trim() === "") return { word, said: "Give it a name.", refusal: "Give it a name." }
  // A title of nothing but punctuation slugs to nothing, and a slug that opens
  // with a digit is not a word — both are refusals this level owes in place
  // rather than after a round trip (`../source.ts`'s `WORD` is the grammar,
  // read from where it is enforced).
  if (!WORD.test(word)) {
    const said = "That name can't become a folder — start it with a letter."
    return { word, said, refusal: said }
  }
  if (taken.includes(word)) {
    const said = `${PLUGIN_FOLDER}${word}/ is taken — pick another name.`
    return { word, said, refusal: said }
  }
  return { word, said: `Kept in your vault as ${PLUGIN_FOLDER}${word}/`, refusal: null }
}

/** The second level: the name, the folder it becomes, and the one press that
 *  creates it. */
const nameLevel = (minting: Minting, sentence: string, engine: string): PaletteValue => ({
  kind: "value",
  placeholder: "Name it…",
  initial: titleFrom(sentence),
  hint: "olai suggested this from what you asked for.",
  // ONE OPTION, ALWAYS CHOSEN: the folder line, which has to follow the box.
  // See the header — this is the only surface at a value level that does.
  options: (scope: LevelScope): Accessor<ReadonlyArray<PaletteOption>> =>
    createMemo<ReadonlyArray<PaletteOption>>((previous) => {
      const label = folderOf(scope.typed(), minting.taken()).said
      return previous.length === 1 && previous[0]!.label === label ? previous : [{ id: "folder", label }]
    }, []),
  submitLabel: "Start building",
  validate: (text) => folderOf(text, minting.taken()).refusal,
  submit: async (text, _option, signal) => {
    const folder = folderOf(text, minting.taken())
    if (folder.refusal !== null) return { keepOpen: true, said: { tone: "alarm", text: folder.refusal } }
    const result = await runAsync(client().procedures.plugins.mint({ sentence, title: text.trim(), engine }))
    // A LEVEL THAT IS GONE CHANGES NOTHING. The folder was still created —
    // this call is not cancelled by the box closing — but navigating a reader
    // who has moved on would be the palette stealing their page back.
    if (signal.aborted) return {}
    if (result._tag === "Failure") return { keepOpen: true, said: { tone: "alarm", text: result.failure.message } }
    minting.go(result.success.name)
    // THE FOLDER EXISTS, SO THE BOX IS DONE. A mint that could not start a
    // builder — no chat on this serve, no agent on this machine, a start the
    // engine refused — still made the plugin, and the PAGE says so in its own
    // words with the folder in front of the reader. Keeping the level up over
    // that page would say it twice and leave a box asking for a name that has
    // already been taken.
    return {}
  },
})

/** The first level's rows: who builds it. One per installed engine, in the
 *  order chat lists them, and the two honest arms around that — nothing typed
 *  yet, and no agent on this machine. */
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

/** The level with an empty box: a row that refuses in place, so Enter says
 *  what is missing instead of doing nothing. */
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

/** The palette row itself. Always offered: a vault with no plugins is exactly
 *  where this is reached for. */
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

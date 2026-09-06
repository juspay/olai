import type { AppCommand } from "olai-plugin-navigation/slots"
/** Generic palette rows and prefix grammar. Feature providers own the words,
 * character, write behavior and continuation of every contributed prefix. */
import type { BodyKind } from "@olai/format"
import type {Hung } from "@olai/plugin-api"
import type { Edit,SearchHit } from "@olai/surface"

import type { Search } from "olai-plugin-search/reading"
import type { NodeProp } from "olai-plugin-search/ui/props.ts"
import { hitRow } from "olai-plugin-search/ui/row.ts"
import { atOnce,type Taking } from "@olai/web/client/settled.ts"
import { HOME_ROUTE,type Route } from "olai-plugin-navigation/routes"
import type { Asking } from "./asking.ts"

export type PaletteAction =
  | { readonly kind: "route"; readonly route: Route }
  | { readonly kind: "shortcuts" }
  | { readonly kind: "toggle-sidebar" }
  | { readonly kind: "toggle-panel" }
  | { readonly kind: "reset-widths" }
  | { readonly kind: "close-pane" }
  /**
   * PIN THIS PAGE, or take it off the shelf — its own arm rather than an
   * `edit`, because which of the two writes it is is a question about the
   * DIRECTORY (does the shelf already hold this address) and the row is built
   * where that is known (`../pins/palette.ts`). Carrying an `Edit` would mean
   * deciding it at build time and sending it a keystroke later, against a
   * shelf that may have moved.
   */
  | { readonly kind: "pin" }
  | { readonly kind: "run"; readonly run: () => Promise<{readonly keepOpen?: boolean; readonly said?: import("@olai/web/client/saying.ts").Said}> }
  /**
   * ONE OP, at the write gate every other write in this app goes through
   * (`../writes.ts`) — the row carries the {@link Edit} it will send, decided
   * when the list was built, exactly as a `•••` entry does.
   *
   * `confirm` is the question the palette puts in its own box first, for the
   * one verb whose reach is bigger than the line it was chosen on. It is the
   * MENU's sentence verbatim (`../menu/verbs.ts`) — the same words, naming the
   * same count — because a reader who has agreed to one of them in the menu
   * has agreed to this.
   */
  | {
    readonly kind: "edit"
    readonly edit: Edit
    readonly confirm?: string
  }
  /**
   * Put this text in the box and stay open — the one action that does not
   * finish anything.
   *
   * It exists for exactly one row: quick capture is a PREFIX (`+ …`), and a
   * prefix nobody has been told about is a feature nobody finds. So the
   * palette lists it like any other command, and choosing it types the `+` for
   * you and leaves the caret after it.
   */
  | { readonly kind: "prefix"; readonly prefix: string }

export interface PaletteItem {
  /** Unique in the list, and — for the rows that are not commands — PREFIXED
   *  `hit-`, over the row's own ADDRESS: `hit-#a1b2c3` for a record and
   *  `hit-notes/cabinets.md` for a document ({@link hitItem}, over
   *  `../search/row.ts`). That prefix is a contract with a
   *  package that does not import this one: it is how a scenario tells a hit
   *  from a shell command that happens to share a word, in both doors
   *  (`packages/tests`' palette and header steps). */
  readonly id: string
  readonly label: string
  /** A short word about the row, drawn INLINE at the right: a chord, a
   *  reminder. Only a command has one — it is a few characters by
   *  construction, which is why it may sit beside the label without ever
   *  starving it. */
  readonly hint?: string
  /**
   * WHERE this row's node lives, drawn on a SECOND line under the title.
   *
   * A place is somebody's prose — an ancestor title can be a whole sentence —
   * so it cannot share a line with the title: side by side, the two fight for
   * one row's width, the title loses (it is the flexible one) and wraps to a
   * word per line, while the mono place refuses to shrink and pushes the
   * palette into a sideways scroll. A popover never scrolls sideways, so the
   * place gets a line of its own and both are ellipsized.
   */
  readonly place?: string
  /** The node's properties, on a THIRD line — matched ones first
   *  (`../search/props.ts`). Only a node row has any; a shell command has
   *  nothing to say about itself that its label does not already say. */
  readonly props?: ReadonlyArray<NodeProp>
  /**
   * WHICH KIND of served file this row opens, drawn as that kind's own glyph
   * in front of the label (`../file/icons.tsx`) — the face the sidebar's tree
   * has used since a `.md`, a `.olai` and a folder stopped being four
   * characters of extension apart.
   *
   * Only a document row carries one (`../search/row.ts`). A command is not a
   * file, and a node hit is a row INSIDE one — the file it lives in is already
   * said, in words, on its place line.
   */
  readonly of?: BodyKind
  /**
   * The file a NODE hit is written in — so `../search/Result.tsx` can run
   * the same `renderTitle` a tree row does. Absent on commands and document
   * hits, which stay text.
   */
  readonly from?: string
  readonly action: PaletteAction
  /**
   * WHICH ANSWER THIS ROW CAME FROM, as the act of spending it —
   * `../settled.ts`'s `Taking`, read by its `spend`, which is where the whole
   * argument for a row carrying this lives.
   *
   * The short of it: the two doors that draw this list draw TWO BLOCKS, the
   * commands matched here off a list the tab already holds and the hits a
   * debounce and a round trip away — so "have the rows caught up" is a
   * question about a ROW and not about the door. A KEY asks it; a POINTER
   * never does.
   *
   * REQUIRED, and `atOnce` is what a row with no answer behind it says. Made
   * optional it would be silence that means "ungated", which is the one thing
   * a new row here must not be able to be by saying nothing.
   */
  readonly taking: Taking
  /** Lowercase haystack for simple substring filter. */
  readonly search: string
}

/** A scoped provider's text action. Keeping the matched contribution in the
 * parsed mode makes rendering and Enter use the same activation. */
export interface PalettePrefix {
  readonly value: string
  readonly label: string
  readonly empty: string
  readonly testid: string
  readonly run: (text: string) => Promise<import("@olai/web/client/saying.ts").Said>
  readonly after: string
}

/** First contributor wins a prefix; disposal makes its character available. */
export const prefixesIn = (entries: ReadonlyArray<{ readonly owner: string; readonly value: PalettePrefix }>): ReadonlyArray<PalettePrefix> => {
  const held = new Map<string, string>()
  return entries.flatMap(entry => {
    const previous = held.get(entry.value.value)
    if (previous !== undefined) {
      console.warn(`olai: plugin "${entry.owner}" claims palette prefix "${entry.value.value}", already owned by "${previous}"`)
      return []
    }
    held.set(entry.value.value, entry.owner)
    return [entry.value]
  })
}

/** Resolve legacy app.command contributions against active typed prefixes. */
export const commandsIn = (
  entries: ReadonlyArray<Hung<AppCommand>>,
  reserved: ReadonlyArray<PalettePrefix> = [],
): ReadonlyArray<AppCommand> => {
  /** Prefix → whoever is holding it, in the words the refusal names them by. */
  const held = new Map<string, string>(
    reserved.map((prefix) => [prefix.value, `the active prefix "${prefix.label}"`] as const),
  )
  const kept: Array<AppCommand> = []
  for (const one of entries) {
    const already = held.get(one.face.prefix)
    if (already !== undefined) {
      console.warn(
        `olai: the plugin "${one.plugin}" claims the palette prefix `
          + `"${one.face.prefix}", which ${already} already answers — that `
          + "command is not drawn, and typing the character does what it did before.",
      )
      continue
    }
    held.set(one.face.prefix, `the plugin "${one.plugin}"`)
    kept.push(one.face)
  }
  return kept
}

/** The shell's own rows. `atOnce` on every one of them, and it is a fact
 *  rather than a formality: a shell row IS this table, so there is no answer
 *  behind it to be inside the settle of ({@link PaletteItem.taking}). */
export const SHELL_ITEMS: ReadonlyArray<PaletteItem> = [
  {
    id: "nav-home",
    label: "Go home",
    hint: "open the first outline",
    action: { kind: "route", route: HOME_ROUTE },
    taking: atOnce,
    search: "go home outline first",
  },
  {
    id: "nav-trash",
    label: "Go to the Trash",
    hint: "what was put away",
    action: { kind: "route", route: { kind: "trash" } },
    taking: atOnce,
    search: "go to trash archive archived put away restore put back",
  },
  {
    id: "panel-sidebar",
    label: "Toggle sidebar",
    hint: "⌘\\",
    action: { kind: "toggle-sidebar" },
    taking: atOnce,
    search: "toggle sidebar panel rail directory",
  },
  {
    id: "panel-agent",
    label: "Toggle agent panel",
    hint: "⌘J",
    action: { kind: "toggle-panel" },
    taking: atOnce,
    search: "toggle agent panel conversation",
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    hint: "every key",
    action: { kind: "shortcuts" },
    taking: atOnce,
    search: "keyboard shortcuts keys help reference bindings",
  },
  {
    id: "reset-widths",
    label: "Reset panel widths",
    hint: "defaults",
    action: { kind: "reset-widths" },
    taking: atOnce,
    search: "reset panel widths sidebar default size",
  },
  {
    id: "close-pane",
    label: "Close pane",
    hint: "⌘⇧W",
    action: { kind: "close-pane" },
    taking: atOnce,
    search: "close pane split view",
  },
]

/**
 * One search hit as a palette row: choosing it opens whatever it names.
 *
 * WHATEVER, and that is the change: a hit is a record or a document
 * (`@olai/format`'s `SearchHit`), and the row is the same row either way —
 * label, place, and a route to take. What each of those IS per kind is
 * `../search/row.ts`'s answer, shared with the three other doors that draw the
 * identical list, so the palette cannot grow a glyph the header box lacks.
 */
/**
 * EVERY HIT OF A SEARCH, as the block a door draws — which is the call the two
 * doors make, and {@link hitItem} below is the row it is made of.
 *
 * It exists so that the answer's own take rides onto the rows in ONE place. It
 * was that `.map` at both doors, which is two chances for one of them to mint
 * a hit row naming no search — and an ungated `Enter` is exactly the drift
 * this reading has been fighting since there were two doors onto it.
 */
export const hitItems = (search: Search): ReadonlyArray<PaletteItem> => {
  const taking = search.taking
  return search.hits().map((hit) => hitItem(hit, taking))
}

export const hitItem = (
  hit: SearchHit,
  /** WHICH ANSWER this row is off, so the row can say whether a KEY may spend
   *  it ({@link PaletteItem.taking}). Required rather than optional, which is
   *  the one line that keeps the rule: a hit row cannot be minted without
   *  naming the search it came out of. {@link hitItems} is how a door passes
   *  it; this stays exported for the tests, which are about what ONE hit
   *  becomes. */
  taking: Taking,
): PaletteItem => {
  const row = hitRow(hit)
  return {
    id: `hit-${row.id}`,
    label: row.label,
    ...(row.of === undefined ? {} : { of: row.of }),
    ...(row.from === undefined ? {} : { from: row.from }),
    place: row.place,
    props: row.props,
    action: { kind: "route", route: row.route },
    taking,
    // Never filtered locally: the server already decided these match.
    search: "",
  }
}

/** Filter the command rows by a free-text query — never reached while the
 *  box carries a prefix, which takes it out of the list entirely. */
export const filterItems = (
  query: string,
  items: ReadonlyArray<PaletteItem> = SHELL_ITEMS,
): ReadonlyArray<PaletteItem> => {
  const q = query.trim().toLowerCase()
  if (q === "") return items
  return items.filter(
    (item) =>
      item.search.includes(q) || item.label.toLowerCase().includes(q),
  )
}

/**
 * WHAT THE BOX IS DOING, as one value — the whole of what a prefix decides.
 *
 * Three answers and never two at once, which is the point of it being a tagged
 * union rather than a pair of nullable strings beside a `typing` boolean
 * derived from them. Those spell "asking AND capturing", "capturing while the
 * list is still being filtered", and "neither, but typing" — states nothing can
 * reach and everything downstream would have to keep not reaching. Here the
 * question "is the list showing?" is `kind === "filter"` and the answer cannot
 * disagree with the text beside it.
 *
 * It is also the one place the prefixes are compared, so their order is stated
 * once ({@link modeOf}), and a line beginning with one of them is that prefix's
 * even if it goes on to mention another.
 */
export type Mode =
  /** No prefix: the rest is a filter over the rows. */
  | { readonly kind: "filter" }
  /**
   * A PLUGIN'S PREFIX — the rest is the line its `run` is about to be handed.
   *
   * The command TRAVELS ON THE MODE rather than being looked up again from the
   * prefix where the line is drawn and once more where Enter sends it. Those
   * two lookups are the same question asked of a table that moves on its own —
   * a plugin dropped between the keystroke and the press — and the honest
   * answer to "which verb did the reader type a line under" is the one the
   * grammar already found.
   */
  | {
    readonly kind: "command"
    readonly command: AppCommand
    readonly text: string
  }
  | { readonly kind: "prefix"; readonly prefix: PalettePrefix; readonly text: string }

/**
 * …AND THE FOURTH THING THE BOX CAN BE DOING: answering a question the palette
 * put in place of its list (`./asking.ts`).
 *
 * It is an arm of {@link Mode}'s union rather than a flag beside it, and the
 * reason is the bug that shaped `Mode` in the first place: a `+ …` typed
 * behind a question sent a capture on an Enter the reader aimed at the
 * question (review, 2026-08-14). Kept apart, "a question is up" and "the box
 * carries a prefix" are two facts four readers have to compare in the same
 * order — the search gate, the placeholder, Enter, and the panel the `Switch`
 * draws. Read as ONE value, a question EXCLUDES a prefix and a filter by
 * construction, and the ordering rule stops being a rule.
 */
export type Box = Mode | { readonly kind: "answering"; readonly question: Asking }

/** What the box is doing, from the three things that decide it: the question
 *  that is up, if any, the words in the box, and which prefixes are on offer at
 *  the moment they were typed. */
export const boxOf = (
  raw: string,
  question: Asking | null,
  commands: ReadonlyArray<AppCommand>,
  prefixes: ReadonlyArray<PalettePrefix> = [],
): Box => question === null ? modeOf(raw, commands, prefixes) : { kind: "answering", question }

/** Parse only contributions that are active in this composition. */
export const modeOf = (raw: string, commands: ReadonlyArray<AppCommand>, prefixes: ReadonlyArray<PalettePrefix> = []): Mode => {
  for (const prefix of prefixes) {
    const text = afterPrefix(raw, prefix.value)
    if (text !== null) return { kind: "prefix", prefix, text }
  }
  for (const command of commands) {
    const line = afterPrefix(raw, command.prefix)
    if (line !== null) return { kind: "command", command, text: line }
  }
  return { kind: "filter" }
}

/**
 * What is left of the query after `prefix`, or `null` when it does not carry
 * one.
 *
 * ONE function for both prefixes, because they are one rule read twice: the
 * leading space is forgiving (a palette opened with a stray space in it is not
 * a different mode), the prefix goes, and the space after it goes too — so `>
 * hello` and `>hello` are the same message and `+ buy milk` and `+buy milk`
 * are the same capture. What comes back is otherwise VERBATIM, including the
 * trailing space somebody left, because it is on its way to a node's title and
 * this is not the layer that judges one.
 */
const afterPrefix = (raw: string, prefix: string): string | null => {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith(prefix)) return null
  return trimmed.slice(prefix.length).trimStart()
}

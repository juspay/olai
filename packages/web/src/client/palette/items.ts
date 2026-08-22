/**
 * The palette SHELL's catalogue: navigation, panel toggles, ask-the-agent, and
 * the row that hands a query to the one search box.
 *
 * The OP rows are next door (`./ops.ts`), because what a verb is and which of
 * them apply is the `•••` menu's answer and not a second list.
 *
 * ## What this file no longer mints, and why
 *
 * NODE HITS. This palette used to answer a query with eight rows from the
 * server — a shortlist, per keystroke, in a modal that closes — and so did the
 * box in the header beside it. Two entry points, two scopes, two answer shapes,
 * one grammar, and nothing in the app that would list a tag written in three
 * files. The human ruled one box on 2026-08-21: the page's own filter, which
 * owns the address, the count, the ancestry-kept rows and the pin, and which
 * now widens to a real `/search?q=…` page
 * (docs/brainstorming/one-search-box.md).
 *
 * So what a typed query produces here is {@link searchItem} — a door to that
 * box rather than a preview of what is behind it. It is minted from the words,
 * costs no round trip, and can never be a row of an answer the reader has
 * already typed past.
 *
 * DOCUMENT ROWS went the same way and had gone once before: they were a third
 * list matched in this tab, then hits like any other, and now they are rows of
 * the everywhere page, which is where a list of files somebody can read
 * belongs.
 *
 * TWO PREFIXES take the box away from the list, and they are the same idea
 * twice: `>` sends the rest to the agent, `+` captures the rest as a node.
 * Both are a LINE OF TEXT rather than a row to choose, which is what a prefix
 * is for — a row can only carry what it was built holding, and neither of
 * these knows what it is going to say until somebody types it. What the box is
 * doing is therefore ONE value ({@link Mode}) rather than one nullable string
 * per prefix.
 */

import type { Asking } from "./asking.ts"
import { HOME_ROUTE, narrowable, type Route } from "../routes.ts"
import { atOnce, type Taking } from "../settled.ts"
import type { Edit } from "@olai/surface"

export type PaletteAction =
  | { readonly kind: "route"; readonly route: Route }
  | { readonly kind: "shortcuts" }
  | { readonly kind: "toggle-sidebar" }
  | { readonly kind: "toggle-chat" }
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
  /**
   * HAND THIS QUERY TO THE ONE SEARCH BOX — the row that replaced the node
   * hits ({@link searchItem}).
   *
   * It carries the WORDS and where they are going rather than a `Route`,
   * because the two destinations are two different gestures: `page` puts the
   * query in this pane's `?q=` and the caret in its box, which is a narrowing
   * of the page the reader is standing on; `everywhere` is a navigation to
   * `/search?q=…`. A single route would have flattened the first into the
   * second and lost the caret with it.
   */
  | {
    readonly kind: "search"
    readonly query: string
    readonly here: "page" | "everywhere"
  }

export interface PaletteItem {
  /** Unique in the list — a stable word per row, because `<Key by="id">` is
   *  what keeps a list somebody is walking from being rebuilt under their
   *  cursor, and because a scenario names a row by it. */
  readonly id: string
  readonly label: string
  /** A short word about the row, drawn INLINE at the right: a chord, a
   *  reminder. It is a few characters by construction, which is why it may sit
   *  beside the label without ever starving it. */
  readonly hint?: string
  /**
   * WHERE this row is ABOUT, drawn on a SECOND line under the label — which
   * page a pin row means, which node a verb row is aimed at.
   *
   * A place is somebody's prose — a page title can be a whole sentence — so it
   * cannot share a line with the label: side by side, the two fight for one
   * row's width, the label loses (it is the flexible one) and wraps to a word
   * per line, while the mono place refuses to shrink and pushes the palette
   * into a sideways scroll. A popover never scrolls sideways, so the place gets
   * a line of its own and both are ellipsized.
   */
  readonly place?: string
  readonly action: PaletteAction
  /**
   * WHICH ANSWER THIS ROW CAME FROM, as the act of spending it —
   * `../settled.ts`'s `Taking`, read by its `spend`.
   *
   * EVERY ROW HERE IS {@link atOnce} NOW, and the field stays because that is
   * the interesting part. This list used to be TWO BLOCKS — commands matched in
   * this tab, and hits a debounce and a round trip away — so "have the rows
   * caught up" was a question about a ROW rather than about the door. The hits
   * are gone (the header above says why) and every row is once again minted
   * from something the tab already holds. What the field keeps is the RULE: a
   * row must say what is behind it, and a row minted from an answer that says
   * nothing would be silently ungated.
   */
  readonly taking: Taking
  /** Lowercase haystack for simple substring filter. */
  readonly search: string
}

/** The character that turns the box into an agent message. */
const ASK_PREFIX = ">"

/** The character that turns the box into a capture. `+` because that is what
 *  the gesture is — one more line — and because it is a character a title does
 *  not start with often enough to matter, which is the same bet `>` makes. */
export const CAPTURE_PREFIX = "+"

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
    id: "nav-today",
    label: "Go to today",
    hint: "journal for this day",
    action: { kind: "route", route: { kind: "today" } },
    taking: atOnce,
    search: "go to today journal day calendar",
  },
  {
    id: "nav-agenda",
    label: "Go to the agenda",
    hint: "what is due",
    action: { kind: "route", route: { kind: "agenda" } },
    taking: atOnce,
    search: "go to agenda due overdue upcoming owed",
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
    id: "panel-chat",
    label: "Toggle agent panel",
    hint: "⌘J",
    action: { kind: "toggle-chat" },
    taking: atOnce,
    search: "toggle agent panel chat",
  },
  {
    // Racket's `olai add`, as a line in a box: the whole promise is that the
    // page under the palette does not move, so this row does not navigate,
    // does not open an editor and does not choose a place — it primes the
    // prefix, and what gets typed after it lands in the inbox.
    id: "capture",
    label: "Capture to the Inbox",
    hint: "+ a line",
    action: { kind: "prefix", prefix: `${CAPTURE_PREFIX} ` },
    taking: atOnce,
    search: "capture inbox add quick note new node jot",
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
    search: "reset panel widths sidebar chat default size",
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
 * THE HANDOFF — the row that takes what is typed to the one search box.
 *
 * The palette used to answer a query with NODE HITS: eight rows, from the
 * server, per keystroke, in a modal that closes. That half is gone (the human's
 * ruling of 2026-08-21, docs/brainstorming/one-search-box.md) and this row is
 * what replaced it — not as a preview of a search, but as the way to the box
 * that IS the search. The palette keeps what it is good at: the shell commands,
 * the zoomed node's verbs, the shelf's row, `>` and `+`.
 *
 * TWO SENTENCES, and which one is drawn is a question about the PAGE rather
 * than about the query. A page that takes a `?q=` gets its own box filled and
 * focused, which is the page-first half of the ruling — you search what is in
 * front of you, and the bar then offers to widen. A page that takes none (a
 * document, which is prose) has no box, so the row goes straight to `/search`,
 * where there always is one.
 *
 * NOTHING IS ASKED OF THE SERVER FOR IT. The row is minted from what is typed,
 * so it is on screen with the keystroke and can never be a row of an answer the
 * reader has moved past — which is why it takes {@link atOnce} rather than a
 * search's `Taking`. The one search request happens once the query is in the
 * address, where a filter's own settle governs it.
 *
 * IT IS ALWAYS THERE while there is anything typed, including over a query that
 * matched commands: a reader who typed `today` may have meant the command or
 * may have meant the word, and a door that appeared only when nothing else
 * matched would be a door you cannot learn.
 */
export const searchItem = (
  query: string,
  /** Where the reader is standing — the FOCUSED pane's route, which is what
   *  decides whether there is a box to hand this to (`../routes.ts`'s
   *  `narrowable`). */
  here: Route,
): PaletteItem | null => {
  const words = query.trim()
  if (words === "") return null
  const onPage = narrowable(here)
  return {
    id: "search-handoff",
    label: onPage ? `Search this page for “${words}”` : `Search everywhere for “${words}”`,
    hint: onPage ? "the filter box" : "/search",
    action: { kind: "search", query: words, here: onPage ? "page" : "everywhere" },
    taking: atOnce,
    // Never filtered against itself: this row IS the query.
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
 * It is also the one place the two prefixes are compared, so their order is
 * stated once: `>` is tried first, and a line beginning `>` is a message even
 * if it goes on to mention a `+`.
 */
export type Mode =
  /** No prefix: the rest is a filter over the rows. */
  | { readonly kind: "filter" }
  /** `>` — the rest goes to the agent. */
  | { readonly kind: "ask"; readonly text: string }
  /** `+` — the rest becomes a node in the inbox. */
  | { readonly kind: "capture"; readonly text: string }

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

/** What the box is doing, from the two things that decide it: the question
 *  that is up, if any, and the words in it. */
export const boxOf = (raw: string, question: Asking | null): Box =>
  question === null ? modeOf(raw) : { kind: "answering", question }

export const modeOf = (raw: string): Mode => {
  const asked = afterPrefix(raw, ASK_PREFIX)
  if (asked !== null) return { kind: "ask", text: asked }
  const captured = afterPrefix(raw, CAPTURE_PREFIX)
  if (captured !== null) return { kind: "capture", text: captured }
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

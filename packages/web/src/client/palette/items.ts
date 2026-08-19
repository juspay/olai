/**
 * The palette SHELL's catalogue: navigation, panel toggles, ask-the-agent —
 * and the shape a NODE takes when search answers with one.
 *
 * The OP rows are next door (`./ops.ts`), because what a verb is and which of
 * them apply is the `•••` menu's answer and not a second list; the DOCUMENT
 * rows are next door the other way (`./documents.ts`), because which files the
 * directory serves is the served list's answer and not a second list either.
 * Node hits
 * arrive from the server's search procedure (Palette.tsx asks it as you type)
 * rather than from a matcher of this file's own: the browser holds every node
 * and could grep them, and deliberately does not, because the palette and an
 * agent's `search_nodes` must be one reading (`@olai/surface`'s search.ts has
 * the argument).
 *
 * TWO PREFIXES take the box away from the list, and they are the same idea
 * twice: `>` sends the rest to the agent, `+` captures the rest as a node.
 * Both are a LINE OF TEXT rather than a row to choose, which is what a prefix
 * is for — a row can only carry what it was built holding, and neither of
 * these knows what it is going to say until somebody types it. What the box is
 * doing is therefore ONE value ({@link Mode}) rather than one nullable string
 * per prefix.
 */

import type { BodyKind } from "@olai/format"
import type { Edit, SearchHit } from "@olai/surface"

import { HOME_ROUTE, type Route } from "../routes.ts"
import type { NodeProp } from "../search/props.ts"
import { hitRow } from "../search/row.ts"

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

export interface PaletteItem {
  /** Unique in the list, and — for the rows that are not commands — PREFIXED
   *  by what the row is about: `node-<id>` for a search hit, `doc-<path>` for
   *  a served file (`./documents.ts`). That prefix is a contract with a
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
   * Only a document row carries one (`./documents.ts`). A command is not a
   * file, and a node hit is a row INSIDE one — the file it lives in is already
   * said, in words, on its place line.
   */
  readonly of?: BodyKind
  readonly action: PaletteAction
  /** Lowercase haystack for simple substring filter. */
  readonly search: string
}

/** The character that turns the box into an agent message. */
const ASK_PREFIX = ">"

/** The character that turns the box into a capture. `+` because that is what
 *  the gesture is — one more line — and because it is a character a title does
 *  not start with often enough to matter, which is the same bet `>` makes. */
export const CAPTURE_PREFIX = "+"

export const SHELL_ITEMS: ReadonlyArray<PaletteItem> = [
  {
    id: "nav-home",
    label: "Go home",
    hint: "open the first outline",
    action: { kind: "route", route: HOME_ROUTE },
    search: "go home outline first",
  },
  {
    id: "nav-today",
    label: "Go to today",
    hint: "journal for this day",
    action: { kind: "route", route: { kind: "today" } },
    search: "go to today journal day calendar",
  },
  {
    id: "nav-agenda",
    label: "Go to the agenda",
    hint: "what is due",
    action: { kind: "route", route: { kind: "agenda" } },
    search: "go to agenda due overdue upcoming owed",
  },
  {
    id: "nav-trash",
    label: "Go to the Trash",
    hint: "what was put away",
    action: { kind: "route", route: { kind: "trash" } },
    search: "go to trash archive archived put away restore put back",
  },
  {
    id: "panel-sidebar",
    label: "Toggle sidebar",
    hint: "⌘\\",
    action: { kind: "toggle-sidebar" },
    search: "toggle sidebar panel rail directory",
  },
  {
    id: "panel-chat",
    label: "Toggle agent panel",
    hint: "⌘J",
    action: { kind: "toggle-chat" },
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
    search: "capture inbox add quick note new node jot",
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    hint: "every key",
    action: { kind: "shortcuts" },
    search: "keyboard shortcuts keys help reference bindings",
  },
  {
    id: "reset-widths",
    label: "Reset panel widths",
    hint: "defaults",
    action: { kind: "reset-widths" },
    search: "reset panel widths sidebar chat default size",
  },
  {
    id: "close-pane",
    label: "Close pane",
    hint: "⌘⇧W",
    action: { kind: "close-pane" },
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
export const hitItem = (hit: SearchHit): PaletteItem => {
  const row = hitRow(hit)
  return {
    id: `hit-${row.id}`,
    label: row.label,
    ...(row.of === undefined ? {} : { of: row.of }),
    place: row.place,
    props: row.props,
    action: { kind: "route", route: row.route },
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

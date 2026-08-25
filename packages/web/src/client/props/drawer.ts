/**
 * What the properties drawer DRAWS — which lines, in what order, as what text.
 *
 * A pure function with a unit test, on purpose: the drawer is a few decisions
 * and a run of chips, and the decisions are the kind that go quietly wrong
 * inside a component. WHAT A VALUE OPENS is the other half of the same
 * arrangement and lives beside this one (`./door.ts`) — this file decides which
 * chips there are and what each says; that one decides where a click on one
 * goes.
 *
 * ## Two halves, and the difference between them is who may write
 *
 * The SYSTEM lines come first and are read-only: the node's id, the mark it
 * carries, its date, and the stamps when it has them. Every one of those is a
 * field with a verb of its own (`set_done`, `set_date`) or nothing's to write
 * at all (`id`, `created`, `changed`), so the drawer shows them and offers
 * nothing — `set_prop` would be refused for each of them by name, and an
 * affordance that leads to a refusal is worse than none.
 *
 * They are here because a reader wants them: the id is what every tool call and
 * every `((` reference takes, and it was previously readable nowhere on the
 * page. That is the ruling this file was rewritten for.
 *
 * The CUSTOM lines follow, in the FILE's own order, and those are the writable
 * ones ({@link customEntries} argues that order).
 *
 * ## What is NOT in the system half
 *
 * `see` and `after` are drawn as reference rows under the note, `desc` is the
 * note, `doc` is the document line, `title` is the row. Repeating any of them
 * here would put two spellings of one fact on one screen, and the second one
 * would be the dumb one. What is in the system half is exactly the facts that
 * have nowhere else to show.
 */

import {
  type Custom,
  customOf,
  customOrder,
  type RegularNode,
  storedMarker,
} from "@olai/format"

/** One chip of the run. */
export interface Entry {
  readonly key: string
  /**
   * What it says, as ONE string — a list joined by commas, exactly as it has
   * always been drawn.
   *
   * Beside {@link Entry.values} rather than derived from it at each reader,
   * because the two have different readers and only one of them can spend the
   * members: a SEARCH ROW draws a hit's properties as one truncating line
   * (`../search/props.ts`) and asks nothing about what a value names, while the
   * run draws a door per member. One entry answers both, and neither has to
   * know how the other spells a list.
   */
  readonly value: string
  /**
   * ...and its MEMBERS, which is one element for a value that is text.
   *
   * The door rule is asked per member (`./door.ts`): `{"reviewer":["pi","grok"]}`
   * is two facts, and drawing one of them as a link and the other as text
   * because they arrived joined would be the display inventing a difference the
   * record does not have.
   */
  readonly values: ReadonlyArray<string>
  /** A fact the record carries in a field of its own: drawn, never edited. */
  readonly system: boolean
  /**
   * A custom key holding a LIST rather than text — hand-written, since
   * `set_prop` writes only text.
   *
   * DRAWN like any other chip (it is what the node says), each member asked the
   * door question on its own, and OPENED like any other chip. What differs is
   * only what the two gestures inside it mean, and it is worth saying plainly:
   *
   *   - CLEARING it removes the key, exact whatever it held. That is the whole
   *     of why the chip opens at all.
   *   - TYPING OVER it replaces the list with the text typed — one key, one
   *     value, which is what `set_prop` does. There is no way to write a list
   *     back, so a member cannot be edited in place; the file is where a list
   *     is written.
   *
   * Committing it UNCHANGED writes nothing (`./editor.ts`'s `writes`), so a
   * list cannot be flattened by opening a chip and pressing Enter — flattening
   * takes deliberately typing over it.
   *
   * This line used to say a list was "not offered for EDITING" with "removal
   * still offered", which described the deleted `•••` menu (an `Edit <key>…`
   * for text and a `Remove <key>` for everything) and stopped being true when
   * the chip became the one door: excluding the chip took the removal with the
   * edit and left this comment claiming a gesture nothing offered (pi, S3).
   */
  readonly listed: boolean
}

/**
 * The node's own facts, in the order a reader wants them: what it IS, then
 * where it stands, then when it was touched.
 *
 * The mark is one line rather than two, holding both of what the field holds —
 * `done` for a bare `true`, `done 2026-08-01` when it says when. The record has
 * one field carrying two facts, and splitting them here would be this drawer
 * inventing a shape the format does not have.
 */
export const systemEntries = (node: RegularNode): ReadonlyArray<Entry> => {
  const out: Array<Entry> = [said("id", node.id)]
  const mark = storedMarker(node)
  if (mark !== undefined) {
    const held = node[mark]
    out.push(said("status", typeof held === "string" ? `${mark} ${held}` : mark))
  }
  if (node.date !== undefined) out.push(said("date", node.date))
  // The stamps, when the node has them. Absent is the ordinary state of a node
  // written before olai stamped anything, and nothing is invented for it: the
  // drawer says what the record says.
  for (const stamp of ["created", "changed"] as const) {
    const held = node[stamp]
    if (held !== undefined) out.push(said(stamp, held))
  }
  return out
}

/** One system line: text, never a list, never editable. Written once rather
 *  than five times with three constant fields each. */
const said = (key: string, value: string): Entry => ({
  key,
  value,
  values: [value],
  system: true,
  listed: false,
})

/**
 * The keys `set_prop` owns, in the FILE's own order (`@olai/format`'s
 * `customOrder`) — so what is on screen is what is on disk, and nothing
 * re-sorts itself under the reader after a reload.
 *
 * FILE ORDER, NEVER ALPHABETICAL, and the two are not the same sentence even
 * though they usually agree. A record olai wrote is alphabetical on disk
 * because the WRITER canonicalises (`customKeys`, and the byte-equality that
 * rests on it); a record a hand or an agent wrote by editing the file holds its
 * keys in whatever order the person thought about them in — `agent`, `brief`,
 * `worktree` — and the parse keeps that order all the way here. Sorting at the
 * draw would take the author's order away in the one case where there is one,
 * to no gain in the case where there is not.
 *
 * TAKES THE MAP, not a thing carrying one, which is the same move
 * `@olai/format`'s `propKeyOf` and `propsOf` make one layer down and for the
 * identical reason: there are two kinds of thing with an open map now — a
 * record's `custom` and a document's frontmatter (`Face.props`) — and a
 * function that took a CARRIER would either need two of itself or a
 * `{ custom: … }` wrapper minted at the call site to lie about which one this
 * is. The rule that a list value is drawn as its members joined lives here,
 * once, and both kinds spend it.
 */
export const customEntries = (custom: Custom): ReadonlyArray<Entry> => {
  return customOrder(custom).flatMap((key) => {
    const value = custom[key]
    if (value === undefined) return []
    const listed = typeof value !== "string"
    const values = listed ? value : [value]
    return [{ key, value: values.join(", "), values, system: false, listed }]
  })
}

export const drawerEntries = (node: RegularNode): ReadonlyArray<Entry> => [
  ...systemEntries(node),
  ...customEntries(customOf(node)),
]

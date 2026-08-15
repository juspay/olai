/**
 * What the properties drawer DRAWS — which lines, in what order, as what text.
 *
 * A pure function with a unit test, on purpose: the drawer is a few decisions
 * and a grid, and the decisions are the kind that go quietly wrong inside a
 * component.
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
 * The CUSTOM lines follow, alphabetically, and those are the writable ones.
 *
 * ## What is NOT in the system half
 *
 * `see` and `after` are drawn as reference rows under the note, `desc` is the
 * note, `doc` is the document line, `title` is the row. Repeating any of them
 * here would put two spellings of one fact on one screen, and the second one
 * would be the dumb one. What is in the system half is exactly the facts that
 * have nowhere else to show.
 */

import { customKeys, customOf, type RegularNode, storedMarker } from "@olai/format"

/** One line of the drawer. */
export interface Entry {
  readonly key: string
  readonly value: string
  /** A fact the record carries in a field of its own: drawn, never edited. */
  readonly system: boolean
  /**
   * A custom key holding a LIST rather than text — hand-written, since
   * `set_prop` writes only text.
   *
   * Drawn (it is what the node says) and not offered for EDITING, because the
   * editor writes text: a key holding three values would come back as one
   * string with commas in it. Removal is still offered — taking a key off is
   * exact whatever it held.
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
  const out: Array<Entry> = [{ key: "id", value: node.id, system: true, listed: false }]
  const mark = storedMarker(node)
  if (mark !== undefined) {
    const held = node[mark]
    out.push({
      key: "status",
      value: typeof held === "string" ? `${mark} ${held}` : mark,
      system: true,
      listed: false,
    })
  }
  if (node.date !== undefined) {
    out.push({ key: "date", value: node.date, system: true, listed: false })
  }
  // The stamps, when the node has them. Absent is the ordinary state of a node
  // written before olai stamped anything, and nothing is invented for it: the
  // drawer says what the record says.
  for (const stamp of ["created", "changed"] as const) {
    const held = node[stamp]
    if (held !== undefined) {
      out.push({ key: stamp, value: held, system: true, listed: false })
    }
  }
  return out
}

/** The keys `set_prop` owns, alphabetically — the FILE's own order
 *  (`@olai/format`'s `customKeys`), so what is on screen is what is on disk and
 *  nothing re-sorts itself under the reader after a reload. */
export const customEntries = (node: RegularNode): ReadonlyArray<Entry> => {
  const custom = customOf(node)
  return customKeys(custom).flatMap((key) => {
    const value = custom[key]
    if (value === undefined) return []
    return [
      typeof value === "string"
        ? { key, value, system: false, listed: false }
        : { key, value: value.join(", "), system: false, listed: true },
    ]
  })
}

export const drawerEntries = (node: RegularNode): ReadonlyArray<Entry> => [
  ...systemEntries(node),
  ...customEntries(node),
]

/** Is this value something to open in a browser? Narrow on purpose: a value is
 *  text and nothing here parses it, so what becomes a link is what
 *  unambiguously already is one. */
export const isLink = (value: string): boolean =>
  value.startsWith("https://") || value.startsWith("http://")

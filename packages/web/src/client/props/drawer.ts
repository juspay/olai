/**
 * What the properties drawer DRAWS — which of a node's properties a person
 * sees, in what order, and as what text.
 *
 * A pure function with a unit test, on purpose: the drawer is two decisions and
 * a grid, and both decisions are the kind that go quietly wrong in a component.
 *
 * ## Which keys
 *
 * The ones olai does NOT read — exactly the keys `set_prop` owns
 * (`@olai/format`'s `isSystemKey`). Every system key is already drawn on the
 * row by something that knows what it means: `status` is the checkbox, `since`
 * is the tone the checkbox takes, `date` is the pill, `see` and `after` are the
 * references under the note. A drawer that listed them again would put two
 * spellings of one fact on one line — and the second one would be the dumb one,
 * a `status doing` in mono type beside a checkbox that already says so.
 *
 * That rule is also what keeps the drawer and its `•••` entries honest with
 * each other: what is drawn is what can be edited, because the same predicate
 * decides both, and a line a person could not change would be a line they would
 * try to.
 *
 * ## In what order
 *
 * The FILE's own order (`canonicalKeys`), which for user keys is alphabetical.
 * The prototype kept insertion order and this deliberately does not: a record's
 * key order on disk is canonical so that two files meaning the same thing are
 * byte for byte the same (`@olai/format`'s `props.ts`), so "the order it was
 * added in" is not a fact the file remembers — a node read back after a reload
 * would re-order itself under the reader. What is on screen is what is in the
 * file, which is the one order that cannot surprise anybody.
 */

import { canonicalKeys, isSystemKey, type RegularNode } from "@olai/format"

/** One line of the drawer: the key as written, and the value as text. */
export interface Entry {
  readonly key: string
  readonly value: string
  /**
   * A value that is a LIST rather than text — hand-written, since `set_prop`
   * writes only text and every list-shaped key olai reads is refused by it.
   *
   * Drawn (it is what the node says) and not offered for EDITING, because the
   * editor writes text: a key holding three ids would come back as one string
   * with commas in it, which is the silent flattening a migration would refuse.
   * Removal is still offered — taking a key off is exact whatever it held.
   */
  readonly listed: boolean
}

export const drawerEntries = (node: RegularNode): ReadonlyArray<Entry> => {
  const props = node.props
  if (props === undefined) return []
  return canonicalKeys(props).flatMap((key) => {
    if (isSystemKey(key)) return []
    const value = props[key]
    if (value === undefined) return []
    return [
      typeof value === "string"
        ? { key, value, listed: false }
        : { key, value: value.join(", "), listed: true },
    ]
  })
}

/** Is this value something to open in a browser? The prototype's rule, and the
 *  narrow one on purpose: a value is text and nothing here parses it, so what
 *  becomes a link is what unambiguously already is one. */
export const isLink = (value: string): boolean =>
  value.startsWith("https://") || value.startsWith("http://")

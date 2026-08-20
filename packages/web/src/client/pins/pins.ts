/**
 * WHAT IS ON THE SHELF, read off the directory.
 *
 * ## A pin is an ADDRESS, and that is the whole storage design
 *
 * The three things a reader wants a door to — a node, a document, the page they
 * have narrowed with a query — have exactly one thing in common: each of them
 * is a PLACE IN THIS APP, and this app already has one spelling of those. That
 * spelling is `../routes.ts`, a bijection with a test standing over it, and it
 * is the only vocabulary here in which "the agenda, filtered to what is
 * overdue" is a sayable thing at all.
 *
 * So a pin is an ordinary node in an ordinary outline whose TITLE is an
 * address. Three shapes were considered and two were rejected on the format's
 * own arguments:
 *
 *   - **a new field** (`{"title":"Overdue","at":"/agenda?q=…"}`) is the shape
 *     the format would give a fact it means to declare, and it costs a field
 *     every node may carry that exactly one view reads, plus an op on both
 *     faces to write it. A field only the shelf understands is a field the
 *     tree, the search grammar and `read_node` would each have to say nothing
 *     about.
 *   - **a `custom` key** costs nothing to write (`set_prop` is already there)
 *     and costs the one sentence that makes `custom` a namespace at all:
 *     *nothing in olai reads a key in here* (docs/format.md's Properties). A
 *     key olai reads is a system field with none of a system field's
 *     guarantees — unvalidated, untyped, and colliding with whatever the
 *     person who owns that namespace happens to call theirs.
 *   - **a mirror** is the format's word for pointing a curated list at a node,
 *     and it is the right word for a list of NODES. A shelf is not one: half
 *     its entries are not nodes, and a mirror means *draw it here too* — so
 *     `Pins.olai` would hold every pinned node's whole subtree, which is a
 *     second copy of the tree rather than a row of doors. A pin says GO THERE.
 *
 * What the chosen shape buys is that pinning grew no verb on the agent's face:
 * `add_node` pins, `move_node` reorders, `trash_node` unpins, and
 * `read_subtree` reads the shelf. The one verb the BROWSER grew (`pin`) resolves
 * to the `add` an agent would have sent — it exists so a tab does not have to
 * work out which file the shelf is (`@olai/surface`'s `edit.ts`).
 *
 * ## And a pin may be NAMED
 *
 * A bare address is the ordinary case and the only one this app writes, because
 * every address already has a name somebody can derive from the set
 * (`../address/address.ts`) — a node's own live title, a file's name, the word
 * *Agenda*. A copy of that name stored beside the address would be the second
 * answer the format spends its whole mirror argument avoiding: rename the node
 * and the shelf would go on saying what it said.
 *
 * A markdown link — `[Overdue](/agenda?q=is%3Atodo)` — is the other case, and
 * it is a NAME rather than a copy: somebody wrote it, nothing derived it, and
 * nothing will disagree with it later. Titles are inline markdown in this
 * format already (docs/format.md's Fields), so `Pins.olai` opened as an
 * ordinary outline draws it as an ordinary link.
 *
 * ## WHAT COUNTS AS A DOOR IS NOT THIS MODULE'S ANY MORE
 *
 * `../address/address.ts` owns it, and the move is the maintainer's finding
 * read structurally: the shelf resolved its rows and `Pins.olai`'s own page
 * drew the raw address, which is one title with two answers. The rule was the
 * shelf's while the shelf was its only reader; the outline is the second, so
 * the rule moved to where both can read it and this module kept what is
 * genuinely about a SHELF — which file it is, which rows of it are pins, and
 * whether a given page is already on it.
 *
 * Everything here is pure over the indexes, so what counts as a pin is decided
 * in a unit test rather than in a sidebar.
 */

import { type Derived, isMirror, type Node, pinsIn, siblingsOf } from "@olai/format"

import { addressIn, labelIn } from "../address/address.ts"
import { hrefOf, type Route } from "../routes.ts"

/** One door on the shelf: the node that IS the pin, and where it goes. */
export interface Pin {
  /** The pin NODE's own id — what an unpin archives and what a reorder moves.
   *  Never the id of whatever the address names: the shelf's rows are the
   *  shelf's own records. */
  readonly id: string
  /** Where it goes. Parsed once, here, so nothing downstream re-reads a
   *  title. */
  readonly route: Route
  /** The name somebody GAVE this pin, or `undefined` for the ordinary bare
   *  address — in which case the shelf derives one (`./name.ts`). */
  readonly named: string | undefined
}

/** One record of the shelf as a pin, or `undefined` when it is not one — a
 *  mirror (which carries no title at all), or a row whose title says something
 *  other than a place. Such a row is left alone rather than drawn: `Pins.olai`
 *  is an ordinary outline, and a heading or a note in it is a thing somebody
 *  may write. */
const pinOf = (node: Node): Pin | undefined => {
  if (isMirror(node)) return undefined
  const route = addressIn(node.title)
  return route === undefined
    ? undefined
    : { id: node.id, route, named: labelIn(node.title) }
}

/**
 * The shelf, in the order it is drawn — empty when the directory has no
 * `Pins.olai`, when the file holds nothing, and while the first frame is still
 * arriving.
 *
 * THE TOP LEVEL ONLY, and that is a rule rather than a shortcut: a shelf is a
 * flat row of doors, so what is nested under a pin is that pin's business
 * (notes about it, a checklist) and not a second row in the sidebar. The order
 * is the outline's own — `ord`, the sort every other reading of a file uses —
 * so a drag on the shelf is the same `move_node` a drag in the tree is.
 */
export const pinsOf = (derived: Derived | undefined): ReadonlyArray<Pin> => {
  if (derived === undefined) return []
  const file = pinsIn([...derived.byFile.keys()])
  if (file === undefined) return []
  return siblingsOf(derived, file, undefined).flatMap((located) => {
    const pin = pinOf(located.node)
    return pin === undefined ? [] : [pin]
  })
}

/**
 * The pin that already stands for this page, or `undefined` — what every door
 * onto the shelf draws its label from, so "Pin" and "Unpin" are one control
 * reading one answer.
 *
 * OVER THE INDEXES rather than over a list of pins, because that is what every
 * caller has: the `•••` menu, the ⌘K row and the chord each hold the app's one
 * derivation and nothing else, and a version taking the list had exactly one
 * consumer — a wrapper, one module over, that read the shelf and handed it
 * straight back. Two names for one question is one too many.
 *
 * COMPARED THROUGH THE BIJECTION rather than as text, so a pin written
 * `?q=is:todo` by hand and the address a browser would mint for the same page
 * are one pin.
 */
export const pinnedAt = (
  derived: Derived | undefined,
  route: Route,
): Pin | undefined => {
  const address = hrefOf(route)
  return pinsOf(derived).find((pin) => hrefOf(pin.route) === address)
}

/**
 * WHAT IS ON THE SHELF, read off the SERVER'S ANSWER.
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
 * every address already has a name somebody can derive from it or from the set
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
 * ## WHERE THE SHELF COMES FROM, since PR 5 of `vault-in-browser`
 *
 * From the wire, whole: the `pins` cell carries the rows of `Pins.olai` in the
 * order they are drawn, each with the live name of whatever node it addresses,
 * re-answered on every published revision (`@olai/format`'s `shelfOf`). This
 * module used to walk the browser's copy of every outline to work that out —
 * find the shelf file among the paths, sort its top level, look each id up in
 * the vault-wide index — and that copy is what the design is taking away.
 *
 * WHAT IS LEFT HERE IS A PARSE, and the difference is the one the search door
 * draws (`../filter/asking.ts`): reading a title to see whether it names a page
 * of this app costs the title, where resolving it cost the vault. It stays in
 * the browser because it IS the browser's — which page an address opens, and
 * what a `?q=` on it means, is ruled to be view-time and this app's own
 * bijection (docs/format.md's Pins, the last paragraph). The server reads the
 * one half of a title that is a statement about the directory — the node an
 * address names — and hands the rest over as it found it.
 *
 * ## WHAT COUNTS AS A DOOR IS NOT THIS MODULE'S ANY MORE
 *
 * `../address/address.ts` owns it, and the move is the maintainer's finding
 * read structurally: the shelf resolved its rows and `Pins.olai`'s own page
 * drew the raw address, which is one title with two answers. The rule was the
 * shelf's while the shelf was its only reader; the outline is the second, so
 * the rule moved to where both can read it and this module kept what is
 * genuinely about a SHELF — which of the answered rows are doors, what each is
 * called, and whether a given page is already on it.
 *
 * Everything here is pure over the answer, so what counts as a pin is decided
 * in a unit test rather than in a sidebar.
 */

import type { Pinned, Shelf } from "@olai/surface"

import { addressIn, titleFace } from "../address/address.ts"
import { hrefOf, type Route } from "../routes.ts"

/** One door on the shelf: the node that IS the pin, where it goes, and what it
 *  is called. */
export interface Pin {
  /** The pin NODE's own id — what an unpin trashes and what a reorder moves.
   *  Never the id of whatever the address names: the shelf's rows are the
   *  shelf's own records. */
  readonly id: string
  /** Where it goes. Parsed once, here, so nothing downstream re-reads a
   *  title. */
  readonly route: Route
  /**
   * What this door is CALLED, as it is drawn — the name somebody WROTE on it,
   * or what its address is called: for a node, what the server says that node's
   * title is right now; for everything else, the address's own answer.
   *
   * RESOLVED ONCE, here, because three surfaces on this row read it — the
   * face, the row's tooltip and the unpin's label — and the RULE behind it is
   * one function over in `../address/address.ts`, which the outline's own rows
   * read too. It used to be spelled in the shelf component beside a comment
   * promising it matched what the face would draw.
   *
   * The written name is not kept beside it, and that is a fact about a SHELF
   * rather than an omission: a shelf row is a `<Link>` already, so its face is
   * never the anchor an authored name would make it (`../address/Face.tsx`) —
   * and nothing else here asks which of the two spellings a row was written in.
   */
  readonly name: string
}

/** One answered row as a pin, or `undefined` when it is not one — a row whose
 *  title says something other than a place. Such a row is left alone rather
 *  than drawn: `Pins.olai` is an ordinary outline, and a heading or a note in
 *  it is a thing somebody may write. (A MIRROR never reaches here: it carries
 *  no title to address with, and the reading leaves it out.) */
const pinOf = (row: Pinned): Pin | undefined => {
  const route = addressIn(row.title)
  if (route === undefined) return undefined
  // The other half of what `titleFace` answers — whether those words are
  // somebody's OWN — is dropped here, for the reason {@link Pin.name} gives.
  const { name } = titleFace(row.title, route, showing(route, row))
  return { id: row.id, route, name }
}

/**
 * The answered name, spent only where THIS parser agrees the row addresses
 * THAT node.
 *
 * The two sides read one title with two parsers, each reading its own half of
 * the seam, and the server's reading is the WIDER one by construction: it cannot
 * see the words this app claimed, so `/d/2026-08-20.olai#x` comes back with a
 * node on it while this parser reads a day (`./target.test.ts` pins both the
 * direction that holds and that case). This is the narrowing that makes the
 * difference harmless rather than a lie: a name is drawn on a door, and a name
 * for some other place is the one wrong thing a door can say. Where the two
 * agree — every spelling either of them mints — this is the answer; where they
 * do not, the row is drawn as the page THIS parser read, named the way a pin
 * with nothing to show has always been.
 */
const showing = (route: Route, row: Pinned): string | undefined => {
  const address = route.kind === "at" ? route.address : null
  return address !== null && address.kind === "node" && address.id === row.shows?.id
    ? row.shows.name
    : undefined
}

/**
 * The shelf, in the order it is drawn — empty when the directory has no
 * `Pins.olai`, when the file holds nothing, and while the first frame is still
 * arriving.
 *
 * The ORDER and the ROWS are the answer's (`ord`, the sort every other reading
 * of a file uses — so a drag on the shelf is the same `move_node` a drag in the
 * tree is). What this adds is the reading of each title, which is why the list
 * can be shorter than the answer: a row that names no page of this app is not
 * a door.
 */
export const pinsOf = (shelf: Shelf): ReadonlyArray<Pin> =>
  shelf.flatMap((row) => {
    const pin = pinOf(row)
    return pin === undefined ? [] : [pin]
  })

/**
 * The pin that already stands for this page, or `undefined` — what every door
 * onto the shelf draws its label from, so "Pin" and "Unpin" are one control
 * reading one answer.
 *
 * OVER THE ANSWER rather than over a list of pins, because that is what every
 * caller has: the `•••` menu, the ⌘K row and the chord each hold the shelf the
 * server sent and nothing else, and a version taking the parsed list had
 * exactly one consumer — a wrapper, one module over, that read the shelf and
 * handed it straight back. Two names for one question is one too many.
 *
 * COMPARED THROUGH THE BIJECTION rather than as text, so a pin written
 * `?q=is:todo` by hand and the address a browser would mint for the same page
 * are one pin.
 */
export const pinnedAt = (shelf: Shelf, route: Route): Pin | undefined => {
  const address = hrefOf(route)
  return pinsOf(shelf).find((pin) => hrefOf(pin.route) === address)
}

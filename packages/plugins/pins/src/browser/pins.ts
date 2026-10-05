import type { Workspace } from "olai-plugin-navigation/workspace"
/** Parse the server's shelf into page and workspace targets. Titles are either
 * bare addresses (named live by the target) or authored Markdown links.
 * Compatibility rewrites belong to the one-time server migration; this reader
 * gives /#id exactly the same reveal meaning as every other surface. */

import { addressWritten } from "@olai/format"
import type { Pinned, Shelf } from "@olai/format"

import { targetIn,targetName,targetFace,type AddressTarget } from "olai-plugin-navigation/address/address.ts"
import type { Route } from "olai-plugin-navigation/routes"
import type { WorkspaceRouting as Routing } from "olai-plugin-navigation/workspace"

/** One door on the shelf: the node that IS the pin, where it goes, and what it
 *  is called. */
export interface Pin {
  /** The pin NODE's own id — what an unpin trashes and what a reorder moves.
   *  Never the id of whatever the address names: the shelf's rows are the
   *  shelf's own records. */
  readonly id: string
  /** Exact stored title when this pin was read. A rename must not overwrite
   *  a name or destination changed while its question was open. */
  readonly title: string
  /** Where it goes. Parsed once, here, so nothing downstream re-reads a
   *  title. */
  readonly target: AddressTarget
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
   * never the anchor an authored name would make it (`../address/Face.tsx`).
   */
  readonly name: string
  /**
   * The ADDRESS this row holds, exactly as the file spells it — which is not
   * `hrefOf(route)` and must not be replaced by it.
   *
   * A rename writes the row's title back ({@link ./naming.ts}), and the one
   * thing a rename must not change is where the door goes: a pin somebody
   * typed as `?q=is:todo` and the address this app would mint for the same page
   * are one pin through the bijection, and re-minting it would rewrite
   * somebody's file for a gesture that was about the NAME.
   */
  readonly at: string
  /**
   * What this door would be called with NOTHING written on it — the address's
   * own answer, live.
   *
   * It rides beside {@link name} because a rename has to say what taking the
   * name off would leave: the box that asks for one wears this as its
   * placeholder, so "Enter with nothing" is a thing the reader can see rather
   * than a promise about a word they cannot.
   */
  readonly bare: string
  /** Whether {@link name} is somebody's OWN words rather than the address's —
   *  which is the one thing a rename needs that the drawn name cannot say: a
   *  box that opened holding a DERIVED name would turn "keep it as it is" into
   *  a stored copy of a title that is supposed to stay live. */
  readonly written: boolean
}

/** One answered row as a pin, or `undefined` when it is not one — a row whose
 *  title says something other than a place. Such a row is left alone rather
 *  than drawn: `Pins.olai` is an ordinary outline, and a heading or a note in
 *  it is a thing somebody may write. (A MIRROR never reaches here: it carries
 *  no title to address with, and the reading leaves it out.) */
const pinOf = (routes: Routing, row: Pinned): Pin | undefined => {
  const target = targetIn(routes, row.title)
  if (target === undefined) return undefined
  const shows = (route: Route) => showing(route, row)
  const face = targetFace(routes, row.title, target, shows)
  return {
    id: row.id, title: row.title, target, at: addressWritten(row.title),
    ...face,
    bare: face.written ? targetName(routes, target, shows) : face.name,
  }
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
  if (address === null || row.shows === undefined) return undefined
  // A ROW names the node too (`/house.olai#install` is what a hand writes)
  // and draws its live name exactly as the bare spelling would: the id half
  // is what moves survive, wherever the pin's file half went stale.
  return (address.kind === "node" || address.kind === "row") && address.id === row.shows.id
    ? row.shows.name
    : undefined
}

/**
 * The shelf, in the order it is drawn — empty when the directory has no
 * `Pins.olai`, when the file holds nothing, and while the first frame is still
 * arriving.
 *
 * The ORDER and the ROWS are the answer's (`ord`, the sort every other reading
 * of a file uses — so a drag on the shelf is the same `outlines_move` a drag in the
 * tree is). What this adds is the reading of each title, which is why the list
 * can be shorter than the answer: a row that names no page of this app is not
 * a door.
 */
export const pinsOf = (
  /** The app's URL grammar, HANDED IN — reading a shelf row's title means
   *  parsing an address, and a plugin's URL is a question about the mounted
   *  roster (`olai-plugin-navigation/routes`' `Routing`). A door that reached
   *  for it would be this contract holding another activation's live state,
   *  which is what the Cordis audit's §12 refuses. */
  routes: Routing,
  shelf: Shelf,
): ReadonlyArray<Pin> =>
  shelf.flatMap((row) => {
    const pin = pinOf(routes, row)
    return pin === undefined ? [] : [pin]
  })

/**
 * The pin that already stands for this page, or `undefined` — what every door
 * onto the shelf draws its label from, so "Pin" and "Unpin" are one control
 * reading one answer.
 *
 * OVER THE ANSWER rather than over a list of pins, because that is what every
 * caller has: the `•••` menu and the ⌘K row each hold the shelf the
 * server sent and nothing else, and a version taking the parsed list had
 * exactly one consumer — a wrapper, one module over, that read the shelf and
 * handed it straight back. Two names for one question is one too many.
 *
 * COMPARED THROUGH THE BIJECTION rather than as text, so a pin written
 * `?q=is:todo` by hand and the address a browser would mint for the same page
 * are one pin.
 */
export const pinnedAt = (routes: Routing, shelf: Shelf, route: Route): Pin | undefined => {
  const address = routes.href(route)
  return pinsOf(routes, shelf).find((pin) => pin.target.kind === "page" && routes.href(pin.target.route) === address)
}


export const pinnedLayout = (routes: Routing, shelf: Shelf, workspace: Workspace): Pin | undefined =>
  pinsOf(routes, shelf).find((pin) => pin.target.kind === "layout"
    && routes.layoutHref(pin.target.workspace) === routes.layoutHref(workspace))

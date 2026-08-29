/**
 * WHERE INSIDE A PAGE AN ARRIVAL LANDS — the value, and every rule about it
 * that can be stated without a browser.
 *
 * An address that names a place inside a page — `/notes/beds.md#slats`,
 * `/saved/report.html#totals`, `/house.olai#install` — asks to arrive THERE, and
 * that ask is an ACT: it
 * happens once, on arrival, and never again. What performs one is a face (the
 * markdown body scrolls to a heading; the `.html` preview puts the fragment on
 * the frame's own URL and then follows the frame's report of where the anchor
 * ended up; the outline unfolds the chain to the row and selects it —
 * `./OutlinePage.tsx`); what this module holds is the WORD — whose arrival it
 * is, and whether it has happened.
 *
 * A MODULE OF ITS OWN rather than four helpers inside `./router.tsx`, and the
 * precedent is `./document/echo.ts`, which is here for the same reason: the
 * rule is arithmetic over values, this client has no harness that mounts a
 * router, and a rule reachable only by driving a browser is a rule nobody
 * checks the edges of. Held here it is a map and three functions with a unit
 * test beside it (`./landing.test.ts`), and the browser scenarios go on proving
 * the thing only a browser can — that a reader really ends up in front of the
 * section.
 *
 * PER PANE, which is the shape rather than a convenience. The address is a LIST
 * of routes (`./workspace.ts`) and any number of them may name a section, so a
 * landing is a fact about the pane that named one. Both directions of that
 * matter and each was a bug: a document in one pane must not treat a landing
 * aimed at the other as its own (two panes previewing two files was the whole
 * point of freeing the watch set), and a two-pane link whose panes BOTH name a
 * heading owes both of them their section — one slot for the workspace could
 * only ever pay the focused one.
 *
 * SPENDING IS A MARK AND NOT A CLEAR, which is the one thing here that looks
 * like an accident and is not. The `.html` preview builds the frame's own URL
 * out of the slug, so a landing that vanished when it was spent would change
 * that address and re-point the frame at the file for nobody's reason — the
 * very re-load the mark exists to stop. So a spent landing is a slug that is
 * still there to be READ and no longer anything to DO, and `./router.tsx`'s
 * `useLanding` hands a face those two answers separately.
 *
 * WHAT IS NOT HERE is when a landing is over. That is the READER's doing rather
 * than the address's — a face that goes on correcting where it put somebody
 * while its page is still settling stops the moment they have gone somewhere of
 * their own choosing — and it is measured in pixels by the face that performed
 * the act (`./document/Hypertext.tsx`, where the whole argument is). This
 * module keeps the word; the pixels are the surface's.
 *
 * Not `./drag/plan.ts`'s `Landing`, which is a different word for a different
 * thing: where a dragged row would come to rest.
 */

import type { Route } from "./routes.ts"
import { panesOf, type Workspace } from "./workspace.ts"

export interface Landing {
  /** WHICH PAGE the slug is a place inside. A pane is one address at a time
   *  and this is the file that address names, so a face still drawn from the
   *  page being LEFT — every navigation has a frame of both on screen — can
   *  tell that the arrival it is being told about is not its own. Without it
   *  a `.html` preview re-pointed its frame on its way out, at a section of
   *  the page replacing it, which cost a fetch and a history entry: Back off
   *  such a page took two presses. */
  readonly file: string
  readonly at: string
  /** Whether the act has been performed. A spent landing is a slug that is
   *  still there to be read and no longer anything to do. */
  readonly spent: boolean
}

/** Every pane's landing, by pane index. A pane with no entry was not asked to
 *  land anywhere; a pane whose entry is spent was, and has arrived. */
export type Landings = ReadonlyMap<number, Landing>

/** Nobody is owed an arrival — what `popstate` and the verbs that RENUMBER the
 *  panes leave behind. Shared, because an empty map is a value. */
export const NOWHERE: Landings = new Map()

/** …and the answer a verb gives when it changed no pane's page at all: the
 *  landings it was handed. A NAME for it rather than a caller reading the
 *  signal back, because "nothing about the landings happened" is a statement a
 *  verb makes and not a line it can forget to write. */
export const asTheyWere = (all: Landings): Landings => all

/** Where inside a page an arrival LANDS — the page's own file and the
 *  element's own name, and nothing for an address that names a whole place.
 *  It is read off the address, which is the only thing that says it: a `#`
 *  after a body is a heading, and after an outline it is a ROW
 *  (`@olai/format`'s `address.ts`), so the grammar has already decided which
 *  of the two this is — and either element address carries the document it is
 *  an element OF, so there is nothing to look the file up in.
 *
 *  The BARE node is the one element address that is NOT a landing: `/#id` is
 *  the zoom permalink, the page that IS the node, and navigating there is an
 *  arrival at the page rather than inside one. */
export const landingOf = (route: Route): Landing | undefined => {
  const address = route.kind === "at" ? route.address : undefined
  if (address?.kind === "heading") {
    return { file: address.path, at: address.slug, spent: false }
  }
  if (address?.kind === "row") {
    return { file: address.path, at: address.id, spent: false }
  }
  return undefined
}

/** What a WHOLE ADDRESS is owed — one landing per pane that named a section,
 *  which is what a first paint and nothing else mints. A reload of a two-pane
 *  link is two arrivals happening at once, and the pane that happens to have
 *  focus is not the only one that asked. */
export const landingsOf = (workspace: Workspace): Landings => {
  const all = new Map<number, Landing>()
  panesOf(workspace).forEach((pane, index) => {
    const land = landingOf(pane.route)
    if (land !== undefined) all.set(index, land)
  })
  return all
}

/** The same landings with ONE pane's changed — minted, spent or gone. A pane's
 *  landing is only ever news about that pane, so this is how every verb that
 *  navigates says what it did without saying anything about the others.
 *
 *  THE SAME MAP BACK when there is nothing to say, which is not an economy: the
 *  signal these live on compares by identity, so a fresh empty map where
 *  nothing changed would wake every pane in the workspace to tell it so. */
export const marked = (
  all: Landings,
  index: number,
  land: Landing | undefined,
): Landings => {
  if (land === undefined && !all.has(index)) return all
  const next = new Map(all)
  if (land === undefined) next.delete(index)
  else next.set(index, land)
  return next
}

/**
 * SPEND one pane's landing: the act named by `{index, file, at}` has been
 * performed, and must not be performed again.
 *
 * NAMING WHAT IS BEING SPENT — the pane, the page and the place — so a landing
 * minted since is not spent by an act that was about the last one: an act is
 * scheduled a frame ahead (both performers scroll on the next animation frame),
 * and a navigation can arrive in between. The performer already knows whose
 * landing it read, which looks like the check `useLanding` has already made and
 * is not: that one asked whose it is NOW, and the gap between the two is
 * exactly what this refuses.
 *
 * The same map back when there is nothing to spend, for {@link marked}'s
 * reason.
 */
export const spent = (
  all: Landings,
  index: number,
  file: string,
  at: string,
): Landings => {
  const land = all.get(index)
  if (land === undefined || land.spent) return all
  if (land.file !== file || land.at !== at) return all
  return marked(all, index, { ...land, spent: true })
}

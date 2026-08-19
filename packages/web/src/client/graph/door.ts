/**
 * The ways IN to the drawing: where each goes, and what each is called.
 *
 * There are three, and they are on three surfaces that never meet — a row's
 * `•••` (`../menu/actions.ts`), the zoomed page's own control
 * (`./GraphLink.tsx`) and the directory column (`../Sidebar.tsx`). Two of them
 * open the same page and said the same words in two places for a release, which
 * is the fragmentation `../backlinks/way.ts` and `../edges/relation.ts` both
 * exist to have stopped one relation over: what a door is CALLED is a fact
 * about where it goes, and a copy per surface is a rename that leaves two of
 * them saying the old thing with everything still compiling.
 *
 * TWO LABELS and not one, because they name two different readings: a node's
 * own neighbourhood, and the whole graph. The directory column can only offer
 * the second — it belongs to no file, which is why it sits beside the Trash —
 * and a node's page can only offer the first.
 *
 * PURE, and a `.ts` rather than an export off the component: the menu catalog
 * is a plain module with a unit test, and reaching into a `.tsx` for a string
 * would pull a JSX runtime in behind it (`../ref.ts`'s own reason).
 */

import type { Route } from "../routes.ts"

/** What the door onto ONE node's neighbourhood is called, on either surface
 *  that offers it. */
export const GRAPH_AROUND = "Reference graph"

/** ...and what the door onto the whole of it is called, where the directory is
 *  listed. Shorter, because the column's entries are one word each and what
 *  distinguishes it there is that it is not a file. */
export const WHOLE_GRAPH = "Graph"

/** Where the first one goes. It spells the id it was GIVEN and lets the address
 *  resolve it, exactly as `Zoom in` does: `/graph/<id>` follows a mirror's chain
 *  the way `/n/<id>` does (`../page.ts`), so a placement and the node it stands
 *  for open one graph rather than two. */
export const graphAround = (id: string): Route => ({ kind: "graph", focus: id })

/** ...and where the second goes — an address that names no node at all. */
export const WHOLE_GRAPH_ROUTE: Route = { kind: "graph", focus: null }

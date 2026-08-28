/**
 * THE SHELF THE SERVER ANSWERED, reachable from wherever a door onto it is
 * drawn.
 *
 * One subscription to the `pins` cell, one context over it. The cell carries
 * the rows of `Pins.olai` with every node address resolved, re-sent whenever a
 * published revision changes what it says (`@olai/format`'s `shelfOf`,
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` §6's item 5) — so there is nothing
 * to ask for here and no generation to ask on: the server is the one that knows
 * when the directory moved.
 *
 * A CONTEXT rather than a prop, for `../reading.tsx`'s reason: the readers are
 * scattered and none of them is near the sidebar. The shelf itself draws it,
 * the ⌘K row and the ⌘⇧P chord ask whether this page is on it
 * (`../palette/Palette.tsx`), and the `•••` of every row in a thousand-row tree
 * asks the same about the node it names (`../menu/verbs.ts`) — threading one
 * accessor through all of that would make every component's signature a
 * function of what one descendant needs.
 *
 * THE VALUE IS AN ACCESSOR, for that module's other reason: the answer is a
 * fresh array each time the shelf changes, and a context holding the rows
 * themselves would hand out the ones that were current when the app mounted.
 *
 * WHAT A DEAD WIRE DRAWS is the last answer that arrived, which is what the
 * connection pill already promises for everything else on screen ("what is on
 * screen is the last thing the server said") — and the reader is looking at it
 * through the offline overlay, which freezes the app while the wire cannot
 * carry a question (`../connection/Offline.tsx`, §5b's ruling). Nothing here
 * pretends, and nothing here is queued.
 */

import { createContext, type JSX, useContext } from "solid-js"

import { NO_PINS, type Shelf } from "@olai/surface"

import { olai } from "../wire.ts"

const ShelfContext = createContext<() => Shelf>()

export function PinsProvider(props: { readonly children: JSX.Element }) {
  const cell = olai.cells.pins.use()
  // BEFORE THE FIRST FRAME the shelf is empty, which is the same thing a
  // directory with no `Pins.olai` says and the same thing it draws: nothing.
  // A shelf cannot be "not known yet" to a reader — an empty column and a
  // column that has not heard look identical, so there is no third state to
  // give anybody.
  return (
    <ShelfContext.Provider value={() => cell.value() ?? NO_PINS}>
      {props.children}
    </ShelfContext.Provider>
  )
}

/** The shelf as the server last answered it, or a throw when a consumer is
 *  drawn outside the provider — which is a bug in this app, not a state a
 *  reader can reach. */
export const usePins = (): (() => Shelf) => {
  const shelf = useContext(ShelfContext)
  if (shelf === undefined) throw new Error("a pins lookup outside <PinsProvider>")
  return shelf
}

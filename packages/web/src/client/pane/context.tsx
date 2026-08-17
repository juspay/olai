/**
 * Which pane a component is drawn in.
 *
 * A `<Link>` inside a pane navigates THAT pane; one in the sidebar or the
 * palette navigates the focused pane. The difference is this context: it is
 * set around each pane's page and nowhere else, so a caller that is not
 * under a pane does not have to be told it is not.
 */

import { createContext, type JSX, useContext } from "solid-js"

export interface PaneHere {
  readonly index: number
}

const PaneContext = createContext<PaneHere>()

export function PaneProvider(props: {
  readonly index: number
  readonly children: JSX.Element
}) {
  // A STABLE value with a getter, not `{ index: props.index }` minted
  // each render. `useHere` captures the context object once; a new
  // object per focus change would leave it holding the index the pane
  // was born with, so a narrow-screen tab tap would light the tab and
  // leave the page, and a close would read a slot that is gone.
  const here: PaneHere = {
    get index() {
      return props.index
    },
  }
  return (
    <PaneContext.Provider value={here}>
      {props.children}
    </PaneContext.Provider>
  )
}

/** The pane this component is drawn in, or `undefined` for chrome that
 *  sits outside every pane (the sidebar, the palette, the header). */
export const usePane = (): PaneHere | undefined => useContext(PaneContext)

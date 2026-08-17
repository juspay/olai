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
  return (
    <PaneContext.Provider value={{ index: props.index }}>
      {props.children}
    </PaneContext.Provider>
  )
}

/** The pane this component is drawn in, or `undefined` for chrome that
 *  sits outside every pane (the sidebar, the palette, the header). */
export const usePane = (): PaneHere | undefined => useContext(PaneContext)

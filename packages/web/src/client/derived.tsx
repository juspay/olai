/**
 * The set's indexes, reachable from wherever a node is drawn.
 *
 * A node's `see` is a list of target ids; the link text is each target's
 * TITLE, which lives on another record and is resolved through the same
 * indexes the validator and the row walk already built. Threading `Derived`
 * through every row of a thousand-row tree to answer that would make every
 * component's signature a function of what one descendant needs — the same
 * reason documents and the router are contexts rather than props.
 *
 * The value is an ACCESSOR: the live store replaces the whole set each frame,
 * and a context holding the indexes themselves would hand out the ones that
 * were current when the page mounted.
 */

import type { Derived } from "@olai/format"
import { createContext, type JSX, useContext } from "solid-js"

const DerivedContext = createContext<() => Derived | undefined>()

export function DerivedProvider(props: {
  /** The app's one derivation of the loaded set. `undefined` only while the
   *  first frame is still arriving — nothing that needs indexes is drawn then. */
  readonly derived: Derived | undefined
  readonly children: JSX.Element
}) {
  return (
    <DerivedContext.Provider value={() => props.derived}>
      {props.children}
    </DerivedContext.Provider>
  )
}

/** The live indexes, or a throw when a consumer is drawn outside the provider
 *  — which is a bug in this app, not a state a reader can reach. */
export const useDerived = (): (() => Derived | undefined) => {
  const derived = useContext(DerivedContext)
  if (derived === undefined) {
    throw new Error("a derived lookup outside <DerivedProvider>")
  }
  return derived
}

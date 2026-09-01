/**
 * THE AGENTS ROSTER THE SERVER ANSWERED, reachable from wherever a face onto it
 * is drawn.
 *
 * One subscription to the `agents` cell, one context over it — `../pins/answered.tsx`'s
 * arrangement, for its reasons, and they hold harder here. The readers are
 * scattered and none of them is near the other: the sidebar's section draws the
 * whole roster, EVERY ROW of a thousand-row outline asks whether its node is on
 * it (the door), and the panel's header asks what the node it is bound to is
 * called. Threading one accessor through all of that would make every
 * component's signature a function of what one descendant needs.
 *
 * THE VALUE IS AN ACCESSOR, for that module's other reason: the answer is a
 * fresh array whenever the roster changes, and a context holding the rows
 * themselves would hand out the ones that were current when the app mounted.
 *
 * BEFORE THE FIRST FRAME the roster is empty, which is the same thing a
 * directory with no `agent` property anywhere says and the same thing it draws:
 * nothing. There is no third state to give anybody — an empty sidebar and a
 * sidebar that has not heard look identical.
 *
 * WHAT A DEAD WIRE DRAWS is the last answer that arrived, which is what the
 * connection pill already promises for everything else on screen, and the
 * reader is looking at it through the offline overlay.
 */

import { createContext, type JSX, useContext } from "solid-js"

import { type Agents, NO_AGENT_ROSTER } from "@olai/surface"

import { olai } from "../wire.ts"

const AgentsContext = createContext<() => Agents>()

export function AgentsProvider(props: { readonly children: JSX.Element }) {
  const cell = olai.cells.agents.use()
  return (
    <AgentsContext.Provider value={() => cell.value() ?? NO_AGENT_ROSTER}>
      {props.children}
    </AgentsContext.Provider>
  )
}

/** The roster as the server last answered it, or a throw when a consumer is
 *  drawn outside the provider — which is a bug in this app, not a state a
 *  reader can reach. */
export const useAgents = (): (() => Agents) => {
  const roster = useContext(AgentsContext)
  if (roster === undefined) throw new Error("an agents lookup outside <AgentsProvider>")
  return roster
}

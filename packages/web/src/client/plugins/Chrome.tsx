/**
 * WHAT THE PLUGINS HANG IN THE APP'S BAR — every manifest's header readout, in
 * registry order, and the app knows none of them by name.
 *
 * ## What this replaced
 *
 * One hand-written line in `../AppHeader.tsx`:
 *
 *     <Padi link={fleet.link()} pulse={fleet.pulse()} now={fleet.now} />
 *
 * ...with a paragraph above it explaining kolu's watcher to a reader of the
 * app's chrome. Three of those four words are an appliance's: the component, and
 * two of its facts read off a context the app had mounted for it. The app was
 * holding a plugin's data to draw a plugin's chip.
 *
 * Now the readout reads its OWN half (which its plugin mounted, once per tab)
 * and the app hands it the one thing that is genuinely the app's: the bar's
 * FURNITURE — the pill's geometry, the desktop breakpoint, the popover that
 * shares this bar's single focus cycle, and a door onto a served file
 * (`./furniture.tsx` argues each). What crosses the wall is the app's contract
 * and never the plugin's data.
 *
 * ## WHERE it sits in the cluster is still the app's decision
 *
 * `../AppHeader.tsx` places this component, and it places it where the padi pill
 * has always been: after the connection and before the Commit pill — "is this
 * page still reading", then whether this olai can see kolu's terminals, then "is
 * what is written to it kept". A plugin does not get to choose its seat in a bar
 * of four chips; what it gets is a seat.
 *
 * That is why every header is drawn HERE, in one place, in registry order,
 * rather than a slot per tenant: a second plugin with a readout arrives beside
 * the first with no edit to the bar, and if two of them ever needed a fixed
 * order relative to each other, the registry is where that order is written.
 *
 * ## Desktop-only is NOT decided here
 *
 * The pills leave the phone bar together and `AppHeader` already draws its
 * standing cluster inside a `desktop()` gate. A face is handed the same
 * predicate anyway (`AppFurniture.desktop`), because a readout that wants to
 * draw a phone face one day should not have to ask the bar for permission — and
 * because a plugin deciding the breakpoint FOR itself, out of its own media
 * query, would be a second answer to the app's own.
 */

import { For } from "solid-js"

import { FURNITURE } from "./furniture.tsx"
import { ROSTER } from "./roster.ts"

/** Every plugin's header readout, in registry order. A plugin that hangs none —
 *  which is most of them, and is not a lesser plugin — contributes nothing. */
export function PluginHeaders() {
  const headers = ROSTER.flatMap((plugin) => {
    const Header = plugin.chrome?.Header
    return Header === undefined ? [] : [Header]
  })
  return (
    <For each={headers}>
      {(Header) => <Header app={FURNITURE} />}
    </For>
  )
}

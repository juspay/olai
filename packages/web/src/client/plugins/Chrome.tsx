/**
 * WHAT THE PLUGINS HANG IN THE APP'S BAR — every readout in the `app.header`
 * slot, in mount order, and the app knows none of them by name.
 *
 * ## What this replaced
 *
 * One hand-written line in `../AppHeader.tsx`:
 *
 *     <Padi link={fleet.link()} pulse={fleet.pulse()} now={fleet.now} />
 *
 * ...with a paragraph above it explaining kolu's watcher to a reader of the
 * app's chrome. Three of those four words are an appliance's: the component,
 * and two of its facts read off a context the app had mounted for it. The app
 * was holding a plugin's data to draw a plugin's chip.
 *
 * ## WHERE it sits in the cluster is still the app's decision
 *
 * `../AppHeader.tsx` places this component, and it places it where the padi
 * pill has always been: after the connection and before the Commit pill — "is
 * this page still reading", then whether this olai can see kolu's terminals,
 * then "is what is written to it kept". A plugin does not get to choose its
 * seat in a bar of four chips; what it gets is a seat.
 *
 * That is why every header is drawn HERE, in one place, in mount order, rather
 * than a slot per tenant: a second plugin with a readout arrives beside the
 * first with no edit to the bar, and if two of them ever needed a fixed order
 * relative to each other, `olai.yml` is where that order is written.
 *
 * ## THE LICENCE IS GONE, and nothing replaced it
 *
 * This walk used to ask, per plugin, whether the serve had composed it — and
 * `undefined`, the roster not yet spoken, had to draw NOTHING rather than
 * everything, because a readout is a component of the plugin's and drawing it
 * mounts it and mounting it reads its plugin's half. On a serve that did not
 * compose the sibling, the padi pill drew its "no padi is running" arm: a
 * complaint about a daemon the operator deliberately turned off.
 *
 * There is nothing to ask now. A plugin the roster does not name has no fiber
 * in this tab, so it registered nothing, so this slot is empty of it — and it
 * is empty before the roster has spoken for the same reason, which is the state
 * the old gate had to be argued into.
 *
 * ## Desktop-only is NOT decided here
 *
 * The pills leave the phone bar together and `AppHeader` already draws its
 * standing cluster inside a `desktop()` gate. A face gets the same predicate
 * anyway (the `Bar` service's `desktop()`), because a readout that wants to draw a phone
 * face one day should not have to ask the bar for permission — and because a
 * plugin deciding the breakpoint FOR itself, out of its own media query, would
 * be a second answer to the app's own.
 */

import { createMemo, For } from "solid-js"
import { Dynamic } from "solid-js/web"

import { hung } from "./runtime.ts"

/** Every plugin's header readout, in mount order — for the plugins THIS SERVE
 *  COMPOSED, which is now the only kind of plugin this tab has. */
export function PluginHeaders() {
  const headers = createMemo(() => hung("app.header"))
  return (
    <For each={headers()}>
      {(one) => <Dynamic component={one.face} />}
    </For>
  )
}

/** Notices occupy their own space below the header rather than covering content. */
export function PluginBanners() {
  const banners = createMemo(() => hung("app.banner"))
  return <For each={banners()}>{(one) => <Dynamic component={one.face} />}</For>
}

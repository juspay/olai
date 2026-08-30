/**
 * EVERY PLUGIN'S TAB HALF, mounted around the page — and the app knows none of
 * them by name.
 *
 * ## What this replaced
 *
 * Two hand-written providers in the composition root, each with a paragraph
 * explaining an appliance to a reader of `App.tsx`:
 *
 *     <KoluUi client={olai} now={createRecencyNow()}>
 *       <RunsProvider runs={olai.cells.ci.use().value}>
 *
 * Both of those spell a MEMBER — `cells.ci` outright, and `client={olai}` only
 * because kolu's seven members were spread into core's own spec. The moment a
 * plugin composes as a SIBLING, the first would have to read
 * `olai.clients.kolu`, which is a general package writing a plugin's name in
 * its own App, and the second would have to read `clients.odu.cells.ci`, which
 * is core spelling a plugin's member. Neither is allowed and neither is
 * necessary: the app hands each plugin ITS OWN CLIENT, addressed by the one
 * word core has, and what is behind the word is that plugin's business
 * (`@olai/plugins`' `PluginMount`).
 *
 * ## A FOLD, not a list
 *
 * The mounts nest — each wraps the page and whatever is already inside — so the
 * composition is a right fold over the registry rather than a fixed number of
 * JSX levels. Registry ORDER is the nesting order, outermost first, and that is
 * a fact worth stating rather than an accident: it is the order `PLUGINS` is
 * written in, so a plugin whose half must sit inside another's would be
 * expressed by moving a line in the registry — and today nothing needs to,
 * because no plugin's mount reads another's context.
 *
 * `<Show>` and a `<Dynamic>` were both tried and neither is right here: the
 * chain is built ONCE, at module scope, off a compiled-in list that cannot
 * change, so a reactive construct would only be machinery guarding a constant.
 * What it must NOT be is a `.map()` into siblings — these wrap, they do not sit
 * beside each other.
 *
 * ## A plugin with no mount is not a lesser plugin
 *
 * `mount` is optional. A plugin whose faces are pure — no subscription of its
 * own, nothing to hold once per tab — contributes nothing here and the fold
 * skips it, which is the same absent arm every other hook on a manifest has.
 */

import type { JSX } from "solid-js"

import { FURNITURE } from "./furniture.tsx"
import { ROSTER } from "./roster.ts"
import { clientFor } from "../wire.ts"

/** The page, with every plugin's tab half wrapped around it. */
export function PluginsMounted(props: { readonly children: JSX.Element }): JSX.Element {
  // A right fold: the LAST plugin's mount is innermost, so registry order reads
  // top-down as the nesting reads outside-in. `children` is read through the
  // props each time rather than captured, so Solid's own laziness over the tree
  // is untouched — a mount that never draws its children costs nothing below it.
  //
  // THUNKS, NOT ELEMENTS, and this is the whole correctness of the nesting.
  //
  // The obvious spelling folds over `props.children` directly — seed the
  // reduce with the page and wrap it a mount at a time. It compiles, it renders
  // the right DOM, and every context is silently WRONG: interpolating an
  // already-built `inner` means the page was CREATED in this component's owner,
  // before any plugin's provider existed, and Solid resolves a context against
  // the owner a component was created under. So every face a plugin draws deep
  // in that page — a dressing on a property, a readout in the chrome — asks for
  // its own plugin's context and is told there is none, then falls back to the
  // hollow answer it keeps for a page that has no plugin half at all.
  //
  // Nothing about that is visible: the DOM is right, the subscriptions are
  // live, the data is in the client, and every face draws its "nothing here"
  // arm. It cost a live serve and a screenshot to find, because it is exactly
  // the state a working app in a vault with nothing running looks like.
  //
  // Folding over THUNKS fixes it at the root: `{inner()}` inside the JSX is
  // compiled to a getter, so each level's children are built when the mount
  // above them renders them — inside that mount's owner, under its providers.
  return ROSTER.reduceRight<() => JSX.Element>(
    (inner, plugin) => {
      const Mount = plugin.mount
      if (Mount === undefined) return inner
      // The client is addressed by the plugin's NAME, which is the sibling key
      // the framework composed its members under and the only word this package
      // has about it. It is handed over opaque: `@olai/plugins` types it
      // `unknown` and the plugin narrows it once, at its own edge.
      return () => (
        <Mount client={clientFor(plugin.name)} app={FURNITURE}>
          {inner()}
        </Mount>
      )
    },
    () => props.children,
  )()
}

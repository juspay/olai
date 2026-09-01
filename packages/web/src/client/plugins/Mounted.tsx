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
 * (`@olai/plugin-api`'s `PluginMount`).
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
 * What it must NOT be is a `.map()` into siblings — these wrap, they do not sit
 * beside each other.
 *
 * ## THE FOLD IS OVER WHAT THIS SERVE COMPOSED, and waits to find out
 *
 * It was over the BUILD, and grok's review named the gap. A plugin's mount is
 * where its members are BOUND — kolu's takes five, odu's takes one — so folding
 * the build subscribes every plugin the binary has, whatever the serve is
 * running. On a `--plugins=odu` serve that is a subscription to a sibling the
 * wire does not carry: the server answers that one request with `Unknown
 * request tag`, the retry fence correctly declines to retry a non-transport
 * failure, and the readout goes `degraded` NAMING A SIBLING THE OPERATOR TURNED
 * OFF — for the life of the page, because the failure is the fiber's exit and
 * no frame can follow one. That is a complaint about a tool somebody removed
 * where the ruling is the ordinary machine-without-it state, and it is the same
 * defect the terminal door had before the evidence run found it, one layer up.
 *
 * So the fold waits. `createComposed` answers `undefined` until the roster has
 * spoken and the names afterwards, and this component mounts nothing until it
 * has an answer. THE GENEROUS DEFAULT IS NOT AVAILABLE HERE, which is the
 * asymmetry with the dressing table one package over: a face drawn early and
 * taken away is a flicker, and a subscription opened early cannot be closed
 * back into the health fact. `../plugins/running.ts` argues the pair.
 *
 * ## What that costs, said out loud
 *
 * ONE re-creation of the page, on load. While the roster is unknown this draws
 * `children` with no plugin provider around them, and when the answer lands the
 * fold changes and Solid builds the subtree again inside the providers. The
 * alternative — draw NOTHING until the roster lands — was rejected because the
 * freeze overlay is inside this component (`../App.tsx`): a tab that cannot
 * reach its server has to be able to say so, and blanking the page to protect a
 * subscription would take the sentence away with it.
 *
 * The cost is bounded by two things rather than hoped away. The signature the
 * memo compares is a STRING, so a server republishing an identical roster — a
 * reconnect does — moves nothing; and the roster rides the same socket as every
 * other first frame, so the subtree being rebuilt is the one that was a beat
 * old. What it is NOT bounded by is arrival order: a page frame that lands
 * before the roster is drawn and then rebuilt, which is a flash on a cold load
 * and is the honest price of not latching a permanent lie.
 *
 * ## A plugin with no mount is not a lesser plugin
 *
 * `mount` is optional. A plugin whose faces are pure — no subscription of its
 * own, nothing to hold once per tab — contributes nothing here and the fold
 * skips it, which is the same absent arm every other hook on a manifest has.
 */

import { type JSX, Show } from "solid-js"

import { FURNITURE } from "./furniture.tsx"
import { ROSTER } from "./roster.ts"
import { createComposed } from "./running.ts"
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
  const composed = createComposed()
  // `keyed`, so the subtree is rebuilt exactly when the ANSWER moves and never
  // when the cell merely publishes: `createComposed` hands back one array
  // identity per distinct roster, so a reconnect that republishes the same one
  // moves nothing here. The FALLBACK is the roster not having spoken — the
  // children alone, with no provider around them and therefore no plugin
  // subscription, which is the whole of what this waits for.
  //
  // `<Show>` rather than a memo returning JSX, and it is not a style choice: a
  // memo that BUILDS a subtree tracks every signal the components it creates
  // read at setup, so the page would rebuild for reasons that have nothing to
  // do with the roster. `Show` runs its children untracked, which is the same
  // guarantee a component body has and the one the old module-scope fold got
  // for free.
  return (
    <Show when={composed()} keyed fallback={props.children}>
      {(names) => chainOver(names, () => props.children)()}
    </Show>
  )
}

/** The nesting, for the plugins this serve composed — a right fold, so registry
 *  order reads top-down as the nesting reads outside-in. */
const chainOver = (
  names: ReadonlyArray<string>,
  page: () => JSX.Element,
): (() => JSX.Element) => {
  const on = new Set(names)
  return ROSTER.filter((plugin) => on.has(plugin.name)).reduceRight<() => JSX.Element>(
    (inner, plugin) => {
      const Mount = plugin.mount
      if (Mount === undefined) return inner
      // The client is addressed by the plugin's NAME, which is the sibling key
      // the framework composed its members under and the only word this package
      // has about it. It is handed over opaque: `@olai/plugin-api` types it
      // `unknown` and the plugin narrows it once, at its own edge.
      return () => (
        <Mount client={clientFor(plugin.name)} app={FURNITURE}>
          {inner()}
        </Mount>
      )
    },
    page,
  )
}

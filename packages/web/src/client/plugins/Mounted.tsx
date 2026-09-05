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
 * necessary: a plugin reaches its OWN client through `ctx.wired`, keyed by its
 * fiber, and this file hands over nothing but the page.
 *
 * ## A FOLD, not a list
 *
 * The mounts nest — each wraps the page and whatever is already inside — so the
 * composition is a right fold over the slot rather than a fixed number of JSX
 * levels. MOUNT ORDER is the nesting order, outermost first, and that is a fact
 * worth stating rather than an accident: it is the order `olai.yml` lists its
 * rows in, so a plugin whose half must sit inside another's would be expressed
 * by moving a row — and today nothing needs to, because no plugin's mount reads
 * another's context.
 *
 * What it must NOT be is a `.map()` into siblings — these wrap, they do not sit
 * beside each other.
 *
 * ## THE WAIT IS GONE, and so is the licence that needed it
 *
 * This fold used to be over the BUILD's manifests, gated on a subscribe licence
 * that answered `undefined` until the roster had spoken — because a plugin's
 * mount is where its members are BOUND, and a subscription to a sibling this
 * serve did not compose fails with `Unknown request tag` and LATCHES a
 * `degraded` readout for the life of the page. So the fold waited, and the
 * page was drawn once without providers and again with them.
 *
 * Neither the wait nor the rebuild is here. A plugin's fiber is mounted only
 * after `../wire.ts` has dialled its sibling, so a face in this slot is a face
 * whose members are on the wire by construction — the sequencing does what the
 * licence was standing in for. A slot that is empty is a page with no plugin
 * providers around it, which is the true state of a tab that has not been told
 * yet and the permanent state of a serve running none.
 *
 * ## A plugin with no mount is not a lesser plugin
 *
 * The `app.mount` slot is optional like every other. A plugin whose faces are
 * pure — no subscription of its own, nothing to hold once per tab — registers
 * nothing here and the fold skips it.
 */

import { createMemo, type JSX, Show } from "solid-js"

import type { Hung, SlotFaces } from "@olai/plugin-api"

import { hung } from "./runtime.ts"

/** The page, with every plugin's tab half wrapped around it. */
export function PluginsMounted(props: { readonly children: JSX.Element }): JSX.Element {
  // THUNKS, NOT ELEMENTS, and this is the whole correctness of the nesting.
  //
  // The obvious spelling folds over `props.children` directly — seed the reduce
  // with the page and wrap it a mount at a time. It compiles, it renders the
  // right DOM, and every context is silently WRONG: interpolating an
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
  //
  // The MEMO is over the slot's FACES and never over a built subtree: a memo
  // that BUILDS one tracks every signal the components it creates read at
  // setup, so the page would rebuild for reasons that have nothing to do with
  // the roster. `Show` runs its children untracked, which is the same guarantee
  // a component body has and the one the old module-scope fold got for free;
  // `keyed` is what rebuilds the subtree exactly when a plugin's mount arrives
  // or leaves, with equality checked against the provider identities below.
  //
  // `props.children` is read through the props each time rather than captured,
  // so Solid's own laziness over the tree is untouched — a mount that never
  // draws its children costs nothing below it.
  const mounts = createMemo(() => hung("app.mount"), undefined, {
    // Other slots can change without changing the contexts around this page.
    equals: (before, after) => before.length === after.length
      && before.every((one, index) => one.plugin === after[index]?.plugin
        && one.face === after[index]?.face),
  })
  return (
    <Show when={mounts()} keyed>
      {(faces) => chainOver(faces, () => props.children)()}
    </Show>
  )
}

/** The nesting — a right fold, so mount order reads top-down as the nesting
 *  reads outside-in. */
const chainOver = (
  faces: ReadonlyArray<Hung<SlotFaces["app.mount"]>>,
  page: () => JSX.Element,
): (() => JSX.Element) =>
  faces.reduceRight<() => JSX.Element>(
    (inner, one) => {
      const Mount = one.face
      return () => <Mount>{inner()}</Mount>
    },
    page,
  )

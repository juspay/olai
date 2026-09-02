/**
 * WHAT THIS PLUGIN READS OF THE APP — declared here, structurally, and nothing
 * else about `@olai/web` is known on this side of the wall.
 *
 * ## Why a re-declaration rather than an import
 *
 * `@olai/plugin-api` declares the whole furniture and `@olai/plugin-api` imports THIS
 * package, so importing it back would be the cycle the manifests cannot express
 * — the direction argued in that package's `plugin.ts` and held by its
 * `fence.test.ts` rather than by a reviewer's memory. The agreement is proved at
 * the registry's `satisfies` instead: the same pin `./appliance/props/block.ts`
 * already keeps with the drawer's entry, one floor down.
 *
 * ## What the pill actually borrows, and why every item is the APP'S
 *
 * The padi readout is the third standing promise in the app's header, beside
 * the connection pill and the Commit pill, and *standing beside them* is most of
 * what it is. So the things it borrows are the things that make it one of the
 * three rather than a chip that looks a bit like them:
 *
 *   - the PILL'S GEOMETRY, because the bar is a fixed height and a wrap inside
 *     it pushes the first row off the top of a 390pt phone — a second copy of
 *     that geometry is one place for it to be fixed and another to stay broken;
 *   - the DESKTOP breakpoint, because the pills leave the phone bar together;
 *   - the POPOVER, because the panel this pill opens has to share ONE focus
 *     cycle with the panels the other two open, sit at the app's own layer, and
 *     be placed by the app's own anchor arithmetic (a computed `top`/`bottom`
 *     key compiles away silently in Solid and leaves a panel below the fold —
 *     it cost the Commit panel its placement once);
 *   - the DOOR ONTO A FILE, because the feed's wrench opens `_olai/Kolu.olai`
 *     as an ordinary outline page, and how olai spells an address, what a
 *     modifier press means and where a split pane opens are all the router's.
 *
 * Every one of those is a contract whose breakage is SILENT — the app's own
 * suite stays green, because the face that broke is in another package. That is
 * `BlockChrome`'s argument, and it is this file.
 */

import type { JSX } from "solid-js"

/** The chrome pill's look — classes rather than a component, because what the
 *  readout draws INSIDE the pill (a dot, a word, a warning word beside it) is
 *  this plugin's and only the box is the bar's. */
export interface PillLook {
  readonly PILL: string
  readonly DOT: string
  /** The infrastructure-warning register: a warm coat on the chip... */
  readonly PILL_WARN_COAT: string
  /** ...a hollow dot... */
  readonly DOT_HOLLOW_WARN: string
  /** ...and a warm word beside it. Amber, and a THIRD family on purpose: the
   *  bar's violet is what an agent's ask for a human wears, and something of
   *  the machine's own being broken must never be one glance's confusion with
   *  it. */
  readonly TEXT_WARN: string
}

/** The panel that hangs off the pill — whether it is up, where it sits, and the
 *  one focus cycle the trigger and the panel make between them. Handed WHOLE
 *  rather than as its parts: see the header on the four contracts a plugin
 *  would otherwise restate. */
export interface AppPopover {
  readonly open: () => boolean
  readonly toggle: () => void
  /** Put it away WITHOUT the caret walking back to the trigger — the wrench's
   *  press navigates, and the caret belongs to the page it lands on. */
  readonly close: () => void
  readonly setTrigger: (el: HTMLElement | undefined) => void
  /** Portalled, placed, layered, focusable-but-not-tabbable, and drawn only
   *  while open. What goes IN it is this plugin's; the box is the bar's. */
  readonly Panel: (props: {
    readonly testid: string
    readonly label: string
    readonly children: JSX.Element
  }) => JSX.Element
}

/** A door onto a served file — the router and the address grammar as the one
 *  thing this plugin wants out of them. */
export type FileLink = (props: {
  readonly file: string
  readonly class?: string
  readonly testid?: string
  readonly label: string
  readonly title?: string
  readonly children: JSX.Element
}) => JSX.Element

/*
 * THE CLOCK IS NOT ON THIS RECORD, and it used to be — a `KoluClocks` with the
 * two facts the mount spends, on a `KoluApp.clocks` beside the rest.
 *
 * Nothing ever read it out of here. The mount spends `ctx.clocks` DIRECTLY at
 * `../browser.tsx`, which is where the cadence is decided, and every `app.*`
 * read in this package is one of the four below. The field was the record
 * carrying a service reference past every face that wanted it, to nobody.
 *
 * Its comment also said the cadence "crosses rather than being decided in this
 * package", which the branch that made the mount a fiber reversed in as many
 * words: `../browser.tsx` now says THE CADENCE IS THIS PACKAGE'S JUDGEMENT, and
 * what the app owns is the LADDER and the LIFETIME. Deleting the dead half
 * takes the stale argument with it and leaves the live one standing.
 */

/** THE WHOLE OF WHAT THIS PLUGIN IS HANDED — four facts, and each is spent. */
export interface KoluApp {
  readonly desktop: () => boolean
  readonly pill: PillLook
  readonly createPopover: () => AppPopover
  readonly FileLink: FileLink
}

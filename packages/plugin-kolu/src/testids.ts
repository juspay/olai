/**
 * THE PADI PILL'S TEST IDS — this plugin's half of olai's testid table.
 *
 * ## Why they are here and not in `@olai/kolu-ui`
 *
 * The split is by RENDERER, which is the only line that makes sense and is the
 * one `@olai/kolu-ui`'s own `testids.ts` already draws — its header says
 * `TESTID.padi` *"deliberately STAYS in web, with the pill it names: the header
 * readout's chrome is olai's, and only its words came here"*. Half of that is
 * still exactly right and half has moved: the pill is still not the appliance's,
 * but it is not `@olai/web`'s either. It is olai's JUDGEMENT ABOUT kolu — what
 * an absent padi means in the app's chrome — and that is what this package is.
 * So the ids follow the component, which is the rule, and the sentence one floor
 * down should be read as "not kolu's" rather than as "web's".
 *
 * ## NAMES ONLY, and that is a graph claim rather than a style one
 *
 * This module imports nothing and must not: `packages/tests` runs under a
 * cucumber process with no browser in it, and a testid door that pulled a
 * component would put SolidJS — and, behind `@olai/kolu-ui`, a terminal emulator
 * — on the graph of a suite that only wanted a string. That package's own import
 * sweep is what holds it, at the other end.
 *
 * ## Why a `data-testid` is worth a module at all
 *
 * It is a contract between two packages that never import each other, and the
 * way that contract normally breaks is silent: someone renames an attribute, the
 * selector still compiles, and a scenario fails thirty seconds later with a
 * timeout that says nothing about why. Declaring them once and importing them on
 * both sides makes a rename a type error.
 */
export const TESTID = {
  /** WHETHER THIS OLAI CAN SEE KOLU'S TERMINALS — the third chrome readout,
   *  beside the connection and the Commit pill (`./browser/Padi.tsx`).
   *  `data-padi` is the closed set `connected` / `absent` / `skew`. Always drawn
   *  on desktop: an indicator that appears only when something is wrong cannot
   *  be trusted when it is absent. */
  padi: "padi",
  /** THE FEED the pill's press opens — the box of `@olai/kolu-ui`'s
   *  `EventsFeed`. THE PANEL'S OWN HANDLE only: the rows are the appliance's and
   *  are asserted through `@olai/kolu-ui`'s `./testids`. */
  padiFeed: "padi-feed",
  /** THE FEED'S FOOT — the drawer's last line, which is the wrench onto the
   *  config and nothing else (`./browser/Feed.tsx`). Present only when there
   *  is a config to read: a vault no file decides anything for has no foot, not
   *  an empty one.
   *
   *  IT HELD A MUTES LINE TOO until the second doorbell took the mute list out
   *  of `_olai/Kolu.olai` (the wake filter file is the silence control now), so
   *  `padiFeedMutes` went with it. The foot survives the cut because the wrench
   *  does — the config's duration knobs are still a thing a person edits, and
   *  this is still the only door onto them. */
  padiFeedFoot: "padi-feed-foot",
  /** THE WRENCH — the door onto the `_olai/Kolu.olai` the convention read, so
   *  the watch's thresholds are one press away as an ordinary outline page. */
  padiFeedWrench: "padi-feed-wrench",
} as const

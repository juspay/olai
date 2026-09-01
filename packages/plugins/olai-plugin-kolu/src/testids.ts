/**
 * THIS TENANT'S TEST IDS — every id kolu's faces wear, behind one door.
 *
 * ## Two tables, one door, because there is one package
 *
 * They used to be two doors on two packages, split by RENDERER: `@olai/kolu-ui`
 * held what KOLU draws (the Dock row, the pane, the events list) and this module
 * held what OLAI draws about kolu (the padi pill and the drawer its press
 * opens). The line is still exactly right and it is still drawn — the two tables
 * are two modules, `./ui/testids.ts` and this one — but it is no longer a
 * PACKAGE line, so it is no longer two doors. The appliance fold made kolu's
 * browser half a module directory of this plugin, and a package has one
 * `./testids` entry the way it has one name.
 *
 * The merge is a spread and the collision is refused where every other one is:
 * `@olai/plugin-api`'s `testids.test.ts` asserts the plugins' tables disjoint,
 * and two modules of one plugin land in one object here before that ever runs —
 * so a key spelled twice inside this package is a duplicate-key error on the
 * literal below rather than a value that silently wins.
 *
 * ## NAMES ONLY, and that is a graph claim rather than a style one
 *
 * Neither module imports anything but the other, and neither may: `packages/tests`
 * runs under a cucumber process with no browser in it, and a testid door that
 * pulled a component would put SolidJS — and, behind `./ui/`, a terminal
 * emulator — on the graph of a suite that only wanted a string. That package's
 * own import sweep is what holds it, at the other end.
 *
 * ## Why a `data-testid` is worth a module at all
 *
 * It is a contract between two packages that never import each other, and the
 * way that contract normally breaks is silent: someone renames an attribute, the
 * selector still compiles, and a scenario fails thirty seconds later with a
 * timeout that says nothing about why. Declaring them once and importing them on
 * both sides makes a rename a type error.
 */
import { TESTID as ui } from "./ui/testids.ts"

export const TESTID = {
  ...ui,
  /** WHETHER THIS OLAI CAN SEE KOLU'S TERMINALS — the third chrome readout,
   *  beside the connection and the Commit pill (`./browser/Padi.tsx`).
   *  `data-padi` is the closed set `connected` / `absent` / `skew`. Always drawn
   *  on desktop: an indicator that appears only when something is wrong cannot
   *  be trusted when it is absent. */
  padi: "padi",
  /** THE FEED the pill's press opens — the box of `./ui/`'s
   *  `EventsFeed`. THE PANEL'S OWN HANDLE only: the rows are the appliance's and
   *  are asserted through `./ui/testids.ts`, spread into the table below. */
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

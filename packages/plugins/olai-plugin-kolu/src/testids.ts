/**
 * THIS TENANT'S TEST IDS — every id kolu's faces wear, behind one door.
 *
 * ## Two tables, one door, because there is one package
 *
 * They used to be two doors on two packages, split by RENDERER: `@olai/kolu-ui`
 * held what KOLU draws (the Dock row, the pane, the events list) and this module
 * held what OLAI draws about kolu (the padi pill and the drawer its press
 * opens). The line is still exactly right and it is still drawn — the two tables
 * are two modules, `./appliance/testids.ts` and this one — but it is no longer a
 * PACKAGE line, so it is no longer two doors. The appliance fold made kolu's
 * browser half a module directory of this plugin, and a package has one
 * `./testids` entry the way it has one name.
 *
 * The merge is a SPREAD, and a spread resolves a collision SILENTLY in favour of
 * whichever was written last — the explicit keys below win over `...appliance` with no
 * diagnostic anywhere, because TypeScript's duplicate-key error fires only for
 * two literal keys in ONE literal. Before the fold these were two packages and
 * both were rows in `@olai/plugin-api`'s disjointness sweep; that sweep now sees
 * kolu's POST-MERGE object, so a key lost here is gone before it runs and its
 * own count compares the survivors with the survivors. The guarantee the package
 * wall used to carry is the pair of TYPE-LEVEL assertions below, which make a
 * collision a compile error naming the key or the value rather than a claim
 * anybody has to keep green. Two earlier drafts got this wrong and both are
 * recorded there, because the ways they were wrong are the interesting part.
 *
 * ## NAMES ONLY, and that is a graph claim rather than a style one
 *
 * Neither module imports anything but the other, and neither may: `packages/tests`
 * runs under a cucumber process with no browser in it, and a testid door that
 * pulled a component would put SolidJS — and, behind `./appliance/`, a terminal
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
import { TESTID as appliance } from "./appliance/testids.ts"

/** WHAT OLAI DRAWS ABOUT KOLU — the chrome half, named rather than written
 *  straight into the merge, so the composition below has two values to be
 *  disjoint ABOUT. It is not exported: the door is `TESTID`. */
const CHROME = {
  /** WHETHER THIS OLAI CAN SEE KOLU'S TERMINALS — the third chrome readout,
   *  beside the connection and the Commit pill (`./browser/Padi.tsx`).
   *  `data-padi` is the closed set `connected` / `absent` / `skew`. Always drawn
   *  on desktop: an indicator that appears only when something is wrong cannot
   *  be trusted when it is absent. */
  padi: "padi",
  /** THE FEED the pill's press opens — the box of `./appliance/`'s
   *  `EventsFeed`. THE PANEL'S OWN HANDLE only: the rows are the appliance's and
   *  are asserted through `./appliance/testids.ts`, spread into the table below (`...appliance` is its first line). */
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

/**
 * THE MERGE, WITH THE COLLISION MADE UNREPRESENTABLE RATHER THAN CHECKED.
 *
 * A spread resolves a collision silently in favour of whichever was written
 * last, and TypeScript's duplicate-key diagnostic fires only for two literal
 * keys in ONE literal — so `{ ...appliance, ...CHROME }` can drop an id with no
 * diagnostic anywhere. That was prose first; then a test beside this file that
 * could not fail, because it rebuilt the chrome half by SUBTRACTING `appliance`'s
 * keys from the merged object — and a key both halves declare is in
 * `appliance`, so the subtraction removed it from the other side and the clash
 * list was empty by construction; then a pair of module-scope throws. That test
 * is deleted, which is why its lesson is written here.
 *
 * The throws are gone because the compiler turned out to be able to make the
 * claim itself: both halves are `as const`, so their VALUES are literal unions,
 * and asking whether the two unions share a member is a type-level question with
 * a type-level answer. The runtime value check written first was in fact DEAD
 * CODE, and `tsc` said so in as many words — *"This comparison appears to be
 * unintentional because the types '"terminal-block" | … ' and '"padi" | …' have
 * no overlap."* An assertion the compiler can prove vacuous is one it can also
 * prove, so it is stated as a type.
 *
 * Each assertion is a TYPE ALIAS whose argument is `true` while the
 * intersection is empty and the OFFENDING MEMBER otherwise, so a collision is a
 * compile error that names the key or the value — `Type '"padi"' does not
 * satisfy the constraint 'true'.` — in every `just typecheck` and every editor,
 * forever. It emits NOTHING: an earlier draft wrote the same assertion as two
 * `const … = true` bindings, which typecheck identically and put four dead
 * statements in the browser bundle for a claim the compiler had already settled.
 * It needs no test either: a claim `tsc` refuses cannot be exercised at runtime,
 * and its falsifier is a planting run against `tsc`.
 *
 * ONE LIMIT, MEASURED RATHER THAN ASSUMED, because the first draft of this
 * paragraph claimed the opposite and was wrong. The KEY assertion survives an
 * `as const` being dropped from either half — keys stay literal in an object
 * type regardless — and a planted collision still fails `tsc` naming the key.
 * The VALUE assertion does NOT: without `as const` the values widen to `string`,
 * and `Extract<string, "padi" | …>` is `never`, so the intersection is empty for
 * the wrong reason and a planted value collision compiles clean. Both were
 * checked by planting, in all four combinations. `as const` on both halves is
 * therefore load-bearing for the value half, which is what these two words are
 * doing here rather than being style.
 */
type SharedKey = Extract<keyof typeof appliance, keyof typeof CHROME>
type SharedValue = Extract<
  (typeof appliance)[keyof typeof appliance],
  (typeof CHROME)[keyof typeof CHROME]
>

/** `true`, or a compile error naming what went wrong. */
type Assert<T extends true> = T

/** No key is declared by both halves — a spread would drop one silently. */
type _NoSharedKey = Assert<[SharedKey] extends [never] ? true : SharedKey>
/** No value is worn by both — one `[data-testid=…]` may name one component. */
type _NoSharedValue = Assert<[SharedValue] extends [never] ? true : SharedValue>

/** THE DOOR: both halves, in one table. The `as const` is load-bearing rather
 *  than habitual — see the value assertion's measured limit above. */
export const TESTID = { ...appliance, ...CHROME } as const

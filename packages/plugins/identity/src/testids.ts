/**
 * THIS PLUGIN'S HALF OF OLAI'S TESTID TABLE — one name, the chip's.
 *
 * Every row of `olai.yml` contributes one of these, merged by
 * `packages/bundle/generate.ts` with a pairwise-disjointness proof over the
 * result. `identity` was `@olai/web`'s while the chip was core's; it is
 * here now, and the scenarios that assert on it read it from
 * `@olai/bundle/testids` like every other plugin's.
 *
 * ONE NAME AND NOT FOUR, because the four faces are one element: which of
 * them is drawn is `data-who` on the chip, and which login it says is
 * `data-login` beside it. An id per face would be four selectors for one
 * question, and a scenario asserting "anonymous" would then pass by
 * finding nothing.
 *
 * A NAMES-ONLY MODULE, like every other one of these: it imports nothing
 * and must not. `packages/tests` runs under a cucumber process with no
 * browser in it, and a testid door that pulled a component would put
 * SolidJS on the graph of a suite that only wanted a string.
 */

export const TESTID = {
  /** Who is looking, in the app's last bar seat. `data-who` is the face
   *  (`asking` / `none` / `yes` / `error`) and `data-login` the login when
   *  there is one. */
  identity: "identity",
} as const

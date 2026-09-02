/**
 * THE SPACES FACES' TEST IDS — this plugin's half of olai's testid table.
 *
 * NAMES ONLY, and that is a graph claim: `packages/tests` runs under a
 * cucumber process with no browser in it.
 */
export const TESTID = {
  /** WHETHER THIS OLAI CAN POST TO SPACES — the chrome readout.
   *  `data-spaces` is the closed set `connected` / `absent` / `fault`. */
  spaces: "spaces",
} as const

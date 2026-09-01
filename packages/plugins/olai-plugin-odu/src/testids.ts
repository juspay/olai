/**
 * THE CI FACES' TEST IDS — this plugin's half of olai's testid table.
 *
 * They split along the RENDERER split, which is the only line that makes sense
 * and is `olai-plugin-kolu`'s own (`src/appliance/testids.ts` one appliance over, whose header
 * argues it first): a scenario asserting on the CI chip is asserting on THIS
 * package's output, and an id it could only reach through `@olai/web` would be a
 * suite reading one package's DOM through another package's door.
 *
 * ## NAMES ONLY, and that is a graph claim rather than a style one
 *
 * This module imports nothing and must not: `packages/tests` runs under a
 * cucumber process with no browser in it, and a testid door that pulled a
 * component would put SolidJS — and, through the neighbouring appliance, an
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
export const TESTID = {
  /** THE CI CHIP — the live-properties seam's chip face, drawn BESIDE a
   *  `worktree` property whose checkout has a run in it (`./browser/CiChip.tsx`).
   *  Its presence is the assertion that a run is live or was: a checkout with no
   *  run and no reading draws nothing here, which is the ordinary state of every
   *  checkout. `data-state` is `going` / `ok` / `red` / `quiet` — a closed set —
   *  and it is spelled `data-state` rather than the `data-tone` a chip with four
   *  inks would reach for first, because that second name is the app's claimed
   *  contract for a said-line's MOOD and two vocabularies may not share it
   *  (`@olai/web`'s `claims.test.ts` sweeps for exactly that). `data-worktree` is
   *  the board's own value, which is what the chip joined on. */
  ciChip: "ci-chip",
  /** THE RUN MATRIX the chip opens — nodes, durations, ok/red/errored, in the
   *  run's own scheduling order (`./browser/RunMatrix.tsx`). Present only while
   *  open; one per run, because the drawer holds one open pane per run the way
   *  it holds one open editor. */
  ciMatrix: "ci-matrix",
  /** One node's row in it. `data-status` is odu's own status word, verbatim and
   *  unnarrowed, so a scenario asserts what the coordinator said rather than what
   *  olai made of it; `data-node` is the `<namepath>@<platform>` id. */
  ciCell: "ci-cell",
} as const

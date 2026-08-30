/**
 * THE ODU PLUGIN — olai's own judgement ABOUT odu.
 *
 * ## What lives here, and what deliberately does not
 *
 * `@olai/odu-client` is the only package that names `@odu/*`: it resolves a
 * `worktree` value into a checkout, sweeps for a coordinator on each one, and
 * projects odu's own pipeline state into olai's shapes. It does not move.
 *
 * What lives here is everything else that says `odu` — the CI chip and the run
 * matrix a live worktree wears, the words a run comes to, the per-node ink,
 * the one subscription a tab holds, and the run events that reach the feed.
 * Those used to be a folder under `@olai/web`, and the header on that folder
 * argued the arrangement plainly: *"a folder rather than a package because it
 * imports nothing of odu at all — so a wall there would confine nothing."*
 *
 * That argument was about the WRONG THING, and it is worth saying why rather
 * than deleting it. It measured the wall against odu's product tier, which the
 * dressing genuinely never reached. But what a wall around a plugin confines
 * is not a foreign import — it is the NAME: the property key it claims, the
 * registration it makes, the cell it reads and the words it puts on a screen.
 * By that measure the folder confined nothing precisely because it was inside
 * the package it was supposed to be keeping the name out of. `@olai/web` spelt
 * `odu` in its dressing table, its testids, its App and its claims sweep. The
 * wall is here now, and it confines what it was always about.
 *
 * ## The manifest is structural
 *
 * No `: OlaiPlugin` on the value: `@olai/plugins` imports this package, and
 * the fit is proved at the registry's `satisfies`. `@olai/plugin-kolu`'s
 * header argues the direction in full.
 */

export { faces, name, surface } from "./wire.ts"
export { plugin } from "./plugin.ts"

/**
 * THE KOLU PLUGIN — olai's own judgement ABOUT kolu, on this side of the wall.
 *
 * ## What lives here, and what deliberately does not
 *
 * kolu implementation lives in ONE package and stays there: `@olai/kolu-client`
 * is THE DIAL and the wire — the only package that speaks padi, and the one that
 * names no olai package at all, which the resolver proves and no sweep has to.
 * That is the sixth sitting's ruling and this package does not reopen it.
 *
 * What DID move is everything on this side of that wall. `./appliance/` is EVERYTHING
 * KOLU RENDERS — the Dock row a terminal property wears, the live pane, the
 * re-attach policy, the fleet a tab holds once, and the words the header readout
 * says — and it was `@olai/kolu-ui` until the appliance fold. A second manifest
 * for it was a second identity for one appliance, and it was never protecting
 * the appliance's wall: nothing in there is kolu's implementation.
 *
 * What lives HERE is the third thing, which had no home and was therefore
 * spread across three general packages under kolu-shaped filenames: what an
 * absent padi MEANS in five English sentences, which vault file is kolu's by
 * convention, which property KIND wears the terminal door, and which of the
 * app's chrome slots the padi pill hangs in. None of that is kolu
 * implementation — it is olai deciding what to make of kolu — and none of it
 * is core's business either, which is why it used to sit in `@olai/chat`,
 * `@olai/server` and `@olai/web` and make those packages spell a name they had
 * no reason to know.
 *
 * ## Which is why there are TWO browser directories and not one
 *
 * `./browser/` holds the padi PILL and the feed its press opens, and the tab's
 * own MOUNT. It is not a second `./appliance/` and the line between them is exact:
 * `./appliance/` draws what KOLU draws — its row, its emulator, its events — and this
 * draws what OLAI says about kolu in olai's own chrome. That line is why the
 * fold left two directories rather than merging them into one: it is a real
 * split and worth keeping visible, and what it never was is a PACKAGE split.
 * The pill's words are `./appliance/`'s (`padiSaid`); the chip it sits in, the seat it takes in
 * the bar and the drawer it opens are the app's judgement, and this is where
 * that judgement lives.
 *
 * It reaches `@olai/web` for none of it. The bar's geometry, the popover and
 * the door onto a served file arrive as VALUES, declared structurally in
 * `./browser/app.ts` — the app mounts every plugin, so an import back would be
 * a cycle, and a face that spelled the app's contract itself would be a second
 * spelling free to drift with the app's suite green.
 *
 * ## The manifest is structural
 *
 * There is no `: OlaiPlugin` on the value below and there must not be:
 * `@olai/plugin-api` imports this package, so an import back would be a cycle the
 * manifests could not express. The fit is proved at the registry's
 * `satisfies`, which is the same structural agreement `@olai/ops` keeps with
 * the surface's `Status` and `./appliance/`'s `props/block.ts` already keeps with the drawer's
 * entry — and it means a manifest that stopped fitting is named on the
 * registry's line, with this plugin's name on it.
 */

export { faces, name, surface } from "./wire.ts"

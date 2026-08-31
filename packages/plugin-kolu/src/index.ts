/**
 * THE KOLU PLUGIN — olai's own judgement ABOUT kolu, on this side of the wall.
 *
 * ## What lives here, and what deliberately does not
 *
 * kolu implementation lives in two packages and stays there:
 * `@olai/kolu-client` is THE DIAL and the wire — the only package that speaks
 * padi — and `@olai/kolu-ui` is EVERYTHING KOLU RENDERS: the Dock row a
 * terminal property wears, the live pane, the re-attach policy, the fleet a tab
 * holds once, and the words the header readout says. Neither moves. The sixth
 * sitting's ruling put them behind package walls and this package does not
 * reopen it.
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
 * ## Which is why there is a browser half here as well as one next door
 *
 * `./browser/` holds the padi PILL and the feed its press opens, and the tab's
 * own MOUNT. That is not a second `@olai/kolu-ui` and the line between them is
 * exact: kolu-ui draws what KOLU draws — its row, its emulator, its events —
 * and this draws what OLAI says about kolu in olai's own chrome. The pill's
 * words are kolu-ui's (`padiSaid`); the chip it sits in, the seat it takes in
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
 * `@olai/plugins` imports this package, so an import back would be a cycle the
 * manifests could not express. The fit is proved at the registry's
 * `satisfies`, which is the same structural agreement `@olai/ops` keeps with
 * the surface's `Status` and `@olai/kolu-ui` already keeps with the drawer's
 * entry — and it means a manifest that stopped fitting is named on the
 * registry's line, with this plugin's name on it.
 */

export { faces, name, surface } from "./wire.ts"

/** The manifest, as `@olai/plugins`' registry spreads it. It carries the name
 *  and the mounted members today and grows the probe, the failure sentences,
 *  the runtime half, the owned file, the kinds, the dressings and the chrome
 *  as the sweep reaches each of them. Every field but those two is optional,
 *  which is not a staging convenience: a plugin that contributes only a cell
 *  is a whole plugin, and the absent arm of every other hook is the state a
 *  machine without kolu already shows. */
export { plugin } from "./plugin.ts"

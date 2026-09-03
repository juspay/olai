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
 * ## The fit is still structural, and where it is PROVED has moved
 *
 * There is no `: OlaiPlugin` on the value below because there is no such type
 * any more. A browser half was a manifest OBJECT and is a Cordis plugin now
 * (`./browser.tsx` — `name`, `inject`, `apply(ctx)`), so the interface a
 * manifest used to be annotated against retired with the thing it described.
 * What used to prove the agreement went with it: the fit was caught at a
 * compiled-in registry's `satisfies`, one line per plugin, and there is no such
 * list — `@olai/bundle` is ROWS, each naming a module a loader resolves at
 * mount, and a row cannot `satisfies` anything about a module nobody has
 * imported yet.
 *
 * The DIRECTION that paragraph argued is still the shape of this tree and only
 * the package at the far end changed. It was `@olai/plugin-api` that imported
 * every plugin, which is exactly why a plugin could not import it back; the
 * registry left for `@olai/bundle` and what stayed there is the interface, which
 * names no plugin at all. So this package DOES import it — `./server.ts`'s
 * `inject` names the services it declares, and `./browser.tsx` takes the
 * declaration merging that types `ctx.slots` — and the one-way arrow is
 * `@olai/bundle`'s now: the bundle names every plugin, and a plugin naming the
 * bundle would be the cycle the manifests decline to express.
 *
 * What the `satisfies` used to catch is caught where these values are SPENT,
 * inside this package and with this package's name on the file. `surface` and
 * `faces` go to `ctx.surfaces.register`, whose `Sibling` types both and whose
 * `deps` carries its own `satisfies ImplementSurfaceDeps<typeof surface.spec>`
 * (`./server.ts`); a face hung in a slot the app does not declare is a type
 * error on its own `ctx.slots.register` line, and the reading of the app this
 * half composes out of `ctx.bar`, `ctx.clocks` and `ctx.links`
 * (`./browser/app.ts`) fails on the line that composes it. It is the same
 * structural agreement `@olai/ops` keeps with the surface's `Status` and
 * `./appliance/`'s `props/block.ts` keeps with the drawer's entry — read at the
 * line that is wrong rather than at a registry's.
 */

export { faces, name, surface } from "./wire.ts"

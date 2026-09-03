/**
 * THE BROWSER'S ROWS — one per plugin this build has, each with the dynamic
 * `import()` that is that plugin's own chunk.
 *
 * ## What this replaced, and the ruling that replaced it
 *
 * Two compiled-in lists: `WIRES` (each plugin's wire half, statically imported,
 * on a browser-safe graph) and `PLUGINS` (each plugin's manifest, statically
 * imported, on a graph carrying SolidJS and a terminal emulator). Both were
 * hand-written, both had to name every plugin in the same order as `olai.yml`,
 * and a `rosters.test.ts` held the three equal. The argument written on them
 * was true as far as it went — *a browser bundle is built ahead of time,
 * `connectSurfaces` takes its sibling map at the call, and there is no loader in
 * the tab* — and it argued for the wrong thing. The human's bar (2026-09-02):
 * olai is one app, and a change that finishes the server half and covers the
 * seam with a test does not merge. `rosters.test.ts` was a monument to the
 * duplication, not a fix for it, and it is gone with the lists.
 *
 * What the tab genuinely cannot do is resolve a specifier it COMPUTES: a
 * bundler splits on a literal `import()` and nothing else. That is a reason to
 * WRITE the list from the rows rather than to keep writing it by hand, which is
 * `../generate.ts`.
 *
 * ## ONE DOOR, and its graph is the claim
 *
 * There were three, because there were three graphs — the manifests whole, the
 * browser-safe wire half, and the composition root's rows. Two of them have
 * collapsed into this one, and the reason is that the graph got EMPTIER rather
 * than fuller: nothing behind this door statically imports a plugin at all. A
 * row carries an `id` and a thunk, and the thunk's specifier is a string until
 * somebody calls it — so the module a face lives in, the SolidJS it is written
 * in and the terminal emulator behind kolu's are all on a chunk this door
 * merely NAMES.
 *
 * That is a stronger claim than the split it replaces, and `./fence.test.ts`
 * holds it: the door's static closure reaches no plugin, and every plugin is
 * nevertheless SPELLED here, because a dynamic import's literal specifier
 * survives compilation where a static import's is stripped.
 *
 * ## WHAT A DISABLED PLUGIN IS, IN THE TAB
 *
 * NOT FETCHED. The bundle ships every built plugin's code, in its own chunk, and
 * the tab loads only the chunks the ROSTER names — so a plugin this serve did
 * not compose is not merely undrawn, it is never evaluated, registers nothing
 * and costs one entry in this array. That is the browser's exact twin of *no
 * fiber, no surface, no handler*, and it is what retired the two mount licences
 * `@olai/web` used to carry: a licence is only needed for something you are
 * holding, and the tab is no longer holding it.
 */

import type { Context } from "cordis"

export { BROWSER_ROWS } from "./rows.generated.ts"

/**
 * ONE PLUGIN'S BROWSER HALF, as the tab mounts it — a Cordis plugin, exactly
 * the shape its SERVER half is, plus the surface the tab dials it by.
 *
 * `name` is the row's `id` and the sibling key; the fiber is bound under it, so
 * it is the stamp `ctx.slots` and `ctx.wired` read off `ctx.fiber.name` — never
 * off anything a caller supplies.
 *
 * `surface` is the same value the server half serves, and it is here because
 * the tab has to DIAL this sibling before its faces can read anything. That is
 * why the browser half is one chunk rather than two: what the roster names, the
 * tab both dials and mounts, in one fetch.
 *
 * `inject` and `apply` are Cordis's own. A browser half that names `slots` in
 * its `inject` is held `PENDING` until the app has provided it, which is the
 * same guarantee its server half has had since the bundle became rows — and the
 * reason a face no longer takes the app's furniture as a prop.
 */
export interface BrowserHalf {
  readonly name: string
  readonly surface: { readonly spec: unknown }
  readonly inject?: ReadonlyArray<string>
  readonly apply: (ctx: Context) => void | (() => void)
}

/**
 * ONE ROW.
 *
 * `id` IS the plugin's name — the sibling key, the word `--plugins` takes, the
 * row preferences draws, and the address of its docs page. It is spelled in
 * `../olai.yml` and nowhere else a person edits.
 *
 * `load` is the CHUNK. A thunk rather than a module, so nothing is fetched
 * until the roster says this plugin is running; a literal specifier, so the
 * bundler can split on it. `../generate.ts` writes both out of the row's own
 * module name.
 */
export interface BrowserRow {
  readonly id: string
  readonly load: () => Promise<BrowserHalf>
}

/**
 * ONE ROW as a COMPOSITION ROOT reads it.
 *
 * `id` is the same word {@link BrowserRow} carries. `name` is the MODULE the
 * loader mounts, and it is deliberately a SPECIFIER rather than an import: that
 * is what makes a plugin's presence a runtime fact and is the seam an
 * out-of-tree `olai plugin add` lands on later.
 *
 * `disabled` is the row's OWN default, and it is the file's rather than a field
 * on a manifest. A plugin that needs a secret this machine may not have is off
 * until `--plugins` names it, and saying so in the row means the built-in
 * default and the operator's override are the SAME MECHANISM — one `disabled`,
 * written by the file or written by the patch.
 */
export interface BundleRow {
  readonly id: string
  readonly name: string
  readonly disabled?: boolean
}

export { ROWS } from "./rows.generated.ts"

import { ROWS } from "./rows.generated.ts"

/**
 * EVERY PLUGIN THIS BUILD HAS, in bundle order — the words `--plugins` takes,
 * the rows preferences draws, the set an unknown name is refused against, and
 * the address of each one's docs page.
 *
 * ## Why this door and not `./bundle.ts`
 *
 * Because everything that wants only the NAMES gets only the names. The rows
 * used to be parsed out of the `.yml` at module load, which put `node:fs` and a
 * YAML parser on the graph of the door a docs sweep opens and a browser mounts;
 * a build-time reading costs neither. `./bundle.ts` — the loader, the patch and
 * the report — is a heavier graph for a heavier question, and nothing that
 * wants a list of strings has to open it.
 */
export const BUNDLE_NAMES: ReadonlyArray<string> = ROWS.map((row) => row.id)

/**
 * ...AND WHAT OMITTING THE FLAG RUNS, which is not necessarily all of them.
 *
 * A row that carries its own `disabled` is opt-in: off until `--plugins` names
 * it. That is the built-in default living in the file the loader reads rather
 * than in a field on a manifest, which is what lets the flag and the default be
 * ONE mechanism — a `disabled` written by the row, or a `disabled` written by
 * the patch.
 */
export const DEFAULT_BUNDLE_NAMES: ReadonlyArray<string> = ROWS
  .flatMap((row) => row.disabled === true ? [] : [row.id])

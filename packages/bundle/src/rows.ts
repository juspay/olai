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

import type { Plugin } from "@olai/plugin-api"

export { BROWSER_ROWS } from "./rows.generated.ts"

/**
 * ONE PLUGIN'S BROWSER HALF, as the tab mounts it — the module a row's chunk
 * resolves to, which is a plugin and the surface the tab dials it by.
 *
 * `default` is the plugin, exactly the shape its SERVER half is: `definePlugin`
 * over an Effect whose `needs` the runtime holds it `waiting` against, and whose
 * registrations are finalizers on its own scope. That is the same guarantee its
 * server half has had since the bundle became rows — and the reason a face no
 * longer takes the app's furniture as a prop.
 *
 * THE NAME IS THE PLUGIN'S AND THERE IS ONE OF IT. `default.name` is the row's
 * `id` and the sibling key; the plugin is bound under it, so it is the stamp the
 * slot table and the client lookup are minted from — never anything a caller
 * supplies. This interface carried a SECOND `name` beside it for one round, and
 * the two had to agree: the tab keyed its sibling clients and its mount table by
 * the outer one while the runtime bound the plugin under the inner one, so
 * `Wired.client()` answering a real client rested on an equality nothing checked
 * and no type expressed. One name, and the question cannot be asked.
 *
 * `surface` is the same value the server half serves, and it is here because the
 * tab has to DIAL this sibling before its faces can read anything. That is why
 * the browser half is one chunk rather than two: what the roster names, the tab
 * both dials and mounts, in one fetch.
 *
 * IT IS OPTIONAL, and the absent arm is a whole kind of plugin rather than an
 * unfinished one. An ENGINE composes no sibling surface at all: what an engine
 * contributes to the tab is a row of the chat panel's picker, a name in the
 * header and a sentence on the no-agent face, and every one of those already
 * travels on the chat cell, which is CORE'S. A second surface under
 * `surface/claude/` saying the same thing would be one fact on the wire twice.
 * So such a half is MOUNTED and never DIALLED, and `@olai/web`'s `wire.ts`
 * leaves it out of the sibling map it redials with.
 */
export interface BrowserHalf {
  readonly surface?: { readonly spec: unknown }
  readonly default: Plugin
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

/** ...as a lookup, built once, so {@link bundleRank} is not a linear scan run
 *  inside a comparator. */
const RANKS: ReadonlyMap<string, number> = new Map(BUNDLE_NAMES.map((id, at) => [id, at]))

/**
 * WHERE A NAME SITS IN THE BUILD'S LIST — the comparator every list of plugin
 * names is put in bundle order with.
 *
 * ## Why it is here and not at either of the two places that sort
 *
 * Because there are two, in two different processes: the session's servers
 * (`@olai/server`'s `probes.ts`) and the tab's plugin-keyed slots (`@olai/web`'s
 * plugin runtime). Both were written out — the same `indexOf`, the same `-1`
 * arm, the same two paragraphs — and one cited the other. `BUNDLE_NAMES` is this
 * module's, so the ORDER over it is too, and the rule is stated once for both
 * ends.
 *
 * A stranger sorts LAST: `BUNDLE_NAMES.length` rather than the `-1` a bare
 * `indexOf` gives, which would put a name the build never heard of before every
 * name it did. That is the behaviour an out-of-tree plugin will want the day
 * `olai plugin add` lands.
 *
 * `Array.prototype.sort` is stable, so two strangers keep the order they
 * arrived in. That is the only order there is to keep for them: the build has no
 * opinion about a plugin it never named.
 */
export const bundleRank = (name: string): number => RANKS.get(name) ?? BUNDLE_NAMES.length

/**
 * ...AND THE SORT ITSELF, which is what every caller actually wanted.
 *
 * `bundleRank` extracted the LOOKUP and left the comparator behind, so the two
 * call sites it was written for went on spelling
 * `[...xs].sort((a, b) => bundleRank(k(a)) - bundleRank(k(b)))` — and the engines
 * phase made a third, in a brand-new module whose only line was that one. Three
 * copies of a comparator, each under its own paragraph re-arguing the same
 * volatility, is the shape the paragraph above was written about; the fix it
 * described was half-applied.
 *
 * WHAT THE ORDER IS FOR, said once here instead of three times out there:
 * registration order is the order two dynamic `import()`s came back in, which is
 * a fact about the filesystem and the module cache on the day rather than about
 * `olai.yml`. A PERSON READS THESE LISTS — the servers a session reports, the
 * faces down a transcript's mark column, the engines the picker offers and the
 * install rows under them — and a list that reshuffles itself between boots is a
 * list nobody can read twice. There is an e2e failure behind that sentence.
 *
 * KEYED BY A FUNCTION because the three callers key off three different fields
 * (a row's `id`, a probe's `name`, a hung face's `plugin`), which is exactly why
 * one comparator could not be shared without one.
 */
export const inBundleOrder = <A>(
  items: Iterable<A>,
  keyOf: (one: A) => string,
): ReadonlyArray<A> => [...items].sort((one, other) => bundleRank(keyOf(one)) - bundleRank(keyOf(other)))

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

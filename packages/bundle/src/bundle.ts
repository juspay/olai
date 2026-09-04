/**
 * THE BASE BUNDLE, MOUNTED — what a composition root reads to build a plugin
 * runtime, and the second of this package's two code doors.
 *
 * ## What this replaces
 *
 * `SERVERS`: an `as const` array of statically imported server halves, which a
 * composition root filtered with `enabled(SERVERS, pin)` and then iterated,
 * calling `serve(services)` on each and keying the results by name. Six edits
 * per plugin across three arrays that had to agree in order, and a `--plugins`
 * that was a `.filter` in a general package.
 *
 * What is here instead is `../olai.yml` — one row per plugin, `id` and the
 * MODULE the loader mounts — and a `disabled` patch over those rows. A plugin is
 * a fiber; `--plugins` is a patch; and "disabled means absent" holds at every
 * moment rather than only at boot, because a row that is off never mounts and a
 * plugin that is disposed unwinds every registration it made.
 *
 * ## Two readers of one file, and why that is not two lists
 *
 * The LOADER is one: it reads the file, applies the patch, and drives the entry
 * tree — which is what makes `--plugins` an overlay over rows rather than a
 * filter in code, and is the seam `--dump-config` and `olai plugin add` land on
 * later.
 *
 * The other reader is `../generate.ts`, at BUILD time, which writes the rows out
 * as data (`./rows.ts`) for the one question that has to be answered before
 * anything is mounted: which modules this BUILD has. The vault's vocabulary
 * needs it — a declaration of `kolu-terminal` stays legal on a serve running
 * only odu, so a file's verdict does not depend on a flag it cannot see — and a
 * disabled row is never imported by the loader, so its words have to be read
 * some other way. Two readings of one file, never two lists.
 *
 * ## THE RUNTIME IS `@olai/effect-cordis`'S, and this package has never heard of
 * Cordis
 *
 * `mountRows` and `rowReport` are the bridge's; what is left here is the two
 * things that are genuinely this package's — WHICH file the rows live in, and
 * HOW a row's module specifier becomes a module. The second is the interesting
 * one and is why it is a parameter rather than something the loader does for
 * itself: a row's `name` is a module specifier resolved with a bare `import()`,
 * and under bun's isolated linker an `import()` written inside the loader's own
 * package cannot see a workspace member — a workspace package is linked into its
 * DEPENDENTS' trees, not the root's. So the `import()` is written HERE, in the
 * one package that declares the plugins, which is the same fence every other
 * door in this package keeps, in a third grammar.
 */

import type { Host, PropKind, RowReport } from "@olai/plugin-api"
import { kindWordOf, rowReport } from "@olai/plugin-api"
// THE TWO REACHES PAST `@olai/plugin-api`, and the only ones in the tree, for
// two different reasons.
//
// `mountRows` is a GRAPH: the loader carries `node:url`, `node:fs` and a YAML
// parser, so it cannot be re-exported through a package a TAB imports.
//
// `settled` and `namedBy` are CAPABILITIES, and they are withheld from the
// plugin door on the same grounds `openHost` and `provide` are. It waits on a list of ROWS — a plugin
// holding it could block its own `apply` until its siblings stopped moving,
// which is a fiber waiting on the runtime that is waiting on it. A plugin's
// answer to "is the thing I need here yet" is `needs`, and the runtime's answer
// is `PENDING`; this is the composition root's verb for the one question a
// plugin cannot be asking. Everything else this file spends of the bridge comes
// through the door above.
// ...and `namedBy` is the THIRD, arriving with the loader surface and withheld
// on the same grounds as `settled`: it answers which service keys each row's
// fiber is standing on, which is the bundle read from the inside. A plugin
// holding it could enumerate what its siblings need, which is the one question
// the keyed services are shaped to keep it from asking.
import { namedBy, settled } from "@olai/effect-cordis"
import { flipRow, mountRows } from "@olai/effect-cordis/loader"
import { Effect } from "effect"

import { BUNDLE_NAMES, ROWS } from "./rows.ts"

/** Where the rows live, as a URL — the loader's `baseUrl` and the file the
 *  include reads, spelled once so the two cannot point at different files. */
const BASE_URL = new URL(".", import.meta.url).href

/** The path the include is given, relative to {@link BASE_URL}. */
const BUNDLE = "../olai.yml"

/**
 * THE ROWS AND THE NAME LISTS ARE `./rows.ts`'S NOW, and this file re-exports
 * them because every caller that mounts also wants at least one of them.
 *
 * They used to be parsed HERE, at module load, out of the same `.yml` the loader
 * reads at mount — "two readers of one file, never two lists", which was the
 * honest shape while nothing else was generated. It is not the honest shape any
 * more: the browser's rows and two more doors are written from that file at
 * build time (`../generate.ts`), so the rows are already available as data, and
 * a second parse here would put `node:fs` and a YAML parser on the graph of a
 * door whose other job is to name plugins for a docs sweep and a tab.
 *
 * ONE SOURCE, still. The generator reads `olai.yml`; the loader reads
 * `olai.yml` itself at mount, which is what keeps `--plugins` a PATCH over rows
 * rather than a filter in code. What is gone is the second parse, not the second
 * reader.
 */
export { BUNDLE_NAMES, type BundleRow, DEFAULT_BUNDLE_NAMES, ROWS } from "./rows.ts"

/** WHAT BECAME OF ONE ROW, as the bridge reads it off the live registry — four
 *  states, and `off` says nothing about WHO turned a row off. The row's own
 *  default and the operator's flag are the same field by design
 *  ({@link pluginsPatch}), so the only thing that can tell them apart is whether
 *  a flag was given at all, which is the composition root's to hold. */
export type { RowReport, RowState } from "@olai/plugin-api"

/**
 * `--plugins`, AS A PATCH — the overlay an operator's flag writes over the rows.
 *
 * `null` is nobody having said, and it writes NO patch at all: the rows' own
 * `disabled` stands, which is the built-in default. That is also what keeps the
 * distinction between an omitted flag and one typed out loud — the preferences
 * row is drawn from it, and a patch that had already expanded `null` could not
 * tell a reader which of the two they were looking at.
 *
 * A flag that WAS given writes a `disabled` onto EVERY row, set from whether the
 * flag named it. Both directions, deliberately: a name the flag gives turns a
 * row ON even where the file left it off, which is the whole of how an opt-in
 * plugin is opted into, and a name the flag omits turns a row off even where the
 * file left it on. `--plugins=` — somebody saying NONE out loud — is that with an
 * empty list, and disables every row.
 *
 * That is exactly the shape the include's own patch algorithm takes: `{ id,
 * …overrides }` copied onto the matching row. The flag refuses an unknown name
 * where a person types one, so a patch for a row that does not exist is not this
 * function's failure to report — the loader logs it and carries on, which is the
 * right arm for an overlay that outlived a build.
 */
export const pluginsPatch = (
  names: ReadonlyArray<string> | null,
): ReadonlyArray<{ readonly id: string; readonly disabled?: boolean }> =>
  names === null ? [] : ROWS.map((row) => ({ id: row.id, disabled: !names.includes(row.id) }))

/**
 * WHAT EVERY BUILT PLUGIN TEACHES THE VAULT, running or not — the declarations a
 * vocabulary's `built` half is made of.
 *
 * Every row's module is imported, INCLUDING the ones this serve disabled, and
 * that is the point rather than a leak: a DECLARATION is refused against what the
 * binary was built with, so `{"type":"kolu-terminal"}` is a legal row on a
 * machine running only odu and a file's verdict does not depend on a flag it
 * cannot see. What a disabled plugin does not get is a fiber — no surface, no
 * handler, no probe, no `admits` — and reading a word off a module is none of
 * those.
 *
 * The word is composed the same way the `kinds` service composes it at
 * registration, from the row's `id`, so the two spellings cannot drift
 * (`./kinds.test.ts` holds them equal).
 */
export const declaredKinds: Effect.Effect<ReadonlyMap<string, PropKind>> = Effect.promise(
  async () => {
    const table = new Map<string, PropKind>()
    for (const row of ROWS) {
      const module = await importByName(row.name) as { readonly kinds?: ReadonlyArray<PropKind> }
      for (const kind of module.kinds ?? []) {
        table.set(kindWordOf(row.id, kind.kind), { ...kind, kind: kindWordOf(row.id, kind.kind) })
      }
    }
    return table
  },
)

/** The loader's module-resolution seam, written where the plugins are declared —
 *  see this module's header for why it cannot live in the loader's own package,
 *  and `@olai/effect-cordis`'s `mountRows` for what the slot it fills is pinned
 *  to. */
const importByName = (specifier: string): Promise<unknown> => import(specifier)

/**
 * EVERY ROW'S STATE, off the live registry — which plugin is where.
 *
 * A LIVE READ, always was, and the sentence that used to stand here said the
 * opposite of what this function does: *a boot snapshot in every caller this
 * phase has… the day something can mount or fail a row after the boot, this is
 * one of the two places that has to learn to move.* What was a snapshot is what
 * the CALLER did with the answer, not the answer — `@olai/server`'s `serve.ts`
 * asked once and held it, because nothing could move a row afterwards.
 *
 * {@link setRow} is the day named in that sentence, and the reading needed
 * nothing: it walks the registry at the moment it is asked. What moved is one
 * floor up, where the composition root now re-asks after every flip.
 */
export const reportBundle = (host: Host): Effect.Effect<ReadonlyMap<string, RowReport>> =>
  rowReport(host, BUNDLE_NAMES)

/**
 * WHICH DOORS EACH ROW IS STANDING ON — every service key a running row's
 * `needs` declared, off the live registry.
 *
 * One half of the join that answers *what stops if I turn this off*: the other
 * is who stands behind each door, which is core's own offers table, and the
 * composition root is where the two meet (`@olai/server`'s `runtime.ts`).
 *
 * NOT AN EFFECT, unlike every other verb on this door — `@olai/effect-cordis`'s
 * `namedBy` argues that where it is written, and the short of it is that this
 * walks a map and its one caller is a roster built synchronously.
 *
 * A ROW WITH NO FIBER IS ABSENT, which is the honest reading rather than a gap:
 * a row nobody imported has no declaration to read, and it cannot be carried by
 * anything anyway, because it is already off.
 */
export const rowsNaming = (host: Host): ReadonlyMap<string, ReadonlyArray<string>> =>
  namedBy(host, BUNDLE_NAMES)

/**
 * TURN ONE ROW ON OR OFF ON THE RUNNING BUNDLE — the loader surface's verb, as a
 * composition root spends it, and this package's third door onto the bridge.
 *
 * Answers whether there WAS such a row; `false` is a caller naming a plugin this
 * build does not have.
 *
 * ## Two calls, for {@link mountBundle}'s reason exactly
 *
 * The flip moves ONE row. What a flip is FOR is the rows around it: turning the
 * chat row off revokes the four doors it stands behind, which unloads every
 * fiber that named one, and turning it back on wakes them — a whole turn later,
 * each. So the settle is not a nicety here, it is the difference between a
 * roster read the instant the switch was pressed and a roster read of the bundle
 * the press produced. Without it, a panel would draw the engines `running` for
 * one frame after the row that carries them had gone, and the tab would redial
 * onto a wire that was still coming apart.
 *
 * EVERY ROW THIS BUILD HAS, and not the flipped one: the point is the siblings.
 *
 * ## WHAT IT DOES NOT DO
 *
 * It writes nothing — not `olai.yml`, not a settings file, not anywhere. A flip
 * is the instance's for as long as the process runs, and the boot-time answer
 * stays the rows, the flag and nix. `@olai/effect-cordis`'s `flipRow` is where
 * that is kept true against a loader whose own instinct is to persist.
 *
 * And it says nothing about what came of it. A row that will not come back —
 * a module that now throws, an `apply` that dies on a socket that has gone —
 * lands `failed` with its own sentence, and reading that is {@link reportBundle},
 * which the caller was going to ask anyway.
 */
export const setRow = (
  host: Host,
  id: string,
  enabled: boolean,
): Effect.Effect<boolean> =>
  Effect.flatMap(
    flipRow(host, id, !enabled),
    (found) => found ? Effect.as(settled(host, BUNDLE_NAMES), true) : Effect.succeed(false),
  )

/**
 * MOUNT THE BUNDLE ON `host` — the rows, patched by the flag, as fibers.
 *
 * Returns once every row that is going to load has loaded AND APPLIED, so a
 * caller can read the kind and surface registries straight afterwards and get
 * the whole build.
 *
 * ## Why that is two calls now
 *
 * It was one, and the sentence above was true by accident. `mountRows` awaits
 * the include's entries being CREATED — the module imported, the fiber
 * constructed — and the loader's own `await()` walks a tree the include's rows
 * were never linked into (`@olai/effect-cordis`'s `host.ts` records that fact for
 * its own reason: `rowReport` reads the REGISTRY, and the paragraph above it says
 * why). An `apply` that finished inside the microtask chain of the mount was
 * covered; one that awaited anything at all was not, and neither was a row woken
 * by a service a SIBLING ROW provides — that one is a whole turn later.
 *
 * That second case is what a bundle whose rows stand behind doors creates: one
 * row provides, and every row that named its key leaves `PENDING` and applies a
 * turn after the mount returned. Without the settle, `@olai/server`'s vocabulary
 * read two statements down would miss a tenant's kind FOR THE LIFE OF THE
 * PROCESS — the store's codec holds its answer — and {@link reportBundle} above
 * would call a running row `waiting` until the next start. Both silently, which
 * is the shape of failure worth spending a call to make impossible.
 *
 * KEPT INSIDE THIS FUNCTION rather than taught to every caller: the sentence
 * this doc opens with is the promise `mountBundle` has always made, and a second
 * step in a composition root is that promise moved out of the place a reader
 * looks for it.
 *
 * A ROW THAT FAILS DOES NOT TAKE THE BOOT DOWN, unchanged. A plugin whose Effect
 * dies lands in `failed`, having installed nothing — every registration is a
 * finalizer, and the ones it had made are unwound — with its siblings running.
 * So a plugin whose serve dies on a socket that is not there is one absent
 * plugin rather than a server that will not start; the settle waits for its
 * fiber to stop moving and asks nothing about where it stopped.
 */
export const mountBundle = (
  host: Host,
  names: ReadonlyArray<string> | null,
): Effect.Effect<void> =>
  Effect.flatMap(
    mountRows(host, {
      baseUrl: BASE_URL,
      path: BUNDLE,
      patches: pluginsPatch(names),
      resolve: importByName,
    }),
    // EVERY ROW THIS BUILD HAS, and not only the ones the flag left on: a row
    // the patch disabled never entered the registry, so it holds no inertia and
    // costs the walk one `has` — while a list narrowed to the enabled ones would
    // be a second reading of the flag beside {@link pluginsPatch}'s.
    () => settled(host, BUNDLE_NAMES),
  )

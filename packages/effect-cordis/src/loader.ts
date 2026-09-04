/**
 * THE LOADER, AS AN EFFECT — a declarative bundle mounted on a host, and this
 * package's SECOND door.
 *
 * ## Why it is a door of its own
 *
 * A GRAPH, and it is the same three-doors-three-graphs discipline every other
 * package in this tree keeps. `@cordisjs/plugin-loader` and
 * `@cordisjs/plugin-include` read a file off a disk and resolve module
 * specifiers: `node:url`, `node:fs`, a YAML parser. The TAB mounts plugins
 * through this package too — a browser half is a plugin exactly as a server half
 * is — and a browser has no bundle file, no rows and no loader. Behind one door
 * the tab's chunk would carry all of it, and it does not fail at a boundary
 * claim: it fails at `bun build`, on `Browser polyfill for module "node:url"
 * doesn't have a matching export named "pathToFileURL"`.
 *
 * So the root door is the RUNTIME — a host, the services on it, a plugin, a
 * waterfall — and this one is the LOADER. Everything the browser needs is on the
 * first; everything that reads a disk is on the second.
 *
 * ## The second verb, and why it is here rather than beside `mountPlugin`
 *
 * {@link flipRow} turns one row off or on after the mount. It is the LOADER's
 * because its subject is a loader ENTRY — the row's own `disabled`, the same
 * field the file writes and the patch overrides — and not a fiber. Reaching for
 * the fiber instead is available and is wrong twice over: the loader would
 * record the dispose as the row having turned ITSELF off and write the bundle
 * file to say so, and a row disposed behind the entry's back cannot be brought
 * back, because {@link Entry.refresh} declines an entry that still remembers a
 * fiber. One field, moved where the loader is already watching it.
 */

import Include from "@cordisjs/plugin-include"
import type { Entry } from "@cordisjs/plugin-loader"
import Loader from "@cordisjs/plugin-loader"
import { Effect } from "effect"

import { interrupt } from "./lifecycle.ts"
import { ctxOf, type Host } from "./host.ts"

/**
 * ONE ROW OF A DECLARATIVE BUNDLE — `id` and the MODULE the loader mounts,
 * plus whether this build leaves it off.
 */
export interface Row {
  readonly id: string
  readonly disabled?: boolean
  /** The plugin's own config, validated at load against the schema it
   *  exports beside `apply`. Absent is the ordinary case. */
  readonly config?: unknown
}

/**
 * MOUNT A BUNDLE FILE — the loader entry, as an Effect.
 *
 * Everything Cordis-shaped about a declarative bundle is behind this one call:
 * the loader plugin, the include plugin that reads the file and applies the
 * patches, the base URL both resolve against, and the module-resolution seam.
 *
 * ## The resolver is the CALLER'S, and it has to be
 *
 * A row's `name` is a module specifier, and the loader resolves it with a bare
 * `import()` from inside its own package — which under bun's isolated linker
 * cannot see a workspace member, because a workspace package is linked into its
 * DEPENDENTS' trees and not the root's. So the `import()` has to be written in
 * the package that DECLARES the plugins, and it arrives here as `resolve`.
 *
 * **The slot it fills is pin-coupled.** `loader.internal` is upstream's slot for
 * Node's own `ModuleLoader`, left `undefined` where the internals are not
 * reachable, which under bun is always. `EntryTree.import` calls exactly one
 * method on it, so what is assigned is one method and a version tag, cast:
 * upstream types the slot as the whole `ModuleLoader`. **Verified against
 * `@cordisjs/plugin-loader@1.0.0-rc.6`** (the pinned revision —
 * `npins/sources.json`, name `cordis`). A revision that renames the slot,
 * reshapes it, or starts calling a second method on it fails at RUNTIME rather
 * than at typecheck, because the cast is what makes the assignment legal at all;
 * `just cordis-deps` does not catch that and cannot, because it asks about
 * versions and not about shapes. THE UPSTREAM ASK is a PUBLIC resolver seam — a
 * `resolve` option on `Loader.Config`, or a documented `import` hook — so a
 * consumer whose module graph the loader cannot walk is a supported case rather
 * than a cast.
 *
 * ## What it RETURNS having done, exactly
 *
 * Every row this build has: its module imported, and its fiber created. That is
 * the whole of the guarantee and it is less than it reads: `Entry.init` starts
 * the fiber and deliberately does not await it, and `ctx.loader.await()` walks
 * the LOADER's tree, which the include's rows were never linked into (the
 * argument is `./host.ts`'s `fibersOf`, which reads the registry instead and for
 * the same reason). So an `apply` that finishes inside this call's own microtask
 * chain is covered, and one that awaits anything at all is not — nor is a row
 * woken by a service a SIBLING ROW provides, which is a whole turn later.
 *
 * The sentence here used to be "it returns once every row that is going to load
 * has loaded", which read as the second thing and promised the first. WAITING
 * OUT THE REST is `./host.ts`'s `settled`, and `@olai/bundle`'s `mountBundle` is
 * the two of them — which is where a bundle's whole promise is now made and
 * kept.
 */
export const mountRows = (host: Host, options: {
  /** Where the rows live — the loader's `baseUrl` and what `path` is relative to. */
  readonly baseUrl: string
  /** The bundle file, relative to {@link baseUrl}. */
  readonly path: string
  /** Overlays applied over the rows on the way in — `{ id, disabled }` or
   *  `{ id, config }` copied onto the matching row. An empty list is nobody
   *  having said anything, and the rows' own defaults stand. */
  readonly patches: ReadonlyArray<Partial<Row> & { readonly id: string }>
  /** How a row's module specifier becomes a module — see the header. */
  readonly resolve: (specifier: string) => Promise<unknown>
}): Effect.Effect<void> =>
  Effect.promise(async () => {
    const ctx = ctxOf(host)
    ctx.baseUrl = options.baseUrl
    await ctx.plugin(Loader)
    ;(ctx.loader as unknown as { internal: unknown }).internal = {
      version: "v1",
      import: (specifier: string) => options.resolve(specifier),
    }
    // THE ROWS, AS THE INCLUDE MAKES THEM — registered BEFORE the include, which
    // is the whole of why this line is here and not further down: the event
    // fires from the `Entry` constructor, so a listener attached afterwards
    // would hear about every row this build adds LATER and none of the ones it
    // has. See {@link entriesOf} for why the handle cannot be had any other way.
    const rows: Array<Entry> = []
    ctx.on("loader/entry-init", (entry: Entry) => void rows.push(entry))
    ;(ctx as unknown as Record<symbol, Array<Entry>>)[ROWS] = rows
    await ctx.plugin(Include, { path: options.path, patches: [...options.patches] })
    await ctx.loader.await()
  })

/**
 * WHERE THE ROWS HANG on the host — a SYMBOL, for {@link ./host.ts}'s `HELD`
 * reason: Cordis's reflect proxy passes a symbol straight through to the
 * underlying object rather than routing it through `provide`/`inject`, so this
 * is not a service a plugin could name.
 */
const ROWS: unique symbol = Symbol.for("olai.effect-cordis.rows")

/**
 * THE ROWS THIS HOST MOUNTED, or none.
 *
 * ## Why they are COLLECTED rather than asked for
 *
 * Because the pin gives no other handle. `@cordisjs/plugin-include` is an
 * `EntryTree` mounted as an ORDINARY PLUGIN, so three doors that would normally
 * lead to it are all shut: it is not a `Service`, so it claims no key on the
 * context; `ctx.fiber.entry` is undefined at its construction, so it never links
 * itself as anybody's `subtree`; and `ctx.loader.entries()` walks the LOADER's
 * own store, which the rows were never put in (`./host.ts`'s `fibersOf` records
 * the same fact from the other side, and reads the registry for the same
 * reason).
 *
 * What IS public is `loader/entry-init`, emitted from the `Entry` constructor
 * with the entry itself. So the rows are gathered as they are made.
 *
 * THE `id` IS NOT READABLE AT THAT MOMENT — `EntryGroup.create` constructs the
 * entry and assigns `options` on the line after — which is why this keeps the
 * entries and matches on `options.id` at FLIP time rather than building a map on
 * the way in. It is a walk over a handful of rows, once per press.
 *
 * AN EMPTY LIST IS A REAL STATE and is every host that mounted its plugins
 * directly: `mountPlugin` makes a fiber and no entry, so a test's toy row has
 * nothing to flip. {@link flipRow} answers that as "no such row", which is
 * exactly what it is.
 */
const entriesOf = (host: Host): ReadonlyArray<Entry> =>
  (ctxOf(host) as unknown as Record<symbol, Array<Entry> | undefined>)[ROWS] ?? []

/**
 * TURN ONE ROW OFF OR ON, on the running host — the loader surface's one verb,
 * and the only thing in this tree that moves a row after the mount.
 *
 * Answers whether there WAS such a row. `false` is a caller naming a plugin this
 * build does not have, which is a stale reader rather than a failure of the
 * flip; there is nothing else that can go wrong here, because the two directions
 * are the loader's own reconciliation and it swallows a module that will not
 * import (the row lands with no fiber, which reads as `off`).
 *
 * ## IT WRITES NOTHING, and that took choosing the right field
 *
 * `EntryTree.update(id, …)` — the tree-level verb — calls `tree.write()`, and
 * the include's `write()` dumps the whole entry list back over `olai.yml`. That
 * is the loader's own answer for a settings page that OWNS its config file, and
 * it is the opposite of this phase's ruling: a flip is the instance's, for as
 * long as the process runs, and the boot-time answer stays the file, the flag
 * and nix. So this reaches the ENTRY and calls `entry.update`, which reconciles
 * without writing.
 *
 * The other way a write can happen is subtler and is closed by ORDER rather than
 * by avoidance. Cordis tells the loader about every dispose, and the loader
 * reads a dispose it did not cause as *the plugin turned itself off* — it sets
 * `options.disabled = true` and writes the file. `entry.update` sets the option
 * BEFORE it disposes, and the loader's handler returns early on an entry that is
 * already disabled, so the branch that writes is unreachable from here.
 *
 * ## What each direction actually does
 *
 * OFF is `fiber.dispose()`, which closes the plugin's Effect scope and runs
 * every finalizer it installed, in reverse — its kinds, its wake, its sibling
 * surface, its slots, and any door it stood behind. Revoking a door unloads
 * every fiber that named it, which is the reactive half doing the work this
 * phase is about.
 *
 * ON re-imports the row's module and mounts a fresh fiber. The module cache
 * makes the import free and hands back the same plugin value, so what comes back
 * is a second ACTIVATION rather than a second plugin — which is the case
 * `@olai/plugin-api`'s `LocalState` is keyed by NAME for, and the case
 * `./registry.ts`'s claims are suspended for.
 *
 * ## IT WAITS OUT ITS OWN ROW, and `entry.update` does not
 *
 * `Entry.update`'s disable arm is `this.fiber?.dispose(); return` — the dispose
 * is FIRED AND NOT AWAITED, so the `await` on `entry.update` returns while the
 * plugin's scope is still unwinding. That is invisible from outside and cost the
 * whole feature its meaning: Cordis takes the fiber out of the registry FIRST
 * and closes the Effect scope after, so `./host.ts`'s `settled` — which waits on
 * the inertia of fibers it can find — has nothing to wait on and returns at once.
 *
 * WHAT THAT LOOKED LIKE, measured rather than reasoned: switch the chat row off
 * and read the offers table, and three of the four doors it stands behind are
 * still claimed. Finalizers run LIFO, so the last door offered is the first
 * released, and the read lands after exactly that one. Fifty milliseconds later
 * the table is empty and every dependent row is `waiting` naming the right tags.
 * A panel drawn from the first read says the engines are running on a serve with
 * no chat in it.
 *
 * So the fiber is caught BEFORE the update takes it away, and its `inertia` — the
 * promise Cordis holds across a transition, and the same field `settled` reads —
 * is waited out afterwards. A LOOP because finishing one transition can start
 * another (revoking a door unloads the rows that named it), and {@link PASSES}
 * for the reason `settled` is bounded: the termination argument is a claim about
 * a pin, and a revision that left a resolved promise on the field would turn this
 * into a hang at every press.
 *
 * ONLY ON THE WAY OUT. Coming back, the fiber is IN the registry and `settled`
 * can see it, which is where waiting for a row to finish applying belongs.
 *
 * NEITHER DIRECTION WAITS for the REST of the bundle to stop moving. That is
 * `./host.ts`'s `settled`, and `@olai/bundle` is where the two are one call —
 * exactly as they are for the mount.
 */
export const flipRow = (host: Host, id: string, disabled: boolean): Effect.Effect<boolean> =>
  Effect.promise(async () => {
    const entry = entriesOf(host).find((one) => one.options.id === id)
    if (entry === undefined) return false
    // CAUGHT BEFORE THE UPDATE, because the update is what disposes it and a
    // disposed row is one nothing else can hand back.
    const going = disabled ? entry.fiber : undefined
    if (going !== undefined) interrupt(going)
    await entry.update({ disabled })
    for (let pass = 0; pass < PASSES && going?.inertia !== undefined; pass += 1) {
      await going.inertia
    }
    return true
  })

/** How many transitions this waits out before it stops waiting — `./host.ts`'s
 *  `PASSES` for the same reason, spelled here because the two are bounding
 *  different loops over the same pinned field and a shared constant would read
 *  as one rule rather than two applications of one argument. */
const PASSES = 100

/**
 * EACH ROW'S CONFIG, off the live entries — what `olai.yml` and the CLI
 * patches left on the row, before the plugin's schema folds defaults in.
 *
 * A LIVE READ of the loader entries, so a patch applied at mount is what a
 * roster draws. A row with no `config:` is absent from the map rather than
 * present-and-empty: the panel draws values only where somebody set them.
 */
export const rowConfigs = (
  host: Host,
): ReadonlyMap<string, Readonly<Record<string, unknown>>> => {
  const table = new Map<string, Readonly<Record<string, unknown>>>()
  for (const entry of entriesOf(host)) {
    const id = entry.options.id
    const config = (entry.options as { readonly config?: unknown }).config
    if (
      typeof id === "string"
      && config !== undefined
      && config !== null
      && typeof config === "object"
      && !Array.isArray(config)
    ) {
      table.set(id, config as Readonly<Record<string, unknown>>)
    }
  }
  return table
}

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
 */

import Include from "@cordisjs/plugin-include"
import Loader from "@cordisjs/plugin-loader"
import { Effect } from "effect"

import { heldBy, type Host } from "./host.ts"

/**
 * ONE ROW OF A DECLARATIVE BUNDLE — `id` and the MODULE the loader mounts,
 * plus whether this build leaves it off.
 */
export interface Row {
  readonly id: string
  readonly disabled?: boolean
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
 * It RETURNS once every row that is going to load has loaded.
 */
export const mountRows = (host: Host, options: {
  /** Where the rows live — the loader's `baseUrl` and what `path` is relative to. */
  readonly baseUrl: string
  /** The bundle file, relative to {@link baseUrl}. */
  readonly path: string
  /** Overlays applied over the rows on the way in — `{ id, disabled }` copied
   *  onto the matching row. An empty list is nobody having said anything, and
   *  the rows' own defaults stand. */
  readonly patches: ReadonlyArray<Partial<Row>>
  /** How a row's module specifier becomes a module — see the header. */
  readonly resolve: (specifier: string) => Promise<unknown>
}): Effect.Effect<void> =>
  Effect.promise(async () => {
    const ctx = heldBy(host).ctx
    ctx.baseUrl = options.baseUrl
    await ctx.plugin(Loader)
    ;(ctx.loader as unknown as { internal: unknown }).internal = {
      version: "v1",
      import: (specifier: string) => options.resolve(specifier),
    }
    await ctx.plugin(Include, { path: options.path, patches: [...options.patches] })
    await ctx.loader.await()
  })


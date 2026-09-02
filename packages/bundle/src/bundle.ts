/**
 * THE BASE BUNDLE, MOUNTED — what a composition root reads to build a plugin
 * runtime, and the third of this package's doors.
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
 * MODULE the loader mounts — and a `disabled` patch over those rows. A plugin
 * is a Cordis fiber; `--plugins` is a patch; and "disabled means absent" holds
 * at every moment rather than only at boot, because a row that is off never
 * mounts and a fiber that is disposed unwinds every registration it made.
 *
 * ## Two readers of one file, and why that is not two lists
 *
 * `@cordisjs/plugin-include` is the LOADER's reader: it reads the file, applies
 * the patch, and drives the entry tree — which is what makes `--plugins` an
 * overlay over rows rather than a filter in code, and is the seam
 * `--dump-config` and `olai plugin add` land on later.
 *
 * The other reader is `../generate.ts`, at BUILD time, which writes the rows
 * out as data (`./rows.ts`) for the one question that has to be answered before
 * anything is mounted: which modules this BUILD has. The vault's vocabulary
 * needs it — a declaration of `kolu-terminal` stays legal on a serve running
 * only odu, so a file's verdict does not depend on a flag it cannot see — and a
 * disabled row is never imported by the loader, so its words have to be read
 * some other way. Two readings of one file, never two lists.
 *
 * ## The resolver, and why it is in THIS file
 *
 * A row's `name` is a module specifier, and the loader resolves it with a bare
 * `import()` from inside its own package. Under bun's isolated linker that
 * cannot see a workspace member: `node_modules/@cordisjs/plugin-loader` walks up
 * to the ROOT `node_modules`, and a workspace package is linked into its
 * DEPENDENTS' trees, not the root's. So the loader's own module-resolution seam
 * (`loader.internal`) is filled with an `import()` written HERE, in the one
 * package that declares the plugins — which is the same fence every other door
 * in this package keeps, in a third grammar.
 *
 * ## That seam is PIN-COUPLED, and here is what it is coupled to
 *
 * `loader.internal` is upstream's slot for Node's own `ModuleLoader`, which the
 * loader uses when it can reach the internals and leaves `undefined` when it
 * cannot — which is always, under bun. `EntryTree.import` calls exactly one
 * method on it, so what is assigned below is one method and a version tag, cast.
 *
 * **Verified against `@cordisjs/plugin-loader@1.0.0-rc.6`** (the pinned
 * revision — `npins/sources.json`, name `cordis`). A revision that renames the
 * slot, reshapes it, or starts calling a second method on it fails at RUNTIME
 * rather than at typecheck, because the cast is what makes the assignment legal
 * at all. `just cordis-deps` does not catch that and cannot: it asks about
 * versions, not shapes.
 *
 * THE UPSTREAM ASK is therefore a PUBLIC resolver seam — something like a
 * `resolve` option on `Loader.Config`, or a documented `import` hook — so a
 * consumer whose module graph the loader cannot walk is a supported case rather
 * than a cast. It goes beside the tsconfig-strictness ask in `nix/cordis.nix`;
 * both are the same class of thing, which is a pin olai cannot use as written
 * without saying so out loud.
 */

import Include from "@cordisjs/plugin-include"
import Loader from "@cordisjs/plugin-loader"
import type { EntryOptions } from "@cordisjs/plugin-loader"
import type { PropKind } from "@olai/plugin-api"
import { kindWordOf } from "@olai/plugin-api"
import { BUNDLE_NAMES, ROWS } from "./rows.ts"
import type { Context, Fiber } from "cordis"
import { FiberState } from "cordis"

/** Where the rows live, as a URL — the loader's `baseUrl` and the file Include
 *  reads, spelled once so the two cannot point at different files. */
const BASE_URL = new URL(".", import.meta.url).href

/** The path Include is given, relative to {@link BASE_URL}. */
const BUNDLE = "../olai.yml"

/**
 * THE ROWS AND THE NAME LISTS ARE `./rows.ts`'S NOW, and this file re-exports
 * them because every caller that mounts also wants at least one of them.
 *
 * They used to be parsed HERE, at module load, out of the same `.yml` Include
 * reads at mount — "two readers of one file, never two lists", which was the
 * honest shape while nothing else was generated. It is not the honest shape any
 * more: the browser's rows and two more doors are written from that file at
 * build time (`../generate.ts`), so the rows are already available as data, and
 * a second parse here would put `node:fs` and a YAML parser on the graph of a
 * door whose other job is to name plugins for a docs sweep and a tab.
 *
 * ONE SOURCE, still. The generator reads `olai.yml`; Include reads `olai.yml`
 * itself at mount, which is what keeps `--plugins` a PATCH over rows rather
 * than a filter in code. What is gone is the second parse, not the second
 * reader.
 */
export { BUNDLE_NAMES, type BundleRow, DEFAULT_BUNDLE_NAMES, ROWS } from "./rows.ts"

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
 * That is exactly the shape include's own patch algorithm takes: `{ id,
 * …overrides }` copied onto the matching row. The flag refuses an unknown name
 * where a person types one, so a patch for a row that does not exist is not this
 * function's failure to report — include logs it and carries on, which is the
 * right arm for an overlay that outlived a build.
 */
export const pluginsPatch = (
  names: ReadonlyArray<string> | null,
): ReadonlyArray<Partial<EntryOptions>> =>
  names === null ? [] : ROWS.map((row) => ({ id: row.id, disabled: !names.includes(row.id) }))

/**
 * WHAT EVERY BUILT PLUGIN TEACHES THE VAULT, running or not — the declarations
 * a vocabulary's `built` half is made of.
 *
 * Every row's module is imported, INCLUDING the ones this serve disabled, and
 * that is the point rather than a leak: a DECLARATION is refused against what
 * the binary was built with, so `{"type":"kolu-terminal"}` is a legal row on a
 * machine running only odu and a file's verdict does not depend on a flag it
 * cannot see. What a disabled plugin does not get is a fiber — no surface, no
 * handler, no probe, no `admits` — and reading a word off a module is none of
 * those.
 *
 * The word is composed the same way `ctx.kinds` composes it at registration,
 * from the row's `id`, so the two spellings cannot drift (`./kinds.test.ts`
 * holds them equal).
 */
export const declaredKinds = async (): Promise<ReadonlyMap<string, PropKind>> => {
  const table = new Map<string, PropKind>()
  for (const row of ROWS) {
    const module = await importByName(row.name) as { readonly kinds?: ReadonlyArray<PropKind> }
    for (const kind of module.kinds ?? []) {
      table.set(kindWordOf(row.id, kind.kind), { ...kind, kind: kindWordOf(row.id, kind.kind) })
    }
  }
  return table
}

/** The loader's module-resolution seam, written where the plugins are declared
 *  — see this module's header for why it cannot live in the loader's package. */
const importByName = (specifier: string): Promise<unknown> => import(specifier)

/**
 * WHAT BECAME OF ONE ROW — the mechanical half of the word a preferences row
 * wears, and deliberately four states rather than five.
 *
 * `off` here means the loader declined to load the row, and says nothing about
 * WHO wrote the `disabled` that made it decline. The row's own default and the
 * operator's flag are the same field by design ({@link pluginsPatch}), so the
 * only thing that can tell them apart is whether a flag was given at all —
 * which is `--plugins`, which is the composition root's to hold and not this
 * file's. So the root splits `off` into `off` and `optIn` when it builds the
 * roster, and this reading stays about the LOADER.
 */
export type RowState = "running" | "waiting" | "failed" | "off"

/** One row's state, and the plugin's own words if its start threw. */
export interface RowReport {
  readonly state: RowState
  /** VERBATIM, and only on `failed` — what the plugin threw, with nothing
   *  composed around it. Absent where it threw something with no message. */
  readonly fault?: string
}

/**
 * EVERY ROW'S STATE, off the live registry — which plugin fiber is where.
 *
 * ## Why the registry and not the loader's entries
 *
 * `@cordisjs/plugin-include` is an `EntryTree` of its own, and it is mounted
 * with `ctx.plugin(Include, …)` rather than as a loader entry — so the link
 * `EntryTree`'s constructor draws (`ctx.fiber.entry.subtree = this`) is never
 * drawn, and `ctx.loader.entries()` yields nothing about the rows. The
 * REGISTRY has them either way: a row that loaded called `ctx.plugin` on the
 * module it named, and a runtime is keyed by that module's own `name` export,
 * which every row's server half exports as the row's `id`. One reading, and it
 * does not depend on a private link between two of the pin's packages.
 *
 * ## A row that never loaded is ABSENT, and that is the `off` arm
 *
 * The loader does not import a disabled row at all, so there is no runtime to
 * find and nothing to read a state off. That absence IS the answer — the same
 * absence the wire, the faces and the kind table already show — rather than a
 * missing case.
 *
 * ## ASYNC because a fault is only readable by asking for it
 *
 * Cordis keeps a failed fiber's error private and re-throws it from `await()`,
 * which for a settled fiber is one already-rejected promise. So the walk awaits
 * exactly the fibers that are in `FAILED` and nothing else; every other row
 * answers synchronously and the returned promise is already resolved by the
 * time the caller has it.
 */
export const reportBundle = async (ctx: Context): Promise<ReadonlyMap<string, RowReport>> => {
  const wanted = new Set(BUNDLE_NAMES)
  const fibers = new Map<string, Fiber>()
  ctx.registry.forEach((runtime) => {
    const id = runtime.name
    if (id === undefined || !wanted.has(id)) return
    // The FIRST fiber, and a row has exactly one: the bundle mounts each module
    // once. A second would mean two rows naming one module, which the entry ids
    // already forbid.
    for (const fiber of runtime.fibers) {
      if (!fibers.has(id)) fibers.set(id, fiber)
    }
  })
  const table = new Map<string, RowReport>()
  for (const row of ROWS) {
    const fiber = fibers.get(row.id)
    if (fiber === undefined) {
      table.set(row.id, { state: "off" })
      continue
    }
    table.set(row.id, await reportOf(fiber))
  }
  return table
}

/** One fiber's state, as a row's word — and the one place the runtime's six
 *  states are collapsed into the four a person is shown. `LOADING` is `waiting`
 *  with the same sentence under it (a row that has not finished starting has
 *  not started), and `UNLOADING`/`DISPOSED` are `off` because a fiber on its
 *  way out has already unwound every registration it made. */
const reportOf = async (fiber: Fiber): Promise<RowReport> => {
  switch (fiber.state) {
    case FiberState.ACTIVE:
      return { state: "running" }
    case FiberState.PENDING:
    case FiberState.LOADING:
      return { state: "waiting" }
    case FiberState.FAILED: {
      const fault = await fiber.await().then(() => undefined, faultOf)
      return fault === undefined ? { state: "failed" } : { state: "failed", fault }
    }
    default:
      return { state: "off" }
  }
}

/** The plugin's own words, or nothing — never core's paraphrase of them. A
 *  throw with no message reaches the panel as a row that says a start threw and
 *  quotes nobody, which is honest; `String(reason)` on a bare `Error` would put
 *  the word "Error" on screen as if the plugin had said it. */
const faultOf = (reason: unknown): string | undefined => {
  const said = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : ""
  const trimmed = said.trim()
  return trimmed === "" ? undefined : trimmed
}

/**
 * MOUNT THE BUNDLE ON `ctx` — the rows, patched by the flag, as fibers.
 *
 * Returns once every row that is going to load has loaded, so a caller can read
 * `ctx.kinds` and `ctx.surfaces` straight afterwards and get the whole build.
 *
 * A ROW THAT THROWS DOES NOT TAKE THE BOOT DOWN. Cordis lands a fiber whose
 * `apply` threw in `FAILED`, having installed nothing (every registration is an
 * effect, and the ones it had made are unwound), with its siblings ACTIVE — so
 * a plugin whose serve dies on a socket that is not there is one absent plugin
 * rather than a server that will not start.
 */
export const mountBundle = async (
  ctx: Context,
  names: ReadonlyArray<string> | null,
): Promise<void> => {
  ctx.baseUrl = BASE_URL
  await ctx.plugin(Loader)
  // The seam, filled before any row is mounted — see the header. Cast because
  // upstream types the slot as Node's own `ModuleLoader`, whose whole surface
  // is the internals the loader uses when it CAN reach them; the one method
  // `EntryTree.import` calls is this one, and under bun the internals arm is
  // absent (`ModuleLoader.fromInternal` answers `undefined`).
  ;(ctx.loader as unknown as { internal: unknown }).internal = {
    version: "v1",
    import: (specifier: string) => importByName(specifier),
  }
  await ctx.plugin(Include, { path: BUNDLE, patches: [...pluginsPatch(names)] })
  await ctx.loader.await()
}

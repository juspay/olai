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
 * {@link ROWS} reads the same file for the one question that has to be answered
 * BEFORE anything is mounted: which modules this BUILD has. The vault's
 * vocabulary needs it — a declaration of `kolu-terminal` stays legal on a serve
 * running only odu, so a file's verdict does not depend on a flag it cannot see
 * — and a disabled row is never imported by the loader, so its words have to be
 * read some other way. Two readings of one file, never two lists.
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
import type { Context } from "cordis"
import { load } from "js-yaml"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/**
 * ONE ROW of the base bundle.
 *
 * `id` IS the plugin's name — the sibling key, the word `--plugins` takes, the
 * row preferences draws, and the word the fiber is bound under, which is the
 * stamp `ctx.deliveries` and `ctx.kinds` read off `ctx.fiber.name`. `name` is
 * the module the loader mounts, and it is deliberately a SPECIFIER rather than
 * an import: that is what makes a plugin's presence a runtime fact.
 *
 * `disabled` is the row's OWN default, and it is the file's rather than a
 * field on a manifest. A plugin that needs a secret this machine may not have
 * is off until `--plugins` names it, and saying so in the row means the built-in
 * default and the operator's override are the same mechanism — one `disabled`,
 * written by the file or written by the patch.
 */
export interface BundleRow {
  readonly id: string
  readonly name: string
  readonly disabled?: boolean
}


/** Where the rows live, as a URL — the loader's `baseUrl` and the file this
 *  module reads, spelled once so the two cannot point at different files. */
const BASE_URL = new URL(".", import.meta.url).href

/** The path Include is given, relative to {@link BASE_URL}. */
const BUNDLE = "../olai.yml"

/**
 * EVERY PLUGIN THIS BUILD HAS, in bundle order.
 *
 * Read at module load, synchronously, because every caller wants it before
 * anything is mounted — the flag that refuses an unknown name, the roster's
 * `built` rows, and the vocabulary of words a vault may declare. A file that
 * will not parse is a build that cannot say what it has, so it throws here
 * rather than composing an empty bundle quietly.
 */
export const ROWS: ReadonlyArray<BundleRow> = readRows()

function readRows(): ReadonlyArray<BundleRow> {
  const file = fileURLToPath(new URL(BUNDLE, BASE_URL))
  const parsed = load(readFileSync(file, "utf8"))
  if (!Array.isArray(parsed)) {
    throw new Error(`bundle: ${file} is not a list of rows`)
  }
  return parsed.map((row: unknown, at: number) => {
    const one = row as Partial<BundleRow>
    if (typeof one?.id !== "string" || typeof one?.name !== "string") {
      throw new Error(`bundle: row ${at} of ${file} needs an \`id\` and a \`name\``)
    }
    return { id: one.id, name: one.name, ...(one.disabled === true ? { disabled: true } : {}) }
  })
}

/** Every plugin's name, in bundle order — the words `--plugins` takes, the rows
 *  preferences draws, and the set an unknown name is refused against. The same
 *  list `@olai/bundle/wire`'s `PLUGIN_NAMES` answers off the browser's door, and
 *  `./rosters.test.ts` holds them equal. */
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

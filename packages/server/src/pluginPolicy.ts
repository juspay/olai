/**
 * `--plugins` — WHICH OF THE BUILT-IN INTEGRATIONS THIS SERVE RUNS.
 *
 * The git policy's shape, one setting over, and deliberately so: this is a
 * CLI/nix-only decision with no settings file and no browser toggle. A browser
 * draws the rows READ-ONLY and says where they are changed, exactly as it does
 * for `--commit` and `--push`. `./gitPolicy.ts` carries the argument for that
 * arrangement in full and it is not repeated here; what IS worth stating is why
 * enablement joined that family rather than the two others available.
 *
 * It is not an ENV VAR, which is what `OLAI_ACP_AGENT` and the origins list
 * are: those name a resource to reach, and this names a policy the instance
 * runs under — the difference a person feels is that a policy belongs on the
 * `--help` page beside the other policies, where it can be read without
 * knowing it exists.
 *
 * It is not a VAULT FILE, which is what `_olai/Kolu.olai` is: a served
 * directory says how a plugin should BEHAVE, and it may travel between machines
 * that have different tools installed. Which tools this HOST has is the
 * operator's fact, not the vault's, and a vault that could switch off an
 * integration would be a directory deciding something about the machine
 * serving it.
 *
 * And it is not REMEMBERED ON DISK. That was tried for the git policy and
 * retired — `docs/running.md` still notes the inert leftovers — because a
 * setting that survives in a state directory is one nobody can read off the
 * command that started the process.
 *
 * ## `null` is not "none", and that is the whole design
 *
 * {@link pluginsPin} answers `null` for a flag nobody typed, and `null` means
 * the built-in default (`DEFAULT_PLUGIN_NAMES`), which is not necessarily
 * every plugin this binary was built with. It does NOT mean an empty list.
 * Whether a flag was GIVEN is a fact a browser has to be told, because a given
 * flag is named under the preferences row (`--plugins=kolu`) while an omitted
 * one is the built-in default — both are the instance's policy, read-only, the
 * same in every browser. A `--plugins` that defaulted to the full list could
 * not tell those two apart, which is precisely the mistake `./gitPolicy.ts`'s
 * `Flag.withDefault(null)` comment exists to prevent one setting over.
 *
 * `--plugins=` with an empty value is therefore the way to say NONE, and it is
 * a different answer from saying nothing. A serve with no plugins is not a
 * degraded serve: no sibling surface is composed, no tag is served, no expose
 * row is granted, and the wire carries no `surface/<name>/` at all — which is
 * the state `olai surface`, the headless faces and every server test already
 * run in.
 */

import { Flag } from "effect/unstable/cli"

/**
 * THE WIRE DOOR, for a list of NAMES — and the subpath is load-bearing rather
 * than a stylistic tidy-up.
 *
 * `@olai/plugin-api`'s root is the MANIFESTS, and a manifest carries a plugin's
 * browser faces: SolidJS components, and behind kolu's a terminal emulator.
 * Reaching this list through the root would put every one of them on the static
 * graph of a process that renders nothing, and it does not merely cost bytes —
 * it KILLS THE BOOT. Bun's default JSX runtime is React's, so the first `.tsx`
 * the server evaluates fails to resolve `react/jsx-dev-runtime` and the process
 * exits before it serves.
 *
 * That is the exact hazard the three doors exist for, arriving through the one
 * import that looked innocent: a list of strings. `PLUGIN_NAMES` is declared in
 * `surfaces.ts` and exported from `./wire` as well as from the root, so the
 * browser-safe door answers the same question with none of that behind it.
 *
 * THE DEFAULT COMES OFF THE ROWS and not off the wire door, which is a second
 * import and one spelling rather than one import and two. A plugin that is off
 * until the flag names it says so in `olai.yml`.s own `disabled`, because that
 * is the same field the PATCH writes — the built-in default and an operator.s
 * override are one mechanism, and a `defaultOn` on the wire half beside it
 * would be the same fact in two places for a `--help` line to disagree with.
 */
import { DEFAULT_BUNDLE_NAMES } from "@olai/bundle/bundle"
import { PLUGIN_NAMES } from "@olai/bundle/wire"

/**
 * What `--plugins` says for itself.
 *
 * Exported because it is the thing worth ASSERTING: `./pluginPolicy.test.ts`
 * holds that the sentence names every built-in plugin and the default, so a
 * third plugin added to the registry cannot arrive with a help page that does
 * not mention it. Reading it back off the built flag would mean reaching into
 * the CLI library's internals to check our own sentence, which is a test of the
 * wrong thing.
 *
 * The NAMES ARE DERIVED, which is the half that matters: they come off the
 * registry rather than a list spelled here, so this file — a general one —
 * contains no plugin's name.
 */
export const pluginsSaid = (): string =>
  `which built-in integrations to run, comma-separated: ${
    PLUGIN_NAMES.join(", ")
  } (the default is ${DEFAULT_BUNDLE_NAMES.join(", ")}). ` +
  `A plugin left out is not there at all — it never probes, mounts nothing on the wire, ` +
  `draws no face, and the file it would own is an ordinary outline. ` +
  `Pass an empty value to run none. ${INSTANCE}`

/** The clause the sentence ends with. Spelled once, because it is one fact
 *  about the flag and two copies of it is one place for it to be softened.
 *  Deliberately the same claim `./gitPolicy.ts` makes, in the same words, since
 *  a person reading two read-only preference rows is owed one explanation. */
const INSTANCE =
  "This is the instance's policy: every browser draws that preference row " +
  "read-only, the same in every browser. Giving this flag sets it; omitting " +
  "it uses the built-in default."

/**
 * The flag, as one thing.
 *
 * A SET of one, which looks like ceremony and is the same discipline
 * `gitFlags` keeps: handing a caller a bare flag to spread into its own options
 * makes "which flags does a face take" a question answered at each call site,
 * and that is one call site away from two faces taking different ones. There is
 * one face today — `olai web` — because `olai surface` is a CLIENT of a running
 * server and has no plugins of its own to run.
 *
 * `Flag.withDefault(null)` rather than the full list, for the reason the header
 * argues: omission has to stay distinguishable from the default typed out loud.
 */
export const pluginFlags = () => ({
  plugins: Flag.string("plugins").pipe(
    Flag.withDescription(pluginsSaid()),
    Flag.withDefault(null),
  ),
})

/**
 * ...and the flag as the answer it is: WHICH plugins, or `null` for nobody
 * having said.
 *
 * Splitting is this file's and not the registry's, because a comma-separated
 * list is a fact about a COMMAND LINE — `@olai/plugin-api`'s `enabled` takes a list
 * of names and has no opinion about how a person typed them.
 *
 * An empty value is an empty LIST and not `null`: `--plugins=` is somebody
 * saying "none" out loud, which is a policy, where saying nothing is the
 * default. Blanks around a name are trimmed because a person separating with
 * `, ` is not making a mistake; an empty segment is dropped for the same
 * reason, so `--plugins=kolu,` is `kolu` rather than a name nothing matches.
 *
 * AN UNKNOWN NAME IS REFUSED HERE, and this is the one place it is. A flag is
 * where a person types one, so it is where a typo can be answered with the
 * legal words beside it — `@olai/plugin-api`'s `enabled` deliberately refuses
 * nothing, because a filter that also validated would be a second sentence
 * about one mistake, in a function tests call with lists they built themselves.
 */
export const pluginsPin = (given: string | null): ReadonlyArray<string> | null => {
  if (given === null) return null
  const names = given.split(",").map((one) => one.trim()).filter((one) => one !== "")
  const unknown = names.filter((one) => !PLUGIN_NAMES.includes(one))
  if (unknown.length > 0) {
    throw new Error(
      `olai web: --plugins names ${unknown.join(", ")}, which this build does not have. ` +
        `It was built with ${PLUGIN_NAMES.join(", ")}.`,
    )
  }
  return names
}

/** The built-in list, re-exported beside the flag that declines to apply it —
 *  so a reader of this file can see what "nobody said" comes to without going
 *  a package down. The same courtesy `./gitPolicy.ts` ends with. */
export { PLUGIN_NAMES } from "@olai/bundle/wire"

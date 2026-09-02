/**
 * WHICH PLUGINS THIS BUILD HAS, and which this SERVE runs — the two lists, and
 * the distance between them is the whole of what `--plugins` means.
 *
 * This module is the WIRE half of the registry and is a separate file from the
 * manifests ({@link ./registry.ts}) for a graph reason rather than a tidiness
 * one: `@olai/server`'s composition root and the browser's both reach this,
 * and what it imports is each plugin's `./wire` subpath and nothing else — so
 * a probe, a runtime half and a SolidJS component stay off both graphs.
 *
 * ## Nothing here spells a member
 *
 * A plugin hands over a whole SURFACE, and the framework's composition is what
 * gives its members their addresses. No line in this file, or in any general
 * package, writes a plugin's member name; core knows a plugin's NAME, which is
 * the sibling key, and nothing else about what is behind it. That is the
 * polymorphism claim, and it is worth saying where it is kept rather than
 * where it is described.
 *
 * ## The one thing this file enumerates
 *
 * Its plugins. {@link WIRES} is the list, and being the place that list lives
 * is the registry's whole job — a third plugin is one line here and nothing
 * anywhere else. A `import()` in a loop would have been shorter to look at and
 * would have made the set a runtime fact, which is what compiled-in
 * deliberately is not.
 */

import * as kolu from "olai-plugin-kolu/wire"
import * as odu from "olai-plugin-odu/wire"
import * as spaces from "olai-plugin-xyne-spaces/wire"

/** One plugin's wire half — its sibling key, its surface, and which of its
 *  members each face may see. The three things a composition root needs and
 *  the only three it gets. */
export interface PluginWire {
  readonly name: string
  readonly surface: { readonly spec: unknown }
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /**
   * Whether omitting `--plugins` runs this plugin. Absent means yes — the
   * built-in default is ON. `false` is opt-in: named on the flag, or not
   * running. A plugin that needs a secret this machine may not have is
   * the second kind.
   */
  readonly defaultOn?: boolean
}

/** WHAT THIS BINARY WAS BUILT WITH, on the wire.
 *
 *  A tuple (`as const`), because the records below are derived from it and a
 *  widened array would take their key types with it. A third party adding a
 *  plugin rebuilds olai; that is the one thing compiled-in cannot do, and it
 *  is accepted — the boundary is the value, not the loading. */
export const WIRES = [kolu, odu, spaces] as const

/**
 * THE NAME AS DATA, beside the import. Claim 8's floor is that the registry
 * must be seen to SPELL every plugin — import specifiers are stripped before
 * the hunt, so a local binding is not a spelling, and a hyphenated name cannot
 * be a binding at all. `satisfies` holds each string to the import's `name`
 * at `tsc`; there is no import-time throw in a module everything pulls in.
 * `WIRES` stays a list of bindings because `./rosters.test.ts` reads that
 * list as source.
 */
const SPELLING = ["kolu", "odu", "xyne-spaces"] as const satisfies readonly [
  typeof kolu.name,
  typeof odu.name,
  typeof spaces.name,
]
void SPELLING

/**
 * A PLUGIN-OWNED WORD, PREFIXED WITH THE PLUGIN'S NAME — the one composition,
 * and the reason plugin-owned names cannot collide or capture.
 *
 * kolu contributes the bare kind `terminal` and a vault declares
 * `kolu-terminal`. It is the same move the wire makes with a member — a plugin
 * declares `fleet` and the framework composes `surface/kolu/fleet/get` — and it
 * is here for the same two reasons:
 *
 *   - **collisions become unreachable.** Two plugins that both contribute
 *     `terminal` compose to two different words. The assembly counts anyway
 *     (`./server.ts`'s `tableOf`), because a proof nobody re-checks is the class
 *     of thing this repo keeps turning into a test.
 *   - **and so does CAPTURE**, which is the sharper one and is why the human
 *     ruled it. A plugin's built-in declaration claims the key equal to its own
 *     composed word, so enabling kolu can only ever declare `kolu-terminal`. A
 *     person's own `terminal` column is not something a flag on the machine can
 *     take over — and a board that WANTS the short key writes one row saying so
 *     (`{"title":"terminal","custom":{"type":"kolu-terminal"}}`), which is the
 *     user's key, the plugin's kind, and the user's own file.
 *
 * ON THE WIRE DOOR because all three doors compose one: the server assembles the
 * vocabulary, the browser registers the dressings, and neither may spell the
 * rule for itself. A plugin cannot read it — no plugin imports this package —
 * so each spells its own composed word from its own `name` for its own walk, and
 * `./kinds.test.ts` holds the two spellings equal.
 *
 * THE SEPARATOR IS FORBIDDEN INSIDE EITHER HALF, which is what makes the
 * composition injective and the collision unreachable rather than merely
 * counted — see the refusals in the body.
 */
export const KIND_SEPARATOR = "-"

export const kindWordOf = (plugin: string, kind: string): string => {
  // THE SEGMENTS MAY NOT CARRY THE SEPARATOR, which is `assertTagSegment`'s
  // rule on the wire and is here for the identical reason: without it the
  // composition is AMBIGUOUS, and ambiguity is what makes a collision possible
  // at all. `kindWordOf("ab", "c-d")` and `kindWordOf("ab-c", "d")` both compose
  // to `ab-c-d`, so two plugins whose names genuinely differ could still land on
  // one word — the count in `./server.ts` would catch it, but a refusal about a
  // word neither author wrote is a refusal nobody can act on.
  //
  // Refused HERE rather than counted downstream, so the composition is INJECTIVE
  // and the collision is unreachable rather than merely reported. A plugin name
  // is already held to this by the wire (a name is a sibling key, and
  // `assertTagSegment` forbids a `/` in one); a kind word had nothing of the
  // sort, and this is it.
  for (const [what, segment] of [["plugin name", plugin], ["kind", kind]] as const) {
    if (segment.length === 0) {
      throw new Error(`plugins: a ${what} may not be empty — it is half of a composed kind word.`)
    }
    if (segment.includes(KIND_SEPARATOR)) {
      throw new Error(
        `plugins: the ${what} "${segment}" carries "${KIND_SEPARATOR}", which is the ` +
          "separator a kind word is composed with — two halves that may carry it compose " +
          "ambiguously, and two different plugins could land on one word.",
      )
    }
  }
  return `${plugin}${KIND_SEPARATOR}${kind}`
}

/** Every plugin's name, in registry order — the words `--plugins` takes, the
 *  rows preferences draws, and the set an unknown name is refused against. */
export const PLUGIN_NAMES: ReadonlyArray<string> = WIRES.map((wire) => wire.name)

/** What omitting `--plugins` runs — not necessarily {@link PLUGIN_NAMES}.
 *  A plugin with {@link PluginWire.defaultOn} `false` is absent from this
 *  list and stays off until the flag names it. */
export const DEFAULT_PLUGIN_NAMES: ReadonlyArray<string> = (WIRES as ReadonlyArray<PluginWire>)
  .flatMap((wire) => wire.defaultOn === false ? [] : [wire.name])

/**
 * WHICH PLUGINS THIS SERVE RUNS, out of what it was built with.
 *
 * `null` is nobody having said, and it means the built-in default
 * ({@link DEFAULT_PLUGIN_NAMES}), which is not necessarily every plugin
 * this binary was built with. That is the same "omission stays
 * distinguishable from the default typed out loud" the git policy's pin
 * is built on (`@olai/server`'s `gitPolicy.ts`), and it is here for the
 * same reason: preferences names a GIVEN flag under the row and otherwise
 * says the built-in default, and a filter that had already expanded `null`
 * into a list could not tell a reader which of the two they were looking at.
 *
 * An unknown name is NOT refused here. The flag refuses it, once, where a
 * person types one, with the legal names beside it — a second sentence about
 * one mistake is a second place for the wording to be softened, and this
 * function is also spent by tests that hand it a list they built themselves.
 */
export const enabled = <P extends { readonly name: string }>(
  plugins: ReadonlyArray<P>,
  names: ReadonlyArray<string> | null,
): ReadonlyArray<P> =>
  plugins.filter((p) => (names ?? DEFAULT_PLUGIN_NAMES).includes(p.name))

/** Is one plugin running on this serve — the same question {@link enabled}
 *  answers, asked about a name instead of answered as a list. Both exist
 *  because preferences draws a row per BUILT plugin and says of each whether
 *  it is on, which is not a filter over the enabled ones. */
export const isEnabled = (names: ReadonlyArray<string> | null, name: string): boolean =>
  (names ?? DEFAULT_PLUGIN_NAMES).includes(name)

/**
 * THE SIBLING MAP — what `composeSurfaceContracts`, `implementSurfaces` and
 * `surfaceClients` all take, and the single source of which surfaces exist
 * under which keys.
 *
 * Keyed by the plugin's own name, which IS the wire prefix: a member declared
 * `fleet` in `olai-plugin-kolu` is `surface/kolu/fleet/get` on the wire, and
 * nothing computed that string but the framework.
 *
 * A plugin left out of `names` is simply absent from the record — no tag, no
 * handler, no expose row, no `surface/<name>/` on the wire at all. `--plugins`
 * is a filter over a plain object and needs no mechanism of its own.
 */
export const surfacesOf = (
  plugins: ReadonlyArray<PluginWire>,
): Record<string, PluginWire["surface"]> =>
  Object.fromEntries(plugins.map((plugin) => [plugin.name, plugin.surface]))

/**
 * ...and the expose maps for ONE face, keyed the same way — what `exposeFaces`
 * takes beside the sibling map.
 *
 * One map per sibling rather than one map with dotted paths, which is the
 * framework's own shape and its reason is worth keeping in view: a sibling's
 * map is written against that sibling's own spec, which is what keeps the keys
 * compiler-checked and what stops `"a.b"` meaning two things depending on
 * whether `a` is a namespace or a sibling.
 *
 * A plugin that says nothing about this face is ABSENT from the result rather
 * than present-and-empty, and the difference is the whole default-deny
 * contract: `exposeFaces` denies a sibling with no map in full, which is what
 * a plugin that never mentioned the agent's face means.
 */
export const exposeMapsOf = (
  plugins: ReadonlyArray<PluginWire>,
  face: string,
): Record<string, Readonly<Record<string, unknown>>> =>
  Object.fromEntries(
    plugins.flatMap((plugin) => {
      const map = plugin.faces[face]
      return map === undefined ? [] : [[plugin.name, map] as const]
    }),
  )

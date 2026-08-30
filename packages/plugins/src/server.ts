/**
 * THE SERVER DOOR — what a composition root reads to COMPOSE a runtime, and the
 * third of this package's three.
 *
 * ## Why a third door rather than a field on the manifest
 *
 * {@link ./wire.ts} is what a composition root and the browser reach, and its whole
 * discipline is what is NOT on its graph: no UI runtime, no appliance client, no
 * `node:` builtin. {@link ./index.ts} is the manifest, and a manifest carries a
 * plugin's CHROME and its DRESSINGS — SolidJS components, and in kolu's case a
 * terminal emulator behind them. A server that reached a runtime half through
 * the manifest would pull all of that onto the graph of a process that renders
 * nothing, which is the exact hazard `@olai/kolu-client/wire`'s fence was
 * written for one floor down and the exact hazard this package's own split was
 * written for one floor up.
 *
 * So the runtime halves are reached HERE, through each plugin's own `./server`
 * subpath, and {@link ./fence.test.ts} walks this door's closure and asserts
 * that no browser face is on it rather than trusting this paragraph.
 *
 * ## Three doors means three lists, and that is the cost of the split
 *
 * {@link WIRES}, `PLUGINS` and {@link SERVERS} each enumerate the same two
 * plugins, so a third one is three lines rather than one. That is worth naming
 * as a cost rather than presenting as a design: a single list would be one edit,
 * and it is not available, because the three lists are what the three GRAPHS
 * are. A registry that named every plugin once and re-exported the halves would
 * put every door's closure on every door — which is not a tidier version of this
 * arrangement, it is the absence of it.
 *
 * What the split does buy is that no line in a general package outside this one
 * spells a plugin's name at all, and every one of the three lists is checked
 * against the others: a plugin missing from `SERVERS` is a sibling the runtime
 * cannot implement deps for, and `implementSurfaces` refuses at boot naming the
 * key ("missing deps for surface").
 *
 * ## What core does with this
 *
 * Iterates. For each enabled entry it calls {@link PluginServerHalf.serve} with
 * the SAME services blob, keys the result by {@link PluginServerHalf.name}, and
 * hands the record to `implementSurfaces` — which walks each sibling's spec at
 * `surface/<name>/` and returns one group, one handler record and a ctx per key.
 * Core never opens `deps`, never spells a member, and knows a plugin's name and
 * nothing else about what is behind it.
 */

import * as kolu from "@olai/plugin-kolu/server"
import * as odu from "@olai/plugin-odu/server"

import type { PluginServer, PluginServices } from "./plugin.ts"
import type { PluginWire } from "./surfaces.ts"

/** The two halves of the contract, re-exported so this door is the whole of
 *  what a composition root imports: what core hands every plugin, and what it
 *  gets back. Declared in {@link ./plugin.ts} beside the rest of the interface,
 *  because they are part of what a plugin IS and not part of how it is reached. */
export type { PluginServer, PluginServices } from "./plugin.ts"

/**
 * ONE PLUGIN, AS A COMPOSITION ROOT SEES IT — its wire half and its server half
 * in one value, so a root reads ONE list.
 *
 * It extends {@link PluginWire} rather than sitting beside it because the two
 * halves are keyed by the same word and that word has one spelling: each
 * plugin's `./server` re-exports `name` from its own `./wire`, so the surface a
 * root composes and the deps it composes it with cannot come to be filed under
 * two different keys. `surfacesOf` and `exposeMapsOf` take a `PluginWire` and
 * therefore take one of these unchanged.
 *
 * `Revision` is PARAMETRIC and is never named in this package, for the reason
 * `@olai/format` is not a dependency of it: the vocabulary of a vault record
 * belongs downstairs. What that costs is that the agreement about the revision
 * ARGUMENT cannot be proved on {@link SERVERS} below — it is proved at the
 * composition root, which is the one place the concrete reading exists
 * (`@olai/server`'s `runtime.ts`, on the line that annotates this list).
 */
export interface PluginServerHalf<Revision> extends PluginWire {
  readonly serve: (services: PluginServices) => PluginServer<Revision>
}

/**
 * WHAT THIS BINARY CAN SERVE — the same two plugins {@link WIRES} lists, with
 * their runtime halves on them.
 *
 * `satisfies` against `PluginServerHalf<never>` and not against a concrete
 * revision, which is the weakest constraint that still checks everything this
 * package can check: the name, the surface, the face maps, the SERVICES a half
 * asks for (a parameter is contravariant, so a plugin that asked for a field
 * core does not offer is a type error on this line), and the shape of what comes
 * back. `never` is the one thing left unchecked here and it is checked there —
 * `@olai/server` re-states this list against the reading it actually passes, and
 * a plugin that wanted something the vault does not carry fails at the root
 * naming this list.
 *
 * A tuple (`as const`), for `WIRES`' reason: a widened array would take the key
 * types of anything derived from it along with it.
 */
/** The two filters, re-exported beside the halves they filter — so a
 *  composition root reaches ONE door for "which plugins run and what do they
 *  need", rather than one for the list and another for the test that narrows
 *  it. They are declared in `./surfaces.ts` because the question is about
 *  NAMES and the wire door answers it too. */
export { enabled, isEnabled, PLUGIN_NAMES } from "./surfaces.ts"

export const SERVERS = [kolu, odu] as const satisfies ReadonlyArray<PluginServerHalf<never>>

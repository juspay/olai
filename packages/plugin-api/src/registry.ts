/**
 * WHAT THIS BINARY WAS BUILT WITH, and what THIS SERVE runs — two lists, and
 * the distance between them is the whole of what `--plugins` means.
 *
 *   - {@link PLUGINS} is the build's. It is a source file with static imports
 *     ({@link ./surfaces.ts} argues why it has to be), and a third party adding
 *     a plugin rebuilds olai. That is the one thing compiled-in cannot do, and
 *     it is accepted: the boundary is the value, not the loading.
 *
 *   - {@link ./surfaces.ts}'s `enabled` is the serve's. A plugin left out of
 *     `--plugins` is ABSENT from the composition: no sibling surface, no tag,
 *     no handler, no expose row, and no `surface/<name>/` on the wire at all.
 *     Its probe never runs, its chrome is unmounted, its dressings are
 *     unregistered, its kinds validate as text, and the outline it would have
 *     owned is an ordinary outline.
 *
 * ## Why a disabled plugin costs no mechanism
 *
 * `composeSurfaceContracts`, `implementSurfaces` and `surfaceClients` all take
 * a plain keyed OBJECT of surfaces, so filtering the enabled set is filtering
 * that object and nothing else. There is no "declared but parked" state to
 * build and no seed to arrange: the sibling is not there, and a browser asking
 * for it is asking for a member the wire does not carry — the same absent
 * state a machine without the tool shows.
 *
 * That is why this costs nothing to be true. **Disabled is a state the
 * framework's own composition already expresses**, and olai only has to not
 * add the entry.
 */

import { plugin as kolu } from "olai-plugin-kolu"
import { plugin as odu } from "olai-plugin-odu"
import { plugin as spaces } from "olai-plugin-xyne-spaces"

import type { OlaiPlugin } from "./plugin.ts"

/**
 * WHAT THIS BINARY WAS BUILT WITH.
 *
 * `satisfies` rather than an annotation, and that IS the type agreement
 * between core and a plugin. A plugin package declares its manifest as a plain
 * `as const` object and imports nothing from here, because this package
 * imports it and a dependency back would be a cycle the manifests could not
 * express ({@link ./plugin.ts}'s header argues the direction in full). A
 * plugin that stopped fitting is a type error on THIS line, naming the plugin.
 *
 * The manifests fill in as the sweep reaches them. Today every tenant
 * contributes its name and its members, which is a whole plugin — every
 * other field is optional, and the absent arm of each is the state a machine
 * without the tool already shows.
 */
export const PLUGINS = [kolu, odu, spaces] as const satisfies ReadonlyArray<OlaiPlugin>

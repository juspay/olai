/**
 * WHAT THIS BINARY WAS BUILT WITH, IN THE BROWSER — the manifests, and the
 * other of the two compiled-in lists.
 *
 *   - {@link PLUGINS} is what the TAB mounts: the dressings, the chrome slots
 *     and the marks, whose fields return `JSX.Element`. It is a source file
 *     with static imports because a browser bundle is built ahead of time and
 *     there is no loader in the tab — {@link ./surfaces.ts} argues it, and it
 *     is `ctx.slots`' to retire (the proposal's §6, phase 5).
 *
 *   - the SERVER's list is not here at all any more. It is `../olai.yml`, one
 *     row per plugin, mounted by name through the loader ({@link ./bundle.ts}),
 *     which is what makes `--plugins` a `disabled` PATCH over rows rather than
 *     a filter in code. {@link ./rosters.test.ts} holds the rows, this list and
 *     the wire door equal.
 *
 * ## What a DISABLED plugin is, now that a fiber is what it is
 *
 * ABSENT, and at every moment rather than only at boot. A row that is off never
 * mounts: no sibling surface, no tag, no handler, no expose row, and no
 * `surface/<name>/` on the wire at all. Its probe never runs, its dressings are
 * unregistered, its kinds validate as text, and the outline it would have owned
 * is an ordinary outline. A row that is turned off LATER disposes its fiber, and
 * every registration it made is an effect that unwinds with it — so the same
 * sentence is true after the boot as during it, which is the property the old
 * arrangement could only have at boot because the filter ran once.
 *
 * What the browser still shows for such a plugin is a row saying so, off the
 * roster cell — which is core's member and not the plugin's, because the one
 * member that could answer *is kolu running* is the member kolu does not have
 * when the answer is no.
 */

import { plugin as kolu } from "olai-plugin-kolu"
import { plugin as odu } from "olai-plugin-odu"
import { plugin as spaces } from "olai-plugin-xyne-spaces"

import type { OlaiPlugin } from "@olai/plugin-api"

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
 * The manifests fill in as the sweep reaches them. Today both tenants
 * contribute their name and their members, which is a whole plugin — every
 * other field is optional, and the absent arm of each is the state a machine
 * without the tool already shows.
 */
export const PLUGINS = [kolu, odu, spaces] as const satisfies ReadonlyArray<OlaiPlugin>

/**
 * WHICH PLUGINS THIS BUILD HAS, ON THE WIRE — the BROWSER's door onto them,
 * and one of the two lists a `rosters.test.ts` holds equal to the bundle.
 *
 * This module is the WIRE half of the registry and is a separate file from the
 * manifests ({@link ./registry.ts}) for a graph reason rather than a tidiness
 * one: what it imports is each plugin's `./wire` subpath and nothing else — so
 * a probe, a runtime half and a SolidJS component stay off the graph of
 * whatever opens it.
 *
 * ## Why this is still a source file when the server's list is a `.yml`
 *
 * The SERVER mounts its plugins by NAME, from `./olai.yml`, through the loader
 * — no static import, so `--plugins` is a `disabled` patch over rows and a
 * plugin's presence is a runtime fact. The BROWSER cannot do that yet: its
 * bundle is built ahead of time, `connectSurfaces` takes its sibling map at the
 * call, and there is no loader in the tab. So the browser keeps a compiled-in
 * list until `ctx.slots` arrives and it boots off the roster cell (the
 * proposal's §6, phase 5).
 *
 * That leaves TWO lists rather than one, and the honest thing is to say so and
 * hold them equal: {@link ./rosters.test.ts} asserts that this door, the
 * manifests beside it and the bundle's rows name the same plugins in the same
 * order, which is the same guarantee the three rosters used to give each other.
 *
 * ## Nothing here spells a member
 *
 * A plugin hands over a whole SURFACE, and the framework's composition is what
 * gives its members their addresses. No line in this file, or in any general
 * package, writes a plugin's member name; core knows a plugin's NAME, which is
 * the sibling key, and nothing else about what is behind it. That is the
 * polymorphism claim, and it is worth saying where it is kept rather than
 * where it is described.
 */

import type { PluginWire } from "@olai/plugin-api"
import * as kolu from "olai-plugin-kolu/wire"
import * as odu from "olai-plugin-odu/wire"

/** One plugin's wire half, re-exported — the three fields that ARE a plugin's
 *  identity. Declared in `@olai/plugin-api`, because both halves of a plugin
 *  and both ends of the wire read them and the interface is the one package
 *  neither end has to import a registry to reach. */
export type { PluginWire }

/** WHAT THIS BINARY WAS BUILT WITH, on the wire.
 *
 *  A tuple (`as const`), because the records below are derived from it and a
 *  widened array would take their key types with it. A third party adding a
 *  plugin rebuilds olai; that is the one thing compiled-in cannot do, and it
 *  is accepted — the boundary is the value, not the loading. */
export const WIRES = [kolu, odu] as const

/** Every plugin's name, in registry order — the words `--plugins` takes, the
 *  rows preferences draws, and what "all of them" comes to when nobody said. */
export const PLUGIN_NAMES: ReadonlyArray<string> = WIRES.map((wire) => wire.name)

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

/** The three readings that moved to the interface, re-exported beside the list
 *  they are spent on — the word a plugin's kind is composed into, and the two
 *  filters `--plugins` is. They are declared in `@olai/plugin-api` because a
 *  PLUGIN spells its own composed word for its own walk and may not reach a
 *  registry to do it (`@olai/bundle`'s `kinds.test.ts` holds the two spellings
 *  equal); they are re-exported here because every caller that wants one also
 *  wants {@link WIRES} or {@link PLUGIN_NAMES} beside it. */
export { enabled, isEnabled, kindWordOf } from "@olai/plugin-api"

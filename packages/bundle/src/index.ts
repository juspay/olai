/**
 * THE MANIFEST DOOR — every plugin's BROWSER half, and the door only the
 * renderer opens.
 *
 * ## What this package is
 *
 * The one place either tenant's name is spelled. It was the back half of
 * `@olai/plugin-api`, which held the interface a plugin is written against AND
 * the registry that names every plugin — an arrangement that could not survive
 * a plugin importing the interface, because a package that both names every
 * plugin and is named by every plugin is a cycle the manifests decline to
 * express. So the interface stayed there and the registry came here, and the
 * arrow between them runs one way.
 *
 * ## Three doors, three graphs
 *
 * This one carries the MANIFESTS whole — the dressings, the chrome and the
 * marks, which are SolidJS components and, behind kolu's, a terminal emulator.
 * `./wire` is the browser-safe half: the sibling map and the filters, on a
 * graph that reaches each plugin's own `./wire` subpath and stops. `./bundle`
 * is what a composition root reads: the base bundle's rows and the loader that
 * mounts them, on a graph with no browser face on it.
 *
 * A single door would put those on every one of them: a UI runtime on the graph
 * of a server that renders nothing, and a daemon's whole contract on the
 * browser's. That is not hypothetical — a `.tsx` evaluated in the server kills
 * the boot on `react/jsx-dev-runtime`, which is what `@olai/server`'s
 * `pluginPolicy.ts` did the day the manifests grew faces. `./fence.test.ts`
 * walks each closure rather than trusting this paragraph.
 *
 * A FOURTH entry is not a fourth graph: `./all.css` is the plugins' stylesheets
 * chained, and it is here because a CSS import is a door a plugin's name can be
 * spelled through. A FIFTH, `./testids`, is the same routing in a third
 * grammar: a `data-testid` is spent in `@olai/tests`, which may not name a
 * plugin either, and the door is NAMES ONLY so a suite with no browser in it
 * never pulls a component.
 */

export { PLUGINS } from "./registry.ts"
export {
  enabled,
  exposeMapsOf,
  isEnabled,
  kindWordOf,
  PLUGIN_NAMES,
  type PluginWire,
  surfacesOf,
  WIRES,
} from "./surfaces.ts"

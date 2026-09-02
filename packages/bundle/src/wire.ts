/**
 * THE WIRE DOOR — what the BROWSER reads to compose, and the only thing it may.
 *
 * The composed group is on the static graph of everything that reads the
 * surface. A single door that also carried the manifests would carry the
 * runtime halves and the browser components with them: a UI runtime on the
 * server's graph and a daemon's whole contract on the browser's, which is
 * exactly what `@olai/kolu-client/wire`'s own fence exists to prevent one floor
 * down.
 *
 * So this entry re-exports the sibling map and the two filters, and the graph
 * behind it reaches each plugin's `./wire` subpath and stops. `./fence.test.ts`
 * walks that closure and asserts it rather than trusting this paragraph.
 *
 * ## The SERVER stopped reading this door, and that is the phase
 *
 * `@olai/server`'s composition root used to read `surfacesOf(WIRES)` and
 * `PLUGIN_NAMES` off here. It reads neither now: the siblings it composes are
 * the ones its plugin fibers REGISTERED (`@olai/plugin-api`'s `Surfaces`), and
 * the names its roster is built from are the bundle's rows. What still reaches
 * this door on the server is `./pluginPolicy.ts`, for the one question a flag
 * asks before anything is mounted — which names are legal to type.
 */

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

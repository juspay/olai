/**
 * THE WIRE DOOR — what a composition root reads to compose, and the only thing
 * it may.
 *
 * The composed group is on the static graph of everything that reads the
 * surface — the browser bundle and the server both. A single door that also
 * carried the manifests would carry the probes, the runtime halves and the
 * browser components with them: a UI runtime on the server's graph and a
 * daemon's whole contract on the browser's, which is exactly what
 * `@olai/kolu-client/wire`'s own fence exists to prevent one floor down.
 *
 * So this entry re-exports the sibling map and the two filters, and the graph
 * behind it reaches each plugin's `./wire` subpath and
 * stops. `./fence.test.ts` walks that closure and asserts it rather than
 * trusting this paragraph.
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

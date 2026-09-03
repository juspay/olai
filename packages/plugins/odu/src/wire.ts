/**
 * ODU'S OWN SURFACE — one cell, and one cell is a whole surface.
 *
 * `@olai/odu-client`'s entire reading of a coordinator — which worktrees have
 * a run in them, what each node of it is doing, and what the row comes to —
 * arrives as ONE cell whose value is the runs, because a run is a reading of
 * somebody else's work and there is nothing a browser can write back. A plugin
 * is not a size.
 *
 * `olai-plugin-kolu`'s module one appliance over argues the shape in full:
 * the framework's `composeSurfaceContracts` takes standalone surfaces and
 * re-walks each at `surface/<key>/`, so the cell called `ci` here is
 * `surface/odu/ci/get` on the wire with no name arithmetic anywhere. The
 * sibling key is this plugin's own {@link name}.
 *
 * ## THIS ENTRY'S OWN FENCE, inherited whole
 *
 * The composed group is on the static graph of everything that reads the
 * surface, so this module may import the framework, `effect` and its own wire
 * slice and nothing else — no `@odu/*`, no `solid-js`, no `@olai/format`, no
 * `node:` builtin. That is `check-odu-deps.sh`'s third assertion one package
 * up, and what asserts it is `@olai/plugin-api`'s `fence.test.ts`, which walks the
 * whole closure of the door this module is reached through.
 */

import { defineSurface } from "@kolu/surface/define"
import { oduMembers } from "olai-plugin-odu/appliance/wire"

/** The sibling key, the preferences row, the docs slug, and the word
 *  `--plugins` takes. Spelled once, here. */
export const name = "odu"

/** The one. `ci` keeps its word: what the cell holds is every CI run this
 *  server is watching, and composed it reads `surface/odu/ci/get`, which says
 *  both halves of that in one address. */
export const surface = defineSurface({
  cells: {
    ci: oduMembers.cells.ci,
  },
})

/**
 * THE BROWSER'S ALONE, and it inherits the door rather than the reasoning —
 * which is the sharpest thing a per-plugin map says. This cell is a READING of
 * somebody else's coordinator, and an agent that wants a run's state has odu's
 * own MCP face and `odu status` besides; re-serving them through olai would be
 * a second door onto another tool's socket with olai's credentials on it,
 * which is exactly the line kolu's seven are held to.
 *
 * The line is easier here than there, in fact: this member carries no bytes
 * anybody typed — no screen, no log — so what is withheld is a convenience
 * rather than a secret. It is withheld anyway, because which face gets what is
 * a decision made per member rather than a default the next member, or the
 * next PLUGIN, inherits.
 */
export const faces = {
  browser: {
    ci: "resource",
  },
} as const

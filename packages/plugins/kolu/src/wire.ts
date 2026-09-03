/**
 * KOLU'S OWN SURFACE — a whole surface, in kolu's own package, with kolu's own
 * member names on it.
 *
 * ## What this is not
 *
 * It is not a slice spread into somebody else's spec. `@olai/surface` used to
 * import `koluMembers` and spread it into four of its own sections, so seven
 * kolu words sat in the middle of core's API with nothing in the key to say
 * whose they were — and every consumer read them off the composed spec as
 * though they were olai's. A first attempt at this extraction replaced that
 * with a mount of core's own devising, which was worse: it put a separator
 * into MEMBER NAMES, and member names are not a namespace — `@kolu/surface`
 * mints channel names, MCP resource paths and tool names out of them, and a
 * name carrying punctuation quietly breaks all three.
 *
 * The framework already has the axis. `composeSurfaceContracts` takes a keyed
 * map of STANDALONE surfaces and re-walks each one at `surface/<key>/`, so a
 * member called `fleet` in this file is `surface/kolu/fleet/get` on the wire
 * with no name arithmetic anywhere and no possibility of two plugins colliding
 * — the reserved `system/*` trio each surface carries is what makes a bare
 * merge unsafe and per-sibling prefixing safe. The sibling key IS the plugin
 * namespace, and it is the plugin's own {@link name}.
 *
 * So this package declares a surface exactly as `@olai/surface` declares one,
 * and core composes rather than absorbs.
 *
 * ## THIS ENTRY'S OWN FENCE, inherited whole
 *
 * The composed group is on the static graph of everything that reads the
 * surface — the browser bundle and the server both. So this module may import
 * the framework, `effect` and its own wire slice and NOTHING ELSE: no
 * `solid-js`, which would put a UI runtime on the server's graph, no
 * `@kolu/padi-client`, which would put the daemon's whole contract on the
 * browser's, and no `@olai/format`. `@olai/plugin-api`'s `fence.test.ts` walks
 * this door's whole closure and asserts it rather than trusting this
 * paragraph — one claim about the door that composes the slices, where
 * `check-kolu-deps.sh`'s fifth assertion made it about the slice one floor
 * down.
 */

import { defineSurface } from "@kolu/surface/define"
import { koluMembers } from "olai-plugin-kolu/appliance/wire"

/** The sibling key, the preferences row, the docs slug, and the word
 *  `--plugins` takes. Spelled once, here — and because the sibling key IS the
 *  wire prefix, the name and every tag it appears in cannot drift apart. */
export const name = "kolu"

/**
 * The seven, as a surface of their own.
 *
 * `link` was called `kolu`, and the rename went into `@olai/kolu-client` where
 * the member is declared rather than being papered over here: a cell named for
 * its own appliance reads `surface/kolu/kolu/get` once composed, which says
 * the word twice and the thing once. What the cell holds is a `KoluLink` —
 * whether this server is talking to a padi, and since when.
 *
 * The doc blocks did not travel. They argue what a member IS and they stayed
 * on the declarations in `@olai/kolu-client/wire`, where a reader looking for
 * what `fleet` carries finds them beside its schema rather than beside its
 * address.
 */
export const surface = defineSurface({
  cells: {
    link: koluMembers.cells.link,
    pulse: koluMembers.cells.pulse,
    knobs: koluMembers.cells.knobs,
  },
  collections: {
    fleet: koluMembers.collections.fleet,
    events: koluMembers.collections.events,
  },
  streams: {
    terminal: koluMembers.streams.terminal,
  },
  procedures: {
    screen: koluMembers.procedures.screen,
  },
})

/**
 * WHICH FACE SEES WHAT — this plugin's own `ExposeMap`, written against this
 * plugin's own spec.
 *
 * It used to be a row per member in `@olai/server`'s expose map: a general
 * package holding a per-appliance decision, which had to be edited every time
 * an appliance grew a member and could silently be forgotten — a member absent
 * from that map is a member no face serves, and it reaches a person as a chip
 * that never fills, with nothing red anywhere.
 *
 * `exposeFaces` takes one map per sibling for exactly this reason: a map
 * written against its own spec is a map whose keys the compiler checks, and
 * `"a.b"` cannot mean two things depending on whether `a` is a namespace or a
 * sibling.
 *
 * ALL SEVEN ARE THE BROWSER'S ALONE, and the reason is one sentence said seven
 * times: every member here is a READING OF SOMEBODY ELSE'S DAEMON, and an
 * agent that wants padi has padi's own MCP face. Re-serving the fleet through
 * olai would be a second door onto another tool's daemon with olai's
 * credentials on it, which is precisely what the orchestrator design refuses —
 * olai reads padi and never re-publishes it.
 *
 * `screen.text` is that line drawn harder: it READS A TERMINAL'S SCREEN, which
 * may hold anything the person working in it has up. It is a gesture somebody
 * made in a tab they are looking at, and not a verb an agent gets for asking.
 *
 * There is no AGENT map, and its absence is the decision rather than an
 * omission: `exposeFaces` denies a sibling with no map in full, which is the
 * default-deny this appliance wants. A face's own composition names which maps
 * it asks each plugin for.
 */
export const faces = {
  browser: {
    link: "resource",
    pulse: "resource",
    knobs: "resource",
    fleet: "resource",
    events: "resource",
    terminal: "resource",
    "screen.text": "tool",
  },
} as const

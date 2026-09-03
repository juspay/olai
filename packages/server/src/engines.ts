/**
 * WHICH ACP ENGINES THIS SERVE HAS, IN THE BUNDLE'S ORDER — and what a browser
 * is told about each.
 *
 * ## The order is the whole reason this is a module
 *
 * An engine is a plugin, and a plugin's registration happens when its `apply`
 * runs, which is when the loader's dynamic `import()` for its row comes back. So
 * the registry's own order is the order two `import()`s resolved in, which is a
 * fact about the filesystem and the module cache on the day rather than about
 * `olai.yml`.
 *
 * A PERSON READS THIS ORDER, twice over: it is the order the chat panel's picker
 * draws its rows in, and the order the no-agent face lists engines to install
 * in. A list that reshuffled itself between boots is a list nobody can read
 * twice — the exact failure `./probes.ts` was written after one wall over, where
 * the servers a session reported changed between two boots of one serve.
 *
 * It is ALSO what a note naming no agent at all is read as being about
 * (`@olai/chat`'s `memory.ts`), so a reshuffle there would silently be a
 * different conversation coming back.
 *
 * So the order is IMPOSED here rather than assumed anywhere: `bundleRank` is the
 * build's own list of rows, and it is the same list the roster cell and the
 * session-start thunks are ordered by. One order, from one file, for everything
 * a person can see.
 *
 * ## What this module deliberately does NOT do
 *
 * It does not read a `leg`, does not call an `at`, and never touches an install
 * sentence. The probing is `@olai/chat`'s (its `agents/roster.ts`, which owns the
 * off switch and the search path), and the PROSE never crosses this wire at all:
 * each engine's browser half draws its own row on the no-agent face, out of the
 * `chat.agent.install` slot, so **core displays no sentence here because it is
 * handed none**. What is left is a sort.
 */

import type { Engine } from "@olai/acp/engine"
import { bundleRank } from "@olai/bundle"
import type { Plugins } from "@olai/plugin-api/services"

/** Every engine this serve mounted, in the build's own order. */
export const enginesAt = (plugins: Plugins): ReadonlyArray<Engine> =>
  [...plugins.engines()].sort((one, other) => bundleRank(one.id) - bundleRank(other.id))


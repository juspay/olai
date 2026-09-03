/**
 * WHICH ACP ENGINES THIS SERVE HAS, in the bundle's order.
 *
 * ## Why reading a registry is a module and not a line
 *
 * An engine is a plugin, and a plugin registers when its `apply` runs — which is
 * when the loader's dynamic `import()` for its row comes back. So the registry's
 * own order is the order two `import()`s resolved in, which is a fact about the
 * filesystem and the module cache on the day rather than about `olai.yml`.
 *
 * That this order is IMPOSED, and why a person would notice if it were not, is
 * argued once beside the list it is imposed from (`@olai/bundle`'s
 * `inBundleOrder`) — the same call `./probes.ts` makes for the session's servers
 * and `@olai/web`'s plugin runtime makes for the tab's slots. It is read twice
 * over here: the order the chat panel's picker draws its rows in, and the order
 * the no-agent face lists engines to install in. It is ALSO what a note naming
 * no agent at all is read as being about (`@olai/chat`'s `memory.ts`), so a
 * reshuffle there would silently be a different conversation coming back.
 *
 * What is left in this module is a READING OF A LIVE REGISTRY, which is the
 * composition root's job and nobody else's: `@olai/chat` is handed an array and
 * never learns that a plugin system exists.
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
import { inBundleOrder } from "@olai/bundle"
import type { Plugins } from "@olai/plugin-api/services"

/** Every engine this serve mounted, in the build's own order. */
export const enginesAt = (plugins: Plugins): ReadonlyArray<Engine> =>
  inBundleOrder(plugins.engines(), (one) => one.id)

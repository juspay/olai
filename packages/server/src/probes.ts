/**
 * WHAT TO ASK THIS HOST WHEN A CONVERSATION OPENS — the `chat/session-start`
 * waterfall, collected and put in the BUNDLE'S ORDER.
 *
 * ## The order is the whole reason this is a module
 *
 * The list used to be collected inline beside the chat, under a comment that
 * said it came back "in dispatch order, which is registration order, which is
 * the bundle's". The first two clauses are true and the third does not follow. A
 * plugin registers when its `apply` RUNS, and a row's `apply` runs when the
 * loader's dynamic import for that row resolves — so the order is the order two
 * `import()`s came back in, which is a fact about the filesystem and the module
 * cache on the day, not about `olai.yml`.
 *
 * Nothing went red at that seam, because nothing there reads the order. What
 * reads it is a CONVERSATION: the servers a session was handed are drawn as
 * chips under the header and reported by the agent in the order they arrived,
 * so the same serve, restarted, showed `kolu odu` one time and `odu kolu` the
 * next. A roster that reorders itself between boots is a roster a person cannot
 * read twice, and it was an e2e failure that re-rolled onto a different
 * scenario every run — which is what an ordering race looks like from outside.
 *
 * So the order is IMPOSED here rather than assumed anywhere: `BUNDLE_NAMES` is
 * the build's own list, and it is the same list the roster cell is written from
 * (`@olai/bundle`'s `reportBundle` walks `ROWS`). One order, from one file, for
 * both of the things a person can see.
 *
 * ## Why sort rather than register in order
 *
 * Because the registry is the runtime's and the registration is a plugin's.
 * There is no seam between them that could be told to take one plugin's probe
 * before another's, and inventing one would mean core holding a second list of
 * plugin names — the one thing `olai.yml` exists to be the only copy of.
 * Collecting whatever arrives and then reading it against the build's list keeps
 * the knowledge in the file that has it.
 *
 * THE SORT ITSELF IS `@olai/bundle`'S, and it was written out here twice over.
 * First the comparator's guts — the same `indexOf`, the same `-1` arm, the same
 * paragraph about strangers — in two processes, one copy citing the other; that
 * move extracted `bundleRank` and left the `.sort(…)` behind, so the copies came
 * back the moment a third caller wanted one. `inBundleOrder` is the whole
 * gesture, and the stranger rule, the stability argument and the reason a person
 * needs this order at all live beside the list they are about.
 */

import { inBundleOrder } from "@olai/bundle"
import type { Asked, Plugins } from "@olai/plugin-api/services"
import { Effect } from "effect"

/**
 * READ THE REGISTRY AND HAND BACK WHAT TO ASK, in the bundle's order.
 *
 * AN EFFECT, and that is not ceremony: the reading is per SESSION OPEN, so a
 * plugin that unloaded between conversations contributes nothing to the next
 * one, and a caller that cached the array would be keeping the second list this
 * whole arrangement exists to not have.
 *
 * The BOUNDED CONCURRENCY is downstream of this and untouched: what is collected
 * here is the LIST, and `@olai/chat` still schedules the asking.
 */
export const askingAt = (plugins: Plugins): Effect.Effect<ReadonlyArray<Asked>> =>
  Effect.map(plugins.sessionStart, (asking) => inBundleOrder(asking, (one) => one.name))


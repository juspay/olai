/**
 * WHAT TO ASK THIS HOST WHEN A CONVERSATION OPENS — the `chat/session-start`
 * waterfall, collected and put in the BUNDLE'S ORDER.
 *
 * ## The order is the whole reason this is a module
 *
 * `SessionStart.asking` used to be collected inline beside the chat, under a
 * comment that said the list came back "in dispatch order, which is
 * registration order, which is the bundle's". The first two clauses are true
 * and the third does not follow. A listener is registered when its plugin's
 * `apply` RUNS, and a row's `apply` runs when the loader's dynamic import for
 * that row resolves — so the order is the order two `import()`s came back in,
 * which is a fact about the filesystem and the module cache on the day, not
 * about `olai.yml`.
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
 * ## Why sort rather than dispatch in order
 *
 * Because the dispatcher is the runtime's and the registration is a plugin's.
 * There is no seam between them that could be told to call kolu's listener
 * before odu's, and inventing one would mean core holding a second list of plugin
 * names — the one thing `olai.yml` exists to be the only copy of. Collecting
 * whatever arrives and then reading it against the build's list keeps the
 * knowledge in the file that has it.
 *
 * THE COMPARATOR ITSELF IS `@olai/bundle`'S, and it was written out here. The
 * tab sorts its plugin-keyed slots by the same rule for the same reason, and the
 * two copies — the same `indexOf`, the same `-1` arm, the same paragraph about
 * strangers — sat in two different processes with one citing the other. The list
 * is that package's, so the order over it is too: `bundleRank` is where the
 * stranger rule and the stability argument now live.
 */

import { bundleRank } from "@olai/bundle"
import type { Plugins, SessionStart } from "@olai/plugin-api/services"
import { Effect } from "effect"

/**
 * DISPATCH THE WATERFALL AND HAND BACK WHAT TO ASK, in the bundle's order.
 *
 * AN EFFECT, and that is not ceremony. The waterfall's own shape is that each
 * link is handed the payload and a `next`, and the chain answers when the last
 * of them has called through. A link that yielded anything before its push
 * would be dropped by a caller that did not wait — silently absent from every
 * session, for ever, on a path whose whole subject is a plugin that is missing.
 * The chain is an Effect and this hands one back, so there is nothing for a
 * plugin author who had no reason to know the contract to get wrong.
 *
 * The BOUNDED CONCURRENCY the thunks exist for is downstream of this and
 * untouched: what is collected here is the LIST, and `@olai/chat` still
 * schedules the asking.
 */
export const askingAt = (plugins: Plugins): Effect.Effect<SessionStart["asking"]> =>
  Effect.map(
    plugins.sessionStart,
    (start) =>
      [...start.asking].sort((one, other) => bundleRank(one.name) - bundleRank(other.name)),
  )


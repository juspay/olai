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
 * Because the dispatcher is Cordis's and the registration is a plugin's. There
 * is no seam between them that could be told to call kolu's listener before
 * odu's, and inventing one would mean core holding a second list of plugin
 * names — the one thing `olai.yml` exists to be the only copy of. Collecting
 * whatever arrives and then reading it against the build's list keeps the
 * knowledge in the file that has it.
 *
 * A name the bundle does not know sorts LAST, in the order it was pushed. That
 * is not a case this build can reach — every fiber is a row — and it is the
 * behaviour an out-of-tree plugin will want the day `olai plugin add` lands: a
 * stranger goes after everything the build shipped rather than being dropped.
 */

import { BUNDLE_NAMES } from "@olai/bundle"
import type { SessionStart } from "@olai/plugin-api/services"
import type { Context } from "cordis"

/**
 * DISPATCH THE WATERFALL AND HAND BACK WHAT TO ASK, in the bundle's order.
 *
 * AWAITED, and that is not ceremony. The waterfall's own shape is that
 * listeners are called with the payload and a `next`, and the INNER function
 * runs when the last of them has called through — so with two synchronous
 * listeners the chain settles inline and the pushes have landed by the time
 * this returns.
 *
 * A listener that awaited anything before its push would not have, and nothing
 * would be red: it would simply be absent from every session, for ever, on a
 * path whose whole subject is a plugin that is missing. So the dispatch is
 * awaited and this hands back a promise, which costs one microtask per session
 * open and cannot be got wrong by a plugin author who had no reason to know the
 * contract.
 *
 * The BOUNDED CONCURRENCY the thunks exist for is downstream of this and
 * untouched: what is collected here is the LIST, and `@olai/chat` still
 * schedules the asking.
 */
export const askingAt = async (plugins: Context): Promise<SessionStart["asking"]> => {
  const start: SessionStart = { asking: [] }
  await plugins.waterfall("chat/session-start", start, async () => start)
  return [...start.asking].sort((one, other) => rank(one.name) - rank(other.name))
}

/**
 * WHERE A NAME SITS IN THE BUILD'S LIST, and `BUNDLE_NAMES.length` for a name
 * that is not in it — so a stranger sorts after every row rather than before
 * every one of them, which is what a bare `indexOf` and its `-1` would do.
 *
 * `Array.prototype.sort` is stable, so two names with the same rank (two
 * strangers) keep the order they were pushed in. That is the only order there
 * is to keep for them: the build has no opinion about a plugin it never named.
 */
const rank = (name: string): number => {
  const at = BUNDLE_NAMES.indexOf(name)
  return at === -1 ? BUNDLE_NAMES.length : at
}

/**
 * EVERY AGENT VERB THIS BUILD HAS, gathered from the rows that own them.
 *
 * ## This is a COMPOSITION, not a table
 *
 * Nothing here names a tool. Each line loads one row's own `./tools` export —
 * the same move `./surface.ts` makes with the rows' specs — so adding a verb to
 * a row is an edit in that row's package and nowhere else. That is the whole
 * point of #546: `@olai/ops` used to hold thirty verbs in one closed array, and
 * `olai-plugin-mcp` held two more tables saying which row each one belonged to,
 * which meant a row switched off left its verbs advertised until somebody
 * edited a filter two packages away.
 *
 * ## Why a STATIC union exists at all when the roster is live
 *
 * `serveSurfaceAsMcp` takes its `tools` record ONCE, at construction, and
 * dispatches `tools/call` out of it for the connection's whole life. A row that
 * mounts later — a vault arriving, a plugin switched back on — has no way into
 * that record, so a face built only from the rows standing at boot would serve
 * an agent a tool list that could only ever shrink.
 *
 * So the RECORD is the build's and the LIST is the roster's: every built row's
 * verbs are registered as handlers, and `olai-plugin-mcp` advertises only those
 * whose owner is standing right now (`packages/server/src/profiles.test.ts`,
 * "shared write tags retain only their active content cases on the MCP catalog"
 * — which flips outlines off, watches `set_title` and `read_node` leave, flips
 * it back on and watches them return).
 *
 * ## ...AND WHY IT IS AWAITED RATHER THAN IMPORTED
 *
 * A `import { tools } from "olai-plugin-outlines/tools"` at the top of this file
 * is a STATIC edge, and `@olai/server`'s `serve.ts` reaches this door — so the
 * host's permanent entry closure grew every row's table and, behind them, the
 * whole ops layer: the planner, the codec, the query engine, thirteen files of
 * write implementation in a closure that composes rows and must not BE one.
 * `./fence.test.ts`'s "permanent host entry closures contain no Olai feature
 * implementation" is what said so, and it was right: nothing here is a contract,
 * these are the verbs themselves.
 *
 * A dynamic `import()` is not a static edge, which is the same mechanism this
 * registry already keeps plugin halves out of the host's closure with
 * (`./rows.ts`'s `load`, and `./bundle.ts`'s `importByName`). The specifiers are
 * still literal, so a bundler splits on them and nothing is resolved by
 * concatenation; what changes is only that the host pays for them when the MCP
 * face is built rather than when the process starts.
 *
 * WHAT REPLACES THIS is juspay/kolu#2233: an adapter that takes a rooted bundle
 * and a live roster, with `notifications/tools/list_changed` when it moves. On
 * that day the record and the list are one reading again, and this module goes.
 */
import type { Tool } from "@olai/ops"

/** One built row's verbs, under the row's own name — the same word its sibling
 *  key is, so the owner a tool is filtered by is the owner it is served by. */
export interface RowTools {
  readonly owner: string
  readonly tools: ReadonlyArray<Tool>
}

/** The eight rows that carry agent verbs, each paired with the loader for its
 *  own table. A row with no `./tools` export simply is not here — which is what
 *  "this row offers an agent nothing" means, and is the same absence
 *  `exposeMapsOf` reads for a row that writes no face map. */
const DOORS: ReadonlyArray<readonly [string, () => Promise<{ readonly tools: ReadonlyArray<Tool> }>]> = [
  ["outlines", () => import("olai-plugin-outlines/tools")],
  ["markdown", () => import("olai-plugin-markdown/tools")],
  ["files", () => import("olai-plugin-files/tools")],
  ["trash", () => import("olai-plugin-trash/tools")],
  ["search", () => import("olai-plugin-search/tools")],
  ["capture", () => import("olai-plugin-capture/tools")],
  ["git", () => import("olai-plugin-git/tools")],
  ["vault-plugins", () => import("olai-plugin-vault-plugins/tools")],
]

/** Loaded ONCE per process. `import()` memoises in the module registry anyway,
 *  so this only saves re-walking the list — but the value's IDENTITY is what a
 *  caller holding a tool record wants to be stable. */
let loaded: Promise<ReadonlyArray<RowTools>> | undefined

export const agentTools = (): Promise<ReadonlyArray<RowTools>> =>
  loaded ??= Promise.all(DOORS.map(async ([owner, load]) => ({ owner, tools: (await load()).tools })))

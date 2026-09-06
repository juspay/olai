/**
 * EVERY AGENT VERB THIS BUILD HAS, gathered from the rows that own them.
 *
 * ## This is a COMPOSITION, not a table
 *
 * Nothing here names a tool. Each line imports one row's own `./tools` export —
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
 * WHAT REPLACES THIS is juspay/kolu#2233: an adapter that takes a rooted bundle
 * and a live roster, with `notifications/tools/list_changed` when it moves. On
 * that day the record and the list are one reading again, and this module goes.
 */
import type { Tool } from "@olai/ops"
import { tools as capture } from "olai-plugin-capture/tools"
import { tools as files } from "olai-plugin-files/tools"
import { tools as git } from "olai-plugin-git/tools"
import { tools as markdown } from "olai-plugin-markdown/tools"
import { tools as outlines } from "olai-plugin-outlines/tools"
import { tools as search } from "olai-plugin-search/tools"
import { tools as trash } from "olai-plugin-trash/tools"

/** One built row's verbs, under the row's own name — the same word its sibling
 *  key is, so the owner a tool is filtered by is the owner it is served by. */
export interface RowTools {
  readonly owner: string
  readonly tools: ReadonlyArray<Tool>
}

export const AGENT_TOOLS: ReadonlyArray<RowTools> = [
  { owner: "outlines", tools: outlines },
  { owner: "markdown", tools: markdown },
  { owner: "files", tools: files },
  { owner: "trash", tools: trash },
  { owner: "search", tools: search },
  { owner: "capture", tools: capture },
  { owner: "git", tools: git },
]

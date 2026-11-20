import { refusalIn } from "@olai/surface"
/**
 * What omp means by what it sends — captured live against **omp 18.1.21**
 * running `omp --approval-mode yolo acp` (2026-09-14). Plain ACP over stdio,
 * with six readings that are omp's own:
 *
 *   - a call id is `<tool>:<n>` (`write:0`, `bash:3`); the number is the
 *     call's, not the tool's.
 *   - olai's MCP tools are dispatched through omp's own `write`. omp mints
 *     them as `mcp__<server>_<tool>` (lowercase, `[^a-z_]` folded to `_`, a
 *     `<server>_` prefix on the tool's own name stripped, capped at 64 with a
 *     hash) and with its default `tools.xdev: true` calls them by writing to
 *     an `xd://` pseudo-path, answering under `details.xdev.inner`. With
 *     `tools.xdev: false` the bare `mcp__<server>_<tool>:<n>` call is
 *     announced instead and answers top-level, so both readers take both.
 *   - `_meta` appears on no frame about a call, so a tool is named from the
 *     call id and whose call it is cannot be answered at all. The one `_meta`
 *     omp stamps is `{ messageCount, size }` on a `session/list` row.
 *   - `session/set_mode "bypassPermissions"` answers `-32603 "Unsupported ACP
 *     mode"` (the modes are `default` and `plan`), and `_session/steering`
 *     answers `-32603 "Unknown ACP ext method"`.
 *   - a send during a streaming turn cancels that turn: omp's `prompt()`
 *     begins a cancel cleanup when `record.session.isStreaming`, and the
 *     cancelled turn ends `stopReason: "cancelled"`. An autonomous turn
 *     refuses the prompt outright with `-32000 session_busy`.
 *   - a server that fails to connect fails `session/new` outright rather than
 *     reporting per server, and no agent-private channel is forwarded.
 *
 * omp writes no `_meta.terminal_*` corner, so this leg declares no
 * `terminalOutput`, and nothing on its frames names who spawned what.
 */

import {
  allowingOurs,
  mcpCallBy,
  type Leg,
  type ListedFacts,
  type Meta,
  namedExactly,
} from "@kolu/acp/engine"

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

export const toolNameOf = (toolCallId: string): string | null => {
  const at = toolCallId.indexOf(":")
  if (at <= 0) return null
  return toolCallId.slice(0, at)
}

/** The pseudo-scheme omp's `write` tool takes as a dispatch door: a path under
 *  it names an internal tool rather than a file. */
const XD = "xd://"

/** The prefix an MCP server's tools carry on this wire — on the SERVER, since
 *  omp folds the tool's own name (see the header). */
export const spelling = (server: string) => `mcp__${server}_`

const byName = mcpCallBy(spelling)

export const mcpCall: Leg["mcpCall"] = (frame, servers) => {
  const path = record(frame.rawInput)?.["path"]
  const aimed = typeof path === "string" && path.startsWith(XD) ? path.slice(XD.length) : null
  const dispatched = aimed === null ? [] : byName({ title: aimed }, servers)
  return dispatched.length > 0 ? dispatched : byName(frame, servers)
}

const xdevReply = (rawOutput: unknown): unknown =>
  record(record(record(record(rawOutput)?.["details"])?.["xdev"])?.["inner"])?.["rawContent"]

const topLevelReply = (rawOutput: unknown): unknown =>
  record(record(rawOutput)?.["details"])?.["rawContent"]

/** What one of olai's tools answered, or `undefined` for a frame carrying no
 *  such thing. */
export function replyIn(rawOutput: unknown): Record<string, unknown> | undefined {
  const blocks = xdevReply(rawOutput) ?? topLevelReply(rawOutput)
  const text = Array.isArray(blocks) ? record(blocks[0])?.["text"] : undefined
  if (typeof text !== "string") return undefined
  try {
    return record(JSON.parse(text))
  } catch {
    return refusalIn(text)
  }
}

export const allowedWithoutAsking = allowingOurs(spelling)

/** The facts a `session/list` entry carries about its conversation. A row with
 *  no `_meta` corner answers `null`, which draws nothing rather than a zero. */
export const listedIn = (meta: Meta): ListedFacts | null => {
  const corner = record(meta)
  if (corner === undefined) return null
  const count = corner["messageCount"]
  return { messageCount: typeof count === "number" ? count : null, supersededBy: null }
}

export const OMP: Leg = {
  spelling,
  mcpCall,
  replyIn,
  toolNameIn: () => null,
  toolNameOf,
  allowedWithoutAsking,
  parentToolUse: () => null,
  spawned: () => null,
  backgroundTask: () => null,
  taskNotification: () => null,
  listedIn,
  prologueIn: () => null,
  bypassMode: null,
  steering: null,
  queues: () => false,
  rawMessages: null,
  models: { config: "model", nameIn: namedExactly },
}

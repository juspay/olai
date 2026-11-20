import { refusalIn } from "@olai/surface"
/**
 * What omp means by what it sends — captured live against **omp 18.1.21**
 * running `omp --approval-mode yolo acp` (2026-09-14).
 *
 * It is plain ACP over stdio, with four readings that are omp's own:
 *
 *   - olai's MCP tools are dispatched through omp's own `write` tool. omp mints
 *     them as `mcp__<server>_<tool>` (lowercase, `[^a-z_]` folded to `_`, a
 *     `<server>_` prefix on the tool's own name stripped, capped at 64 with a
 *     hash) and with its default `tools.xdev: true` CALLS them by writing to an
 *     `xd://` pseudo-path: `tool_call { toolCallId: "write:0", title: <intent>,
 *     kind: "execute", rawInput: { path: "xd://mcp__olai_outlines_read",
 *     content: "{\"id\":…}" } }`. With `tools.xdev: false` the bare
 *     `mcp__<server>_<tool>:<n>` call is announced instead, args as `rawInput`,
 *     answering top-level — so both readers take both shapes.
 *   - `_meta` never appears on any frame, so a tool is named from the call id
 *     and whose call it is cannot be answered at all.
 *   - `session/set_mode "bypassPermissions"` answers `-32603 "Unsupported ACP
 *     mode"` (the modes are `default` and `plan`), `_session/steering` answers
 *     `-32603 "Unknown ACP ext method"`, and a `session/prompt` during an
 *     autonomous omp turn answers `-32000 session_busy`.
 *   - a busy send CANCELS the turn in flight: omp's `prompt()` begins a cancel
 *     cleanup when `record.session.isStreaming`, and the cancelled turn ends
 *     `stopReason: "cancelled"`. No capability says otherwise, which is what
 *     {@link Leg.queues} answering `false` is for.
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

/** What separates a tool's name from the rest of a call id. omp mints
 *  `<tool>:<n>` — `write:0`, `bash:3` — and the number is the call's, not the
 *  tool's. */
const AT = ":"

export const toolNameOf = (toolCallId: string): string | null => {
  const at = toolCallId.indexOf(AT)
  if (at <= 0) return null
  return toolCallId.slice(0, at)
}

/** The pseudo-scheme omp's `write` tool takes as a dispatch door. A path under
 *  it names an INTERNAL tool rather than a file, which is why it is the one
 *  string on this wire that may be believed. */
const XD = "xd://"

/**
 * The programmatic prefix an MCP server's tools carry on this wire:
 * `mcp__<server>_<tool>`, a double underscore after `mcp` and a single one
 * between the server and the tool.
 *
 * omp folds the name it mints — lowercase, anything outside `[a-z_]` to `_`, a
 * `<server>_` prefix on the tool's own name stripped, capped at 64 characters
 * with a hash — which is why this is a prefix on the SERVER rather than derived
 * from the tool's name. The folding is the identity on every server and tool
 * name olai hands over.
 */
export const spelling = (server: string) => `mcp__${server}_`

const byName = mcpCallBy(spelling)

export const mcpCall: Leg["mcpCall"] = (frame, servers) => {
  const path = record(frame.rawInput)?.["path"]
  const aimed = typeof path === "string" && path.startsWith(XD) ? path.slice(XD.length) : null
  const dispatched = aimed === null ? [] : byName({ title: aimed }, servers)
  return dispatched.length > 0 ? dispatched : byName(frame, servers)
}

/**
 * What one of olai's tools answered, out of the completion frame of the `write`
 * call that dispatched it — or `undefined` for a frame carrying no such thing.
 *
 * omp wraps the result twice, and the reply is the innermost text block:
 * `rawOutput.details.xdev.inner.rawContent[0].text`, with
 * `details.rawContent[0].text` as the `tools.xdev: false` shape, where the call
 * is top-level and there is no `write` around it.
 *
 * The text is parsed as JSON because olai's own MCP server publishes every
 * answer twice: `structuredContent` and that same object serialized beside it.
 */
export function replyIn(rawOutput: unknown): Record<string, unknown> | undefined {
  const details = record(record(rawOutput)?.["details"])
  const inner = record(record(details?.["xdev"])?.["inner"])
  const blocks = inner?.["rawContent"] ?? details?.["rawContent"]
  const text = Array.isArray(blocks) ? record(blocks[0])?.["text"] : undefined
  if (typeof text !== "string") return undefined
  try {
    return record(JSON.parse(text))
  } catch {
    return refusalIn(text)
  }
}

export const allowedWithoutAsking = allowingOurs(spelling)

/**
 * The two facts a `session/list` entry carries about its conversation: omp
 * stamps `{ messageCount, size }` on the entry's own `_meta` corner, and the
 * count is a real count rather than an inference. A row with no corner answers
 * `null`, which draws nothing rather than a zero.
 */
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
  // `-32603 "Unsupported ACP mode"`: the modes are `default` and `plan`, and
  // `plan` is offered only where omp's own `plan.enabled` says so. Unattended
  // approval for omp is the `--approval-mode yolo` on its command line.
  bypassMode: null,
  // `-32603 "Unknown ACP ext method"`, so there is no interrupting gesture to
  // offer here.
  steering: null,
  // A `session/prompt` arriving while a turn streams makes omp cancel that turn
  // and run the new prompt (`acp-agent.ts`'s `prompt()`), and no capability in
  // its `initialize` says otherwise.
  queues: () => false,
  // omp forwards no agent-private channel. A server that fails to connect fails
  // `session/new` outright rather than reporting per server.
  rawMessages: null,
  models: { config: "model", nameIn: namedExactly },
}

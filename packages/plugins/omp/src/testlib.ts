/**
 * Adapter fixtures shared by the leg bench and the executable e2e fake: the
 * `write` call whose `rawInput.path` is the `xd://` door an olai tool was
 * dispatched through, and the completion that nests the tool's own result
 * inside `write`'s.
 *
 * The shapes are omp 18.1.21's, captured live: see `./leg.ts`'s header.
 */

import type { ToolCall, ToolCallContent } from "@agentclientprotocol/sdk"

import { spelling } from "./leg.ts"

export const XD = "xd://"

export interface CallToolResult {
  readonly content: { type: "text"; text: string }[]
  readonly structuredContent?: Record<string, unknown>
  readonly isError?: boolean
}

export const announced = (server: string, tool: string, args: unknown): Partial<ToolCall> => ({
  kind: "execute",
  rawInput: { path: `${XD}${spelling(server)}${tool}`, content: JSON.stringify(args) },
})

/**
 * `details.xdev.inner.rawContent` is the tool's content blocks, the only part
 * of omp's wrapping anything reads (`./leg.ts`'s `replyIn`). The `xdev` corner
 * also carries the tool's arguments, its tier and its provider; nothing here
 * reads those, so they are left out.
 */
export const wrapped = (result: CallToolResult): { rawOutput: unknown; content?: ToolCallContent[] } => {
  const content = result.content.map((part) => ({ type: "content" as const, content: part }))
  return {
    rawOutput: {
      content: result.content,
      details: { xdev: { mode: "execute", inner: { rawContent: result.content, provider: "acp" } } },
    },
    content,
  }
}

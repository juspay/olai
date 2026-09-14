/**
 * Adapter fixtures shared by the leg bench and the executable e2e fake.
 *
 * TWO FILES AND ONE FIXTURE, which is the arrangement every engine here has and
 * for the reason the second file exists at all: a fake that builds its own
 * frames is a fake that can agree with the client by construction, and a bench
 * that builds its own is a bench measuring a shape nobody sends. What both
 * stage is the pair an olai call makes on THIS wire —
 * {@link announced}, the `write` call whose `rawInput.path` is the `xd://` door
 * the tool was dispatched through, and {@link wrapped}, the completion that
 * nests the tool's own result inside `write`'s.
 *
 * The shapes are omp 18.1.21's, captured live: see `./leg.ts`'s header.
 */

import type { ToolCall, ToolCallContent } from "@agentclientprotocol/sdk"

import { spelling } from "./leg.ts"

/** `xd://`, omp's pseudo-scheme for dispatching one of its own internal tools.
 *  Exported because both files need the door spelled the same way and neither
 *  may be the other's source. */
export const XD = "xd://"

/** Structural `CallToolResult` subset used by these text-only fixtures. */
export interface CallToolResult {
  readonly content: { type: "text"; text: string }[]
  readonly structuredContent?: Record<string, unknown>
  readonly isError?: boolean
}

/**
 * The ANNOUNCEMENT of one of olai's tools on this wire: a `write` call to the
 * `xd://` path omp minted for it.
 *
 * NOTHING HERE SAYS `write` OR A CALL ID, deliberately. Both belong to the
 * caller: the id is the caller's counter (`write:0`, `write:1`) and the title is
 * the intent sentence its model wrote, and a fixture that invented either would
 * be staging a claim about a conversation it has never seen. What IS this
 * fixture's is the pair that makes the call read as ours — the `xd://` path and
 * the JSON-stringified arguments — which is exactly what the leg's readers and
 * the panel's title, outline and reply all hang off.
 */
export const announced = (server: string, tool: string, args: unknown): Partial<ToolCall> => ({
  kind: "execute",
  rawInput: { path: `${XD}${spelling(server)}${tool}`, content: JSON.stringify(args) },
})

/**
 * The COMPLETION of that call: what `write` answers, with the MCP tool's own
 * result nested inside it.
 *
 * `details.xdev.inner.rawContent` is the tool's content blocks, which is the
 * only part of the wrapping anything reads (`./leg.ts`'s `replyIn`). omp's
 * `xdev` corner also carries the tool's arguments, its tier and the provider it
 * came from; a fixture that filled those in would be inventing values no reader
 * here consults, so they are left out rather than guessed at.
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

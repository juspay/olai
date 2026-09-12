/** Adapter fixtures shared by the leg bench and the executable e2e fake. */
import type { ToolCall, ToolCallContent } from "@agentclientprotocol/sdk"
/** Structural CallToolResult subset used by these text-only fixtures. */
export interface CallToolResult {
  readonly content: { type: "text"; text: string }[]
  readonly structuredContent?: Record<string, unknown>
  readonly isError?: boolean
}
export const announced = (server: string, tool: string, args: unknown): Partial<ToolCall> => {
  return { title: `${server}_${tool}`, kind: "other", rawInput: args }
}
export const wrapped = (result: CallToolResult): { rawOutput: unknown; content?: ToolCallContent[] } => {
  const output = JSON.stringify(result)
  return { rawOutput: { output, metadata: result }, content: [{ type: "content", content: { type: "text", text: output } }] }
}

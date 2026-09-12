import { spelling } from "./leg.ts"
/** Adapter fixtures shared by the leg bench and the executable e2e fake. */
import type { ToolCall, ToolCallContent } from "@agentclientprotocol/sdk"
/** Structural CallToolResult subset used by these text-only fixtures. */
export interface CallToolResult {
  readonly content: { type: "text"; text: string }[]
  readonly structuredContent?: Record<string, unknown>
  readonly isError?: boolean
}
export const announced = (server: string, tool: string, args: unknown): Partial<ToolCall> => {
  return { title: spelling(server) + tool, kind: "other", rawInput: args, _meta: { claudeCode: { toolName: spelling(server) + tool } } }
}
export const wrapped = (result: CallToolResult): { rawOutput: unknown; content?: ToolCallContent[] } => {
  return { rawOutput: result.content, content: result.content.map(content => ({ type: "content", content })) }
}

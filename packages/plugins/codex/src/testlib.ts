import type { ToolCall, ToolCallContent } from "@agentclientprotocol/sdk"
export interface CallToolResult {
  readonly content: { type: "text"; text: string }[]
  readonly structuredContent?: Record<string, unknown>
  readonly isError?: boolean
}
export const announced = (server: string, tool: string, args: unknown): Partial<ToolCall> => {
  return { title: `mcp.${server}.${tool}`, kind: "execute", rawInput: { server, tool, arguments: args }, _meta: { is_mcp_tool_call: true } }
}
export const wrapped = (result: CallToolResult): { rawOutput: unknown; content?: ToolCallContent[] } => {
  return { rawOutput: { result, error: null } }
}

/**
 * Adapter fixtures, shared by the leg bench and the executable e2e fake.
 *
 * Captured against opencode 2.2.7, whose MCP story is CODE MODE: a tool olai
 * handed over never arrives as a tool call of its own, only as a line of
 * JavaScript inside one `execute`, with the agent's account of what ran in the
 * completion's `rawOutput.metadata.toolCalls` and the script's value as a
 * content block.
 */
import type { ToolCall, ToolCallContent } from "@agentclientprotocol/sdk"

export interface CallToolResult {
  readonly content: { type: "text"; text: string }[]
  readonly structuredContent?: Record<string, unknown>
  readonly isError?: boolean
}

export const script = (server: string, tool: string, args: unknown): string =>
  `return await tools.${server}.${tool}(${JSON.stringify(args)});`

/**
 * opencode leaves `rawInput` EMPTY on the announcing frame and carries the code
 * on the refining one, while the model is still emitting the script.
 */
export const announced = (code: string | null): Partial<ToolCall> => ({
  name: "execute",
  title: "execute",
  kind: "other",
  rawInput: code === null ? {} : { code },
})

/**
 * `rawOutput.metadata.toolCalls` is the agent's own record of what the script
 * ran (`<server>.<tool>`, dotted); `error` is set for a run in which anything
 * threw or was refused. There is no `structuredContent` and no `output` on this
 * wire.
 */
export const ran = (
  calls: ReadonlyArray<{ tool: string; status?: "completed" | "error"; input?: unknown }>,
  returned: unknown,
): { rawOutput: unknown; content: ToolCallContent[] } => ({
  rawOutput: {
    metadata: {
      toolCalls: calls.map((one) => ({
        tool: one.tool,
        status: one.status ?? "completed",
        ...(one.input === undefined ? {} : { input: one.input }),
      })),
      ...(calls.some((one) => one.status === "error") ? { error: true } : {}),
      truncated: false,
    },
  },
  content: [{
    type: "content",
    content: {
      type: "text",
      text: typeof returned === "string" ? returned : JSON.stringify(returned, null, 2),
    },
  }],
})

export const wrapped = (
  server: string,
  tool: string,
  args: unknown,
  result: CallToolResult,
): { rawOutput: unknown; content: ToolCallContent[] } =>
  ran(
    [{ tool: `${server}.${tool}`, status: result.isError === true ? "error" : "completed", input: args }],
    result.isError === true
      ? result.content.map((block) => block.text).join("\n")
      : result.structuredContent ?? result.content.map((block) => block.text).join("\n"),
  )

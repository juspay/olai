/**
 * ADAPTER FIXTURES, shared by the leg bench and the executable e2e fake — so
 * the frames a unit test asserts against and the frames a scenario actually
 * drives are the same frames.
 *
 * Every shape here was captured against **opencode 2.2.7**. The whole of the
 * MCP story on that wire is CODE MODE: a tool olai handed over never arrives
 * as a tool call of its own, only as a line of JavaScript inside one
 * `execute`, with the agent's account of what ran in the completion's
 * `rawOutput.metadata.toolCalls` and the script's value as a content block.
 */
import type { ToolCall, ToolCallContent } from "@agentclientprotocol/sdk"

/** Structural `CallToolResult` subset these text-only fixtures need. */
export interface CallToolResult {
  readonly content: { type: "text"; text: string }[]
  readonly structuredContent?: Record<string, unknown>
  readonly isError?: boolean
}

/** The script a Code Mode call runs, for one tool call — the spelling opencode
 *  itself writes (`return await tools.<server>.<tool>({ … });`). */
export const script = (server: string, tool: string, args: unknown): string =>
  `return await tools.${server}.${tool}(${JSON.stringify(args)});`

/**
 * How an `execute` is ANNOUNCED: a `name` of its own, an opaque id minted
 * elsewhere, and — on the refining frame — the script.
 *
 * `rawInput` is EMPTY on the first frame and carries the code on the second,
 * which is what the real agent does while the model is still emitting the
 * script, and why nothing here may name a row from its first frame alone.
 */
export const announced = (code: string | null): Partial<ToolCall> => ({
  name: "execute",
  title: "execute",
  kind: "other",
  rawInput: code === null ? {} : { code },
})

/**
 * ... and how it COMPLETES: the script's returned value as one text block, and
 * the run's bookkeeping in `rawOutput.metadata`.
 *
 * `toolCalls` is the agent's own record of what the script ran — `<server>.<tool>`,
 * dotted — and `error` is set for a run in which anything threw or was refused.
 * There is no `structuredContent` and no `output` anywhere on this wire.
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

/** One olai tool's answer as the script's value: `tools.<server>.<tool>()`
 *  resolves to the tool's structured content, which is what the `execute`
 *  returns and therefore what the content block holds. */
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

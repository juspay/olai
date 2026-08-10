/**
 * The internal MCP server: the ops layer, spoken as tools.
 *
 * ACP's `session/new` takes MCP server configurations, so the standard channel
 * from an agent to a host's own capabilities is an MCP server the host hands
 * its own session (docs/brainstorming/acp.md). This is that server — one
 * `handle` over JSON-RPC messages, with no transport in it at all. The
 * transport is the caller's: the olai server mounts it as an HTTP route
 * (`packages/server/src/mcp`), and a test calls it directly, which is what
 * makes the tool surface unit-testable without a socket.
 *
 * Three methods and one notification is the whole of MCP's tool half —
 * `initialize`, `tools/list`, `tools/call`, `notifications/initialized` — so
 * the official SDK would be a dependency for a hundred lines of dispatch we
 * would still have to route ourselves.
 *
 * The reply shape is MCP's, and one detail of it is load-bearing: a tool that
 * REFUSES returns a successful JSON-RPC result carrying `isError: true`, not a
 * JSON-RPC error. A protocol-level error is for a call the server could not
 * process; a refusal is an answer, and it has to reach the model — with its
 * structured detail in `structuredContent`, so "these three children are not
 * done" arrives as data the agent can act on rather than a sentence it has to
 * parse.
 */

import { kindOf, type OpFailure } from "@olai/format"
import { Effect, Result, Schema, SchemaRepresentation, SubscriptionRef } from "effect"

import type { Store } from "./deps.ts"
import type { Ops } from "./ops.ts"
import * as Query from "./query.ts"
import { Request } from "./request.ts"
import { TOOLS, type Tool, toolNamed } from "./tools.ts"

/** The MCP revision this server speaks. Answered back to a client that asked
 *  for something else, which is what the specification says to do: the client
 *  then decides whether it can live with it. */
const PROTOCOL = "2025-06-18"

export interface Options {
  readonly ops: Ops
  readonly store: Store
  /**
   * Told about every write that was refused, so a refusal can be RENDERED
   * rather than only returned. The agent gets the same detail in its tool
   * result; this is what puts it in front of the person watching, which is the
   * "errors are never silently ignored" rule made concrete — a refused write
   * shows its unfinished children in the chat panel.
   */
  readonly onRefusal?: (tool: string, failure: OpFailure) => Effect.Effect<void>
}

/** A JSON-RPC reply, or `null` for a notification — which has no id and must
 *  not be answered. */
export type Reply = Readonly<Record<string, unknown>> | null

export interface Server {
  readonly handle: (message: unknown) => Effect.Effect<Reply>
  /** What `tools/list` answers, for anything that wants to show the surface
   *  without speaking the protocol. */
  readonly tools: ReadonlyArray<Readonly<Record<string, unknown>>>
}

export const make = (options: Options): Server => {
  const advertised = TOOLS.map(describe)

  const handle = (message: unknown): Effect.Effect<Reply> => {
    if (!isObject(message)) {
      return Effect.succeed(error(null, -32600, "a JSON-RPC message is an object"))
    }
    const id = message["id"] as string | number | null | undefined
    const method = message["method"]
    if (typeof method !== "string") {
      return Effect.succeed(error(id ?? null, -32600, "a JSON-RPC request names a method"))
    }
    // A notification has no id and gets no reply — including the ones this
    // server does not implement, which is what the specification requires.
    const notification = id === undefined || id === null

    switch (method) {
      case "initialize":
        return Effect.succeed(
          result(id, {
            protocolVersion: PROTOCOL,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "olai", version: "0.1.0" },
            instructions:
              "olai serves a directory of outlines. Everything here is about NODES, not files: " +
              "search and read to find one, then use the write tools to change it. There is no " +
              "file access — a node is the smallest thing you can name, and that is deliberate.",
          }),
        )
      case "ping":
        return Effect.succeed(result(id, {}))
      case "tools/list":
        return Effect.succeed(result(id, { tools: advertised }))
      case "tools/call":
        return notification
          ? Effect.succeed(null)
          : call(options, id, message["params"])
      default:
        return Effect.succeed(
          notification ? null : error(id, -32601, `no such method: ${method}`),
        )
    }
  }

  return { handle, tools: advertised }
}

// ── tools/call ─────────────────────────────────────────────────────────

const call = (
  options: Options,
  id: string | number,
  params: unknown,
): Effect.Effect<Reply> =>
  Effect.gen(function*() {
    if (!isObject(params) || typeof params["name"] !== "string") {
      return error(id, -32602, "`tools/call` takes a tool `name`")
    }
    const name = params["name"]
    const tool = toolNamed(name)
    if (tool === undefined) return error(id, -32602, `no such tool: ${name}`)

    const args = isObject(params["arguments"]) ? params["arguments"] : {}
    const decoded = Schema.decodeUnknownResult(tool.schema as Schema.Codec<unknown>)({
      ...args,
      ...tool.fixed,
    })
    if (Result.isFailure(decoded)) {
      return result(id, refusal(`\`${name}\`: ${decoded.failure.message}`))
    }

    const answered = tool.writes
      ? yield* perform(options, tool, decoded.success as Request)
      : yield* Effect.map(read(options, tool, decoded.success), Result.succeed)

    if (Result.isFailure(answered)) {
      const failure = answered.failure
      if (options.onRefusal !== undefined) yield* options.onRefusal(name, failure)
      return result(
        id,
        refusal(`\`${name}\` was refused (${kindOf(failure)}): ${failure.message}`, {
          kind: kindOf(failure),
          ...(failure.toJSON() as Record<string, unknown>),
        }),
      )
    }
    return result(id, answer(answered.success))
  })

const perform = (
  options: Options,
  tool: Tool,
  request: Request,
): Effect.Effect<Result.Result<unknown, OpFailure>> =>
  Effect.result(options.ops.run(request)).pipe(
    Effect.map((outcome) =>
      Result.isFailure(outcome)
        ? outcome
        : Result.succeed({
          ...outcome.success,
          did: tool.name,
        })
    ),
  )

const read = (
  options: Options,
  tool: Tool,
  args: unknown,
): Effect.Effect<unknown> =>
  Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.get(options.store.snapshot)
    if (snapshot === null) {
      const errors = yield* SubscriptionRef.get(options.store.errors)
      return {
        unreadable: "the served directory has never loaded",
        errors: (errors ?? []).map(
          (error_) => `${error_.file}:${error_.line} ${error_.message}`,
        ),
      }
    }
    const set = snapshot.value
    const derived = Query.index(set)
    const input = args as Record<string, never>

    switch (tool.name) {
      case "list_outlines":
        return { outlines: Query.outlines(set, derived) }
      case "search_nodes":
        return Query.search(
          set,
          args as { text: string; limit?: number },
          derived,
        )
      case "read_node": {
        const id = (input as unknown as { id: string }).id
        const found = Query.detail(set, id, derived)
        return found ?? { missing: id }
      }
      case "read_subtree": {
        const asked = args as { id: string; depth?: number }
        const found = Query.subtree(
          set,
          asked.id,
          asked.depth === undefined ? {} : { depth: asked.depth },
          derived,
        )
        return found ?? { missing: asked.id }
      }
      default:
        throw new Error(`the tool table declares \`${tool.name}\` a read with no reader`)
    }
  })

// ── the shapes MCP expects ─────────────────────────────────────────────

/** One tool, as `tools/list` describes it. The JSON Schema is compiled from
 *  the request schema with the fields the tool NAME already decides taken out
 *  — an agent that had to pass `op: "done"` to `set_done` would be filling in
 *  a field that can only have one value. */
const describe = (tool: Tool): Readonly<Record<string, unknown>> => {
  const compiled = SchemaRepresentation.toJsonSchemaDocument(
    SchemaRepresentation.toRepresentation(tool.schema.ast),
  ).schema as {
    properties?: Record<string, unknown>
    required?: ReadonlyArray<string>
  }

  const properties = { ...(compiled.properties ?? {}) }
  for (const field of Object.keys(tool.fixed)) delete properties[field]
  const required = (compiled.required ?? []).filter(
    (field) => !(field in tool.fixed),
  )

  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    annotations: { readOnlyHint: !tool.writes, destructiveHint: false },
  }
}

/** A tool result. The text is what a model reads; the structured copy beside it
 *  is what a caller acts on, and both are always present so neither side has to
 *  parse the other's. */
const answer = (value: unknown): Readonly<Record<string, unknown>> => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  structuredContent: isObject(value) ? value : { value },
})

const refusal = (
  text: string,
  detail?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => ({
  content: [{ type: "text", text }],
  ...(detail === undefined ? {} : { structuredContent: detail }),
  isError: true,
})

const result = (
  id: string | number | null | undefined,
  value: unknown,
): Readonly<Record<string, unknown>> => ({ jsonrpc: "2.0", id: id ?? null, result: value })

const error = (
  id: string | number | null,
  code: number,
  message: string,
): Readonly<Record<string, unknown>> => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
})

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

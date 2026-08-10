/**
 * The MCP server: the ops layer, spoken as tools.
 *
 * ACP's `session/new` takes MCP server configurations, so the standard channel
 * from an agent to a host's own capabilities is an MCP server the host hands
 * its own session (docs/brainstorming/acp.md). This is that server — and,
 * having no transport in it at all, it is also the one an agent olai has never
 * met reaches. One `handle` over JSON-RPC messages; the transport is the
 * caller's. The olai server mounts it as an HTTP route for the session it
 * spawns, and pumps it over stdin and stdout for the coding agent in somebody's
 * terminal (`packages/server/src/mcp`); a test calls it directly, which is what
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
import { Effect, Result, Schema, SchemaRepresentation } from "effect"

import type { Ops } from "./ops.ts"
import { Request } from "./request.ts"
import { TOOLS, type Tool, toolNamed } from "./tools.ts"

/** The MCP revision this server speaks. Answered back to a client that asked
 *  for something else, which is what the specification says to do: the client
 *  then decides whether it can live with it. */
const PROTOCOL = "2025-06-18"

export interface Options {
  /** The whole of what this server can do. Reads go through `ops.read` and
   *  writes through `ops.run`, so nothing here reaches into a store — which is
   *  what lets this file be, as its header claims, dispatch and nothing else. */
  readonly ops: Ops
}

/** A JSON-RPC reply, or `null` for a notification — which has no id and must
 *  not be answered. */
export type Reply = Readonly<Record<string, unknown>> | null

export interface Server {
  readonly handle: (message: unknown) => Effect.Effect<Reply>
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

  return { handle }
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
      ...(tool.kind === "write" ? tool.fixed : {}),
    })
    if (Result.isFailure(decoded)) {
      return result(id, refusal(`\`${name}\`: ${decoded.failure.message}`))
    }

    const answered = tool.kind === "write"
      ? yield* Effect.result(
        Effect.map(options.ops.run(decoded.success as Request), (applied) => ({
          ...applied,
          did: tool.name,
        })),
      )
      // The reader is the tool's OWN, carried in the table beside it — so a
      // tool the table declares and nothing answers is a type error rather
      // than something a caller discovers.
      : yield* Effect.result(
        Effect.map(options.ops.read, (at) => tool.read(at, decoded.success as never)),
      )

    if (Result.isFailure(answered)) {
      const failure = answered.failure
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

  const fixed = tool.kind === "write" ? tool.fixed : {}
  const properties = { ...(compiled.properties ?? {}) }
  for (const field of Object.keys(fixed)) delete properties[field]
  const required = (compiled.required ?? []).filter((field) => !(field in fixed))

  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    annotations: { readOnlyHint: tool.kind === "read", destructiveHint: false },
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

/**
 * The answer to something that never became a message.
 *
 * This one is EXPORTED, and it is the only frame a transport has to build: a
 * body that will not parse is the one failure a transport meets before this
 * dispatch can be reached, and both of ours meet it — the HTTP route with a
 * request body, the stdio pump with a line. Left private, that was the same
 * seven-key object written in three files, agreeing by memory. The id is
 * always null: the id was inside the thing that would not parse.
 */
export const parseError = (message: string): Readonly<Record<string, unknown>> =>
  error(null, -32700, message)

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

import { Schema } from "effect"

const PROTOCOL = "2025-06-18"

const TOKEN_ENV = "OLAI_TOKEN"

export class McpRefused extends Error {
  readonly _tag = "OlaiSurfaceRefused"
  constructor(
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export class McpUnreachable extends Error {
  readonly _tag = "OlaiSurfaceUnreachable"
  constructor(message: string) {
    super(message)
  }
}

export interface McpConnection {
  readonly callTool: (name: string, args: unknown) => Promise<unknown>
  readonly readResource: (uri: string) => Promise<unknown>
  readonly dispose: () => void
}

const Reply = Schema.Struct({
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(
    Schema.Struct({
      code: Schema.optional(Schema.Number),
      message: Schema.optional(Schema.String),
    }),
  ),
})

/**
 * Open a connection: the MCP handshake, then the door is ready.
 *
 * The SDK's `Server` refuses every request before `initialize`, so the two
 * handshake messages are not ceremony: the request, and the notification that
 * says the client has read the answer.
 */
export const openMcp = async (url: string): Promise<McpConnection> => {
  const endpoint = mcpUrl(url)
  const token = process.env[TOKEN_ENV]
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...(token === undefined || token === "" ? {} : { authorization: `Bearer ${token}` }),
  }
  let next = 0

  const post = async (body: unknown): Promise<Response> => {
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
    } catch (cause) {
      throw new McpUnreachable(becauseOf(cause))
    }
  }

  const ask = async (method: string, params: unknown): Promise<unknown> => {
    next += 1
    const response = await post({ jsonrpc: "2.0", id: next, method, params })
    if (response.status === 401) {
      throw new McpUnreachable(
        `${endpoint} refused this client: off loopback the surface needs the server's bearer token in $${TOKEN_ENV}`,
      )
    }
    if (!response.ok) {
      throw new McpUnreachable(`${endpoint} answered ${response.status}`)
    }
    const said = await response.json().catch((cause: unknown) => {
      throw new McpUnreachable(`${endpoint} did not answer with JSON: ${becauseOf(cause)}`)
    })
    const reply = Schema.decodeUnknownSync(Reply)(said)
    if (reply.error !== undefined) {
      throw new McpRefused(reply.error.message ?? `${method} was refused`)
    }
    return reply.result
  }

  await ask("initialize", {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: "olai-surface-cli", version: "0.1.0" },
  })
  await post({ jsonrpc: "2.0", method: "notifications/initialized" })

  return {
    callTool: async (name, args) => {
      const result = await ask("tools/call", {
        name,
        arguments: args ?? {},
      })
      return answerOf(result, name)
    },
    readResource: async (uri) => {
      const result = await ask("resources/read", { uri })
      return contentsOf(result, uri)
    },
    dispose: () => {},
  }
}

export const mcpUrl = (url: string): string => {
  let base: URL
  try {
    base = new URL(url)
  } catch {
    throw new McpUnreachable(
      `${JSON.stringify(url)} is not a URL — --url takes the server's address, like http://127.0.0.1:7714`,
    )
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new McpUnreachable(
      `${url} is not an http(s) address — --url names the server olai web is listening on`,
    )
  }
  return new URL(MCP_PATH, base).toString()
}

const MCP_PATH = "/mcp"

/** A tool result, read as the verb's answer — or raised as its refusal.
 *
 *  MCP types the structured arm as a JSON OBJECT, which is why a scalar answer
 *  travels under `value` (`@kolu/surface/verbs`' `wrapValue`) and is unwrapped
 *  here. */
const answerOf = (result: unknown, name: string): unknown => {
  const said = result as {
    readonly content?: ReadonlyArray<{ readonly text?: string }>
    readonly structuredContent?: Record<string, unknown>
    readonly isError?: boolean
  }
  const prose = said.content?.map((block) => block.text ?? "").join("\n") ?? ""
  if (said.isError === true) {
    throw new McpRefused(prose === "" ? `${name} refused` : prose, said.structuredContent)
  }
  if (said.structuredContent === undefined) {
    return prose === "" ? null : prose
  }
  return unwrap(said.structuredContent)
}

const contentsOf = (result: unknown, uri: string): unknown => {
  const said = result as {
    readonly contents?: ReadonlyArray<{ readonly text?: string }>
  }
  const text = said.contents?.[0]?.text
  if (text === undefined) {
    throw new McpUnreachable(`${uri} came back with no contents`)
  }
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new McpUnreachable(`${uri} did not come back as JSON: ${becauseOf(cause)}`)
  }
}

const unwrap = (value: Record<string, unknown>): unknown => {
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === "value" ? value.value : value
}

/** Node reports every network failure as `fetch failed` with the reason on
 *  `cause`, so a refused connection, a bad name and an expired certificate all
 *  read alike at the top. */
const becauseOf = (cause: unknown): string => {
  const said = cause instanceof Error ? cause.message : String(cause)
  const under = (cause as { readonly cause?: unknown })?.cause
  if (under === undefined || under === null) return said
  const beneath = under instanceof Error ? under.message : String(under)
  return beneath === "" || beneath === said ? said : `${said} — ${beneath}`
}

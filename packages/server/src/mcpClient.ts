/**
 * `/mcp`, DIALLED — the client half of the door this server already has.
 *
 * `olai surface` is not a second way in. It speaks the same protocol to the same
 * path as any bridged agent, is admitted by the same rule (`./mcp/route.ts`'s
 * `mcpAllowed`: loopback, or the per-process bearer), and reaches exactly the
 * members and tools that face publishes — so "who may call what" is ONE decision
 * with one place to read it, and a terminal cannot be given anything an agent
 * was not. That is the whole reason the transport is this and not a wire face of
 * its own (ruled, human 2026-08-23, after a per-user unix socket shipped and was
 * reverted: two servers on one machine raced for the one path, and a capture
 * landed in the wrong vault).
 *
 * ## What that costs, said out loud
 *
 * The door is HALF DUPLEX. One POST carries one JSON-RPC message and is answered
 * with one; the SSE half is a 405, and the route says why. So there is nothing
 * to subscribe to here, which is why the CLI declares `streaming: false` and
 * mounts no `watch` and no `--follow` (`./dial.ts`). Every other read still
 * works, because every one of them is a first-frame read.
 *
 * ## What it is not
 *
 * It is not the MCP SDK. The SDK's client brings a transport that wants an SSE
 * stream this endpoint refuses, a session id it never issues, and a dependency
 * closure a CLI pays for at every startup. What is actually needed is three
 * POSTs of well-known shape, and they are below — the same reasoning
 * `./mcp/route.ts` records for not using the SDK's server transport, from the
 * other side of the same wire.
 */

import { Schema } from "effect"

/** The protocol revision this client speaks. Named once; the server's SDK
 *  answers with its own and does not require them to match. */
const PROTOCOL = "2025-06-18"

/** What a caller may set on the wire. `Authorization` is the only one, and only
 *  when the environment carries a token: off loopback the route demands the
 *  bearer, and there is no other way for a caller to have one. The IDENTITY
 *  headers are deliberately absent — those are the reverse proxy's to inject and
 *  the server's to trust, and a client that could send its own would be a client
 *  that could name any person it liked (`./mcp/route.ts`). */
const TOKEN_ENV = "OLAI_TOKEN"

/** A refusal the far side ANSWERED with — `isError` on a tool result, carrying
 *  whatever structured detail the tool raised.
 *
 *  A tagged ERROR rather than a `SurfaceCliFailure`: `@kolu/surface-cli`'s
 *  `classify` turns anything that is not a transport failure into exit 1 with
 *  the whole object as JSON on stderr, which is exactly the treatment a refusal
 *  from `/mcp` deserves — the same treatment it gets over any other link.
 *
 *  An `Error` and not a plain class, because `messageOf` reads a non-Error
 *  object by stringifying the whole of it: an exit-3 line came out as
 *  `no surface at http://… — {"message":"…","_tag":"…"}`, with the sentence
 *  wrapped in the shape it travelled in. `message` is non-enumerable on an
 *  `Error`, so the JSON body a refusal prints is unchanged — the spread that
 *  builds it does not pick it up, and the line is added back by name. */
export class McpRefused extends Error {
  readonly _tag = "OlaiSurfaceRefused"
  constructor(
    message: string,
    /** The tool's own machine-readable reason, when it raised one. Spread onto
     *  the stderr line by `refusalLine`, so `set_done` refusing with three
     *  unfinished children hands those children over rather than a sentence
     *  about them. */
    readonly detail?: Record<string, unknown>,
  ) {
    // `name` is deliberately NOT set: it would be an own enumerable property,
    // and the refusal line a caller reads is built by spreading this object.
    // `_tag` is the identity, and it is already there.
    super(message)
  }
}

/** The door did not answer, or answered something that is not this protocol.
 *
 *  Distinct from {@link McpRefused} because the two are different facts and land
 *  on different exit codes: this one means there is no surface to reach and a
 *  caller should look at `--url`. */
export class McpUnreachable extends Error {
  readonly _tag = "OlaiSurfaceUnreachable"
  constructor(message: string) {
    super(message)
  }
}

/** One open connection to one `/mcp`. */
export interface McpConnection {
  /** Call a tool by the name the face advertises it under. */
  readonly callTool: (name: string, args: unknown) => Promise<unknown>
  /** Read one `surface://…` resource, decoded from its JSON text. */
  readonly readResource: (uri: string) => Promise<unknown>
  /** Nothing to release — a POST holds nothing open — but the seam requires an
   *  answer rather than an absence, and "there is nothing" is one. */
  readonly dispose: () => void
}

/** The JSON-RPC envelope, as far as this client reads it. */
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
 * The handshake is not ceremony — the SDK's `Server` refuses every request
 * before `initialize`, so a client that skipped it would be told "not
 * initialized" for a capture that was otherwise perfectly well formed. It is two
 * messages: the request, and the notification that says the client has read the
 * answer.
 *
 * REJECTING IS THE HONEST ANSWER for "nothing is serving there": the CLI's
 * `withConnection` turns a rejected `open()` into exit 3 naming the endpoint,
 * which is the one fact a caller can act on.
 */
export const openMcp = async (url: string): Promise<McpConnection> => {
  const endpoint = mcpUrl(url)
  const token = process.env[TOKEN_ENV]
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...(token === undefined || token === "" ? {} : { authorization: `Bearer ${token}` }),
  }
  // Ids are per connection and monotonic. The route refuses two live requests
  // under one id, and a CLI does one thing at a time, so a counter is enough.
  let next = 0

  const post = async (body: unknown): Promise<Response> => {
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
    } catch (cause) {
      // A refused connection, a name that does not resolve, a TLS handshake that
      // failed. `fetch` reports all of them the same way and buries the reason
      // one level down, which is the half worth carrying: "fetch failed" alone
      // names nothing a caller can act on.
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
      // A PROTOCOL error, not a tool's refusal: an unknown method, a malformed
      // frame, a resource this face does not publish. The far side is answering,
      // so it is the caller's business rather than the endpoint's.
      throw new McpRefused(reply.error.message ?? `${method} was refused`)
    }
    return reply.result
  }

  await ask("initialize", {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: "olai-surface-cli", version: "0.1.0" },
  })
  // A NOTIFICATION — no id, so the route answers 202 with an empty body and
  // there is nothing to read. Skipping it leaves the server's protocol state
  // machine mid-handshake.
  await post({ jsonrpc: "2.0", method: "notifications/initialized" })

  return {
    callTool: async (name, args) => {
      const result = await ask("tools/call", {
        name,
        // MCP's arguments are an OBJECT. A verb whose input is a scalar is
        // advertised wrapped under `value` by the same bridge on both sides
        // (`toInputSchema`), and the CLI assembles against that advertised
        // document — so whatever it hands over is already the right shape.
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

/** Where `/mcp` is, given what the user typed. A bare origin, a URL with a
 *  path, with or without a trailing slash — all of them name one endpoint, and
 *  a caller should not have to know which spelling this door wanted. */
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
  // `new URL("/mcp", base)` rather than string concatenation, so a base carrying
  // a path, a port or a trailing slash lands on the same absolute path the route
  // is mounted at.
  return new URL(MCP_PATH, base).toString()
}

/** The path the route publishes. Spelled here rather than imported from
 *  `./mcp/route.ts` — that module pulls the MCP SDK in, and this one is loaded
 *  by every `olai surface` invocation including the ones that dial nothing. The
 *  two are pinned together by `./dial.test.ts`. */
const MCP_PATH = "/mcp"

/** A tool result, read as the verb's answer — or raised as its refusal.
 *
 *  `structuredContent` is the data half and the one to prefer: it is the answer
 *  as a value, where `content` is the same answer serialized for a model to
 *  read. On an `isError` result the two are deliberately different — the
 *  sentence and the machine-readable reason are two jobs — so a refusal carries
 *  both out.
 *
 *  MCP types the structured arm as a JSON OBJECT, which is why a scalar answer
 *  travels under `value` (`@kolu/surface/verbs`' `wrapValue`); it is unwrapped
 *  here so the CLI prints the answer the verb gave rather than a wrapper around
 *  it. */
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
    // A tool with no structured arm — nothing in olai's table is one, but the
    // protocol allows it, and the prose is then the whole answer.
    return prose === "" ? null : prose
  }
  return unwrap(said.structuredContent)
}

/** One resource's value, decoded from the text it travels as. */
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

/** Undo `wrapValue`: a lone `value` property is the wrapper a non-object answer
 *  had to travel in, and nothing else this surface answers with has that
 *  shape. */
const unwrap = (value: Record<string, unknown>): unknown => {
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === "value" ? value.value : value
}

/** What a thrown thing SAID, with the layer `fetch` hides underneath.
 *
 *  Node reports every network failure as the same three words with the reason on
 *  `cause`, so a diagnostic that read only the top said "fetch failed" for a
 *  refused connection, a bad name and an expired certificate alike. */
const becauseOf = (cause: unknown): string => {
  const said = cause instanceof Error ? cause.message : String(cause)
  const under = (cause as { readonly cause?: unknown })?.cause
  if (under === undefined || under === null) return said
  const beneath = under instanceof Error ? under.message : String(under)
  return beneath === "" || beneath === said ? said : `${said} — ${beneath}`
}

/**
 * The internal MCP server, mounted on the listener the browser already uses.
 *
 * The face is {@link ./face.ts}; this is the transport and the HTTP in front of
 * it. One POST carries one JSON-RPC message and is answered with one — which is
 * the whole shape this endpoint needs, because it pushes nothing: there are no
 * server-initiated notifications to this client, so the SSE half is answered
 * with a 405 as the specification says to.
 *
 * **Why HTTP rather than the stdio transport most MCP servers use.** The agent
 * is a subprocess of THIS process, and the surface it needs is this process's
 * own store. A stdio server would mean spawning a second olai to talk to the
 * first, with a second store watching the same directory and no way to keep the
 * two revisions in step. An HTTP entry pointing at ourselves is one line of
 * `session/new` configuration and no second copy of anything. ACP advertises
 * the transport as a capability (`mcpCapabilities.http`), so an agent that
 * cannot do it says so.
 *
 * **The token.** The listener binds loopback and is otherwise unauthenticated,
 * which is the standing trade for a read-only outline surface; a WRITE surface
 * reachable from whatever page the browser happens to be showing is a different
 * bargain. So the route requires a bearer token minted per process and handed
 * only to the session we spawn. It is not a secret worth much — anything that
 * can read this process's memory has already won — but it closes the one
 * realistic path, which is a page on another origin POSTing at localhost.
 *
 * **Why the SDK's Streamable HTTP transport is not used here**, having been
 * tried. It offers two modes and neither fits. STATELESS refuses to be reused —
 * "Stateless transport cannot be reused across requests. Create a new transport
 * per request." — and a transport per request means a `Server` per request,
 * because an MCP `Server` binds exactly one; that would rebuild the whole face,
 * its expose walk and its resource pusher on every call. STATEFUL keeps one
 * transport but issues an `Mcp-Session-Id` the client must then echo, which is
 * a requirement this endpoint has never made of anyone. It also prefers to
 * answer with an SSE stream, which a client that called `response.json()` waits
 * on forever.
 *
 * So the transport is {@link RouteTransport}, which is the one thing that IS
 * pluggable in the SDK's design. What was bought from `@kolu/surface-mcp` is the
 * SERVER — the dispatch, the tools, the resources, the schema bridge — and a
 * transport was never part of that purchase: `serveSurfaceAsMcp` takes one as an
 * option precisely because the shape of the pipe is the embedder's business.
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"
import { Effect, Layer } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/** Where the route lives. Named once: `session/new` is told the same URL. */
export const MCP_PATH = "/mcp"

/** A JSON-RPC message, as far as this transport needs to care: an `id` makes it
 *  something owed an answer, and its absence makes it a notification. */
type Message = { id?: string | number | null }

/**
 * The transport this route drives: request in, reply out, nothing in between.
 *
 * The SDK's `Transport` contract is small and this implements all of it —
 * `start`/`send`/`close` plus the three callbacks the `Server` installs. What
 * makes it simple enough to own is that this endpoint is HALF DUPLEX by design:
 * a client POSTs one message and reads one answer, and nothing is ever pushed
 * the other way. So `send` does not write to a socket; it RESOLVES the request
 * that is waiting.
 *
 * A message the server sends with no matching waiter is dropped, and that is
 * documented behaviour rather than an oversight: a server-initiated notification
 * (a `resources/updated`, say) has no open channel to travel down here. The
 * browser is what watches cells on this process, and it watches them over the
 * websocket the surface already serves; the stdio face is where an agent
 * subscribes to them. If that ever changes, this is the file that grows an SSE
 * arm — and the 405 below is what tells a client today that it has not.
 */
class RouteTransport implements Transport {
  onmessage?: <T extends JSONRPCMessage>(message: T) => void
  onclose?: () => void
  onerror?: (error: Error) => void

  /** Requests in flight, by JSON-RPC id. */
  readonly #waiting = new Map<string | number, (reply: unknown) => void>()

  async start(): Promise<void> {}

  async close(): Promise<void> {
    // A waiter left hanging would hold a request open forever, so they are
    // answered with silence rather than abandoned.
    for (const [, resolve] of this.#waiting) resolve(null)
    this.#waiting.clear()
    this.onclose?.()
  }

  /** The server answering. Matched to its request by id; a notification the
   *  server originated has nobody waiting and goes nowhere — see the class doc. */
  async send(message: JSONRPCMessage): Promise<void> {
    const id = (message as Message).id
    if (id === undefined || id === null) return
    const waiter = this.#waiting.get(id)
    if (waiter === undefined) return
    this.#waiting.delete(id)
    waiter(message)
  }

  /**
   * Deliver one client message and wait for its answer.
   *
   * `null` for a notification, which is answered with silence rather than with
   * a frame — a client matching replies to ids must not be handed one where
   * there is none.
   *
   * An id ALREADY in flight is refused rather than allowed to overwrite the
   * waiter that holds it. Two live requests under one id is a client bug, but
   * the failure it used to cause was ours: the second `set` dropped the first
   * resolver on the floor and left that POST hanging until the process died.
   * Answering the newcomer keeps the damage to the request that caused it.
   */
  ask(message: unknown): Promise<unknown> {
    const id = (message as Message).id
    if (id === undefined || id === null) {
      this.onmessage?.(message as JSONRPCMessage)
      return Promise.resolve(null)
    }
    if (this.#waiting.has(id)) {
      return Promise.resolve({
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: `id ${JSON.stringify(id)} is already in flight` },
      })
    }
    return new Promise<unknown>((resolve) => {
      this.#waiting.set(id, resolve)
      this.onmessage?.(message as JSONRPCMessage)
    })
  }
}

/** A JSON-RPC message is an OBJECT — not `null`, not an array, not a number.
 *  The old hand-rolled dispatch judged this and answered `-32600`; the SDK's
 *  `Protocol` reports a non-object to `onerror` and sends nothing, which
 *  through a half-duplex transport means the POST is answered 202 and the
 *  client waits for a frame that is never coming. So the judgement stays at
 *  this edge, where it always was. */
const isMessage = (body: unknown): boolean =>
  typeof body === "object" && body !== null && !Array.isArray(body)

export interface Options {
  /** The transport the face is connected to, built by {@link mcpTransport} and
   *  driven here. One object for the lifetime of the process: it holds no
   *  per-request state beyond the requests actually in flight. */
  readonly transport: RouteTransport
  /** The bearer token this route requires. Minted per process. */
  readonly token: string
}

/** The transport {@link mcpRoute} drives and {@link ./face.ts} is connected to.
 *  A function rather than an exported class so both ends obtain it the same way
 *  and neither constructs its own. */
export const mcpTransport = (): RouteTransport => new RouteTransport()

/**
 * The route, as an `HttpRouter` layer to merge beside the static one.
 * `HttpRouter` ranks by specificity, so this beats the SPA catch-all whatever
 * order the layers are merged in.
 */
export const mcpRoute = (options: Options): Layer.Layer<never, never, HttpRouter.HttpRouter> =>
  Layer.merge(
    HttpRouter.add(
      "POST",
      MCP_PATH,
      (request: HttpServerRequest.HttpServerRequest) =>
        Effect.gen(function*() {
          if (request.headers["authorization"] !== `Bearer ${options.token}`) {
            return HttpServerResponse.text("unauthorized", { status: 401 })
          }

          const body = yield* Effect.result(request.json)
          if (body._tag === "Failure") {
            // The one frame this transport builds for itself: a body that will
            // not parse never reaches the server, so there is no dispatch to
            // answer it. The id is null because the id was inside the thing
            // that would not parse.
            return yield* Effect.orDie(HttpServerResponse.json({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "the body is not JSON" },
            }, { status: 400 }))
          }
          if (!isMessage(body.success)) {
            // Parsed, but not a message — see {@link isMessage}. Answered here
            // rather than passed on, because passing it on is silence.
            return yield* Effect.orDie(HttpServerResponse.json({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: "a JSON-RPC message is an object" },
            }, { status: 400 }))
          }

          const reply = yield* Effect.promise(() => options.transport.ask(body.success))
          // A notification has no reply, and the transport says so with a 202
          // and an empty body rather than with a null JSON-RPC frame.
          return reply === null
            ? HttpServerResponse.empty({ status: 202 })
            : yield* Effect.orDie(HttpServerResponse.json(reply))
        }),
    ),
    HttpRouter.add(
      "GET",
      MCP_PATH,
      HttpServerResponse.text("this MCP server pushes nothing", { status: 405 }),
    ),
  )

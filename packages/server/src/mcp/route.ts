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
 * **The token, and who may skip it.** The listener binds loopback and is
 * otherwise unauthenticated, which is the standing trade for a read-only
 * outline surface; a WRITE surface reachable from whatever page the browser
 * happens to be showing is a different bargain. So a request that did not
 * come from loopback (`127.0.0.1`) still needs the bearer token minted per
 * process and handed only to the session we spawn. A request that DID come
 * from loopback does not: that is how a `.mcp.json` HTTP client — an agent
 * the operator started on this machine — reaches the same store the browser
 * is looking at, with nothing to configure beyond the URL. The chat keeps
 * sending its token; a loopback request that carries one is accepted the
 * same as one that does not. It is not a secret worth much — anything that
 * can read this process's memory has already won — but off-loopback it
 * still closes the one realistic path, which is a page on another origin
 * POSTing at a port bound to the world.
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
import type { IdentityConfig } from "@olai/identity"
import { Effect, Layer, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { AsyncLocalStorage } from "node:async_hooks"

import { whoOf } from "../identity.ts"

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
 * websocket the surface already serves. A Streamable-HTTP client that wants
 * live `resources/updated` is asking for the SSE half this route refuses. If
 * that ever changes, this is the file that grows an SSE arm — and the 405
 * below is what tells a client today that it has not.
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

/**
 * WHO THE REQUEST IS, for the length of the request.
 *
 * The face behind this route is built ONCE, at boot, with one transport and one
 * set of handlers — which is right, and is why an agent's tool call costs no
 * face rebuild. But a capture's `captured-by` is a fact about the REQUEST: the
 * reverse proxy in front injects the login on each one, and two people can be
 * behind the same proxy. So the login travels beside the request rather than
 * bound into the face, and this is the channel.
 *
 * TWO THINGS MAKE IT RIGHT, and it is worth being precise about which does
 * what, because the load-bearing one is the less obvious one.
 *
 * The first is that the login is READ SYNCHRONOUSLY, at the top of a handler,
 * on the request's own stack — which is what {@link currentLogin} is for and
 * what `bespokeFrom`'s `login` thunk does. A handler DESCRIBES its work as an
 * Effect, and the Effect then runs on a scheduler this store makes no promises
 * about; the construction happens before anything can yield to another request.
 * That alone is what keeps two concurrent POSTs apart today.
 *
 * The second is the STORAGE, and it is here for what the first does not cover:
 * a handler that reads the login later — after an await, inside an Effect — gets
 * its own request's value rather than whichever request happened to be running.
 * A module-level field would silently stop being correct the day somebody wrote
 * that, and the failure would be a capture attributed to the wrong person:
 * silent, permanent, and in a file. This makes "read it later" safe instead of a
 * trap, which is a property worth paying an `AsyncLocalStorage` for.
 *
 * Measured rather than assumed: with the storage swapped for a plain field, the
 * concurrency case in `./route.test.ts` still passes — because of the first
 * reason. That case says so itself rather than claiming a proof it does not
 * have.
 */
const WHOSE = new AsyncLocalStorage<string | null>()

/** The login on the request being served, or `null` for a door that knows
 *  nobody — a direct loopback call, a `just run` with no proxy in front. An
 *  answer, not a gap: a capture with no attribution is honest, and one with an
 *  invented attribution is not. */
export const currentLogin = (): string | null => WHOSE.getStore() ?? null

/**
 * ...AND THE BEARER THIS REQUEST PRESENTED, for the same span and by the same
 * mechanism — a second storage beside {@link WHOSE} rather than a second field
 * on the first, because the two answer different questions and are read by
 * different things.
 *
 * THE RULE THIS ROUTE KEEPS, and it is the only thing this module knows about
 * the value: {@link mcpAllowed} decides WHETHER a request reaches the tools and
 * this decides AS WHOM it writes, and the second may never make the first
 * stricter. A request admitted above is admitted; what a credential MEANS is
 * asked of the composition root, per request, and the affordance in this file's
 * header ("a loopback request that carries one is accepted the same as one that
 * does not") is true byte for byte after this.
 *
 * WHOSE BEARER IT IS IS NOT THIS MODULE'S QUESTION. A route that resolved a
 * token to a session would be the transport learning what a conversation is,
 * which is the same reason the login travels as a string rather than as a
 * person. This carries an opaque value from the wire to the one place that can
 * say what it stands for.
 */
const HANDED = new AsyncLocalStorage<string | null>()

/** The bearer on the request being served, or `null` for one that presented
 *  none. Read SYNCHRONOUSLY, on the request's own stack, exactly where the
 *  login is and for the identical reason ({@link WHOSE}'s note). */
export const currentTicket = (): string | null => HANDED.getStore() ?? null

/** The token out of an `Authorization` header, or `null` — the one line of
 *  parsing this file does, spelled here so that {@link mcpAllowed}'s comparison
 *  and this one cannot come to disagree about what "presenting a bearer" is. */
export const bearerIn = (authorization: string | undefined): string | null =>
  authorization?.startsWith("Bearer ") === true ? authorization.slice("Bearer ".length) : null

export interface Options {
  /** The transport the face is connected to, built by {@link mcpTransport} and
   *  driven here. One object for the lifetime of the process: it holds no
   *  per-request state beyond the requests actually in flight. */
  readonly transport: RouteTransport
  /** The bearer token a non-loopback request must present. Minted per process.
   *  Loopback may omit it; a request that carries it is accepted either way. */
  readonly token: string
  /** Which headers name the person in front of the proxy — the operator's
   *  configuration, read by the same {@link whoOf} the page and `GET /olai/who`
   *  read. Here so that a write through this door can be attributed to whoever
   *  the proxy says made it, and to nobody when it says nothing. */
  readonly identity: IdentityConfig
}

/**
 * Whether `address` is loopback as the kernel reports it on the accepted
 * socket. `127.0.0.1` is the documented case; `::1` and the IPv4-mapped
 * form are the same host, and a client that reached us that way is no less
 * local.
 */
export const fromLoopback = (address: string): boolean => {
  const host = address.replace(/^::ffff:/i, "")
  return host === "127.0.0.1" || host === "::1"
}

/**
 * Whether this request may reach the tools.
 *
 * Loopback skips the bearer: that is how a `.mcp.json` HTTP client on this
 * machine talks to the running server. Off loopback — or when the peer
 * address is unknown — the token is still required. A loopback request that
 * carries a token is accepted the same as one that does not, so the chat
 * may keep sending the one it was handed.
 */
export const mcpAllowed = (
  remote: Option.Option<string>,
  authorization: string | undefined,
  token: string,
): boolean => {
  if (Option.isSome(remote) && fromLoopback(remote.value)) return true
  return authorization === `Bearer ${token}`
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
          if (!mcpAllowed(request.remoteAddress, request.headers["authorization"], options.token)) {
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

          // The person on THIS request, for the length of THIS dispatch. Read
          // off the same headers the page reads, by the same function, so a
          // capture from a terminal and a chip in a browser cannot disagree
          // about who is looking.
          const who = whoOf(request.headers, options.identity)
          // ...and the credential on THIS request, for the length of THIS
          // dispatch, nested inside the login's span rather than beside it so
          // the two are one scope and cannot be entered independently.
          const held = bearerIn(request.headers["authorization"])
          const reply = yield* Effect.promise(() =>
            WHOSE.run(
              who === null ? null : who.login,
              () => HANDED.run(held, () => options.transport.ask(body.success)),
            )
          )
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

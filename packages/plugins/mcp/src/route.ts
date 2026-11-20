/**
 * `@modelcontextprotocol/sdk`'s Streamable HTTP transport cannot drive this
 * route. Stateless: "Stateless transport cannot be reused across requests.
 * Create a new transport per request.", and a transport per request means an
 * MCP `Server` per request, because a `Server` binds exactly one. Stateful:
 * it issues an `mcp-session-id` the client must echo, and answers with
 * `text/event-stream` unless `enableJsonResponse` is set, which a client that
 * called `response.json()` waits on forever.
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"
import { Effect, Layer, Option } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http"
import { AsyncLocalStorage } from "node:async_hooks"

import type { TransportSurface } from "@olai/plugin-api/transport"
type Reading = TransportSurface["who"]

export const MCP_PATH = "/mcp"

type Message = { id?: string | number | null }

class RouteTransport implements Transport {
  onmessage?: <T extends JSONRPCMessage>(message: T) => void
  onclose?: () => void
  onerror?: (error: Error) => void

  readonly #waiting = new Map<string | number, (reply: unknown) => void>()

  async start(): Promise<void> {}

  async close(): Promise<void> {
    for (const [, resolve] of this.#waiting) resolve(null)
    this.#waiting.clear()
    this.onclose?.()
  }

  async send(message: JSONRPCMessage): Promise<void> {
    const id = (message as Message).id
    if (id === undefined || id === null) return
    const waiter = this.#waiting.get(id)
    if (waiter === undefined) return
    this.#waiting.delete(id)
    waiter(message)
  }

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

/** The SDK's `Protocol` hands a non-object to `onerror` and sends nothing, so
 *  over a half-duplex transport the POST is answered 202 and the client waits
 *  for a frame that is never coming. */
const isMessage = (body: unknown): boolean =>
  typeof body === "object" && body !== null && !Array.isArray(body)

interface Caller {
  readonly login: string | null
  readonly bearer: string | null
}

const CALLER = new AsyncLocalStorage<Caller>()

export const currentLogin = (): string | null => CALLER.getStore()?.login ?? null

export const currentTicket = (): string | null => CALLER.getStore()?.bearer ?? null

export const bearerIn = (authorization: string | undefined): string | null =>
  authorization?.startsWith("Bearer ") === true ? authorization.slice("Bearer ".length) : null

export interface Options {
  readonly transport: RouteTransport
  readonly token: string
  readonly who: Reading
}

export { fromLoopback } from "@olai/plugin-api/http"
import { fromLoopback } from "@olai/plugin-api/http"

export const mcpAllowed = (
  remote: Option.Option<string>,
  authorization: string | undefined,
  token: string,
): boolean => {
  if (Option.isSome(remote) && fromLoopback(remote.value)) return true
  return authorization === `Bearer ${token}`
}

export const mcpTransport = (): RouteTransport => new RouteTransport()

export const mcpRoute = (source: Options | (() => Options | undefined)): Layer.Layer<never, never, HttpRouter.HttpRouter> =>
  Layer.merge(
    HttpRouter.add(
      "POST",
      MCP_PATH,
      (request: HttpServerRequest.HttpServerRequest) =>
        Effect.gen(function*() {
          const options = typeof source === "function" ? source() : source
          if (!options) return HttpServerResponse.empty({ status: 404 })
          if (!mcpAllowed(request.remoteAddress, request.headers["authorization"], options.token)) {
            return HttpServerResponse.text("unauthorized", { status: 401 })
          }

          const body = yield* Effect.result(request.json)
          if (body._tag === "Failure") {
            return yield* Effect.orDie(HttpServerResponse.json({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "the body is not JSON" },
            }, { status: 400 }))
          }
          if (!isMessage(body.success)) {
            return yield* Effect.orDie(HttpServerResponse.json({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: "a JSON-RPC message is an object" },
            }, { status: 400 }))
          }

          const who = options.who(request.headers)
          const reply = yield* Effect.promise(() =>
            CALLER.run(
              { login: who === null ? null : who.login, bearer: bearerIn(request.headers["authorization"]) },
              () => options.transport.ask(body.success),
            )
          )
          return reply === null
            ? HttpServerResponse.empty({ status: 202 })
            : yield* Effect.orDie(HttpServerResponse.json(reply))
        }),
    ),
    HttpRouter.add(
      "GET",
      MCP_PATH,
      Effect.sync(() => typeof source === "function" && !source()
        ? HttpServerResponse.empty({ status: 404 })
        : HttpServerResponse.text("this MCP server pushes nothing", { status: 405 })),
    ),
  )

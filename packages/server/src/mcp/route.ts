/**
 * The internal MCP server, mounted on the listener the browser already uses.
 *
 * `@olai/ops` owns the tools and the JSON-RPC dispatch; this is the HTTP in
 * front of it. MCP's Streamable HTTP transport is one POST endpoint that takes
 * a JSON-RPC message and answers with one — which is all this server needs,
 * because it pushes nothing: there are no server-initiated notifications, so
 * the SSE half of that transport is answered with a 405, as the specification
 * says to.
 *
 * **Why HTTP rather than the stdio transport most MCP servers use.** The agent
 * is a subprocess of THIS process, and the tools it needs are this process's
 * own ops layer over this process's own store. A stdio server would mean
 * spawning a second olai to talk to the first, with a second store watching the
 * same directory and no way to keep the two revisions in step. An HTTP entry
 * pointing at ourselves is one line of `session/new` configuration and no
 * second copy of anything. ACP advertises the transport as a capability
 * (`mcpCapabilities.http`), so an agent that cannot do it says so.
 *
 * **The token.** The listener binds loopback and is otherwise unauthenticated,
 * which is the standing trade for a read-only outline surface; a WRITE surface
 * reachable from whatever page the browser happens to be showing is a different
 * bargain. So the route requires a bearer token minted per process and handed
 * only to the session we spawn. It is not a secret worth much — anything that
 * can read this process's memory has already won — but it closes the one
 * realistic path, which is a page on another origin POSTing at localhost.
 */

import type { Mcp } from "@olai/ops"
import { Effect, Layer } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/** Where the route lives. Named once: `session/new` is told the same URL. */
export const MCP_PATH = "/mcp"

export interface Options {
  readonly server: Mcp.Server
  /** The bearer token this route requires. Minted per process. */
  readonly token: string
}

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
            return yield* rpcError(-32700, "the body is not JSON", 400)
          }

          const reply = yield* options.server.handle(body.success)
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

const rpcError = (code: number, message: string, status: number) =>
  Effect.orDie(
    HttpServerResponse.json({ jsonrpc: "2.0", id: null, error: { code, message } }, {
      status,
    }),
  )

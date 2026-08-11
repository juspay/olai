/**
 * The surface, spoken as MCP — serve-fresh.
 *
 * `@kolu/surface-mcp` adapts a declared surface into an MCP server: the cells
 * and collections named in {@link ./expose.ts} become readable and SUBSCRIBABLE
 * resources, so an agent watches the same rows the browser draws instead of
 * polling a second projection of them. This module is the composition — the
 * surface runtime, an in-process dispatch over it, and the adapter in front.
 *
 * **Serve-fresh** is the shape here: the MCP server IS the backend, in one
 * process, which is what `olai mcp <dir>` needs when nothing else is running —
 * the ordinary case, somebody in a terminal in their notes directory. The other
 * shape the adapter supports, BRIDGE (dial a surface something else is already
 * serving, over a unix socket), is deliberately not here: it only retires the
 * second store if writes cross it too, and until writes are surface procedures
 * that means carrying the running server's token in a file. That trade belongs
 * to the parent roadmap item, with the argument in
 * docs/brainstorming/surface-mcp-viewing.md.
 *
 * There is no wire under the dispatch and that is the point of `directDispatch`:
 * the same consumer code that would run against a socket-served surface runs
 * against an in-process one, so what an agent reads here and what it would read
 * bridged are the same values by construction rather than by two
 * implementations agreeing.
 *
 * **What is NOT here yet, and why the tools argument exists.** olai's tool
 * surface (`@olai/ops`' table) rides alongside the resources as bespoke tools,
 * and cannot until `@kolu/surface-mcp` can carry `structuredContent` on a tool
 * result. Olai's refusal contract is that a refused write arrives as `isError`
 * WITH its structured detail — "these three children are not done" as data the
 * agent can act on, not a sentence it has to parse (`@olai/ops`' `mcp.ts`) —
 * and the adapter's `ok`/`fail` emit `content` only, with a rejecting handler
 * squashed to its message. That is a live upstream change, not a thing this
 * package can patch: `ok`/`fail` are internal, and a handler's return value is
 * passed through them. Until it lands, `olai mcp` keeps serving tools from the
 * hand-rolled dispatch and this face is exercised by its own test.
 *
 * A second, smaller gap travels with it: the adapter builds its `Server` with
 * `capabilities` and no `instructions`, so the paragraph olai answers
 * `initialize` with — "everything here is about NODES, not files … there is no
 * file access" — has nowhere to go. `initialize` is served inside the SDK's own
 * protocol layer, so unlike the tool framing it cannot be worked around from
 * out here either.
 */

import { surface } from "@olai/surface"
import { buildSurfaceFace } from "@kolu/surface/client"
import { directDispatch } from "@kolu/surface/links/direct"
import {
  type BespokeTool,
  serveSurfaceAsMcp,
  type SurfaceClientCallable,
} from "@kolu/surface-mcp"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { Effect, type Scope } from "effect"

import { EXPOSE } from "./expose.ts"
import type { Bound } from "../runtime.ts"

/** What this server calls itself. The version is the binary's, spelled here
 *  because the adapter has no other way to learn it. */
const SERVER_INFO = { name: "olai", version: "0.1.0" } as const

export interface FaceOptions {
  /** The surface, bound to this process's store. `handlers` is all the
   *  in-process dispatch needs — `ctx` is the WRITE face and stays with
   *  whoever built the runtime, so nothing that serves a transport can also
   *  publish into the surface. */
  readonly bound: Pick<Bound, "handlers">
  /** Where the protocol goes. `process.stdin`/`stdout` in the binary (the
   *  adapter's own default), an `InMemoryTransport` half in a test. Injectable
   *  is the whole reason a test can read this face without a pipe. */
  readonly transport?: Transport
  /**
   * The call-shaped half of the surface, if there is one yet.
   *
   * Empty today — see the module header. When the upstream result shape can
   * carry `structuredContent`, this is where `@olai/ops`' table arrives,
   * projected once rather than declared twice.
   */
  readonly tools?: Record<string, BespokeTool>
}

/**
 * Serve the surface as MCP until the enclosing scope closes.
 *
 * Scoped rather than returning a teardown: everything else in both composition
 * roots is, and a caller holding a `close()` it might forget is exactly the
 * arrangement `serve.ts` took the listener's lifetime away from.
 */
export const serveFace = (
  options: FaceOptions,
): Effect.Effect<Server, never, Scope.Scope> =>
  Effect.gen(function*() {
    // The member face over the in-process dispatch. The cast is the adapter's
    // own idiom, carried by its published example: `SurfaceClientCallable`
    // types the member leaves as callable, `buildSurfaceFace` types them
    // `unknown` because the face is structural by design. The two describe one
    // runtime value; reconciling the spellings is an upstream follow-up.
    const client = buildSurfaceFace(
      surface,
      directDispatch({ handlers: options.bound.handlers }),
    ) as unknown as SurfaceClientCallable

    const served = yield* Effect.promise(() =>
      serveSurfaceAsMcp({
        surface,
        client: () => client,
        expose: EXPOSE,
        serverInfo: SERVER_INFO,
        ...(options.tools === undefined ? {} : { tools: options.tools }),
        ...(options.transport === undefined ? {} : { transport: options.transport }),
      })
    )
    // Registered on the scope for the same reason the listener's teardown is:
    // closing olai is closing a scope, and no caller carries a shutdown
    // function. `close()` stops the resource pusher, disposes the connection
    // and disconnects the transport.
    yield* Effect.addFinalizer(() => Effect.promise(() => served.close()))

    return served.server
  })

/**
 * The surface, spoken as MCP — serve-fresh.
 *
 * `@kolu/surface-mcp` adapts a declared surface into an MCP server: the cells
 * and collections named in {@link ../faces.ts} become readable and SUBSCRIBABLE
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
 * **The tools ride here too**, as bespoke tools projected from `@olai/ops`'
 * table ({@link ./tools.ts}). That waited on juspay/kolu#2155, because olai's
 * refusal contract is that a refused write arrives as `isError` WITH its
 * structured detail — "these three children are not done" as data the agent can
 * act on, not a sentence it has to parse — and the adapter's result shape
 * carried prose only. `ToolFailure` is that gap closed; `instructions` below is
 * the other half of the same PR.
 *
 * So this is now the WHOLE of olai's MCP face, resources and tools together, and
 * both transports are one call apart: stdio for `olai mcp <dir>`
 * ({@link ./serve.ts}), Streamable HTTP for the session the server spawns
 * ({@link ./route.ts}). The hand-rolled JSON-RPC dispatch this replaced is gone.
 */

import { surface } from "@olai/surface"
import { buildSurfaceFace, type StreamingProcedure } from "@kolu/surface/client"
import type { SurfaceSpec } from "@kolu/surface/define"
import { directDispatch } from "@kolu/surface/links/direct"
import type { SurfaceReadFace } from "@kolu/surface/project"
import type { SurfaceHandlers } from "@kolu/surface/server"
import { type BespokeTool, serveSurfaceAsMcp } from "@kolu/surface-mcp"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { Effect, type Scope } from "effect"

import { EXPOSE } from "../faces.ts"
import type { Bound } from "../runtime.ts"

// ── The client, typed ────────────────────────────────────────────────────

/**
 * The collection READ verbs, typed off a spec.
 *
 * The framework's {@link SurfaceReadFace} deliberately declines collections: it
 * exists for a PROJECTION's `deps`, which consumes cells and streams and never
 * walks a collection. This face does — the adapter reads `outlines.keys` for the
 * key set and `outlines.get({ key })` for one file — so the two read verbs are
 * spelled here, in the shape and on the sides `buildSurfaceFace` actually mints
 * them. Keys and values are DECODED on both legs: a collection key is an
 * identity in our own key set, not a pure forwarded argument.
 *
 * Lifted from the same declaration in kolu's `@kolu/padi`, which is the
 * sanctioned pattern rather than a coincidence — see {@link OlaiSurfaceClient}.
 */
type SurfaceCollectionsReadFace<S extends SurfaceSpec> = {
  [K in keyof S["collections"] & string]: {
    keys: StreamingProcedure<
      undefined,
      readonly NonNullable<S["collections"]>[K]["keySchema"]["Type"][]
    >
    get: StreamingProcedure<
      { key: NonNullable<S["collections"]>[K]["keySchema"]["Type"] },
      NonNullable<S["collections"]>[K]["schema"]["Type"]
    >
  }
}

/**
 * olai's surface as a CLIENT sees it — spec-derived, so a schema edit is a
 * compile error here rather than a runtime surprise.
 *
 * This exists because `buildSurfaceFace` types its member leaves `unknown`: the
 * face is structural by design, and re-materializing the precise client type
 * inside the framework overflows TypeScript's union budget (kolu's documented
 * TS2590 dodge). Asking upstream to widen its own client type was the wrong fix
 * and was declined for exactly that reason. The right one is this: each consumer
 * declares the narrow face it actually calls, the way `@kolu/padi` declares
 * `PadiSurfaceClient`, and the framework-forced structural cast lives in ONE
 * named place — {@link clientOver} — instead of at every call site.
 */
export type OlaiSurfaceClient = {
  readonly surface:
    & SurfaceReadFace<typeof surface.spec>
    & SurfaceCollectionsReadFace<typeof surface.spec>
}

/** Build the typed face over an in-process dispatch. THE one place the
 *  structural cast lives, so nothing downstream re-derives it. */
const clientOver = (handlers: SurfaceHandlers): OlaiSurfaceClient =>
  buildSurfaceFace(
    surface,
    directDispatch({ handlers }),
  ) as unknown as OlaiSurfaceClient

/** What this server calls itself. The version is the binary's, spelled here
 *  because the adapter has no other way to learn it. */
const SERVER_INFO = { name: "olai", version: "0.1.0" } as const

/**
 * What a host is told olai IS, at `initialize`.
 *
 * Load-bearing prose, not a greeting: an agent that has met a hundred MCP
 * servers arrives assuming files, and the one thing it has to unlearn here is
 * that there are any. Reachable only because the adapter passes it through to
 * the SDK, which serves `initialize` inside its own protocol layer — there is no
 * request handler a consumer could register to say this instead.
 */
const INSTRUCTIONS =
  "olai serves a directory of outlines. Everything here is about NODES, not files: " +
  "search and read to find one, then use the write tools to change it. There is no " +
  "file access — a node is the smallest thing you can name, and that is deliberate."

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
   * The call-shaped half of the surface: `@olai/ops`' table, projected by
   * {@link ./tools.ts}. Optional so a test can read the resources without
   * standing an ops layer up behind them.
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
    // The member face over the in-process dispatch — typed, and typed HERE
    // rather than cast at the adapter's door. See {@link OlaiSurfaceClient}.
    const client = clientOver(options.bound.handlers)

    const served = yield* Effect.promise(() =>
      serveSurfaceAsMcp({
        surface,
        client: () => client,
        expose: EXPOSE,
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
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

/**
 * The surface, spoken as MCP — over whichever surface it is handed.
 *
 * `@kolu/surface-mcp` adapts a declared surface into an MCP server: the cells
 * and collections named in {@link ../faces.ts} become readable and SUBSCRIBABLE
 * resources, so an agent watches the same rows the browser draws instead of
 * polling a second projection of them. This module is the composition — the
 * adapter, its expose map, and the typed client the tools and the resources
 * both read through.
 *
 * **Both of the adapter's shapes go through this one function**, and the caller
 * decides which by what it passes as `client`: a direct dispatch at a runtime
 * this process built (serve-fresh), or a dialled unix socket into an `olai web`
 * that already holds the store (attached, `../socket.ts`). Nothing else differs
 * — same expose map, same tools, same instructions — which is the property
 * `mcp-bridge` was built to have and the reason an agent's tool list cannot
 * depend on whether a browser happens to be open.
 *
 * There is no wire under the direct dispatch and that is the point of it: the
 * same consumer code that runs against a socket-served surface runs against an
 * in-process one, so what an agent reads and writes here and what it reads and
 * writes attached are the same values by construction rather than by two
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
import { restrictHandlers } from "@kolu/surface/expose"
import type { SurfaceDispatch } from "@kolu/surface/link"
import type { SurfaceReadFace } from "@kolu/surface/project"
import type { SurfaceHandlers } from "@kolu/surface/server"
import { type BespokeTool, type ClientOrConnection, serveSurfaceAsMcp } from "@kolu/surface-mcp"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { Effect, type Scope } from "effect"

import { AGENT_FACE, MCP } from "../faces.ts"

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
 *
 * The PROCEDURES need nothing added, which is worth saying because the tools
 * call them now ({@link ./tools.ts} projects `@olai/ops`' table over this
 * client rather than over a local `Ops`). {@link SurfaceReadFace}'s name
 * undersells it: its last mapped block is over `S["procedures"]`, with the
 * four-arm input/output ladder and the declared error union. A local re-spelling
 * of that was written here first and deleted — it type-checked, so it looked
 * harmless, and it had already drifted on the side that matters: the framework
 * mints a procedure on the ENCODED input and the copy took the decoded one.
 */
export type OlaiSurfaceClient = {
  readonly surface:
    & SurfaceReadFace<typeof surface.spec>
    & SurfaceCollectionsReadFace<typeof surface.spec>
}

/** Build the typed face over any dispatch — an in-process one here, a unix
 *  socket's when `olai mcp` attaches. THE one place the structural cast lives,
 *  so nothing downstream re-derives it. */
export const clientOn = (dispatch: SurfaceDispatch): OlaiSurfaceClient =>
  buildSurfaceFace(surface, dispatch) as unknown as OlaiSurfaceClient

/** The in-process case: dispatch straight at the handlers this process bound.
 *  No wire under it and that is the point — the same consumer code runs against
 *  a socket-served surface, so what an agent reads and writes here and what it
 *  would read and write attached are the same values by construction.
 *
 *  GATED BY THE SAME FACE the socket is, which is the other half of that
 *  sentence and the reason `restrictHandlers` is exported upstream for
 *  hand-built serve paths. Without it a fresh `olai mcp` would reach members an
 *  attached one is refused, and a tool that worked in a terminal would fail on
 *  a directory that happened to have a browser open on it — the one divergence
 *  this whole arrangement exists to foreclose. It costs nothing: the adapter is
 *  the only caller, and it asks for what the map already grants. */
export const clientOver = (handlers: SurfaceHandlers): OlaiSurfaceClient =>
  clientOn(
    directDispatch({
      handlers: restrictHandlers(surface.group, handlers, AGENT_FACE),
    }),
  )

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
  /**
   * Where the surface IS — the adapter's live-client factory, verbatim.
   *
   * Two shapes, and the whole of the difference between olai's two deployments
   * is which one a composition root passes:
   *
   *   - SERVE-FRESH — `clientOver(bound.handlers)`, a direct dispatch at the
   *     runtime this process built. Nothing to dispose;
   *   - ATTACHED — a dialled unix socket, returned as `{ client, dispose }` so
   *     the adapter closes what it opened and re-dials after a drop.
   *
   * It is a THUNK because the adapter re-invokes it: a dropped connection is
   * re-dialled rather than mourned, and the bespoke tools are handed whichever
   * client is live at the moment they are called.
   */
  readonly client: () => ClientOrConnection | Promise<ClientOrConnection>
  /** Where the protocol goes. `process.stdin`/`stdout` in the binary (the
   *  adapter's own default), an `InMemoryTransport` half in a test. Injectable
   *  is the whole reason a test can read this face without a pipe. */
  readonly transport?: Transport
  /**
   * The call-shaped half of the surface: `@olai/ops`' table, projected by
   * {@link ./tools.ts}. Optional so a test can read the resources without
   * standing an ops layer up behind them.
   *
   * It closes over no client. The adapter hands each handler the LIVE one, so
   * the table is projected once, in one process, and answers over whatever
   * connection is current — which is what lets a re-dial after a socket drop
   * leave the tool surface alone.
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
    const served = yield* Effect.promise(() =>
      serveSurfaceAsMcp({
        surface,
        client: options.client,
        expose: MCP,
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

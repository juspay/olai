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
 * **The adapter's client is a direct dispatch at a runtime this process
 * built.** Same expose map, same tools, same instructions, whether the
 * caller is the panel's agent or a `.mcp.json` HTTP client — which is the
 * reason an agent's tool list cannot depend on who is asking.
 *
 * There is no wire under the direct dispatch and that is the point of it:
 * the same consumer code that a test drives in memory is the code the HTTP
 * route runs, so what an agent reads and writes is one implementation.
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
 * the transport is Streamable HTTP for every client of the running server
 * ({@link ./route.ts}). The hand-rolled JSON-RPC dispatch this replaced is gone.
 */

import { surface } from "@olai/surface"
import { buildSurfaceFace, type StreamingProcedure } from "@kolu/surface/client"
import type { SurfaceSpec } from "@kolu/surface/define"
import { directDispatch } from "@kolu/surface/links/direct"
import { restrictHandlers } from "@kolu/surface/expose"
import type { SurfaceDispatch } from "@kolu/surface/link"
import type { SurfaceReadFace } from "@kolu/surface/project"
import { type BespokeTool, type ClientOrConnection, serveSurfaceAsMcp } from "@kolu/surface-mcp"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { Effect, type Scope } from "effect"

import type { FaceExposure } from "@kolu/surface/expose"

import { MCP } from "../faces.ts"
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

/** Build the typed face over any dispatch — the in-process one the HTTP
 *  route uses. THE one place the structural cast lives, so nothing
 *  downstream re-derives it. */
export const clientOn = (
  dispatch: SurfaceDispatch,
): OlaiSurfaceClient =>
  buildSurfaceFace(surface, dispatch) as unknown as OlaiSurfaceClient

/** The in-process case: dispatch straight at the handlers this process bound.
 *  No wire under it and that is the point — the same consumer code runs against
 *  a socket-served surface, so what an agent reads and writes here and what it
 *  would read and write attached are the same values by construction.
 *
 *  GATED BY THE AGENT FACE, which is the reason `restrictHandlers` is
 *  exported upstream for hand-built serve paths. Without it an HTTP client
 *  would reach members a browser is refused — or the other way around —
 *  and a tool that worked in a terminal would fail on a directory that
 *  happened to have a browser open on it. It costs nothing: the adapter is
 *  the only caller, and it asks for what the map already grants.
 *
 *  IT TAKES THE GROUP AND THE FACE rather than reading either off `@olai/surface`
 *  and `../faces.ts`, and it has to: what this process serves is olai's surface
 *  FUSED with whichever plugin siblings it composed, and `restrictHandlers`
 *  proves an exposure describes the group it is applied to as a set EQUALITY —
 *  so a gate built from olai's own surface over a fused record refuses at boot,
 *  naming every sibling tag it cannot account for. That is the right failure and
 *  the reason both halves arrive together from the one place that composed them
 *  (`../runtime.ts`'s `bind`, which returns the faces beside the group).
 *
 *  The TYPED face above it stays olai's own spec, and that is not an
 *  inconsistency: what an agent calls through this client is core's members, and
 *  a plugin's are denied by the face it is gated with. */
export const clientOver = (
  bound: Pick<Bound, "group" | "handlers">,
  face: FaceExposure,
): OlaiSurfaceClient => {
  const handlers = restrictHandlers(bound.group, bound.handlers, face)
  return clientOn(directDispatch({ handlers }))
}

/** What this server calls itself. The version is the binary's, spelled here
 *  because the adapter has no other way to learn it. */
const SERVER_INFO = { name: "olai", version: "0.1.0" } as const

/**
 * What a host is told olai IS, at `initialize`.
 *
 * Load-bearing prose, not a greeting: an agent that has met a hundred MCP
 * servers arrives assuming a filesystem, and what it has to unlearn here is
 * that this is one. Reachable only because the adapter passes it through to
 * the SDK, which serves `initialize` inside its own protocol layer — there is no
 * request handler a consumer could register to say this instead.
 *
 * **IT SAID "there is no file access" UNTIL THIS PR, AND THAT HAD STOPPED
 * BEING TRUE.** `md-editing` added `create_document` and `write_document` —
 * verbs whose subject is a file — and the read half (`list_documents`,
 * `read_document`) is what makes the pair usable at all. A charter an agent is
 * handed at `initialize` and can disprove with its second tool call is worse
 * than no charter: what it teaches next is that the rest of this text is
 * decoration.
 *
 * So what it claims now is the thing that is actually true, and it is the
 * stronger claim rather than the weaker one. The unit is not a byte and never
 * a range — a NODE for an outline, a whole TEXT for a document, a whole
 * TRASH for `empty_trash` — and the namespace is the served set rather than
 * a disk: there is no listing that is not this directory's own, no path outside
 * it, no shell and no grep. That is what the closed table enforces
 * (`@olai/ops`' `tools.ts`), so this sentence and that list say one thing.
 *
 * THE THIRD AND FOURTH UNITS ARE THE SAME LESSON READ ONCE MORE.
 * `empty_trash` empties `_olai/Trash.olai` and `delete_file` removes a file,
 * and an enumeration that stopped at nodes and documents would be disprovable
 * by an agent's second tool call in exactly the way the paragraph above is
 * about. They change none of the claims that do the work: the path is always
 * one the set already serves, what is named is a whole file — its records, or
 * its existence — rather than any part of one, and nothing about either
 * reaches outside this directory.
 */
const INSTRUCTIONS =
  "olai serves a directory of outlines and the documents beside them. Everything here " +
  "is NODES and whole FILES, never bytes: search and read to find a node, then use " +
  "the write tools to change it; list and read a `.md` document by path, and write one " +
  "back whole; `empty_trash` empties `_olai/Trash.olai`'s records; and `delete_file` " +
  "removes a document or an emptied outline — guarded, and not to be put back, so a " +
  "path you are not sure of is a refusal you want. There is no filesystem under this " +
  "— no shell, no grep, no path outside the served directory, and no way to name part " +
  "of a file — and that is deliberate."

export interface FaceOptions {
  /**
   * Where the surface IS — the adapter's live-client factory, verbatim.
   *
   * A thunk because the adapter re-invokes it. On this face it answers with
   * the same in-process client every time — nothing to dispose, nothing to
   * re-dial.
   */
  readonly client: () => ClientOrConnection | Promise<ClientOrConnection>
  /** Where the protocol goes. The HTTP route in the binary, an
   *  `InMemoryTransport` half in a test. Injectable is the whole reason a
   *  test can read this face without a listener. */
  readonly transport?: Transport
  /**
   * The call-shaped half of the surface: `@olai/ops`' table, projected by
   * {@link ./tools.ts}. Optional so a test can read the resources without
   * standing an ops layer up behind them.
   *
   * It closes over no client. The adapter hands each handler the LIVE one, so
   * the table is projected once, in one process, and answers over the live
   * client the adapter hands each call.
   */
  readonly tools?: Record<string, BespokeTool>
}

/**
 * Serve the surface as MCP until the enclosing scope closes.
 *
 * Scoped rather than returning a teardown: everything else in the
 * composition root is, and a caller holding a `close()` it might forget is
 * exactly the arrangement `serve.ts` took the listener's lifetime away from.
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

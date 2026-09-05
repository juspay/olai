/** MCP protocol acquisition belongs to the plugin's activation scope. Core
 * supplies the composed, writer-bound face and the shared HTTP transport. */
import { surface } from "@olai/surface"
import { type BespokeTool, type ClientOrConnection, serveSurfaceAsMcp } from "@kolu/surface-mcp"
import type { ExposeMap } from "@kolu/surface/expose"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { TransportSurface } from "@olai/plugin-api/transport"
import { Effect, type Scope } from "effect"

export const endpoint = (surface: TransportSurface) => Effect.gen(function*() {
  const options = yield* surface.mcp
  yield* serveFace(options)
})

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
  readonly expose: ExposeMap<typeof surface.spec>
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
        expose: options.expose,
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

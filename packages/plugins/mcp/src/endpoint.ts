import type { SurfaceSpec } from "@kolu/surface/define"
import type { AgentBinding } from "./binding.ts"
import type { Tool } from "@olai/ops"
import { siblingsOf, type Row } from "./bundle.ts"
import { currentLogin, mcpTransport, mcpRoute } from "./route.ts"
import { bespokeFrom } from "./tools.ts"
/** MCP protocol acquisition belongs to the plugin's activation scope. Core
 * supplies the composed, writer-bound face; this plugin owns the HTTP carrier. */
import { type ClientOrConnection, type McpSibling, serveSurfaceAsMcp, type ServedSurfaceMcp } from "@kolu/surface-mcp"
import { hostFaces, hostSurface } from "@olai/surface/host"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { TransportSurface } from "@olai/plugin-api/transport"
import { Effect, type Scope } from "effect"

/** WHAT THE ADAPTER IS SERVING, as one comparable word: every sibling and the
 *  verbs on it. Read by the catch-up below and by the no-op guard, which must
 *  agree or one of them re-applies what the other just settled. */
const signatureOf = (map: Record<string, { readonly tools?: Record<string, unknown> }>): string =>
  Object.entries(map).map(([key, one]) =>
    `${key}:${Object.keys(one.tools ?? {}).sort().join(",")}`).sort().join("|")

export const endpoint = (shared: TransportSurface, policy: AgentBinding) => Effect.gen(function*() {
  const transport = mcpTransport()
  const rows = (): ReadonlyArray<Row> => shared.agentRows() as unknown as ReadonlyArray<Row>
  /**
   * EVERY STANDING ROW, WITH ITS OWN VERBS ON IT — the whole bundle, minted for
   * the roster as it is right now.
   *
   * There is no BUILD-wide tool table left and there was one for one commit.
   * `serveSurfaceAsMcp` used to take its record once and dispatch out of it
   * forever, so a row mounting later had no way in — which meant the record had
   * to be every verb the binary had while the LIST was filtered to the roster,
   * and something had to hold the difference. juspay/kolu#2234's `reroster`
   * re-composes the whole bundle on a roster move, so a row that arrives brings
   * its verbs with it and one reading answers both questions.
   */
  const bundle = () => siblingsOf(rows(), row =>
    bespokeFrom(row.name, row.tools as ReadonlyArray<Tool>, rows, {
      ...policy, get root() { return policy.root }, login: currentLogin, fenced: policy.fenced,
    }))
  const booted = bundle()
  const served = yield* serveFace({ siblings: booted, client: policy.client, transport })
  /**
   * THE ROSTER, FOLLOWED IN PLACE.
   *
   * A row switching off used to reach this face as a FILTER: the resource list
   * was re-derived per request from a curated flat spec, the tool list was
   * filtered against the standing rows, and nothing told a host either had
   * moved. The adapter takes the roster now — `reroster` re-runs the whole boot
   * composition on the new siblings, re-dials `client()`, ends any subscription
   * the new roster cannot serve, and sends both `list_changed` notifications.
   * Absence is the adapter's, which is what #546 asked for.
   *
   * RUNG FROM THE COMPOSITION ROOT, at the tail of a recompose, so the rows it
   * reads are the generation just published.
   *
   * ONE AT A TIME, AND NOT BECAUSE THE SWAP RACES. kolu's `reroster` resolves
   * the new generation and assigns it with no `await` in between, so two calls
   * cannot interleave the state change however fast the bell rings — read, not
   * assumed. What the chain buys is the two NOTIFICATIONS, which are awaited:
   * un-chained, a burst could tell a host the list changed in an order that
   * does not match the order it changed in, and a host that re-lists on the
   * first notice would be answered correctly and then told again for a move it
   * had already seen. It also gives the failure below one place to be caught.
   *
   * A REFUSED ROSTER IS SAID OUT LOUD. The adapter leaves the endpoint exactly
   * as it was — the same guarantee `mount` makes one wall down — so nothing is
   * broken by one, but a face that quietly went on serving a roster the host no
   * longer has is precisely the silent-wrong-answer this whole change is about.
   */
  let moving: Promise<unknown> = Promise.resolve()
  /** The roster the adapter is currently serving, as names — see the guard. */
  let applied = signatureOf(booted)
  yield* Effect.acquireRelease(
    Effect.sync(() => shared.agentRosterMoved(() => {
      moving = moving.then(() => {
        const next = bundle()
        // NOTHING MOVED, NOTHING TO APPLY. The bell rings on every recompose,
        // and most recomposes do not touch the agent's roster — a browser-only
        // row arriving, a service offer changing. Six identical rerosters at
        // boot is what that looked like before this line, and each one re-runs
        // the composition, re-dials `client()` and sends both `list_changed`
        // notifications: a host told four times that a list it has not seen
        // change has changed. Keyed on the sibling names and their verbs, which
        // is exactly what the adapter serves out of the bundle.
        const now = signatureOf(next)
        if (now === applied) return undefined
        applied = now
        return served.reroster(next)
      }).catch((thrown: unknown) => {
        Effect.runFork(Effect.logWarning(`mcp: the agent face kept its previous roster — ${String(thrown)}`))
      })
    })),
    stop => Effect.sync(stop),
  )
  /**
   * THE WINDOW BETWEEN THE BUNDLE AND THE BELL, closed.
   *
   * `serveFace` awaits `server.connect`, and the watcher above is attached only
   * once that resolves. A row that registers its surface inside that await
   * rings a bell nobody is holding, so the generation kolu keeps is the one
   * read BEFORE it — and stays that way until some unrelated move happens to
   * republish. This row needs only the transport door, so it applies early;
   * `olai-plugin-outlines` waits for a vault and can land squarely in the gap.
   *
   * The catch-up is a comparison rather than an unconditional move: `applied`
   * is `booted`'s signature, so a roster that did not change costs nothing and
   * one that did is handed over exactly once. It is the same shape
   * `./runtime.ts` uses when it composes in line before forking its stream
   * loop — except a stream replays its first element and a bell does not, so
   * the replay is spelled here.
   */
  yield* Effect.promise(async () => {
    const now = bundle()
    const signature = signatureOf(now)
    if (signature === applied) return
    applied = signature
    await served.reroster(now)
  })
  yield* shared.register({ routes: mcpRoute({ transport, token: shared.token, who: shared.who }) })
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
 * BEING TRUE.** `md-editing` added `markdown_create` and `markdown_write` —
 * verbs whose subject is a file — and the read half (`markdown_index`,
 * `markdown_read`) is what makes the pair usable at all. A charter an agent is
 * handed at `initialize` and can disprove with its second tool call is worse
 * than no charter: what it teaches next is that the rest of this text is
 * decoration.
 *
 * So what it claims now is the thing that is actually true, and it is the
 * stronger claim rather than the weaker one. The unit is not a byte and never
 * a range — a NODE for an outline, a whole TEXT for a document, a whole
 * TRASH for `trash_empty` — and the namespace is the served set rather than
 * a disk: there is no listing that is not this directory's own, no path outside
 * it, no shell and no grep. That is what the rows' own tables enforce between
 * them — the vocabulary is closed even though it is no longer written in one
 * place — so this sentence and those lists say one thing.
 *
 * THE THIRD AND FOURTH UNITS ARE THE SAME LESSON READ ONCE MORE.
 * `trash_empty` empties `_olai/Trash.olai` and `files_delete` removes a file,
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
  "back whole; `trash_empty` empties `_olai/Trash.olai`'s records; and `files_delete` " +
  "removes a document or an emptied outline — guarded, and not to be put back, so a " +
  "path you are not sure of is a refusal you want. There is no filesystem under this " +
  "— no shell, no grep, no path outside the served directory, and no way to name part " +
  "of a file — and that is deliberate."

/**
 * THE ROOT OF THE BUNDLE — core's own surface, granting an agent NOTHING.
 *
 * ## It is here because an empty roster is not a bundle
 *
 * Siblings alone was the honest shape and it had one hole: kolu refuses a
 * bundle with neither half ("a bundle with no core and no siblings is not a
 * bundle"), and the roster REACHES ZERO in two ordinary situations. A serve
 * selected as `--plugins outlines,ws,mcp,web-app` composes no agent row until a
 * vault arrives, so `serveSurfaceAsMcp` threw at boot and `/mcp` was never
 * registered at all. And a person flipping the vault off through the panel took
 * every content row with it, so `reroster({})` was refused — and the adapter's
 * refusal leaves the endpoint EXACTLY AS IT WAS, which meant the face went on
 * advertising twenty-four verbs and two `surface://` URIs belonging to rows that
 * had left, indefinitely, with `list_changed` never sent. Reading one of them
 * refused, so nothing was mis-served; what was wrong is that the catalogue said
 * otherwise, which is the silent-wrong-answer #546 is about
 * (`@olai/server`'s `profiles.test.ts`, "vault withdrawal removes content tools"
 * and "an explicit content selection waits for its vault").
 *
 * ## Why CORE and not a stand-in
 *
 * Because core is genuinely the root of this composition — the surface every
 * sibling is mounted beside — and `hostFaces.agent` is genuinely `{}`: every
 * member core declares is a reading of the served INSTANCE, which is a panel's
 * business and not a vault's (`@olai/surface`'s `host.ts` argues each one). So
 * this publishes no resource and no tool and is addressable by nothing; what it
 * does is make the bundle a bundle when no row is standing, which is a true
 * sentence about olai rather than a placeholder.
 *
 * The core is passed at BOOT and `reroster` replaces the sibling half only, so
 * one statement here covers both holes.
 *
 * NOT A `FaceOptions` FIELD, deliberately. It is a fact about the agent face
 * rather than a choice a caller makes, and a bench that could pass a different
 * one — or none — would be a bench proving something this face does not do.
 */
const AGENT_CORE = { surface: hostSurface, expose: hostFaces.agent } as const

export interface FaceOptions {
  /**
   * THE WHOLE BUNDLE — one entry per standing row, each carrying its own
   * surface, its own resource map and its own verbs.
   *
   * It was `surface` + `expose`: ONE curated spec copying six rows' members
   * into one un-prefixed namespace, and one hand-written map beside it. The
   * adapter takes a rooted bundle since juspay/kolu#2234, resolves each row's
   * map against that ROW's spec, and mints
   * `surface://collections/markdown/documents` from the key it was mounted
   * under — so nothing is copied and two rows exposing the same member key are
   * disjoint by construction.
   *
   * NO CORE. Core's four members are on no agent face (`hostFaces.agent` is
   * `{}`), so this bundle is siblings alone — which kolu accepts; what it
   * refuses is a bundle with neither half.
   *
   * NO FILTER BESIDE IT EITHER, and one stood here for one commit. While a
   * sibling's authored tool names took its key, olai's verbs had to be declared
   * at the bundle ROOT to keep their words — and a root tool survives any
   * roster, so a `tools/list` override had to hide the ones whose row was gone.
   * kolu#2234 records ownership on the entry instead of spelling it into the
   * name, so a verb keeps its word AND leaves with its row, and absence is the
   * adapter's.
   */
  readonly siblings: Record<string, McpSibling<SurfaceSpec>>
  /**
   * Where the surface IS — the adapter's live-client factory, verbatim.
   *
   * A thunk because the adapter re-invokes it: on a retry after a drop, and
   * after every `reroster`. On this face it mints one in-process client per
   * standing row — nothing to dispose, nothing to re-dial — and it must READ
   * the current roster rather than close over one, which is the whole reason
   * it is a function.
   */
  readonly client: () => ClientOrConnection | Promise<ClientOrConnection>
  /** Where the protocol goes. The HTTP route in the binary, an
   *  `InMemoryTransport` half in a test. Injectable is the whole reason a
   *  test can read this face without a listener. */
  readonly transport?: Transport
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
): Effect.Effect<ServedSurfaceMcp, never, Scope.Scope> =>
  Effect.gen(function*() {
    const served = yield* Effect.promise(() =>
      serveSurfaceAsMcp({
        core: AGENT_CORE,
        surfaces: options.siblings,
        client: options.client,
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
        ...(options.transport === undefined ? {} : { transport: options.transport }),
      })
    )
    // Registered on the scope for the same reason the listener's teardown is:
    // closing olai is closing a scope, and no caller carries a shutdown
    // function. `close()` stops the resource pusher, disposes the connection
    // and disconnects the transport.
    yield* Effect.addFinalizer(() => Effect.promise(() => served.close()))

    return served
  })

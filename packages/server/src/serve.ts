/**
 * One directory, read and served: the composition root's argument is its order.
 *
 * The tenant runtime opens before the store because it supplies the vocabulary
 * the first disk read validates against. The store and write gate stand before
 * the composed surface; the surface stands before a transport may expose it.
 * Only after a listener has bound can a session be told where its tools are.
 * These are dependencies between owners, so they belong here even when the
 * acquisitions themselves live behind a smaller module's door.
 *
 * Profiles change which rows are present, not this sequence. Infrastructure
 * rows mount beside tenants on the same host and wait for TransportSurface.
 * Providing that door after bind lets the existing needs/activation mechanism
 * express the dependency. The store and kinds are still this shared base;
 * making the store acquisition a row is Phase 17, not a special headless path.
 *
 * Logging is inherited through Effect: the root annotation must be established
 * before openPlugins captures the environment and before the store forks its
 * watcher. A row started later then says which directory it belongs to under
 * the same log settings as everything that booted eagerly.
 */
import { type GitPin, type PageRequest } from "@olai/format"
import {
  make as makeOps,
  NO_LEDGER,
  NO_SEARCH,
  type Ledger as OpsLedger,
  type Ops,
  type Search as OpsSearch,
} from "@olai/ops"
import {
  BUNDLE_NAMES,
  configsOf,
  mountBundle,
  provide,
  settled,
  offered,
  reportBundle,
  rowsNaming,
  setRow,
} from "@olai/bundle/bundle"
import { bundleRank } from "@olai/bundle"
import { emitter } from "@olai/log"
import {
  Identity,
  Ledger,
  NOWHERE_TO_WRITE,
  openPlugins,
  type PropWrite,
  Search,
  type ToolServer,
} from "@olai/plugin-api/services"
import { Deferred, Effect } from "effect"
import { randomBytes } from "node:crypto"
import { resolve } from "node:path"

import { localStateFor } from "./localState.ts"
import { openDirectory } from "./directory.ts"
import { openDynamic } from "./dynamic/runtime.ts"
import { propKinds } from "./propKinds.ts"
import { watchFault } from "./fault.ts"
import { hostname } from "./hostname.ts"
import { NOBODY, readingOf } from "./identity.ts"
import { PROFILES, profileRows, TRANSPORT_ROWS, type Profile } from "./profiles.ts"
import { transportListener, transportModules, TransportSurface } from "./transports.ts"
import { mcpEndpoint } from "./mcp/endpoint.ts"
import { gitConfigPatch } from "./gitPolicy.ts"
import { bind } from "./runtime.ts"

export interface ServeOptions {
  /** Which row bundle the instance starts with; omission selects web.
   * `--plugins` still patches integrations, independently of transport rows. */
  readonly profile?: Profile
  /** The directory to serve, recursively. */
  readonly root: string
  readonly port: number
  readonly host: string
  /** The built browser bundle. A nix-built binary is pointed at the bundle
   *  derivation; the dev loop points at the tree it just built. */
  readonly clientDist: string
  /** Browser origins allowed to open the websocket, beyond same-origin. */
  readonly allowedOrigins: ReadonlyArray<string>
  /**
   * WHAT THIS PROCESS CAN SEE — `process.env` on a real serve, and the one
   * place a test states an environment instead of arranging one.
   *
   * It is here because a plugin's rendezvous is decided from it
   * (`@olai/plugin-api`'s `Env`), and the identity row's header names are
   * the first of those a test in THIS package has to be able to set: the
   * two doors that answer who is looking are the listener's, so a suite
   * that drives a real socket must be able to say what the proxy in front
   * of it is called. It used to be an `identity` field of parsed header
   * names, which was core holding the row's own vocabulary in order to
   * hand it back to the row.
   *
   * Omitted is `process.env` itself, which is what `olai web` passes by
   * saying nothing.
   */
  readonly vars?: Record<string, string | undefined>
  /** `--commit` / `--push` as given — a CLI patch onto the git row's config,
   *  the way `--plugins` is a patch onto `disabled`. `null` on both halves is
   *  nobody having said. */
  readonly pin: GitPin
  /** WHICH built-in integrations to run — `null` for nobody having said,
   *  which means the built-in default (not necessarily every plugin this
   *  binary was built with). `./pluginPolicy.ts` argues why omission stays
   *  distinguishable from the default typed out loud. */
  readonly plugins: ReadonlyArray<string> | null
}


/**
 * Serves until the enclosing scope closes. Everything it opens is registered
 * as a finalizer of that scope, so shutting down is closing the scope and no
 * caller holds a teardown function it might forget to call.
 *
 * It RETURNS once everything is up, and what it hands back is the one thing a
 * caller still has to wait on: an effect that never settles unless the surface
 * runtime faults, in which case it FAILS. That is what keeps `olai web` alive —
 * and it is why an unrecoverable fault now unwinds this scope like every other
 * shutdown instead of exiting the process from under its finalizers.
 */

export const serve = (options: ServeOptions) =>
  Effect.gen(function*() {

    const profile = options.profile ?? "web"
    const built = [...BUNDLE_NAMES, ...TRANSPORT_ROWS]
    /** The re-compose, filled in by `bind` — `./runtime.ts`'s `PluginRuntime`
     *  argues why it is a holder rather than a callback passed here. */
    const onChange = { run: (): void => {} }

    // A process credential; session tickets are minted only while the MCP row stands.
    const token = randomBytes(24).toString("hex")

    const mcp = mcpEndpoint(token)

    /** THE WRITE GATE, filled the moment it is built. Held rather than passed,
     *  because the plugin runtime is opened BEFORE the store the layer is over —
     *  the vocabulary a store validates with is what the rows contribute — so
     *  the door a row names is asked per call. */
    let opsLayer: Ops | null = null

    /** WHERE A RELATIVE PATH RESOLVES FROM, resolved the way `openDirectory`
     *  resolves it and BEFORE it, because the plugin runtime is opened first.
     *  One spelling of `resolve` in two places is a hazard; two answers to which
     *  directory this serve is about is a worse one, and `./directory.ts` must
     *  be handed the same resolved string. */
    const served = resolve(options.root)

    /**
     * WHICH DIRECTORY EVERY LINE BELOW IS ABOUT, annotated BEFORE the plugin
     * runtime rather than only inside `openDirectory`.
     *
     * `openDirectory` sets the same annotation and owns the ordering rule that
     * matters most — it has to be in force before `Store.make` forks its watcher,
     * or those fibers say nothing about which directory they were probing. This
     * line is the same fact one step earlier, and it is here because a plugin's
     * `apply` runs BEFORE the store opens: the plugin runtime captures this
     * fiber's services once, and every line a plugin emits for the life of the
     * process is emitted under them. Annotating afterwards would leave exactly
     * the lines that name somebody's vault as the ones that do not say which.
     *
     * The value is `openDirectory`'s own — `resolve(options.root)`, computed
     * once, above — so the two cannot disagree.
     */
    yield* Effect.annotateLogsScoped({ root: served })

    /**
     * CORE'S OWN LINE FROM A CHAIN THAT IS NOT AN EFFECT — the one emitter this
     * file still holds, and what is left of a `let ring` that used to carry every
     * plugin service's two channels.
     *
     * `./localState.ts` orders a plugin's reads and writes under one permit.
     * The save effect waits for its own write, while callbacks such as the Spaces
     * mirror may deliberately detach that effect. A write that fails there can
     * therefore have no fiber under it, which is the exact position
     * `@olai/log`'s `emit.ts` was written for: without this the line would be
     * emitted against the defaults and escape an `OLAI_LOG_LEVEL` the operator
     * typed. It is core's own file and core's own failure — no plugin service
     * carries a callback any more.
     */
    const say = yield* emitter

    /**
     * The tool address is promised before any row mounts and answered only
     * after the OS supplies the bound URL. A Deferred expresses that once-only
     * fact; a mutable slot would require each session to invent its own wait.
     *
     * Tools must already stand when tenants mount: a row needing it otherwise
     * stays pending, and the kind registry read before opening the store would
     * miss that tenant's vocabulary for the lifetime of the codec. Providing
     * the promise does not start an agent. The session row awaits the answer.
     *
     * A profile with no transport never completes the promise. It announces its
     * absence of listeners and holds the vault; closing its scope interrupts
     * any waiting work. There is no invented URL for an unbound process.
     */
    const toolsReady = yield* Deferred.make<ToolServer>()

    /**
     * The runtime opens before the directory, because kinds are registrations.
     * A disabled integration still contributes its built declaration through
     * propKinds, but no live handler or admission rule. An empty tenant roster
     * is the same mounted host with its rows disabled, not a null runtime.
     *
     * This is also where a process reaches for its environment on behalf of
     * the rows. Services mint each plugin's keyed doors from its registered
     * name; no root callback hands a tenant somebody else's identity. Effects
     * keep the captured logging and scope rather than escaping to runPromise.
     *
     * The transport rows are allowed to stay pending here. They teach no vault
     * vocabulary and need the composed surface, which cannot exist until the
     * store and ops layer do. TransportSurface is intentionally absent until
     * that later point; awaiting a late Deferred inside apply would instead
     * leave mountBundle waiting for an acquisition that it must precede.
     */
    const plugins = yield* openPlugins({
      vars: options.vars ?? process.env,
      now: () => new Date().toISOString(),
      served,
      tools: toolsReady,
      // ...AND THE FENCE MINTED OFF IT. Read per call rather than captured,
      // because the endpoint has no mint until its row is active — and the row
      // that seats sessions is mounted long before that.
      ticketFor: mcp.ticketFor,
      // THE NARROW OPS DOOR: the reading a message's armed ids are resolved
      // against, a page read through core's standing cache, one property on one
      // node, and a document mint. The ops layer is built below, so all are asked
      // per call — the same shape the doorbell's door had before it became the
      // chat row's own.
      ops: {
        // THE REFUSAL IS NOT THE PLUGIN'S TO SEE. A reading that failed is a
        // store that has never loaded, which reaches a plugin as the same
        // "nothing yet" a process with no directory answers — the door has one
        // arm for both because a plugin has nothing different to do about them.
        reading: Effect.suspend(() =>
          opsLayer === null
            ? Effect.succeed(null)
            : Effect.catch(opsLayer.read, () => Effect.succeed(null))
        ),
        page: (request: unknown) =>
          Effect.suspend(() =>
            opsLayer === null
              ? Effect.fail(NOWHERE_TO_WRITE)
              : opsLayer.page(request as PageRequest)
          ),
        prop: (write: PropWrite) =>
          Effect.suspend(() =>
            opsLayer === null
              ? Effect.fail(NOWHERE_TO_WRITE)
              // A KEYSTROKE HAS NO SESSION, and neither does this: the gesture
              // is a person's in the panel, so the write is recorded under this
              // face's own writer and is fenced by nothing. A session's own
              // writes reach the gate through the MCP face and its ticket.
              : Effect.asVoid(opsLayer.run(
                { op: "prop", id: write.node, key: write.key, value: write.value },
                "web",
              ))
          ),
        document: (file: string) =>
          Effect.suspend(() =>
            opsLayer === null
              ? Effect.fail(NOWHERE_TO_WRITE)
              : Effect.asVoid(opsLayer.run({ op: "create-doc", file }, "web"))
          ),
      },
      // WHERE EACH ROW SITS IN THIS BUILD'S OWN LIST, handed over as the function
      // `@olai/bundle` already exports rather than as the list itself: a plugin
      // that owns a table a person reads has to be able to order it, and nothing
      // here should hand a plugin the ability to enumerate its siblings.
      rank: bundleRank,
      // NO `doorFor`, and its absence is this lane: where a doorbell may
      // deliver is a promise the CHAT ROW keeps, offered from its own `apply`
      // (`@olai/plugin-api`'s `Offers`). A serve composing no chat row composes
      // no `deliveries` at all, so kolu and odu sit `waiting` and the
      // preferences panel says on whose account — which is the paper's rule and
      // the ruling that took this phase.
      // ...and the small record a plugin keeps about this serve, in the state
      // home rather than the vault. Core owns the file and keys it by the calling
      // plugin; `./localState.ts` orders the writes so the last snapshot handed over is
      // the one that lands, and the service mints ONE door per plugin, which is
      // what makes that ordering true.
      localStateFor: (plugin) => localStateFor(plugin, served, (line) => say(Effect.logWarning(line))),
      changed: () => onChange.run(),
      // NO `dials`: the injectables are a test's, and this is the product.
    })
    yield* mountBundle(plugins.host, options.plugins ?? (PROFILES[profile].tenants ? null : []), gitConfigPatch(options.pin), {
      rows: profileRows(profile),
      resolve: async (name) => transportModules[name],
    })

    /**
     * The vault's own definitions mount on this host too. Open their manager
     * before the first report so there is one asynchronous reading of one
     * registry, including both shipped and approved definitions. Two reports
     * on different clocks made dynamic rows stick at their mounting state.
     *
     * Nothing is mounted until a revision supplies approved source. The full
     * built list is reserved here, including infrastructure ids: a vault may
     * not replace ws merely because its module is not a tenant package.
     */
    const dynamic = openDynamic(plugins.host, built)

    /**
     * WHAT BECAME OF EACH ROW, read once the bundle has settled — the word a
     * panel row wears when a plugin is not running, and the plugin's own
     * sentence when its start failed.
     *
     * A HELD READING rather than a live one, because the reading is
     * ASYNCHRONOUS — a failed fiber's error is private and reachable only by
     * awaiting it — and the roster is republished synchronously, from inside a
     * re-compose that a registry change drove. So it is re-read at every moment
     * a row can have moved, which is here, after activation and after a flip ({@link flipped}),
     * and `./runtime.ts` reads this holder through a thunk.
     *
     * `let` rather than a `Ref`, deliberately: it is written by exactly one
     * fiber (the flip, which the surface runs one call at a time) and read
     * synchronously by the roster, so a Ref would buy nothing but two more
     * `yield*` on a path that has no concurrency to protect against.
     */
    let report = yield* reportBundle(plugins.host, [...TRANSPORT_ROWS, ...dynamic.names()])

    /**
     * WHICH ROWS A PERSON HAS TURNED OFF HERE — the third author of a row's
     * `disabled`, and the only one downstream of the patch cannot infer.
     *
     * A row's `disabled` has three authors and is ONE FIELD, which is what makes
     * a flip and a flag one mechanism — and is why nothing past it could tell a
     * press from the build's own default. Without this, a person who had just
     * switched kolu off was told by the panel that the BUILD ships it off, with
     * a flag to go and type. This is the only place that knows, because it is
     * where the press arrives (`./runtime.ts`'s `PluginRuntime.switched`).
     *
     * A `Set` rather than a `Ref` for {@link report}'s reason: one writer, on
     * one fiber, read synchronously by the roster.
     */
    const switched = new Set<string>()
    /** A flip belongs at the root, which holds both the host and bundle.
     * setRow settles the tenant bundle; the following settle includes the
     * infrastructure rows inserted by this profile. Only then may runtime.ts
     * recompose and publish the report. A loading mcp row is not yet a working
     * endpoint, even when every tenant has already finished moving. */
    const flipped = (id: string, enabled: boolean) =>
      Effect.gen(function*() {
        const found = yield* setRow(plugins.host, id, enabled)
        yield* settled(plugins.host, built)
        report = yield* reportBundle(plugins.host, [...TRANSPORT_ROWS, ...dynamic.names()])
        if (found) {
          if (enabled) switched.delete(id)
          else switched.add(id)
        }
        return found
      })
    const kinds = yield* propKinds(plugins)
    const { root, store } = yield* openDirectory(served, kinds)

    /** The write gate outlives any provider row. Each operation reads the
     * current ledger offer, so stopping git also stops recording for callers
     * that held this Ops before the flip. The absent provider answers with
     * NO_LEDGER's refusal; it does not install a second ledger implementation. */
    const ledger: OpsLedger = {
      wrote: (writer) => currentLedger().wrote(writer),
      whyWaiting: (writer) => currentLedger().whyWaiting(writer),
      record: (request, writer) => currentLedger().record(request, writer),
      get push() {
        return currentLedger().push
      },
      get resume() {
        return currentLedger().resume
      },
    }
    const currentLedger = (): OpsLedger =>
      (offered(plugins.host, Ledger) as OpsLedger | undefined) ?? NO_LEDGER

    /**
     * THE MATCHER, ASKED PER QUERY — the ledger's arrangement one door over, and
     * for the same reason: an `Ops` is built once and a row is mounted, unmounted
     * and mounted again while it lives. So this is a thin door that reads the
     * offer table at the moment of the ask; a serve whose `search` row is off,
     * or has not mounted yet, answers with {@link NO_SEARCH} — no hits and the
     * reason, in words, at all five doors onto search at once.
     *
     * THE CAST IS THE SEAM, and this is the one file that holds both spellings:
     * the tag's payloads are `unknown` because `@olai/plugin-api` may not import
     * the floor, and `@olai/ops`' `Search` is the same door with the floor's own
     * types on it. A drift between them is a type error here.
     *
     * THE THREE OF THESE ARE NOT FACTORED INTO ONE, and that is a decision
     * rather than an oversight — the volatility lens asks for it and the
     * decomposition lens refuses. What they share is a SHAPE, not a concept:
     * each reads a different key, falls back to a different sentence, and — the
     * part a helper would eat — spends its own cast between a tag whose payloads
     * are `unknown` and the typed twin the layer that consumes it declares.
     * That cast is checked here, per door, against a type only this file has
     * both halves of; a `standing(key, nobody)` generic over the fallback erases
     * exactly the check and leaves three `as never`s where three checked casts
     * were. Similar is not complected, and three lines that a compiler will
     * point at one by one are cheaper than an abstraction that stops it looking.
     */
    const search: OpsSearch = {
      nodes: (ask) => currentSearch().nodes(ask),
    }
    const currentSearch = (): OpsSearch =>
      (offered(plugins.host, Search) as OpsSearch | undefined) ?? NO_SEARCH

    /**
     * WHO IS LOOKING, asked of the roster as it stands — the identity row's
     * reading, or {@link NOBODY}.
     *
     * The same shape the ledger above has, and for the same reason: a door
     * core DEFINES, a row STANDS BEHIND, and a serve that composed no such
     * row answers honestly rather than through a stand-in that invents
     * something. What "honestly" is here is the state a loopback serve with
     * no proxy in front has always been in — every request is nobody — so
     * there is nothing for the absent arm to say that the present one does
     * not already say every day.
     *
     * Read PER CALL by the READING below, so a flip at the plugins panel
     * reaches the next request; read ONCE at the bind for the header
     * allowlist, which is the seam and is spelled at the `listen` call
     * where it is spent rather than hidden in a thunk.
     */
    const currentIdentity = (): Identity =>
      (offered(plugins.host, Identity) as Identity | undefined) ?? NOBODY

    /** ...and the one thing the three readers share, minted once over that
     *  door: headers in, a person or nobody out (`./identity.ts`). Nothing
     *  downstream is handed the door itself — the names are the bind's and
     *  the reading is everyone's. */
    const who = readingOf(currentIdentity)

    const ops: Ops = makeOps({
      store,
      root,
      ledger,
      search,
      // The write gate and the store judge against the same vocabulary.
      kinds,
      // Refusal is a write fact, so every face reports through this hook;
      // keeping it on MCP would omit refusals from the browser's own writes.
      onRefusal: (request, failure) => plugins.refused({ op: request.op, failure }),
    })
    opsLayer = ops
    /** Minted once for the serve: app.get and the install manifest must name
     * the same machine even if the host is renamed underneath us. The start
     * instant is process start rather than this function's return, so the
     * uptime chip reports the lifetime of the answering process. */
    const theMachine = hostname()
    const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString()
    /** The surface and its exposure maps are composed together. Handing a
     * listener a group from one generation and a face from another is a gate
     * failure, not a way to partially serve a roster. Both transports consume
     * this same binding; their maps decide which vocabulary each may reach.
     * The root chooses writers: web for a button, chat-agent for MCP below. */
    const wired = yield* bind({
      store,
      ops,
      writer: "web",
      hostname: theMachine,
      startedAt,
      plugins: {
        plugins,
        onChange,
        built,
        pinned: options.plugins,
        report: () => report,
        names: () => rowsNaming(plugins.host, TRANSPORT_ROWS),
        configs: () => configsOf(plugins.host),
        set: flipped,
        reread: Effect.gen(function*() {
          report = yield* reportBundle(plugins.host, [...TRANSPORT_ROWS, ...dynamic.names()])
        }),
        switched: () => switched,
        dynamic,
      },
    })
    /**
     * The root owns the composed runtime; transports only borrow its group
     * and handlers. Register its close before the row drain, so reverse scope
     * order unloads rows while the surface and store still answer releases.
     *
     * The transport coordinator is acquired next. Its stop is also registered
     * after the service provision below: it must stop accepting before that
     * provision is revoked, or the resulting row unloads would keep asking an
     * active coordinator to rebuild the listener during process shutdown.
     */
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))
    yield* Effect.addFinalizer(() => plugins.close)
    /** The shared port is acquired only once the rows have registered their
     * choices. Its websocket and shell options are bind-time facts; MCP is a
     * request-time source so stopping that row leaves the control socket up.
     * The identity header allowlist is likewise read once here, while who is
     * asked per request. A later identity flip cannot renegotiate the names
     * trusted by an existing listener (the Phase 14a seam).
     *
     * Resync waits for ops to become idle before forcing a disk refresh: a
     * probe among staged temporary files would read a partially applied write.
     * It is the explicit, publishing refresh; ordinary MCP reads below use
     * the cheaper independent verification path instead.
     */
    const transports = yield* transportListener({
      ...options,
      bound: wired.bound,
      expose: () => wired.faces.browser,
      hostname: theMachine,
      upgradeHeaders: currentIdentity().headers,
      who,
      mcp: mcp.route(who),
      resync: Effect.andThen(ops.idle, store.refresh("verified")),
      plugins: dynamic,
    })
    /**
     * The bundle came first; this provision now wakes its transport fibers.
     * A transport needs the composed surface, not the authority to bind a
     * second store or mount arbitrary tenants. The door gives each row only
     * the scoped acquisition it installs over this serve.
     *
     * ws and web-app register choices because the framework binds their one
     * listener together. mcp has a second lifetime of its own: the protocol
     * server, waiters and session-ticket table. Its Effect runs on that row's
     * scope, so an off/on cycle gets a fresh protocol server. The coordinator
     * owns the shared port, and no row can close another row's endpoint merely
     * by disposing its own server. transports.ts owns that reconciliation.
     */
    yield* provide(plugins.host, TransportSurface, () => ({
      register: transports.register,
      mcp: mcp.serve({
        bound: wired.bound,
        face: wired.faces.agent,
        ops,
        root,
        writer: "chat-agent",
        // Verified READ, not REFRESH: a tool read must remain independent of
        // the publish-loop permit, so a wedged loop is observable as stale
        // vintage rather than hanging the diagnostic tool too. Refresh would
        // also reread and republish every file on every tool read. A verified
        // read checks stamps; it cannot detect a rewrite that preserved both
        // length and mtime. /olai/resync is the explicit stronger operation.
        vintage: Effect.map(store.read("verified"), (aged) => aged.vintage),
      }),
    }))
    yield* Effect.addFinalizer(() => transports.stop)
    // Wait for both the rows and their protocol acquisitions before publishing
    // readiness. Binding earlier could hand a newly spawned session a port
    // whose mcp row was still loading.
    yield* settled(plugins.host, built)
    report = yield* reportBundle(plugins.host, [...TRANSPORT_ROWS, ...dynamic.names()])
    onChange.run()
    const url = yield* transports.start
    // A deliberate close must be marked before any finalizer reaches the
    // runtime; otherwise watchFault would report our own shutdown as damage.
    yield* Effect.addFinalizer(() => runtime.stopped)

    if (url && !LOOPBACK.has(options.host)) {
      yield* Effect.annotateLogs(
        Effect.logWarning(
          "bound off loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline here, and edit them",
        ),
        { host: options.host },
      )
    }

    /** Complete the once-only address only after listen returned the OS's
     * answer, including a busy-port fallback. The name and bearer come from
     * the endpoint shared with the row; a session must not guess either one.
     * No transport means no address and no agent started against a fiction. */
    if (url) yield* Deferred.succeed(toolsReady, mcp.address(url))

    return runtime.faulted
  })

const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"])

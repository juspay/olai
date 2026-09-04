/**
 * One directory, read and served.
 *
 * This is the composition root, and it should read as one: a store over the
 * directory, the ops layer over the store, an internal MCP server over the ops,
 * an agent handed that server, the surface bound to both, a listener in front.
 * Each of those lives in its own file with its own reason to change; what is
 * left here is the ORDER they go in, and the one thing that is genuinely this
 * layer's business — the warning you get for binding somewhere the world can
 * reach.
 *
 * The order is not arbitrary. The chat is built before the surface because the
 * surface's transcript collection is seeded from it; the surface is what the
 * chat publishes through, so its publishers are handed back and installed once
 * it exists. Nothing publishes in between: the agent is not started until the
 * listener is up.
 *
 * It says what it is doing through Effect's own logging rather than a `log`
 * callback a caller passes in — see `@olai/log`. Two settings are established
 * here and inherited by everything below, including fibers the store and the
 * agent fork for themselves: the `root` annotation (`./directory.ts`, which
 * owns the reason it has to be set before the store is opened) and the `serve`
 * log span, so every line says how far into this serve it was emitted.
 */

import { surface } from "@olai/surface"
import { type GitPin, type PageRequest } from "@olai/format"
import type { IdentityConfig } from "@olai/identity"
import { make as makeOps, NO_LEDGER, type Ledger as OpsLedger, type Ops, TOOLS } from "@olai/ops"
import {
  BUNDLE_NAMES,
  configsOf,
  mountBundle,
  offered,
  reportBundle,
  rowsNaming,
  setRow,
} from "@olai/bundle/bundle"
import { bundleRank } from "@olai/bundle"
import { emitter } from "@olai/log"
import {
  Ledger,
  NOWHERE_TO_WRITE,
  openPlugins,
  type PropWrite,
  type ToolServer,
} from "@olai/plugin-api/services"
import { Deferred, Effect } from "effect"
import { randomBytes } from "node:crypto"
import { resolve } from "node:path"

import { localStateFor } from "./localState.ts"
import { saveSettings as persistSettings } from "./settings.ts"
import { openDirectory } from "./directory.ts"
import { openDynamic } from "./dynamic/runtime.ts"
import { pluginChunks } from "./dynamic/route.ts"
import { propKinds } from "./propKinds.ts"
import { watchFault } from "./fault.ts"
import { hostname } from "./hostname.ts"
import { listen } from "./listener.ts"
import { clientOver, serveFace } from "./mcp/face.ts"
import { currentLogin, MCP_PATH, mcpTransport } from "./mcp/route.ts"
import { ticketing, type Tickets } from "./mcp/tickets.ts"
import { bespokeFrom, pluginTools } from "./mcp/tools.ts"
import { gitConfigPatch } from "./gitPolicy.ts"
import { bind, writerAt } from "./runtime.ts"

export interface ServeOptions {
  /** The directory to serve, recursively. */
  readonly root: string
  readonly port: number
  readonly host: string
  /** The built browser bundle. A nix-built binary is pointed at the bundle
   *  derivation; the dev loop points at the tree it just built. */
  readonly clientDist: string
  /** Browser origins allowed to open the websocket, beyond same-origin. */
  readonly allowedOrigins: ReadonlyArray<string>
  /** What this server trusts for who is looking, and how it pictures them
   *  — the header names plus the avatar template (`@olai/identity`).
   *  Read from the environment at the composition root, once. */
  readonly identity: IdentityConfig
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
    /** The re-compose, filled in by `bind` — `./runtime.ts`'s `PluginRuntime`
     *  argues why it is a holder rather than a callback passed here. */
    const onChange = { run: (): void => {} }
    /** Minted per process and handed only to the sessions a row spawns: the
     *  write surface is not something any page that can reach loopback may
     *  call. */
    const token = randomBytes(24).toString("hex")
    /** THE FENCED CREDENTIAL MINT, filled once the MCP face exists — see the
     *  line beside `ticketing` below. `null` until then, which the door hands
     *  a plugin verbatim: a session spawned before the listener bound has
     *  nothing to be fenced against, and inventing a bearer for it would be a
     *  credential onto a face that does not exist yet. */
    let mintTicket: Tickets["mint"] | null = null
    /** THE WRITE GATE, filled the moment it is built. Held rather than passed,
     *  because the plugin runtime is opened BEFORE the store the layer is over —
     *  the vocabulary a store validates with is what the rows contribute — so
     *  the door a row names is asked per call. */
    let opsLayer: Ops | null = null
    /** WHERE A RELATIVE PATH RESOLVES FROM, resolved the way `openDirectory`
     *  resolves it and BEFORE it, because the plugin runtime is opened first.
     *  One spelling of `resolve` in two places is a hazard; two answers to which
     *  directory this serve is about is a worse one, and `./directory.ts` is
     *  handed the same string. */
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
     * THE VAULT'S OWN MCP SERVER, PROMISED HERE AND ADDRESSED AT THE BOTTOM.
     *
     * A `Deferred` and not a mutable slot, because the two facts about this
     * address are "not knowable until `listen` returns" and "knowable exactly
     * once", and that is what a Deferred is. `let tools` below is the mutable
     * slot, and it survives only because the chat this file still builds reads it
     * through a thunk it was handed before either existed.
     *
     * MADE BEFORE `openPlugins` because the SERVICE has to stand before any row
     * is mounted: a plugin naming a key nobody has provided sits PENDING, and the
     * vocabulary is read two statements after `mountBundle` — so a `tools` that
     * only appeared down there would leave a tenant's property kind out of the
     * store's codec for the life of the process, silently. Provided early,
     * completed late.
     */
    const toolsReady = yield* Deferred.make<ToolServer>()
    /**
     * THE PLUGIN RUNTIME, OPENED — before the store, before the chat, before
     * anything reads a file.
     *
     * ## Why this is the first thing that happens
     *
     * A plugin teaches the vault its VOCABULARY, and the store validates through
     * it ({@link ./propKinds.ts}): a codec built without it would judge the
     * boot's own load against a vocabulary that has never heard of a terminal,
     * and every value under a contributed kind would be text until something
     * re-validated. That ordering was already here — `propKinds` ran first — and
     * what changed is where the words come from. They used to be a static field
     * on a compiled-in list; they are registrations a mounted plugin makes, so
     * the plugins have to be up.
     *
     * Nothing in an `apply` touches the disk or dials anything: each half is MADE
     * eagerly and STARTED lazily, and starting is a cell's connector, which the
     * framework runs when the surface binds. So mounting here costs the import of
     * two modules and a handful of `Map.set`s.
     *
     * ## The ONE place a process reaches for the real world
     *
     * This is it, which is the rule every seam in this tree is built on: a plugin
     * that read `process.env` or called `new Date()` would be a plugin a test
     * cannot drive. What changed is only that the values arrive once, at the
     * runtime, instead of once per plugin — and that the KEYED ones (the
     * doorbell's door, the machine-local record, a test's injectable dial) are
     * minted from the CALLING PLUGIN'S OWN WORD inside the service rather than
     * from a name a composition root closed over.
     *
     * ## No `Effect.promise`, and no callbacks back out
     *
     * Both are the phase. Opening the runtime and mounting the bundle are
     * Effects; every service a plugin names is an Effect service; and the two log
     * channels that used to be `ring(Effect.logDebug(line))` callbacks on a `Log`
     * service are Effect's own logger, reached by the plugin from inside its own
     * fiber. The one bridge that survives is the chat's `deliver`, which is an
     * Effect a plugin now `yield*`s rather than a promise core forks for it.
     *
     * THERE IS ALWAYS A RUNTIME HERE, and `--plugins=` is not the exception:
     * saying NONE out loud is every row patched `disabled`, so the services stand
     * and nothing mounts into them, which is exactly the state the roster has to
     * be able to draw. The face that composes no runtime at all is the one that
     * never calls this function — `olai surface`, the headless faces, every test
     * in this package — and it passes `null` to `bind` directly.
     */
    const plugins = yield* openPlugins({
      vars: process.env,
      now: () => new Date().toISOString(),
      served,
      tools: toolsReady,
      // ...AND THE FENCE MINTED OFF IT. Read per call rather than captured,
      // because the mint does not exist until the MCP face does — and the row
      // that seats sessions is mounted long before that.
      ticketFor: (seated, above) => mintTicket?.(seated, above) ?? null,
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
      saveSettings: (plugin, overlay) =>
        Effect.suspend(() =>
          opsLayer === null
            ? Effect.fail(NOWHERE_TO_WRITE)
            : persistSettings(opsLayer, "web")(plugin, overlay)
        ),
      changed: () => onChange.run(),
      // NO `dials`: the injectables are a test's, and this is the product.
    })
    yield* mountBundle(plugins.host, options.plugins, gitConfigPatch(options.pin))
    /**
     * THE PLUGINS THIS VAULT ITSELF DEFINES — phase 12
     * ([dynamic-plugins.md](../../../docs/dynamic-plugins.md)).
     *
     * Opened HERE because this is where the host is: mounting a plugin nobody
     * compiled in is `mountPlugin` on the same registry the rows are on, and
     * that capability is the composition root's — a plugin holding a host could
     * mount a fiber under any word it liked (`@olai/plugin-api`'s `runtime.ts`
     * argues it at length). `BUNDLE_NAMES` is what a definition may NOT take.
     *
     * BEFORE THE REPORT, and that ordering is the one thing about this line
     * worth reading twice: a definition's fiber is on this host under its own
     * word, so it belongs in the SAME reading the bundle's rows are reported
     * from — and a second reading on a second clock is exactly what made a
     * definition's row stick at whatever it said when it mounted.
     *
     * It mounts NOTHING until a revision has been followed and a person has
     * approved a version, so at this point it names no rows and the reading
     * below is the bundle's alone.
     */
    const dynamic = openDynamic(plugins.host, BUNDLE_NAMES)
    /**
     * WHAT BECAME OF EACH ROW, read once the bundle has settled — the word a
     * panel row wears when a plugin is not running, and the plugin's own
     * sentence when its start failed.
     *
     * A HELD READING rather than a live one, because the reading is
     * ASYNCHRONOUS — a failed fiber's error is private and reachable only by
     * awaiting it — and the roster is republished synchronously, from inside a
     * re-compose that a registry change drove. So it is re-read at every moment
     * a row can have moved, which is here and after a flip ({@link flipped}),
     * and `./runtime.ts` reads this holder through a thunk.
     *
     * `let` rather than a `Ref`, deliberately: it is written by exactly one
     * fiber (the flip, which the surface runs one call at a time) and read
     * synchronously by the roster, so a Ref would buy nothing but two more
     * `yield*` on a path that has no concurrency to protect against.
     */
    let report = yield* reportBundle(plugins.host, dynamic.names())
    /**
     * ...AND THE FLIP, which is the only thing that can move it.
     *
     * `setRow` flips the loader's own `disabled` for that row and then settles
     * the WHOLE bundle — because what a flip is for is the rows around it —
     * so by the time this re-reads, every row that was going to unload or come
     * back has. `./runtime.ts` recomposes and republishes afterwards, and holds
     * the roster back while this runs.
     *
     * IT IS SPELLED HERE rather than in `./runtime.ts` for that file's own
     * fence: the composition root is where `@olai/bundle` and the host are both
     * in hand, and a runtime that could reach a loader would be a second package
     * that knows what the plugin runtime is written on.
     */
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
    const flipped = (id: string, enabled: boolean) =>
      Effect.gen(function*() {
        const found = yield* setRow(plugins.host, id, enabled)
        report = yield* reportBundle(plugins.host, dynamic.names())
        // ...AND WHO ASKED — see {@link switched}, declared above it.
        //
        // WRITTEN ONLY WHEN THE FLIP TOOK, so a refused press about a row this
        // build does not have leaves nothing behind. Cleared on the way back on,
        // rather than kept as a log: what a row says is about its state now, and
        // a row somebody switched off and then on again is simply running.
        if (found) {
          if (enabled) switched.delete(id)
          else switched.add(id)
        }
        return found
      })
    const kinds = yield* propKinds(plugins)
    const { root, store } = yield* openDirectory(options.root, kinds)

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

    const ops: Ops = makeOps({
      store,
      root,
      ledger,
      // THE SAME TABLE THE STORE VALIDATES WITH, so a value a page draws, a
      // value the validator reports and a value `set_prop` refuses are one
      // question asked three times. Two tables here would be the bug family
      // `@olai/format`'s `meaning.ts` is a list of, rebuilt at the root.
      kinds,
      // A refusal reaches the agent as its tool result AND whoever is watching
      // writes. On OPS rather than on the MCP server, because it is writes this
      // is a property of — a second writer would report nothing. What a plugin
      // makes of it is its own: the chat row draws a row in the transcript.
      onRefusal: (request, failure) => plugins.refused({ op: request.op, failure }),
    })
    // ...AND THE DOOR THE ROWS ASK THROUGH, filled the moment the layer exists.
    // See the holder above on why it is a slot rather than an argument.
    opsLayer = ops

    // The surface is bound to everything it reports on or writes through: the
    // store it reads, the chat it draws, what git is doing for the directory,
    // and the ops layer its edit procedures write through — the same one the
    // MCP face below hands the agent, because there is one writer.
    //
    // `web` is the writer for the button's door; the panel's agent reaches the
    // tools as `chat-agent` below. Which face a caller is, is decided HERE and
    // never claimed by a transport about itself. A keystroke is the same web
    // writer: it goes through the ops layer this line hands over.
    //
    // And the word the whole deployment is served AS: the machine's name,
    // read HERE and read ONCE — `app.get` answers it, the install manifest
    // was made of it at listen, and a box renamed under a running process
    // must not drift the two (`./hostname.ts` argues the mint being the
    // root's). The start instant is the other half of that same ask.
    const theMachine = hostname()
    // Process start, not serve() return: the chip in the header is how
    // long THIS process has been the one answering, and `process.uptime`
    // is that number. Minted here, once, so every `app.get` of this serve
    // answers the same instant.
    const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString()
    const wired = yield* bind({
      store,
      ops,
      writer: "web",
      hostname: theMachine,
      startedAt,

      // THE PLUGINS, already mounted — and this is no longer the place a
      // process reaches for the real environment on their behalf. That happens
      // at the top of this function, where the services are constructed, and
      // what crosses here is the runtime's own doors plus the two facts a
      // BROWSER has to be told: which plugins the build has, and whether
      // anybody typed the flag.
      //
      // `olai web` is the face every plugin's door is drawn on, so it is the
      // face that composes them; the headless and one-shot faces never call this
      // function and pass `null` to `bind` directly, carrying no
      // `surface/<name>/` on the wire at all — the true answer for a process
      // that has no business dialing somebody's daemon on its way to printing a
      // node.
      plugins: {
        plugins,
        onChange,
        built: BUNDLE_NAMES,
        pinned: options.plugins,
        // A THUNK over the holder above, so the roster is drawn from the last
        // reading rather than from the boot's — see it, and the flip beside it.
        report: () => report,
        // WHICH DOORS EACH ROW NAMES, live off the registry — one half of the
        // join that answers "what stops if I turn this off"; the other half is
        // the offers table, which the runtime reads through `Plugins`.
        names: () => rowsNaming(plugins.host),
        configs: () => configsOf(plugins.host),
        set: flipped,
        // ...AND THE SAME RE-READ WITHOUT A FLIP, for the movements a plugin the
        // vault defines makes: mounted on approval, disposed when its node goes,
        // replaced when its source is edited. Each of those puts a fiber on this
        // host and none of them is a press.
        reread: Effect.gen(function*() {
          report = yield* reportBundle(plugins.host, dynamic.names())
        }),
        switched: () => switched,
        // ...AND THE PLUGINS THIS VAULT ITSELF DEFINES (phase 12). It is opened
        // HERE because this is where the host is: mounting a plugin nobody
        // compiled in is `mountPlugin` on the same registry the rows are on, and
        // the capability to do that is the composition root's — a plugin
        // holding a host could mount a fiber under any word it liked
        // (`@olai/plugin-api`'s `runtime.ts` argues that at length).
        //
        // `BUNDLE_NAMES` is what it may NOT take: a definition claiming a word
        // this build already has is a fault rather than an override.
        dynamic,
      },
    })

    // A faulted runtime is unrecoverable structural damage, and telling that
    // apart from the ordinary settle of a shutdown is `fault.ts`'s whole job.
    const runtime = yield* watchFault(wired.bound)

    // This file built the runtime, so this file closes it. The listener takes
    // its `group` and its `handlers` and never its lifetime — a transport that
    // also closed it would be two owners of one thing — which is why the line
    // is here and not there. Registered BEFORE the listener so it runs AFTER
    // it: finalizers run in reverse, and every serving stack the listener
    // drains is answered by this runtime while it drains.
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))
    // Drain plugin scopes while the store and bound surface still exist.
    // The listener is acquired next, so it stops accepting calls first.
    yield* Effect.addFinalizer(() => plugins.close)

    // The agent's face onto this process: the same surface the browser reads,
    // plus the ops layer's tools, over the Streamable HTTP transport the route
    // below drives. ONE face rather than two projections of the ops layer —
    // which is the whole point of the surface-mcp adoption, and the reason the
    // hand-rolled dispatch this replaced is gone.
    const transport = mcpTransport()
    // Built ONCE and handed back on every ask: this face has no transport to
    // drop, so re-dialling would only re-run the gate over the same handlers.
    const panel = clientOver(
      {
        group: wired.bound.group,
        handlers: writerAt(wired.bound, ops, { writer: "chat-agent", fence: null }),
      },
      wired.faces.agent,
    )
    const tickets = ticketing({ bound: wired.bound, face: wired.faces.agent, ops, token })
    // ...AND THE MINT, HANDED TO WHOEVER HOLDS THE SESSIONS. What a bearer
    // stands for is asked per request of the plugin that seated the session —
    // its subtree, and the ancestor a refusal names — and the composition root
    // is the only thing that may compose a door out of the answer. It is filled
    // HERE, after the face exists, and reads `null` before that: a plugin that
    // spawned a session before the listener bound would be asking for a bearer
    // onto nothing.
    mintTicket = tickets.mint
    yield* serveFace({
      client: () => panel,
      /**
       * WHAT THIS FACE KNOWS ABOUT ITSELF: which directory it is serving, so
       * every answer names the vault it came from; who the request is, so a
       * capture through a reverse proxy is attributed to the person the proxy
       * named — and to nobody when it named nobody; and how current what it
       * serves is, at the class an agent's tool result deserves.
       *
       * THE CLASS IS `verified`, because an agent acts on what it reads: one
       * walk of the tree per read, taken outside the publish loop's permit, so
       * a wedged loop shows up as a stale vintage on the answer rather than as
       * an answer that looks fine.
       *
       * AND IT IS THE READ RATHER THAN THE LOOK, which is the one real choice
       * on this line and was argued on #406. `@olai/store` has two verbs at
       * that class: `read("verified")` checks the disk against the standing
       * answer and publishes nothing, and `refresh("verified")` forgets the
       * stamp table, re-reads every file and publishes what it finds. The
       * second is strictly stronger about BYTES — it is the only thing that
       * sees a rewrite which kept the length and put the mtime back — and it
       * is the wrong verb here, for three reasons that all point the same way:
       *
       *   - IT SITS BEHIND THE PERMIT. `refresh` takes the gate, so every
       *     agent read would wait on whatever the publish loop is doing — and
       *     a loop wedged behind a held permit would hang the tool calls
       *     outright. That is the exact condition the vintage exists to make
       *     legible, and the MCP face is the surface the 2026-08-25 incident
       *     was finally diagnosed through: a disk-vs-MCP diff of one node.
       *     Putting the diagnostic door behind the thing being diagnosed is
       *     the trade nobody would take twice. It would also stand the red
       *     line on its head — the verification path is the one thing all
       *     three seats signed must not share `cycle`'s permit.
       *   - IT PUBLISHES. A forget-and-re-read mints a revision every time,
       *     because every file comes back stale by construction. An agent
       *     working through a vault makes tens of reads a minute, and each
       *     would push a byte-identical frame to every open browser.
       *   - IT COSTS THE CORPUS. Every read tool call would re-read and
       *     re-validate every file in the directory. The debate specified the
       *     cheaper thing on purpose ("an independent stamp check against
       *     disk, no cycle permit needed"), and the read is that.
       *
       * WHAT THE READ THEREFORE CANNOT SAY is pinned rather than promised:
       * `Confirmed` is exactly as strong as a stamp, and a same-length rewrite
       * that restored the mtime reads `stale: false` over the old bytes
       * (`./mcp/tools.test.ts`'s "what `stale: false` is worth", and
       * `@olai/store`'s sibling pin). The caller who cannot take that trade
       * has the other verb, one route over: `POST /olai/resync` below is the
       * look, and it is where the one real-world producer of the invisible
       * shape — a harness putting a fixture back under a live server — already
       * knocks.
       */
      tools: {
        ...bespokeFrom(TOOLS, {
          login: currentLogin,
          root,
          vintage: Effect.map(store.read("verified"), (aged) => aged.vintage),
          fenced: tickets.doorAt,
          record: (request) => ops.commit(request, "chat-agent"),
          push: ops.push,
        }),
        // ...AND CORE'S OWN THREE, which are not operations on a vault and so
        // are not rows in the ops layer's table (`./mcp/tools.ts` argues where
        // they live). Without them the section of `docs/dynamic-plugins.md`
        // written FOR a node agent named three verbs no node agent could call.
        ...pluginTools(),
      },
      transport,
    })

    // Port 0 asks the OS every boot.
    const url = yield* Effect.onError(
      listen({
        ...options,
        bound: wired.bound,
        // The face for the group on the line above, from the one call that
        // composed both (`./runtime.ts`'s `bind`) — a second reading of which
        // plugins are on is the boot refusal `restrictHandlers` exists to raise.
        expose: () => wired.faces.browser,
        hostname: theMachine,
        mcp: { transport, token, identity: options.identity },
        // `POST /olai/resync` — force a re-read of the disk. Waits for
        // in-flight writes first (`ops.idle`): a probe while a `run` is
        // still staging is a look at `.olai-*.tmp`, not at the tree the
        // next reader will be served. Then the store's one look verb, at the
        // class this door exists for: `verified` is "a look nobody may be
        // entitled to see nothing from", and what it costs to be that is the
        // store's business rather than this line's.
        // Nothing about it is on the surface: no tab draws it and no agent
        // calls it. It is for the case the watcher cannot see, which is a
        // change made where no inotify reaches.
        resync: Effect.andThen(ops.idle, store.refresh("verified")),
        // `GET /_olai/plugins/<name>-<version>.js` — the browser half of a
        // plugin this vault defines, compiled by this serve. The tab loads it
        // exactly as it loads a compiled-in plugin's chunk; what differs is that
        // its source did not exist when the bundle was built.
        plugins: dynamic,
      }),
      () => runtime.stopped,
    )
    // Registered AFTER the listener's own, so it runs BEFORE it: finalizers
    // run in reverse, and this one has to be true by the time anything starts
    // closing the runtime.
    yield* Effect.addFinalizer(() => runtime.stopped)

    yield* Effect.annotateLogs(Effect.logInfo("serving"), { url })
    if (!LOOPBACK.has(options.host)) {
      yield* Effect.annotateLogs(
        Effect.logWarning(
          "bound off loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline here, and edit them",
        ),
        { host: options.host },
      )
    }

    /**
     * THE ADDRESS, now that we know what we bound — and the promise made before
     * `openPlugins` kept.
     *
     * TOLD UNCONDITIONALLY, and deliberately not from inside the `chat !== null`
     * arm below. Whether THIS process has an ACP agent is a fact about the
     * machine; whether the vault's own tools are reachable is a fact about the
     * SERVE, and a plugin waiting on the second must not be held for ever by the
     * first. The chat's own slot is still filled below, out of the same value, so
     * the name a session is handed and the name a plugin is handed cannot drift.
     *
     * `name: "olai"` is load-bearing beyond this line: every engine's auto-allow
     * prefix is built from it (`@olai/acp`'s `leg.ts`), so a machine where this
     * word changed is a machine where a person approves every write olai makes.
     */
    const address: ToolServer = { name: "olai", url: `${url}${MCP_PATH}`, token }
    // ...AND THAT IS THE WHOLE OF THE BOOT CONVERSATION'S ORDER NOW. It was
    // fourteen lines here — detect the roster, build the chat, hold its stop,
    // start it, and say what was found — and every one of them is
    // `olai-plugin-chat`'s. What core has left is this settle: the row's own
    // `apply` awaits `Tools.server`, which is what "the surface is bound and
    // only then is the agent started" became when it stopped being a comment
    // guarded by a loud throw.
    yield* Deferred.succeed(toolsReady, address)

    return runtime.faulted
  }).pipe(Effect.withLogSpan("serve"))

const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"])

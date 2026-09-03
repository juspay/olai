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
import { roster, whyNoAgent } from "@olai/chat"
import { AGENT_PROP, type GitPin } from "@olai/format"
import type { IdentityConfig } from "@olai/identity"
import { fixedPolicy, make as makeOps, TOOLS } from "@olai/ops"
import { BUNDLE_NAMES, mountBundle, reportBundle } from "@olai/bundle/bundle"
import { emitter } from "@olai/log"
import { openPlugins } from "@olai/plugin-api/services"
import { Effect, SubscriptionRef } from "effect"
import { randomBytes } from "node:crypto"
import { resolve } from "node:path"

import * as Chat from "@olai/chat"
import { roster as agentsRoster } from "./agents.ts"
import { heldFor } from "./held.ts"
import { openDirectory } from "./directory.ts"
import { propKinds } from "./propKinds.ts"
import { watchFault } from "./fault.ts"
import { hostname } from "./hostname.ts"
import { listen } from "./listener.ts"
import { clientOver, serveFace } from "./mcp/face.ts"
import { currentLogin, MCP_PATH, mcpTransport } from "./mcp/route.ts"
import { ticketing } from "./mcp/tickets.ts"
import { bespokeFrom } from "./mcp/tools.ts"
import { enginesAt } from "./engines.ts"
import { askingAt } from "./probes.ts"
import { bind, gitWiring, type Publishers, writerAt } from "./runtime.ts"

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
  /** The git policy this serve runs under, as the operator PINNED it —
   *  `--commit=off | manual | auto` and `--push=off | auto`, each `null` when
   *  the flag was not given (`@olai/format`'s `GitPin`). What the server DOES
   *  is that composed with the built-in defaults (`@olai/ops`' `fixedPolicy`);
   *  what every browser draws read-only is the instance's policy. */
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
    /** THE CHAT, built further down and `null` forever on a machine with no ACP
     *  agent. It is declared UP HERE because two things below reach for it out
     *  of order: the delivery door is asked for per call, and the refusal
     *  observer is installed on the ops layer, which is built before the chat
     *  that draws its refusals. */
    let chat: Chat.Chat | null = null
    /** The re-compose, filled in by `bind` — `./runtime.ts`'s `PluginRuntime`
     *  argues why it is a holder rather than a callback passed here. */
    const onChange = { run: (): void => {} }
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
     * `./held.ts` orders a plugin's writes on a promise chain, because the
     * ordering is the point and a fire-and-forget save must not wait on a disk. A
     * write that fails there has no fiber under it, which is the exact position
     * `@olai/log`'s `emit.ts` was written for: without this the line would be
     * emitted against the defaults and escape an `OLAI_LOG_LEVEL` the operator
     * typed. It is core's own file and core's own failure — no plugin service
     * carries a callback any more.
     */
    const say = yield* emitter
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
      // The chat is built further down and a machine with no ACP agent never
      // builds one at all, so the door is asked for per call rather than
      // captured — which is also what makes a plugin that unloads and comes back
      // get the door that is live rather than the one that was.
      //
      // The KEYING is not this line's: the service mints a plugin's door from
      // the word the registry bound it under, so what this does is hand over the
      // chat's own door for the name it was asked about and nothing else.
      doorFor: (plugin) => chat?.doorFor(plugin) ?? null,
      // ...and the small record a plugin keeps about this serve, in the state
      // home rather than the vault. Core owns the file and keys it by the calling
      // plugin; `./held.ts` orders the writes so the last snapshot handed over is
      // the one that lands, and the service mints ONE door per plugin, which is
      // what makes that ordering true.
      heldFor: (plugin) => heldFor(plugin, served, (line) => say(Effect.logWarning(line))),
      changed: () => onChange.run(),
      // NO `dials`: the injectables are a test's, and this is the product.
    })
    yield* mountBundle(plugins.host, options.plugins)
    // WHAT BECAME OF EACH ROW, read once the bundle has settled — the word a
    // preferences row wears when a plugin is not running, and the plugin's own
    // sentence when its start failed. A snapshot rather than a live read because
    // a failed fiber's error is private and reachable only by awaiting it;
    // `./runtime.ts`'s `PluginRuntime.report` argues why that is honest in this
    // phase and names the phase it stops being.
    const report = yield* reportBundle(plugins.host)
    const kinds = yield* propKinds(plugins)
    const { root, store } = yield* openDirectory(options.root, kinds)

    // The chat publishes through the surface, and the surface is seeded from
    // the chat. One mutable slot resolves that, and it is safe because nothing
    // publishes before `bind` returns: the agent is started at the very end.
    let publish: Publishers | null = null

    /**
     * The publishers, ONCE THEY EXIST — and a loud stop if they do not.
     *
     * The reads used to be `publish?.state(…)`, which is the invariant above
     * spelled as a shrug: if it ever stopped holding, the optional chain threw
     * the event away and said nothing, and what a person would see is a
     * transcript missing a row or a header stuck on the state before last,
     * forever, with a green pill over it.
     *
     * A throw rather than a buffer, because there is nothing here to buffer
     * FOR: the order in this file is fixed and deliberate (the chat is built,
     * the surface is bound, and only then is the agent started), so an event
     * arriving early is a mistake in that order and not a race to smooth over.
     * A buffered slot would make the mistake survivable and therefore
     * permanent. This one fails at boot, on a developer's machine, naming
     * itself.
     */
    const publishing = (): Publishers => {
      if (publish === null) {
        throw new Error(
          "olai serve: something published before the surface was bound — the " +
            "order in serve.ts is chat, then bind, then start the agent",
        )
      }
      return publish
    }

    // Bumped whenever anything about git settled — a commit by whichever door
    // (the button, the agent's tool, the quiet window), a push, a refusal of
    // either, or the loop stopping. None of them moves a served file, so
    // nothing else in this process can say that what a reader is owed has
    // changed.
    const settled = yield* SubscriptionRef.make(0)

    /** WHAT THIS DIRECTORY'S GIT POLICY IS: the flags plus the built-in
     *  defaults. Immutable after boot. Built before the ops layer, because
     *  that layer asks it on every decision it makes. */
    const policy = fixedPolicy(options.pin)

    const ops = makeOps({
      store,
      root,
      policy,
      // THE SAME TABLE THE STORE VALIDATES WITH, so a value a page draws, a
      // value the validator reports and a value `set_prop` refuses are one
      // question asked three times. Two tables here would be the bug family
      // `@olai/format`'s `meaning.ts` is a list of, rebuilt at the root.
      kinds,
      onSettled: () => {
        Effect.runSync(SubscriptionRef.update(settled, (count) => count + 1))
      },
      // A refusal reaches the agent as its tool result AND the panel as a row:
      // what the agent then says about it is prose, and the unfinished
      // children are data. On OPS rather than on the MCP server, because it is
      // writes this is a property of — a second writer would report nothing.
      onRefusal: (request, failure) =>
        chat === null ? Effect.void : chat.recordRefusal(request.op, failure),
    })

    // WHICH ENGINES this build has, in the bundle's own order — the registry
    // the engine plugins wrote themselves into, sorted against `olai.yml`
    // ({@link ./engines.ts} says why the sort is not optional). It used to be a
    // hardcoded table inside `@olai/chat`; each engine is a plugin now, so this
    // is a reading of what mounted rather than a list anybody keeps.
    const engines = enginesAt(plugins)
    // ...and WHICH OF THEM THIS MACHINE HAS, once, before anything is spawned:
    // each engine's own probe, plus the off switch `OLAI_ACP_AGENT` is when it
    // is empty (`@olai/chat`'s `agents/roster.ts`, which owns that rule and the
    // search path). Nothing found is the state the panel has a face for — it
    // draws, and says how to install one, out of each engine's own sentence —
    // so it is a line in the log and never a refusal to serve.
    // ...ONE ANSWER WITH THE REASON ON THE ARM. A serve with no agent has one
    // of three causes and only this end can tell them apart, so the roster
    // hands over which — spent twice and never re-derived: the journal line
    // here, and the chat cell the panel draws its opening sentence out of
    // (`bind`'s `noAgent`, below). A screen and a journal disagreeing about one
    // boot is how a person ends up debugging the wrong thing.
    const found = roster(root, engines)
    const installed = found.kind === "here" ? found.installed : []
    const noAgent = found.kind === "none" ? found.because : null
    if (noAgent !== null) yield* Effect.logInfo(whyNoAgent(noAgent))

    // Minted per process and handed only to the session we spawn: the write
    // surface is not something any page that can reach loopback may call.
    const token = randomBytes(24).toString("hex")
    let mintNodeTicket: ((node: string) => Chat.ToolTicket) | null = null
    /** Filled once the listener has bound — see the thunk on the chat's
     *  options. Until then there is no session to hand it to. */
    let tools: Chat.ToolServer | null = null
    /** THE VAULT'S HALF OF THE AGENTS ROSTER, held here because two things
     *  read it and they are built at different moments: the chat's teaching,
     *  through the thunk below, and the runtime's own cell, which is also what
     *  keeps it current ({@link ./agents.ts}). */
    const nodeAgents = agentsRoster()

    chat = installed.length === 0 ? null : yield* Chat.make({
      roster: installed,
      // ...AND EVERY ENGINE ROW THIS BUILD HAS, by id, in order — read for one
      // thing only: which agent a note that names none is about. What a person
      // is TOLD about an engine this machine has not installed is that engine's
      // own face in the tab, hung by its browser half.
      engines: engines.map((one) => one.id),
      cwd: root,
      tools: () => tools,
      /**
       * ...AND WHATEVER ELSE THIS HOST IS RUNNING, asked once per conversation
       * — the `chat/session-start` registrations, read here.
       *
       * The one place the two halves meet: `@olai/chat` declares the SHAPE of
       * the question — is your tool here, and what am I owed if it is not — and
       * each plugin answers it in its own package, in its own words. This line
       * is where a drift between the two spellings is a type error, which is why
       * neither of them imports the other.
       *
       * ## A THUNK, and the reason is that the list can move
       *
       * It used to be a list built once at boot: `probesOf(enabled(SERVERS,
       * pin), env)`, filtered by the flag, held for the life of the process.
       * That was exact while the set could not change. A plugin is a fiber now,
       * so the list is read PER SESSION OPEN off the registry the plugins
       * registered themselves into — a plugin that unloaded between
       * conversations contributes nothing to the next one, and nobody keeps a
       * second list for it to fall out of step with.
       *
       * ## What each plugin registers, and what it does NOT
       *
       * The ASKING, not an answer. The scheduling stays `@olai/chat`'s, which is
       * load-bearing rather than tidy: a probe starts a subprocess on the
       * session-open path, and running them one after another would multiply
       * that window by the number of plugins — the same defect the bound exists
       * to prevent, wearing a different shape. `Probed`'s two halves still come
       * off ONE reading, which is the invariant `probe()` existed to hold.
       *
       * AND NO PLUGIN SIGNS ITS NAME HERE any more: the door is keyed by the
       * fiber like every other one, so what a plugin hands over is one Effect
       * and there is no parameter to put a name in.
       *
       * NO FILTER BY THE PIN, and its absence is the phase: a plugin left out of
       * `--plugins` has no fiber, so it registered nothing, so it never probes — which is what the registry always claimed an absent
       * plugin meant, now true by construction rather than by a `.filter`.
       *
       * The ENVIRONMENT is not read here either. It is `ctx.env.vars`, on the
       * service, reached by the plugin that asks — a composition root is still
       * where a process reaches for the real environment (one screen up, where
       * `Env` is constructed), and a probe still sees what a session's own spawn
       * will resolve against.
       *
       * ## The ORDER is `./probes.ts`'s, and it had to be taken off this line
       *
       * The dispatch was written out here, handing back the array the listeners
       * had pushed onto — which is registration order, which is the order two
       * dynamic imports resolved in, which is nothing a person can read twice.
       * A conversation SHOWS that order, so the same serve reported its servers
       * one way at boot and the other way at the next. `askingAt` imposes the
       * build's own list on it; that file argues why the knowledge lives there.
       */
      probes: () => askingAt(plugins),
      /**
       * ... AND WHICH CONVERSATIONS SOMEBODY POINTED A PLUGIN'S DOORBELL AT.
       *
       * Built HERE, beside the chat, because `root` is in hand and a
       * `StateFailure` can be answered — the record is read once, at boot, and a
       * directory whose picks will not read comes up with its doorbells off and
       * one warning rather than not at all.
       *
       * NOT in `bind`: that call's error channel is `never`, and the served
       * directory only exists inside its nullable plugins block, while the
       * member that writes a pick is on every face it binds.
       *
       * INSIDE THIS TERNARY, so a machine with no ACP agent on PATH builds no
       * store at all — no read, no write, and no way for a boot without an agent
       * to touch somebody's picks. The empty-roster arm is `null` all the way
       * down.
       */
      scoping: yield* Chat.scopesIn(root),
      /**
       * ... AND WHAT OLAI HAS OVERHEARD EACH CONVERSATION DO.
       *
       * Built here for the picks' reason above, word for word: `root` is in
       * hand, the record is read once at boot, and a directory whose record
       * will not read comes up teaching each node agent its contract once more
       * and one warning rather than not at all. Inside the same ternary, so a
       * machine with no ACP agent opens nobody's record.
       */
      overheard: yield* Chat.sessionsIn(root),
      /**
       * ... and WHOSE NODE AGENT a conversation is, which is what tells the
       * panel there is a contract to teach at all ({@link ./agents.ts}).
       *
       * A THUNK OVER A CARRIER, and the carrier is written by the runtime built
       * a few lines below: the chat is constructed first because the surface
       * binds to it, so the earlier of the two asks the later one's question
       * through a closure. What it answers with is a row of the reading the
       * roster cell is drawn from — one reading, two readers, no second walk.
       */
      agentAt: (to) => nodeAgents.agentAt(to),
      nodeAt: (node) => nodeAgents.nodeAt(node),
      nodes: () => nodeAgents.nodes(),
      ticket: (node) => {
        if (mintNodeTicket === null) throw new Error("node session opened before MCP tickets were bound")
        return mintNodeTicket(node)
      },
      onState: (state) => publishing().state(state),
      onTranscript: (change) => publishing().transcript(change),
      onLive: () => publishing().live(),
    })

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
      chat,
      // ...and WHY there is none, where there is none — the value the log line
      // above was made from, so the panel says exactly what the journal says.
      noAgent,
      // The carrier the chat's teaching already reads. The runtime is what
      // KEEPS it current — one reading per published revision, taken where the
      // roster cell is filled — so the two readers cannot be looking at two
      // different vaults.
      agents: nodeAgents,
      ops,
      writer: "web",
      hostname: theMachine,
      startedAt,
      git: gitWiring(ops, policy, settled),
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
        report,
      },
    })
    publish = wired.publish

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
    mintNodeTicket = (node) => tickets.mint(
      () => ({ under: node, forbidden: [AGENT_PROP] }),
      nodeAgents.above,
    )
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
      tools: bespokeFrom(TOOLS, {
        login: currentLogin,
        root,
        vintage: Effect.map(store.read("verified"), (aged) => aged.vintage),
        fenced: tickets.doorAt,
      }),
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
        expose: wired.faces.browser,
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

    // `chat` is non-null exactly when this machine has an agent to talk to.
    if (chat !== null) {
      // LAST, and after the listener is up: the session is handed the MCP
      // server's address, which is only knowable once we know what we bound.
      tools = { name: "olai", url: `${url}${MCP_PATH}`, token }
      yield* Effect.addFinalizer(() => chat.stop)
      yield* chat.start
      yield* Effect.annotateLogs(Effect.logInfo("chat agents detected"), {
        // The whole roster, because which agents a person is offered is the
        // question this line now answers — and because "olai cannot see the
        // opencode I installed" is a PATH question a log has to be able to
        // settle (`@olai/chat`'s `agents/roster.ts` says why olai's PATH is not
        // your shell's).
        agents: installed.map((row) => `${row.id}=${row.adapter.command}`).join(" "),
        mcp: tools.url,
      })
    }

    return runtime.faulted
  }).pipe(Effect.withLogSpan("serve"))

const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"])

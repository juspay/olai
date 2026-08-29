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
import { AGENT_ENV, roster, whyNoAgent } from "@olai/chat"
import type { GitPin } from "@olai/format"
import type { IdentityConfig } from "@olai/identity"
import { make as makeOps, TOOLS } from "@olai/ops"
import { Effect, SubscriptionRef } from "effect"
import { randomBytes } from "node:crypto"

import * as Chat from "@olai/chat"
import { openDirectory } from "./directory.ts"
import { watchFault } from "./fault.ts"
import { openPolicy } from "./gitPolicy.ts"
import { hostname } from "./hostname.ts"
import { listen } from "./listener.ts"
import { clientOver, serveFace } from "./mcp/face.ts"
import { currentLogin, MCP_PATH, mcpTransport } from "./mcp/route.ts"
import { bespokeFrom } from "./mcp/tools.ts"
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
   *  is that composed with the built-in defaults (`./gitPolicy.ts`'s
   *  `openPolicy`); what every browser draws read-only is the instance's
   *  policy. */
  readonly pin: GitPin
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
    const { root, store } = yield* openDirectory(options.root)

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
    // Likewise the refusal observer: ops is built before the chat that draws
    // its refusals, because the chat is not what writes.
    let chat: Chat.Chat | null = null

    // Bumped whenever anything about git settled — a commit by whichever door
    // (the button, the agent's tool, the quiet window), a push, a refusal of
    // either, or the loop stopping. None of them moves a served file, so
    // nothing else in this process can say that what a reader is owed has
    // changed.
    const settled = yield* SubscriptionRef.make(0)

    /** WHAT THIS DIRECTORY'S GIT POLICY IS: the flags plus the built-in
     *  defaults (`./gitPolicy.ts`). Immutable after boot. Opened before the
     *  ops layer, because that layer asks it on every decision it makes. */
    const policy = openPolicy(options.pin)

    const ops = makeOps({
      store,
      root,
      policy,
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

    // WHICH agents this machine has, once, before anything is spawned: a PATH
    // probe per agent olai knows, plus the one `OLAI_ACP_AGENT` names
    // (`@olai/chat`'s `agents/roster.ts`, which owns the rule and the two
    // variables). Nothing found is the state the panel has a face for — it
    // draws, and says how to install one — so it is a line in the log and never
    // a refusal to serve.
    const installed = roster(root)
    if (installed.length === 0) yield* Effect.logInfo(whyNoAgent(process.env[AGENT_ENV]))

    // Minted per process and handed only to the session we spawn: the write
    // surface is not something any page that can reach loopback may call.
    const token = randomBytes(24).toString("hex")
    /** Filled once the listener has bound — see the thunk on the chat's
     *  options. Until then there is no session to hand it to. */
    let tools: Chat.ToolServer | null = null

    chat = installed.length === 0 ? null : yield* Chat.make({
      roster: installed,
      cwd: root,
      tools: () => tools,
      onState: (state) => publishing().state(state),
      onTranscript: (change) => publishing().transcript(change),
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
      ops,
      writer: "web",
      hostname: theMachine,
      startedAt,
      git: gitWiring(ops, policy, settled),
      // THE PADI LINK, and this is the one place a process reaches for the
      // real environment and the real clock. `olai web` is the face the
      // terminal door is drawn on, so it is the face that dials; the headless
      // and one-shot faces below pass `null` and every chip there goes hollow,
      // which is the true answer for a process that has no business holding a
      // socket to somebody's daemon open.
      kolu: { env: process.env, now: () => new Date().toISOString() },
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
    const panel = clientOver(writerAt(wired.bound, ops, "chat-agent"))
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
      }),
      transport,
    })

    // Port 0 asks the OS every boot. A leftover `.olai-dev/url` from an
    // older olai is not consulted; nothing is written back.
    const url = yield* Effect.onError(
      listen({
        ...options,
        bound: wired.bound,
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

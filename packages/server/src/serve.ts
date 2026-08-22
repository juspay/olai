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

import { AGENT_ENV, roster, whyNoAgent } from "@olai/chat"
import type { GitPin } from "@olai/format"
import type { IdentityConfig } from "@olai/identity"
import { make as makeOps, TOOLS } from "@olai/ops"
import { Effect, SubscriptionRef } from "effect"
import { randomBytes } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"

import * as Chat from "@olai/chat"
import { openDirectory } from "./directory.ts"
import { watchFault } from "./fault.ts"
import { openPolicy } from "./gitPolicy.ts"
import { listen } from "./listener.ts"
import { clientOver, serveFace } from "./mcp/face.ts"
import { MCP_PATH, mcpTransport } from "./mcp/route.ts"
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
   *  is that composed with whatever anybody chose for this directory and the
   *  defaults (`./gitPolicy.ts`'s `openPolicy`); what every browser draws
   *  read-only is the pin itself. */
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

    /** WHAT THIS DIRECTORY'S GIT POLICY IS: the flags, plus whatever anybody
     *  chose for this path, remembered outside the vault (`./gitPolicy.ts`).
     *  Opened before the ops layer, because that layer asks it on every
     *  decision it makes. */
    const policy = yield* openPolicy(root, options.pin)

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
    const wired = yield* bind({
      store,
      chat,
      ops,
      writer: "web",
      git: gitWiring(ops, policy, settled),
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
      tools: bespokeFrom(TOOLS),
      transport,
    })

    // Port 0 plus a remembered URL is how the next process of this
    // worktree asks for the same address: the first boot asks the OS, the
    // file records what it got, and a later boot with `--port 0` reads it
    // back. Unset, nothing is written and nothing is reused — the e2e suite
    // and a packaged `--port 7714` both take that road. The env is the
    // justfile's (and the drivers'), not a flag, so two worktrees cannot
    // share one file. If the remembered port is still held when the next
    // process listens (a `bun --watch` restart that outran the old
    // teardown), the listener falls back and the file follows.
    const port = options.port === 0 ? (rememberedPort() ?? 0) : options.port
    const url = yield* Effect.onError(
      listen({
        ...options,
        port,
        bound: wired.bound,
        mcp: { transport, token },
        // The quick-capture door, and the fourth face composed HERE: a share
        // sheet is not the browser and is not an agent, so it writes as
        // `capture` and the trailer says which door a line came in by. The
        // writer travels beside the ops layer, exactly as `bind` above takes
        // it — a route that named its own would be a route that could name
        // somebody else's. Handed the ops layer directly rather than a runtime
        // member, because nothing about this door is on the surface: no tab
        // draws it and no agent calls it.
        capture: { ops, writer: "capture", identity: options.identity.headers },
        resync: store.resync,
      }),
      () => runtime.stopped,
    )
    yield* Effect.try({
      try: () => remember(url),
      catch: (cause) =>
        new Error(
          `cannot write the bound url to ${process.env.OLAI_PORT_FILE}: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        ),
    })
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

/** Where this process should write (and, on a later boot with `--port 0`,
 *  read back) the URL it actually bound. Per-worktree by construction:
 *  the justfile points it at `<worktree>/.olai-dev/url`, never at a path
 *  two checkouts share. */
const PORT_FILE = "OLAI_PORT_FILE"

/** The port a previous boot of THIS process's worktree bound, if the file
 *  still names one. First line is the URL; anything after (`pid=…`) is
 *  for readers, not for us. Corrupt or missing is "nothing remembered",
 *  not a reason to refuse to serve — the OS will pick again. */
const rememberedPort = (): number | undefined => {
  const file = process.env[PORT_FILE]
  if (file === undefined || file === "") return undefined
  try {
    const line = fs.readFileSync(file, "utf8").split("\n")[0]?.trim() ?? ""
    const port = Number(new URL(line).port)
    return Number.isInteger(port) && port > 0 ? port : undefined
  } catch {
    return undefined
  }
}

/** Record the bound URL so a later boot (and a harness) can read it back.
 *  Throws if the file cannot be written: a silent miss would be a server
 *  nobody can find. tmp+rename so a racing `cat` cannot observe a torn
 *  write; `pid=` so a reader can tell a live server from a crash leftover
 *  (the file is not unlinked on teardown — `bun --watch` has to read it). */
const remember = (url: string): void => {
  const file = process.env[PORT_FILE]
  if (file === undefined || file === "") return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${url}\npid=${process.pid}\n`)
  fs.renameSync(tmp, file)
}

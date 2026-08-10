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
 */

import type { OutlineError, OutlineSet } from "@olai/format"
import { codec, Mcp, make as makeOps } from "@olai/ops"
import * as Store from "@olai/store"
import { Cause, Effect } from "effect"
import { randomBytes } from "node:crypto"
import { resolve } from "node:path"

import { adapterFrom, AGENT_ENV } from "./chat/adapter.ts"
import * as AcpAgent from "./chat/agent.ts"
import * as Chat from "./chat/chat.ts"
import { listen } from "./listener.ts"
import { MCP_PATH } from "./mcp/route.ts"
import { bind, type Publishers } from "./runtime.ts"

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
  /** Commit every write to git when the served directory is a work tree.
   *  `olai web --no-commit` is the opt-out. */
  readonly commit: boolean
  /** Where to say what we are doing. Injected so a test can read it and a
   *  future caller can silence it. */
  readonly log: (message: string) => void
}

/** Serves until the enclosing scope closes. Everything it opens is registered
 *  as a finalizer of that scope, so shutting down is closing the scope and no
 *  caller holds a teardown function it might forget to call. */
export const serve = (options: ServeOptions) =>
  Effect.gen(function*() {
    const root = resolve(options.root)
    const store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>> = yield* Store
      .make({ root, codec })

    // The chat publishes through the surface, and the surface is seeded from
    // the chat. One mutable slot resolves that, and it is safe because nothing
    // publishes before `bind` returns: the agent is started at the very end.
    let publish: Publishers | null = null
    // Likewise the refusal observer: ops is built before the chat that draws
    // its refusals, because the chat is not what writes.
    let chat: Chat.Chat | null = null

    const ops = makeOps({
      store,
      root,
      commit: options.commit,
      // A refusal reaches the agent as its tool result AND the panel as a row:
      // what the agent then says about it is prose, and the unfinished
      // children are data. On OPS rather than on the MCP server, because it is
      // writes this is a property of — a second writer would report nothing.
      onRefusal: (request, failure) =>
        chat === null ? Effect.void : chat.recordRefusal(request.op, failure),
    })

    const adapter = adapterFrom(process.env[AGENT_ENV])
    if (adapter === null) {
      options.log(
        `no ACP agent configured (${AGENT_ENV} is unset), so chat is off — the outlines are served as usual`,
      )
    }

    // Minted per process and handed only to the session we spawn: the write
    // surface is not something any page that can reach loopback may call.
    const token = randomBytes(24).toString("hex")
    /** Filled once the listener has bound — see the thunk on the agent's
     *  options. Until then there is no session to hand it to. */
    let tools: AcpAgent.ToolServer | null = null

    chat = adapter === null ? null : yield* Chat.make({
      agent: (onEvent) =>
        AcpAgent.make({
          command: adapter.command,
          args: adapter.args,
          // The served directory, exactly — an agent keys its stored sessions
          // by the directory it was started in, and that is what makes "the
          // conversation you were last in" survive a restart.
          cwd: root,
          tools: () => tools,
          onEvent,
          log: options.log,
        }),
      onState: (state) => publish?.state(state),
      onTranscript: (change) => publish?.transcript(change),
      log: options.log,
    })

    const mcp = Mcp.make({ ops })

    const wired = yield* bind({ store, chat })
    publish = wired.publish

    // A faulted runtime is unrecoverable structural damage. Serving past it
    // would answer subscriptions with silence, which is worse than stopping.
    //
    // But `done` settles for TWO reasons — it faulted, or it is being closed —
    // and only the first is news. The second happens on every shutdown,
    // including the shutdown a failed `listen` starts, and treating it as a
    // fault meant a busy port printed `[object Object]` over the perfectly
    // good "cannot listen on 127.0.0.1:7714: address already in use" and then
    // exited before the runtime could report it at all. So the handler only
    // speaks while we are still meant to be serving.
    let serving = true
    const stopped = Effect.sync(() => {
      serving = false
    })
    wired.bound.done.catch((cause: unknown) => {
      if (!serving) return
      options.log(`surface runtime faulted — unrecoverable:\n${render(cause)}`)
      process.exit(1)
    })

    const url = yield* Effect.onError(
      listen({ ...options, bound: wired.bound, mcp: { server: mcp, token } }),
      () => stopped,
    )
    // Registered AFTER the listener's own, so it runs BEFORE it: finalizers
    // run in reverse, and this one has to be true by the time anything starts
    // closing the runtime.
    yield* Effect.addFinalizer(() => stopped)

    options.log(`serving ${root} on ${url}`)
    if (!LOOPBACK.has(options.host)) {
      options.log(
        `WARNING: bound to ${options.host}, not loopback — the surface is unauthenticated, so anyone who can reach this port can read every outline in ${root}`,
      )
    }

    if (chat !== null) {
      // LAST, and after the listener is up: the session is handed the MCP
      // server's address, which is only knowable once we know what we bound.
      tools = { name: "olai", url: `${url}${MCP_PATH}`, token }
      yield* Effect.addFinalizer(() => chat.stop)
      yield* chat.start
      options.log(`chat agent: ${adapter?.command ?? "none"} (mcp at ${url}${MCP_PATH})`)
    }
  })

const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"])

/** What a rejection from the surface runtime actually says.
 *
 *  `done` rejects with an Effect `Cause`, and `String(cause)` on one of those
 *  is `[object Object]` — the least informative thing available about the one
 *  failure we exit the process for. `Cause.pretty` is what renders it, and
 *  the other two arms are for a rejection that never went through Effect. */
const render = (cause: unknown): string =>
  Cause.isCause(cause)
    ? Cause.pretty(cause)
    : cause instanceof Error
    ? cause.stack ?? cause.message
    : String(cause)

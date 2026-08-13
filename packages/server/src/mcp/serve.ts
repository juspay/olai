/**
 * `olai mcp <dir>` — the surface handed to an agent that olai did not start.
 *
 * The other composition root, and a much smaller one than {@link ../serve.ts}:
 * a store over the directory, the ops layer over the store, the surface bound
 * to the store, the MCP face over both, and stdio in front. No listener, no
 * browser, no chat — the client is a coding agent in a terminal, and it brought
 * its own everything.
 *
 * **Why a second process rather than a bridge into a running `olai web`.**
 * {@link ./route.ts} argues the opposite case for the INTERNAL agent, and both
 * arguments are about who owns the store. That agent is a subprocess of the
 * server, so a stdio server there would have been a second olai for no reason.
 * This one is nobody's subprocess: it has to work with no server running at
 * all, which is the ordinary case — somebody in a terminal, in their notes
 * directory. A bridge would need the running server's socket discovered from
 * outside, and would still have to do all of this when it found nothing.
 *
 * So two stores may watch one directory, and that is safe for the reason the
 * write gate exists: it PROBES before it judges, so a change another process
 * made is part of the revision a write is checked against, and a base that has
 * moved comes back as `StaleWrite` for the ops layer to re-plan against the
 * newer snapshot. That is the same machinery a `git pull` under an open tab
 * already goes through. What it is not is a lock: two writers landing on the
 * same file inside the same instant is last-write-wins, exactly as an editor
 * and a `git checkout` are, and git is the recovery net for that as for
 * everything else.
 *
 * **stdout is the protocol**, so the logging goes to stderr — the whole
 * program's, not just this file's. The store logs a failed probe, git logs a
 * refused commit, and neither knows it is running under a pipe a JSON-RPC
 * parser is reading; `@olai/log`'s `toStderr` is one line here and nothing
 * downstream has to remember. The framing is the SDK's `StdioServerTransport`
 * now rather than a pump of our own, which is the same discipline enforced by
 * somebody else's code.
 */

import { toStderr } from "@olai/log"
import { type CommitMode, make as makeOps, TOOLS } from "@olai/ops"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { Effect, SubscriptionRef } from "effect"

import { openDirectory } from "../directory.ts"
import { watchFault } from "../fault.ts"
import { embedderFrom } from "../recall/embedder.ts"
import * as Recall from "../recall/recall.ts"
import { bind, gitWiring } from "../runtime.ts"
import { serveFace } from "./face.ts"
import { bespokeFrom } from "./tools.ts"

/**
 * The stdio transport, plus the two things the SDK's does not do.
 *
 * **It never notices stdin ending.** `StdioServerTransport.start()` attaches
 * listeners for `data` and `error` and nothing for `end`, so a client that
 * closes the pipe is never noticed, `onclose` never fires, and this process
 * lives on holding a watcher over somebody's notes directory. The pump this
 * replaced got that for free by iterating stdin as an `AsyncIterable`, which
 * simply ends.
 *
 * **And it does not drain.** That one is subtler and it is why this is a
 * wrapper rather than two `once` listeners. The old pump answered lines through
 * `Stream.runForEach`, which handles one message and AWAITS its reply before
 * reading the next — so when the stream ended, every message had already been
 * answered. The SDK's transport hands each message off without waiting, so a
 * client that writes its whole conversation and closes stdin (which is what a
 * batch client does, and what `serve.test.ts` does) reaches `end` with replies
 * still in flight. Closing there exits before a single frame is written.
 *
 * So the end of stdin arms a shutdown rather than performing one, and what
 * performs it is the last reply going out. A request is a message carrying an
 * `id`; a reply is one carrying a `result` or an `error`. Notifications are
 * neither and are deliberately not counted — a `resources/updated` push is not
 * something anyone is waiting for an answer to.
 *
 * `onmessage` is intercepted through an accessor because `Server.connect()`
 * ASSIGNS it, after this function has returned: a wrapper installed here would
 * simply be overwritten.
 */
const stdio = (): Transport => {
  const transport = new StdioServerTransport()

  let inFlight = 0
  let ended = false
  const shutIfDrained = () => {
    if (ended && inFlight === 0) void transport.close()
  }

  let handler: Transport["onmessage"]
  Object.defineProperty(transport, "onmessage", {
    configurable: true,
    get: () => handler,
    set: (assigned: Transport["onmessage"]) => {
      handler = (message, extra) => {
        if (isRequest(message)) inFlight += 1
        assigned?.(message, extra)
      }
    },
  })

  const send = transport.send.bind(transport)
  transport.send = async (message: Parameters<typeof send>[0]) => {
    try {
      return await send(message)
    } finally {
      if (isReply(message)) {
        inFlight -= 1
        shutIfDrained()
      }
    }
  }

  // `end` is the ordinary hang-up, `close` the abrupt one (a parent that died
  // rather than closing its pipe). Either arms the shutdown; neither performs
  // it while something is still owed an answer.
  const armed = () => {
    ended = true
    shutIfDrained()
  }
  process.stdin.once("end", armed)
  process.stdin.once("close", armed)

  return transport
}

/** A message somebody is owed an answer to: it names a method AND carries an
 *  id. A notification names a method and carries no id. */
const isRequest = (message: unknown): boolean =>
  typeof message === "object" && message !== null &&
  "method" in message && "id" in message

/** The answer to one of those. Not "has an id": a REQUEST has an id too, and
 *  counting those on the way out would decrement for something we never
 *  incremented. */
const isReply = (message: unknown): boolean =>
  typeof message === "object" && message !== null &&
  ("result" in message || "error" in message)

export interface McpServeOptions {
  /** The directory of outlines the tools operate on, read recursively. */
  readonly root: string
  /** How writes reach git — `--commit=off | manual | auto`, `manual` by
   *  default, which is what puts the `commit` tool in the agent's hands. */
  readonly commits: CommitMode
  /** The transport to speak over — stdio in the binary, an `InMemoryTransport`
   *  half in a test. Injectable so the face can be driven without a pipe. */
  readonly transport?: Transport
}

/**
 * Serve until the client's end of the transport closes.
 *
 * Everything opened here is a finalizer of the enclosing scope, so the store,
 * its watcher and the surface runtime go away when this returns — the same
 * discipline the web server keeps, for the same reason.
 */
export const serveTools = (options: McpServeOptions) =>
  Effect.gen(function*() {
    const { root, store } = yield* openDirectory(options.root)

    // The same slot `../serve.ts` keeps, for the same reason and with the same
    // meaning: a commit or a push happens without moving a served file, so
    // nothing else in this process can say that what is waiting has changed.
    const recorded = yield* SubscriptionRef.make(0)
    // The same semantic index the web serve opens, over the same seam — a
    // terminal agent's `search_nodes` and a palette's search must be one
    // reading (HACKING.md), and `null` here is the same substring-only story.
    const recall = yield* Recall.open({
      root,
      snapshot: store.snapshot,
      // As in `../serve.ts`, and for the same reason: the resolution is the
      // composition root's to state, never the index's to assume.
      embedder: embedderFrom(process.env),
    })
    const ops = makeOps({
      store,
      root,
      commits: options.commits,
      recall,
      onRecorded: () => {
        Effect.runSync(SubscriptionRef.update(recorded, (count) => count + 1))
      },
    })

    // The surface, bound to this store. No chat: there is no browser here and
    // nothing to prompt, and `bind` already answers a chat verb as a refusal
    // when there is no agent — so the cell reads `off` and nothing is exposed.
    //
    // The git half is bound EXACTLY as the web face binds it — same cells, same
    // clocks, same derivation — so a terminal agent reads what is waiting and
    // what git is doing from the same place a browser does. `mcp` is the writer
    // for the procedure's door, because here there is no button and no panel:
    // the only caller is the agent this process was launched by.
    //
    // The ops layer is the same one the tools get: the edit procedures it backs
    // are unexposed on this face (`./expose.ts` is default-deny, and an agent
    // has the tools), so what they cost here is a binding nobody can reach.
    const wired = yield* bind({
      store,
      chat: null,
      ops,
      writer: "mcp",
      git: gitWiring(ops, "mcp", recorded),
    })
    // The runtime's `done` rejects when it is closed, so something must hold
    // that catch or a clean shutdown surfaces as an unhandled rejection. Same
    // reason as `../serve.ts`, and registered in the same order: `stopped`
    // last so it runs first.
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const server = yield* serveFace({
      bound: wired.bound,
      // `mcp`, not `chat-agent`: the client here is somebody's own coding agent,
      // launched from their terminal, and the commit trailer is the only place
      // that difference is ever recorded.
      tools: bespokeFrom(TOOLS, ops, "mcp"),
      transport: options.transport ?? stdio(),
    })
    yield* Effect.addFinalizer(() => runtime.stopped)

    // After the store AND the face, so the line means READY: a directory that
    // cannot be read has already failed by here, and an MCP client's first act
    // is to send `initialize` and wait.
    yield* Effect.logInfo("serving the outline surface over stdio")

    // Closing the client's end of the pipe is what stops this process, and that
    // is a claim `serve.test.ts` makes from outside — so it has to be wired,
    // not assumed. The SDK's stdio transport does NOT end when stdin does; that
    // is precisely the gap {@link stdio} exists to close, and it is what puts a
    // `close()` on this `Server` for the hook below to hear. Nothing here is
    // redundant with the transport: delete the wrapper and this waits forever.
    //
    // CHAINED rather than assigned: `serveSurfaceAsMcp` installs its own
    // `onclose` to stop the resource pusher and dispose the connection, and
    // overwriting it would leak both. The adapter's hook runs first, then ours
    // settles this effect, and the scope unwinds the rest.
    yield* Effect.callback<void>((resume) => {
      const adapters = server.onclose
      server.onclose = () => {
        adapters?.()
        resume(Effect.void)
      }
    })
  }).pipe(Effect.provide(toStderr), Effect.withLogSpan("mcp"))

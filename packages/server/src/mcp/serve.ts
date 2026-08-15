/**
 * `olai mcp <dir>` — the surface handed to an agent that olai did not start.
 *
 * The other composition root, and it has two shapes now. It ATTACHES to a
 * running `olai web` on the same directory when there is one, and otherwise
 * opens the directory itself — and the only thing that differs between them is
 * where the surface comes from:
 *
 *   - ATTACHED — dial the per-directory unix socket (`../socket.ts`) and serve
 *     the MCP face over THAT surface. No store, no watcher, no ops layer, no
 *     runtime. The process is an adapter and nothing else;
 *   - FRESH — a store over the directory, the ops layer over the store, the
 *     surface bound to the store, the MCP face over both. Exactly as before,
 *     and still the ordinary case: somebody in a terminal with no browser open.
 *
 * The two are one call apart because the tools were made to be
 * ({@link ./tools.ts}): every verb an agent has is a surface procedure, so the
 * whole difference is whether the client under them dispatches in-process or
 * down a socket. Nothing about what an agent can do changes, which is what a
 * command whose tool set depended on whether a server happened to be running
 * would have cost — a shape the viewing design rejected, correctly.
 *
 * **What attaching is worth**, measured rather than asserted: two olai
 * processes on one 1020-file vault held 418 MB and 2099 open file descriptors,
 * re-read and re-validated the whole corpus twice per edit on two
 * unsynchronised clocks, and left an agent and a person reading the same
 * directory at revisions seconds apart with no number either could compare.
 * Attaching retires all of it (docs/brainstorming/surface-mcp-positions.md).
 *
 * **Two stores were never UNSAFE**, and that is why this took a design ruling
 * rather than a bug report. The write gate PROBES before it judges, so a change
 * another process made is part of the revision a write is checked against, and
 * a base that has moved comes back as `StaleWrite` for the ops layer to re-plan
 * against the newer snapshot — the same machinery a `git pull` under an open
 * tab already goes through. What it is not is a lock: two writers landing on
 * the same file inside the same instant is last-write-wins, exactly as an
 * editor and a `git checkout` are. It was argued as safe, never as cheap.
 *
 * **Discovery is the dial and there is no state anywhere.** No pidfile, no
 * registry, no port to read: `ECONNREFUSED`/`ENOENT` on the rendezvous path IS
 * the answer "nobody is home", so there is nothing that can go stale and
 * nothing to clean up after a crash. A server that stops takes its socket with
 * it.
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
import type { OwnedSurfaceConnection } from "@kolu/surface-mcp"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { Effect, SubscriptionRef } from "effect"
import { resolve } from "node:path"

import { openDirectory } from "../directory.ts"
import { watchFault } from "../fault.ts"
import { bind, gitWiring } from "../runtime.ts"
import { attaching, attachTo, socketFor } from "../socket.ts"
import { clientOver, serveFace } from "./face.ts"
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
 * Serve until the client's end of the transport closes — attached to a running
 * `olai web` on this directory if there is one, over a store of our own if
 * there is not.
 *
 * The probe is one dial and there is nothing to undo if it fails: a directory
 * nobody is serving answers `ENOENT` and this reads exactly as it always did.
 *
 * Everything opened here is a finalizer of the enclosing scope, so the store,
 * its watcher and the surface runtime go away when this returns — the same
 * discipline the web server keeps, for the same reason.
 */
export const serveTools = (options: McpServeOptions) =>
  Effect.gen(function*() {
    const socketPath = socketFor(options.root)
    const attached = yield* Effect.promise(() => attachTo(socketPath))
    return yield* attached === null
      ? fresh(options)
      : bridged(options, attached, socketPath)
  }).pipe(Effect.provide(toStderr), Effect.withLogSpan("mcp"))

/**
 * ATTACHED: the MCP face over somebody else's surface, and nothing else in the
 * process.
 *
 * What is absent is the whole point of this function — no store, no watcher,
 * no ops layer, no surface runtime, no git. The tools are the same table
 * projected the same way ({@link ./tools.ts}); only the client under them is a
 * socket rather than a direct dispatch, which is the difference the design was
 * built to make invisible.
 *
 * `--commit` is the one flag that stops meaning anything here, and it says so
 * rather than being quietly ignored: how a write reaches git is a property of
 * the process that HOLDS the store, decided when that server was started.
 */
const bridged = (
  options: McpServeOptions,
  first: OwnedSurfaceConnection,
  socketPath: string,
) =>
  Effect.gen(function*() {
    yield* Effect.annotateLogsScoped({ root: resolve(options.root), socket: socketPath })
    if (options.commits !== "manual") {
      yield* Effect.logWarning(
        `--commit=${options.commits} is ignored while attached: how writes reach git is the ` +
          "running server's setting, not this session's",
      )
    }
    const server = yield* serveFace({
      client: attaching(first, socketPath),
      tools: bespokeFrom(TOOLS, "mcp"),
      transport: options.transport ?? stdio(),
    })
    yield* Effect.logInfo("attached to the olai already serving this directory")
    yield* untilClosed(server)
  })

/** FRESH: a store of our own, which is what `olai mcp` has always been and
 *  still is whenever nothing else is serving the directory. */
const fresh = (options: McpServeOptions) =>
  Effect.gen(function*() {
    const { root, store } = yield* openDirectory(options.root)

    // The same slot `../serve.ts` keeps, for the same reason and with the same
    // meaning: a commit or a push happens without moving a served file, so
    // nothing else in this process can say that what is waiting has changed.
    const recorded = yield* SubscriptionRef.make(0)
    const ops = makeOps({
      store,
      root,
      commits: options.commits,
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
    // The ops layer is what the tools reach too, one seam further along: they
    // go through the SURFACE (`./tools.ts`), over a direct dispatch at these
    // same handlers, gated by the same map the socket face is. So the keyboard's
    // `edit.apply` is bound here and unreachable — an agent has the tools — and
    // what it costs is a binding nobody can call.
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
      client: () => clientOver(wired.bound.handlers),
      // `mcp`, not `chat-agent`: the client here is somebody's own coding agent,
      // launched from their terminal, and the commit trailer is the only place
      // that difference is ever recorded.
      tools: bespokeFrom(TOOLS, "mcp"),
      transport: options.transport ?? stdio(),
    })
    yield* Effect.addFinalizer(() => runtime.stopped)

    // After the store AND the face, so the line means READY: a directory that
    // cannot be read has already failed by here, and an MCP client's first act
    // is to send `initialize` and wait.
    yield* Effect.logInfo("serving the outline surface over stdio")

    yield* untilClosed(server)
  })

/**
 * Park until the client hangs up — the last statement of both shapes.
 *
 * Closing the client's end of the pipe is what stops this process, and that is
 * a claim `serve.test.ts` makes from outside — so it has to be wired, not
 * assumed. The SDK's stdio transport does NOT end when stdin does; that is
 * precisely the gap {@link stdio} exists to close, and it is what puts a
 * `close()` on this `Server` for the hook below to hear. Nothing here is
 * redundant with the transport: delete the wrapper and this waits forever.
 *
 * CHAINED rather than assigned: `serveSurfaceAsMcp` installs its own `onclose`
 * to stop the resource pusher and dispose the connection, and overwriting it
 * would leak both. The adapter's hook runs first, then ours settles this
 * effect, and the scope unwinds the rest.
 */
const untilClosed = (server: Server): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    const adapters = server.onclose
    server.onclose = () => {
      adapters?.()
      resume(Effect.void)
    }
  })

/**
 * The rendezvous: where a running `olai web` puts its surface so that an
 * `olai mcp` on the same directory can find it.
 *
 * One owner-only unix socket per SERVED DIRECTORY, beside the listener and for
 * the lifetime of the serve. It carries the same surface the browser reads,
 * gated by `AGENT_FACE` (`./faces.ts`) — every write verb, every read the tools
 * need, and nothing of the human's session.
 *
 * **What it is for is not convenience, it is the second store.** Two olai
 * processes on one directory were measured at 418 MB and 2099 open descriptors
 * on a 1020-file vault, two full parses of everything per edit on two
 * unsynchronised clocks, and a "the same live rows the browser draws" promise
 * that held only up to the skew between them
 * (docs/brainstorming/surface-mcp-positions.md, position (c)). None of that was
 * unsafe — the write gate PROBES before it judges — it was just paid for
 * twice.
 *
 * **Permissions ARE the authentication.** The directory is created `0700` and
 * verified owner-only before anything binds; there is no token, no port and no
 * origin gate, because anyone who can `connect()` is already the user whose
 * files these are. That is the same reasoning the web listener CANNOT use, and
 * the reason the two faces are gated differently at all.
 *
 * Serving is deliberately ADDITIVE. Every transport verdict resolves to a no-op
 * listener carrying an `outcome` rather than to a rejection, and this module
 * turns each one into a sentence: an `olai web` whose socket could not bind is
 * an `olai web` that still serves its browser perfectly, and the only thing
 * lost is that an agent will open its own store — which is exactly what it did
 * before this existed. The ONE thing that does throw is an exposure built from
 * a different surface, and that is upstream's decision and the right one: a
 * security gate that silently never took effect is worse than a boot crash.
 */

import { emitter } from "@olai/log"
import { surface } from "@olai/surface"
import type { Logger } from "@kolu/log"
import { unixSocketLink } from "@kolu/surface/links/unix-socket"
import {
  getRuntimeSocketPath,
  serveOverUnixSocket,
  type UnixSocketServeOutcome,
} from "@kolu/surface/unix-socket"
import type { OwnedSurfaceConnection } from "@kolu/surface-mcp"
import { Effect, type Scope } from "effect"
import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import { resolve } from "node:path"

import { AGENT_FACE } from "./faces.ts"
import { clientOn } from "./mcp/face.ts"
import type { Bound } from "./runtime.ts"

/**
 * Where the two processes meet, for one directory.
 *
 * PER DIRECTORY, because olai serves one: a person with a notes vault and a
 * work vault open runs two servers, and an `olai mcp` in either must reach the
 * one that is serving THAT directory. So the directory is the whole of the
 * name, digested — the path itself cannot be, since a socket path has a length
 * limit (~104 bytes on the platforms this runs on) that a nested vault would
 * blow through, and since a `/`-bearing name is not a filename at all.
 *
 * REALPATH, not `resolve`, and that is the load-bearing half. The two processes
 * compute this independently with no coordination beyond the app name, so they
 * must agree — and a person types `olai web ~/notes` and, later, `olai mcp .`
 * from inside a directory reached through a symlink. `resolve` answers those
 * two differently; `realpathSync` answers them the same. A path that does not
 * exist has no real path, and falls back to the resolved one: the caller is
 * about to fail on the missing directory anyway, and this must not be what
 * tells them so.
 *
 * The DIRECTORY the socket sits in is `getRuntimeSocketPath`'s convention —
 * `$XDG_RUNTIME_DIR/olai/` where systemd provides one, else the fixed per-user
 * `/tmp/olai-$UID/`. Its doc has why that is deliberately not `os.tmpdir()`.
 */
export const socketFor = (root: string): string =>
  getRuntimeSocketPath({
    app: "olai",
    file: `${
      createHash("sha256").update(canonical(root)).digest("hex").slice(0, 16)
    }.sock`,
  })

const canonical = (root: string): string => {
  try {
    return realpathSync(resolve(root))
  } catch {
    return resolve(root)
  }
}

/**
 * Serve the agent face beside the browser's, until the enclosing scope closes.
 *
 * Registered as a finalizer for the reason the listener is: shutting olai down
 * is closing a scope, and no caller holds a teardown it might forget. The
 * socket file goes with it — `close()` severs every established peer and
 * removes the inode — so an `olai mcp` started after a server stopped finds
 * nothing and opens its own store, rather than dialling a corpse.
 */
export const serveAgentSocket = (options: {
  readonly root: string
  readonly bound: Pick<Bound, "group" | "handlers">
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function*() {
    const socketPath = socketFor(options.root)
    // Everything this listener says about itself, it says from a Node callback
    // — the same reason `./listener.ts` captures one here rather than at each
    // line (`@olai/log`'s `emitter`).
    const say = yield* emitter
    const listener = yield* Effect.promise(() =>
      serveOverUnixSocket({
        socketPath,
        group: options.bound.group,
        handlers: options.bound.handlers,
        // What an attached `olai mcp` may call. NOT omitted: an absent expose
        // serves the whole surface, and this face must never reach the human's
        // conversation.
        expose: AGENT_FACE,
        log: kolu(say),
      })
    )
    yield* Effect.addFinalizer(() => Effect.sync(() => listener.close()))
    yield* said(listener.outcome, socketPath)
  })

/** What each verdict MEANS for olai, in olai's words. The transport owns the
 *  verdicts; the advice is ours, and every arm of it says the same thing in the
 *  end — the browser is unaffected, and an agent falls back to the second store
 *  this socket exists to retire. */
const said = (
  outcome: UnixSocketServeOutcome,
  socketPath: string,
): Effect.Effect<void> => {
  const also = "an `olai mcp` on this directory will open a store of its own instead of attaching"
  switch (outcome.kind) {
    case "listening":
      return Effect.annotateLogs(
        Effect.logInfo("agents can attach to this server"),
        { socket: socketPath },
      )
    case "already-served":
      // Another olai is serving this directory. Not a fault and not even a
      // degradation: an agent attaches to THAT one, which holds a store over
      // the same files and judges writes through the same gate.
      return Effect.annotateLogs(
        Effect.logInfo("another olai already serves this directory's socket — agents will attach to it"),
        { socket: socketPath },
      )
    case "dir-not-private":
      return Effect.annotateLogs(
        Effect.logWarning(
          "the runtime directory is not owner-only, so the agent socket was not bound — " +
            "its permissions are the whole of its authentication, and " + also,
        ),
        { dir: outcome.dir },
      )
    case "not-a-socket":
      return Effect.annotateLogs(
        Effect.logWarning(
          "something that is not a socket already occupies the agent socket's path, and it " +
            "will not be removed — " + also,
        ),
        { socket: socketPath },
      )
    case "probe-failed":
      return Effect.annotateLogs(
        Effect.logWarning(
          "the agent socket's path could not be probed, so it was left alone — " + also,
        ),
        { socket: socketPath, code: outcome.code ?? "" },
      )
    case "bind-failed":
      return Effect.annotateLogs(
        Effect.logWarning("the agent socket could not be bound — " + also),
        { socket: socketPath, err: String(outcome.err) },
      )
  }
}

/**
 * Dial the socket for `root`, or answer `null` when nothing is serving it.
 *
 * THE DISCOVERY IS THE DIAL, which is what makes this whole arrangement have no
 * state to go stale: there is no pidfile, no registry and no port to read.
 * `ECONNREFUSED` (a crashed server's leftover inode) and `ENOENT` (nothing
 * there at all) are both "nobody is home", and `olai mcp` falls through to
 * opening its own store — the behaviour it had before this existed, unchanged
 * and still the ordinary case.
 *
 * Nothing else is caught. A dial that fails for another reason — the socket is
 * there, owned by this user, and refuses in some way nobody predicted — is a
 * defect rather than a shrug: silently opening a second store over a directory
 * a server IS holding is the outcome this node exists to stop, and it must not
 * be reachable by accident.
 */
export const attachTo = async (
  socketPath: string,
): Promise<OwnedSurfaceConnection | null> => {
  try {
    const link = await unixSocketLink({ group: surface.group, socketPath })
    return {
      client: clientOn(link.dispatch),
      // The adapter disposes every connection it opens, including this one:
      // the dial is ITS factory's answer, so the socket's lifetime belongs to
      // it and not to whoever asked for the first one.
      dispose: () => void link.dispose(),
    }
  } catch (error) {
    if (nobodyHome(error)) return null
    throw error
  }
}

const nobodyHome = (error: unknown): boolean => {
  const code = (error as { readonly code?: unknown } | null)?.code
  return code === "ECONNREFUSED" || code === "ENOENT"
}

/**
 * The adapter's client factory for a session that has already attached: hand
 * over the connection the probe opened, then dial a fresh one for every later
 * ask.
 *
 * TWO CALLERS want a connection — the reads-and-tools slot and the resource
 * pusher — and the adapter re-invokes this after a drop, so it cannot be a
 * single value. The probe's own connection is handed to the FIRST asker rather
 * than disposed and re-dialled, which is worth the six lines: disposing it
 * would open a window in which the server could stop between "there is one" and
 * "connect to it", and a session that decided to attach would then have nothing
 * to attach to.
 *
 * A later dial that finds nobody home FAILS rather than falling back to opening
 * a store. Falling back would mean a session whose tools silently changed which
 * directory-reading they answer from, halfway through a conversation, with the
 * agent's earlier reads describing a store that no longer exists. The honest
 * answer is that the server this session attached to is gone.
 */
export const attaching = (
  first: OwnedSurfaceConnection,
  socketPath: string,
): () => Promise<OwnedSurfaceConnection> => {
  let held: OwnedSurfaceConnection | null = first
  return async () => {
    const ready = held
    held = null
    if (ready !== null) return ready
    const again = await attachTo(socketPath)
    if (again === null) {
      throw new Error(
        `the olai server this session attached to has stopped serving ${socketPath}`,
      )
    }
    return again
  }
}

/** kolu's structured logger, spoken as olai's. Four levels onto Effect's four,
 *  through the captured emitter so a line from a socket callback carries the
 *  same annotations and honours the same `--log-level` as one from a fiber. */
const kolu = (say: (line: Effect.Effect<void>) => void): Logger => ({
  debug: (fields, message) => say(Effect.annotateLogs(Effect.logDebug(message), fields)),
  info: (fields, message) => say(Effect.annotateLogs(Effect.logInfo(message), fields)),
  warn: (fields, message) => say(Effect.annotateLogs(Effect.logWarning(message), fields)),
  error: (fields, message) => say(Effect.annotateLogs(Effect.logError(message), fields)),
})

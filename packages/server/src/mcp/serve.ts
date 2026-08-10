/**
 * `olai mcp <dir>` — the ops layer handed to an agent that olai did not start.
 *
 * The other composition root, and a much smaller one than {@link ../serve.ts}:
 * a store over the directory, the ops layer over the store, the tool surface
 * over the ops, and stdio in front. No listener, no browser, no chat — the
 * client is a coding agent in a terminal, and it brought its own everything.
 *
 * **Why a second process rather than a bridge into a running `olai web`.**
 * {@link ./route.ts} argues the opposite case for the INTERNAL agent, and both
 * arguments are about who owns the store. That agent is a subprocess of the
 * server, so a stdio server there would have been a second olai for no reason.
 * This one is nobody's subprocess: it has to work with no server running at
 * all, which is the ordinary case — somebody in a terminal, in their notes
 * directory. A bridge would need the running server's port and its per-process
 * token discovered from outside, and would still have to do all of this when it
 * found nothing listening.
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
 * parser is reading; `Logger.LogToStderr` is the framework's own switch for
 * exactly this, and setting it here means nothing downstream has to remember.
 */

import { codec, Mcp, make as makeOps } from "@olai/ops"
import * as Store from "@olai/store"
import { Effect, Logger } from "effect"
import { resolve } from "node:path"

import { pump } from "./stdio.ts"

export interface McpServeOptions {
  /** The directory of outlines the tools operate on, read recursively. */
  readonly root: string
  /** Commit every write to git when the directory is a work tree.
   *  `olai mcp --no-commit` is the opt-out. */
  readonly commit: boolean
  /** Bytes in and frames out — `process.stdin` and `process.stdout` for the
   *  binary, a pair of fakes for a test. */
  readonly input: AsyncIterable<Uint8Array>
  readonly write: (frame: string) => void
  /** Where to say what we are doing. NOT stdout: see the header. */
  readonly log: (message: string) => void
}

/**
 * Serve the tools until the client's end of the pipe closes.
 *
 * Everything opened here is a finalizer of the enclosing scope, so the store
 * and its watcher go away when this returns — the same discipline the web
 * server keeps, for the same reason.
 */
export const serveTools = (options: McpServeOptions) =>
  Effect.gen(function*() {
    const root = resolve(options.root)
    const store = yield* Store.make({ root, codec })
    const ops = makeOps({ store, root, commit: options.commit })

    // After the store, so the line means READY: a directory that cannot be
    // read has already failed by here, and an MCP client's first act is to
    // send `initialize` and wait.
    options.log(`olai mcp: serving ${root}`)

    yield* pump({
      server: Mcp.make({ ops }),
      input: options.input,
      write: options.write,
    })
  }).pipe(Effect.provideService(Logger.LogToStderr, true))

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
 * parser is reading; `@olai/log`'s `toStderr` is one line here and nothing
 * downstream has to remember.
 */

import { toStderr } from "@olai/log"
import { type CommitMode, Mcp, make as makeOps } from "@olai/ops"
import { Effect } from "effect"

import { openDirectory } from "../directory.ts"
import { pump } from "./stdio.ts"

export interface McpServeOptions {
  /** The directory of outlines the tools operate on, read recursively. */
  readonly root: string
  /** How writes reach git — `--commit=off | manual | auto`, `manual` by
   *  default, which is what puts the `commit` tool in the agent's hands. */
  readonly commits: CommitMode
  /** Bytes in and frames out — `process.stdin` and `process.stdout` for the
   *  binary, a pair of fakes for a test. */
  readonly input: AsyncIterable<Uint8Array>
  readonly write: (frame: string) => void
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
    const { root, store } = yield* openDirectory(options.root)
    const ops = makeOps({ store, root, commits: options.commits })

    // After the store, so the line means READY: a directory that cannot be
    // read has already failed by here, and an MCP client's first act is to
    // send `initialize` and wait.
    yield* Effect.logInfo("serving the outline tools over stdio")

    yield* pump({
      // `mcp`, not `chat-agent`: the client here is somebody's own coding
      // agent, launched from their terminal, and the commit trailer is the
      // only place that difference is ever recorded.
      server: Mcp.make({ ops, writer: "mcp" }),
      input: options.input,
      write: options.write,
    })
  }).pipe(Effect.provide(toStderr), Effect.withLogSpan("mcp"))

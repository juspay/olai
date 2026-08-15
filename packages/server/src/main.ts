/**
 * `olai web <dir>` — the binary.
 *
 * There is still no CLI PRODUCT (the rewrite plan, decision 3): nothing here
 * adds a node, marks one or moves one, and nothing ever will. The two write
 * surfaces are the browser and the agent's MCP tools, and they are two
 * clients of ONE server: a tab on the websocket, or an HTTP POST at `/mcp`.
 * There is no second process and no stdio face. An agent that is not ours
 * dials the running `olai web`, the same way the panel's agent already does.
 *
 * It uses Effect's own CLI rather than an argument parser dependency — usage
 * errors are part of the format's error taxonomy, and they may as well come
 * from the same runtime as every other error.
 *
 * Loopback by default. The surface is unauthenticated, so binding anywhere
 * else is a decision the operator has to type out and gets warned about.
 */

import { NodeHttpServer, NodeRuntime, NodeServices } from "@effect/platform-node"
import { toStdout } from "@olai/log"
import { Effect, Layer } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"

import { allowedOrigins } from "./allowedOrigins.ts"
import { clientDist } from "./clientDist.ts"
import { commitFlags, commitMode } from "./commits.ts"
import { serve } from "./serve.ts"

/** The directory of outlines the server operates on. */
const directory = Argument.directory("directory", { mustExist: true }).pipe(
  Argument.withDescription("the directory of outlines, read recursively"),
)

/** `--commit` / `--no-commit` — `./commits.ts`, which owns the mode table,
 *  the default, why `--no-commit` wins, and why the sentence names both
 *  doors this face actually has. */
const webCommits = commitFlags("web")

/** No registered port, and memorable: 7714 is "olai" on a phone keypad. */
const DEFAULT_PORT = 7714

const web = Command.make("web", {
  directory,
  port: Flag.integer("port").pipe(
    Flag.withDescription("TCP port to listen on"),
    Flag.withDefault(DEFAULT_PORT),
  ),
  host: Flag.string("host").pipe(
    Flag.withDescription(
      "interface to bind; loopback by default, because the surface is unauthenticated",
    ),
    Flag.withDefault("127.0.0.1"),
  ),
  ...webCommits,
}, ({ commits, directory, host, noCommit, port }) =>
  Effect.gen(function*() {
    const faulted = yield* serve({
      root: directory,
      port,
      host,
      commits: commitMode(commits, noCommit),
      clientDist: yield* clientDist,
      allowedOrigins: allowedOrigins(),
    })
    // Wait to be interrupted — or for the surface runtime to fault, which is
    // the one thing that stops a healthy server on its own. Either way the
    // scope unwinds: the listener registered its teardown on it, so a signal
    // here closes the sockets on the way out rather than leaving the port held
    // by a process that has already stopped answering, and a fault takes the
    // same road out rather than exiting from under those finalizers.
    yield* faulted
  })).pipe(
    Command.withDescription("serve a directory of outlines in the browser"),
  )

const olai = Command.make("olai").pipe(
  Command.withDescription("olai — outlines in flat-record JSONL"),
  Command.withSubcommands([web]),
)

// `runMain` IS the signal handling, the keep-alive and the exit code, and it
// is why waiting on one effect above is enough: interrupting on SIGINT or
// SIGTERM runs the scope's finalizers — the listener's teardown — and only then
// exits, and a surface fault arrives as a failure it reports and sets the code
// for. Hand-rolling it dropped three things quietly, the one that mattered
// being that the port stayed held long enough to break a harness starting a
// dozen servers on it.
//
// The LOG LEVEL is not set here and there is no flag of ours for it: Effect's
// CLI already carries `--log-level`, parses it, documents it in `--help` and
// provides the minimum level to whichever subcommand runs. Quiet is its default
// (`Info`), so debug lines — a relayed agent stderr chunk, the loudest thing in
// the program — are off until somebody asks. The sink is stdout: a person
// watching a server looks there, and nothing else in this process owns it.
NodeRuntime.runMain(
  Command.run(olai, { version: "0.1.0" }).pipe(
    Effect.scoped,
    // NodeServices carries the CLI's own needs (stdio, terminal, file system);
    // layerHttpServices carries the static file layer's (the file-response
    // platform and ETags).
    Effect.provide(
      Layer.mergeAll(NodeServices.layer, NodeHttpServer.layerHttpServices, toStdout),
    ),
  ),
)

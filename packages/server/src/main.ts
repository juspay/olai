/**
 * `olai web <dir>` and `olai mcp <dir>` — the binary.
 *
 * There is still no CLI PRODUCT (the rewrite plan, decision 3): nothing here
 * adds a node, marks one or moves one, and nothing ever will. The two write
 * surfaces are the browser and the agent's MCP tools, and these two
 * subcommands are the two ways of putting one of those in front of a
 * directory — a listener a browser opens, or a pipe an agent speaks JSON-RPC
 * down. Which is why `mcp` takes no port and no host: it is not a server
 * anybody dials.
 *
 * It uses Effect's own CLI rather than an argument parser dependency — usage
 * errors are part of the format's error taxonomy, and they may as well come
 * from the same runtime as every other error.
 *
 * Loopback by default. The surface is unauthenticated, so binding anywhere
 * else is a decision the operator has to type out and gets warned about.
 */

import { NodeHttpServer, NodeRuntime, NodeServices } from "@effect/platform-node"
import { parseAllowedOrigins } from "@kolu/surface/ws-origin"
import { Effect, Layer } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"

import { clientDist } from "./clientDist.ts"
import { serveTools } from "./mcp/serve.ts"
import { serve } from "./serve.ts"

/** The directory of outlines a subcommand operates on. Spelled once: both
 *  take exactly the same thing, and a second `Argument.directory` is a second
 *  place for `mustExist` to be forgotten. */
const directory = Argument.directory("directory", { mustExist: true }).pipe(
  Argument.withDescription("the directory of outlines, read recursively"),
)

/** Both subcommands write, so both have the opt-out — a directory whose
 *  history is somebody else's job. */
const noCommit = Flag.boolean("no-commit").pipe(
  Flag.withDescription(
    "do not git-commit writes; the default commits each one when the directory is a work tree",
  ),
)

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
  noCommit,
}, ({ directory, host, noCommit, port }) =>
  Effect.gen(function*() {
    yield* serve({
      root: directory,
      port,
      host,
      commit: !noCommit,
      clientDist: yield* clientDist,
      allowedOrigins: parseAllowedOrigins(process.env.OLAI_ALLOWED_ORIGINS),
      log: (message) => {
        console.log(message)
      },
    })
    // Wait to be interrupted. The listener registered its teardown on this
    // scope, so a signal below closes the sockets on the way out rather than
    // leaving the port held by a process that has already stopped answering.
    yield* Effect.never
  })).pipe(
    Command.withDescription("serve a directory of outlines in the browser"),
  )

/**
 * The same tools the chat panel's agent gets, for an agent that is not ours.
 *
 * Registered with an MCP client as a command it launches — `claude mcp add
 * olai -- olai mcp ~/outlines` — so it speaks JSON-RPC down its own pipes and
 * exits when the client closes them. There is nothing to bind and nothing to
 * authenticate: the client already proved who it is by being the process that
 * started this one.
 */
const mcp = Command.make("mcp", { directory, noCommit }, ({ directory, noCommit }) =>
  serveTools({
    root: directory,
    commit: !noCommit,
    input: process.stdin,
    write: (frame) => {
      process.stdout.write(frame)
    },
    // stderr, and it is not a detail: stdout is the wire. What a person reads
    // and what the client parses are two different streams, which is the whole
    // reason this transport can say anything at all.
    log: (message) => {
      process.stderr.write(`${message}\n`)
    },
  })).pipe(
    Command.withDescription(
      "serve the outline tools over stdio, for a coding agent in a terminal",
    ),
  )

const olai = Command.make("olai").pipe(
  Command.withDescription("olai — outlines in flat-record JSONL"),
  Command.withSubcommands([web, mcp]),
)

// `runMain` IS the signal handling, the keep-alive and the exit code, and it
// is why `Effect.never` above is enough: interrupting on SIGINT or SIGTERM
// runs the scope's finalizers — the listener's teardown — and only then exits.
// Hand-rolling it dropped three things quietly, the one that mattered being
// that the port stayed held long enough to break a harness starting a dozen
// servers on it.
NodeRuntime.runMain(
  Command.run(olai, { version: "0.1.0" }).pipe(
    Effect.scoped,
    // NodeServices carries the CLI's own needs (stdio, terminal, file system);
    // layerHttpServices carries the static file layer's (the file-response
    // platform and ETags).
    Effect.provide(Layer.mergeAll(NodeServices.layer, NodeHttpServer.layerHttpServices)),
  ),
)

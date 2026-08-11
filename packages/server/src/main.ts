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
import { COMMIT_MODES, type CommitMode } from "@olai/format"
import { toStdout } from "@olai/log"
import { Effect, Layer } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"

import { allowedOrigins } from "./allowedOrigins.ts"
import { clientDist } from "./clientDist.ts"
import { serveTools } from "./mcp/serve.ts"
import { serve } from "./serve.ts"

/** The directory of outlines a subcommand operates on. Spelled once: both
 *  take exactly the same thing, and a second `Argument.directory` is a second
 *  place for `mustExist` to be forgotten. */
const directory = Argument.directory("directory", { mustExist: true }).pipe(
  Argument.withDescription("the directory of outlines, read recursively"),
)

/**
 * How writes reach git. Both subcommands write, so both take it.
 *
 * `manual` is the default and the point of the whole thing: a write lands on
 * disk and WAITS, and a commit is something somebody asks for — the button in
 * the browser, or the agent's `commit` tool, which knows where its work ends
 * and can say why. `auto` is the old behaviour, one commit per op, for a
 * headless server with no browser to press anything.
 *
 * `--no-commit` stays, and it means `--commit=off`: it is in scripts and in
 * this repo's own test harness, and a flag that quietly changed meaning would
 * be worse than one that is spelled twice. Given both, `--no-commit` wins,
 * because it is the one that turns something off.
 */
const commits = Flag.choice("commit", COMMIT_MODES).pipe(
  Flag.withDescription(
    "when to git-commit writes: manual (a Commit button and a `commit` tool ask for one), auto (every write commits itself), off",
  ),
  Flag.withDefault("manual" as CommitMode),
)

const noCommit = Flag.boolean("no-commit").pipe(
  Flag.withDescription("the same as --commit=off"),
)

/** The two flags above, as the one answer they are between them. */
const commitMode = (chosen: CommitMode, off: boolean): CommitMode =>
  off ? "off" : chosen

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
  commits,
  noCommit,
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

/**
 * The same tools the chat panel's agent gets, for an agent that is not ours.
 *
 * Registered with an MCP client as a command it launches — `claude mcp add
 * olai -- olai mcp ~/outlines` — so it speaks JSON-RPC down its own pipes and
 * exits when the client closes them. There is nothing to bind and nothing to
 * authenticate: the client already proved who it is by being the process that
 * started this one.
 */
const mcp = Command.make("mcp", { directory, commits, noCommit }, ({ commits, directory, noCommit }) =>
  serveTools({
    root: directory,
    commits: commitMode(commits, noCommit),
    input: process.stdin,
    write: (frame) => {
      process.stdout.write(frame)
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
// the program — are off until somebody asks. What IS ours is the sink, and only
// one of the two subcommands keeps it: `olai mcp` swaps in the stderr one for
// itself, because there stdout is the protocol.
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

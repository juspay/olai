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
 *
 * Signals: `runMain` interrupts the fiber on SIGINT/SIGTERM and exits 130,
 * silently — Effect treats an interrupt as a successful stop and writes
 * nothing. Our own listeners write `olai web: received SIGTERM` (or SIGINT)
 * to stderr first, so a journal can tell a signaled death from a deliberate
 * stop. Node allows more than one listener; `runMain` still does the unwind.
 */

import { NodeHttpServer, NodeRuntime, NodeServices } from "@effect/platform-node"
import { identityHeaders } from "@olai/identity"
import { toStdout } from "@olai/log"
import { Effect, Layer } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"

import { allowedOrigins } from "./allowedOrigins.ts"
import { clientDist } from "./clientDist.ts"
import { gitFlags, gitPin } from "./commits.ts"
import { serve } from "./serve.ts"

/** The directory of outlines the server operates on. */
const directory = Argument.directory("directory", { mustExist: true }).pipe(
  Argument.withDescription("the directory of outlines, read recursively"),
)

/** `--commit` / `--no-commit` / `--push` — `./commits.ts`, which owns the mode
 *  tables, the defaults it declines to apply, why `--no-commit` wins, and why
 *  the sentence names both doors this face actually has. */
const webGit = gitFlags("web")

/** 0 is the OS's to pick. A fixed port is a deploy's explicit `--port` —
 *  7714 ("olai" on a phone keypad) is what the home-manager module passes.
 *  The default used to be 7714 itself, which is how a `just run` in a
 *  worktree squatted the production instance and the orchestrator's MCP
 *  spent an evening reading the wrong vault. */
const DEFAULT_PORT = 0

const web = Command.make("web", {
  directory,
  port: Flag.integer("port").pipe(
    Flag.withDescription(
      "TCP port to listen on; 0 (the default) asks the OS for one",
    ),
    Flag.withDefault(DEFAULT_PORT),
  ),
  host: Flag.string("host").pipe(
    Flag.withDescription(
      "interface to bind; loopback by default, because the surface is unauthenticated",
    ),
    Flag.withDefault("127.0.0.1"),
  ),
  ...webGit,
}, ({ commits, directory, host, noCommit, port, pushes }) =>
  Effect.gen(function*() {
    const faulted = yield* serve({
      root: directory,
      port,
      host,
      git: gitPin(commits, noCommit, pushes),
      clientDist: yield* clientDist,
      allowedOrigins: allowedOrigins(),
      identity: identityHeaders(),
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

// `runMain` IS the interrupt, the keep-alive and the exit code, and it is why
// waiting on one effect above is enough: interrupting on SIGINT or SIGTERM
// runs the scope's finalizers — the listener's teardown — and only then exits,
// and a surface fault arrives as a failure it reports and sets the code for.
// Hand-rolling it dropped three things quietly, the one that mattered being
// that the port stayed held long enough to break a harness starting a dozen
// servers on it.
//
// It is SILENT on an interrupt. Effect treats that as a successful stop, so
// nothing reaches stdout or stderr, and a journal that already treats 130 as
// success (`SuccessExitStatus` in the shipped unit) cannot tell a signaled
// crash from `systemctl stop`. The listeners below write the one line; they
// do not replace `runMain`. Registered first so the name is on the pipe
// before the unwind starts.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    process.stderr.write(`olai web: received ${signal}\n`)
  })
}

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

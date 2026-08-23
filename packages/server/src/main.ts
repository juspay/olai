/**
 * `olai web <dir>` — the binary.
 *
 * TWO SUBCOMMANDS, and only one of them is a server. `olai web` IS the
 * process that holds the directory; `olai surface` is a CLIENT of it — the
 * declared surface projected as argv by `@kolu/surface-cli`, exactly as
 * `@kolu/surface-mcp` projects it as tools, over the per-user socket that
 * serve binds.
 *
 * THERE IS STILL NO SECOND WRITER, which is the principle the old sentence here
 * ("no write CLI, and there never will be") was protecting. Nothing in this
 * binary opens the directory except `olai web`, and `olai surface` cannot: it
 * dials a running server and sends the same verbs an agent sends, so there is
 * one process writing those files and one gate judging every write. What
 * changed is the number of CLIENTS — a tab, an agent, and now a terminal — not
 * the number of writers.
 *
 * The verbs are DERIVED. They are `@olai/ops`' tool table and the agent face's
 * resources, under the names the agent already sees, so a verb cannot mean one
 * thing to an agent and another in a shell — and a verb added to the table is a
 * verb here with no code written in this file.
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
import * as os from "node:os"
import { getRuntimeSocketPath } from "@kolu/surface/unix-socket"
import { reportingRunEdge, surfaceCommands } from "@kolu/surface-cli"
import { identityConfig } from "@olai/identity"
import { TOOLS } from "@olai/ops"
import { surface } from "@olai/surface"
import { atLevel, toStdout } from "@olai/log"
import { Effect, Layer, Option } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"

import { allowedOrigins } from "./allowedOrigins.ts"
import { clientDist } from "./clientDist.ts"
import { dialOlai } from "./dial.ts"
import { MCP } from "./faces.ts"
import { bespokeFrom } from "./mcp/tools.ts"
import { gitFlags, gitPin } from "./gitPolicy.ts"
import { serve } from "./serve.ts"

/**
 * Where the agent socket goes, from what `--socket` said.
 *
 * UNSET IS THE CONVENTION, not a default somebody has to know:
 * `$XDG_RUNTIME_DIR/olai/surface.sock` (else `/tmp/olai-$UID/…`), which is the
 * same path `olai surface` walks to last. That is what makes the CLI work with
 * no configuration and no flag on either side — the two ends agree because
 * neither one chose.
 *
 * `off` BINDS NONE, and it is a word rather than an absent flag because absent
 * already means the convention. A serve with no socket is the honest shape for
 * a second worktree that wants the page without fighting the user service for
 * the one path, and for anywhere a stray socket would be a surprise.
 */
const socketFor = (flag: Option.Option<string>): string | null => {
  const said = Option.getOrUndefined(flag)
  if (said === "off") return null
  return getRuntimeSocketPath({ app: "olai", file: "surface.sock", override: said })
}

/** The directory of outlines the server operates on. */
const directory = Argument.directory("directory", { mustExist: true }).pipe(
  Argument.withDescription("the directory of outlines, read recursively"),
)

/** `--commit` / `--no-commit` / `--push` — `./gitPolicy.ts`, which owns the mode
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
  socket: Flag.string("socket").pipe(
    Flag.withDescription(
      "path for the agent socket `olai surface` dials; the per-user runtime path by default, and `off` to bind none",
    ),
    Flag.optional,
  ),
  ...webGit,
}, ({ commits, directory, host, noCommit, port, pushes, socket }) =>
  Effect.gen(function*() {
    const faulted = yield* serve({
      root: directory,
      port,
      host,
      pin: gitPin(commits, noCommit, pushes),
      clientDist: yield* clientDist,
      allowedOrigins: allowedOrigins(),
      identity: identityConfig(),
      socketPath: socketFor(socket),
    })
    // Wait to be interrupted — or for the surface runtime to fault, which is
    // the one thing that stops a healthy server on its own. Either way the
    // scope unwinds: the listener registered its teardown on it, so a signal
    // here closes the sockets on the way out rather than leaving the port held
    // by a process that has already stopped answering, and a fault takes the
    // same road out rather than exiting from under those finalizers.
    yield* faulted
  }).pipe(
    // Innermost only when the env var is set (empty layer otherwise), so
    // `olai web --log-level warn` still quiets Info, and a systemd
    // `OLAI_LOG_LEVEL=debug` still raises it.
    Effect.provide(atLevel()),
  )).pipe(
    Command.withDescription(
      "serve a directory of outlines in the browser. OLAI_LOG_LEVEL (debug|info|warn|error) sets the minimum log level and wins when set; when unset, --log-level applies (default info)",
    ),
  )

/**
 * `olai surface <verb>` — the projection.
 *
 * A VALUE, not a program: `surfaceCommands` returns the commands and runs
 * nothing, so this binary keeps its own run edge and mounts them beside `web`.
 *
 * `expose: MCP` is the RESOURCES half — the same read-only map the agent face
 * publishes, so `olai surface get outlines <path>` reads what an agent reads.
 * `verbs` is the tool table itself, projected by the same `bespokeFrom` the MCP
 * face is handed, which is what keeps `capture` one verb with one schema rather
 * than two spellings of it. The identity is `null` here and that is right: this
 * process is a CLIENT, and who a capture is attributed to is decided by the
 * door it lands on — the socket's own face, in `serve.ts`, which knows the OS
 * user.
 *
 * `annotate` is CLI-only ergonomics, keyed by verb name and BESIDE the table
 * rather than inside it: a scalar-ish argument reads better as a position than
 * as a flag (`olai surface read_node a1b2c3`), and that is a fact about argv
 * which the MCP face has no use for.
 *
 * THE IDENTITY IS THE OS USER, and it is passed HERE because this is where the
 * verbs are composed: a bespoke verb's handler runs in the process that CALLS
 * it, so for `olai surface` that is this one. It is still "the identity the
 * door has" and not a claim a caller invented (the ruling, human 2026-08-22),
 * because of what the door IS: a `0700` per-user socket admits only the account
 * that owns it, so the user on this side and the user on that side are the same
 * account by construction — and that account can already write those files
 * directly. Nothing is being trusted across a privilege boundary, because there
 * is no boundary here to cross. The faces that know NOBODY — `/mcp` and the
 * in-process panel, both composed in `serve.ts` — pass nothing and their
 * captures carry no attribution, which is the honest answer rather than a
 * made-up one.
 */
const surfaceCmd = Command.make("surface").pipe(
  Command.withDescription(
    "call any verb of the running server's surface — the same verbs an agent has",
  ),
  Command.withSubcommands([
    ...surfaceCommands({
      surface,
      expose: MCP,
      verbs: bespokeFrom(TOOLS, os.userInfo().username),
      endpoint: {
        flags: {
          socket: Flag.string("socket").pipe(
            Flag.withDescription("the agent socket to dial"),
            Flag.optional,
          ),
        },
        resolve: dialOlai,
      },
      annotate: {
        capture: { positional: ["title"] },
        read_node: { positional: ["id"] },
        read_subtree: { positional: ["id"] },
      },
      info: { name: "olai" },
    }),
  ]),
)

const olai = Command.make("olai").pipe(
  Command.withDescription("olai — outlines in flat-record JSONL"),
  Command.withSubcommands([web, surfaceCmd]),
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

// The sink is stdout: a person watching a server looks there, and nothing else
// in this process owns it. The LEVEL is provided on the `web` handler above:
// OLAI_LOG_LEVEL when set, otherwise Effect's `--log-level` (default info).
NodeRuntime.runMain(
  Command.run(olai, { version: "0.1.0" }).pipe(
    // THE RUN EDGE `olai surface` NEEDS, in the one line the package exports it
    // as: catch the CAUSE (a defect is not a failure, and the runtime's own
    // report of one goes to STDOUT, into the data channel a script is reading),
    // pass an interrupts-only cause through untouched (Ctrl-C, whose 130 is the
    // runtime's teardown), write the arm's own line, re-fail with the verdict.
    //
    // NOT OPTIONAL GARNISH: every failure that face raises carries
    // `Runtime.errorReported = false`, because its line is its own — so a host
    // that re-fails without writing that line exits with the right code and says
    // NOTHING AT ALL. That is not a hypothetical: this binary did exactly that,
    // and a refused capture (`captured-by` sent by a caller) exited 1 with both
    // channels empty until this line existed.
    //
    // It is harmless to `web`, whose failures are ordinary reported ones.
    reportingRunEdge,
    Effect.scoped,
    // NodeServices carries the CLI's own needs (stdio, terminal, file system);
    // layerHttpServices carries the static file layer's (the file-response
    // platform and ETags).
    Effect.provide(
      Layer.mergeAll(NodeServices.layer, NodeHttpServer.layerHttpServices, toStdout),
    ),
  ),
  // The other HALF of the same recipe, and the host's to pass because it is
  // `runMain`'s own argument: the line above is already written, and Effect's
  // own report on top of it would be a second, differently-worded copy — on
  // stdout, in the middle of the data.
  { disableErrorReporting: true },
)

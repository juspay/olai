/**
 * `olai web <dir>` — the binary.
 *
 * TWO SUBCOMMANDS, and only one of them is a server. `olai web` IS the
 * process that holds the directory; `olai surface` is a CLIENT of it — the
 * declared surface projected as argv by `@kolu/surface-cli`, exactly as
 * `@kolu/surface-mcp` projects it as tools, speaking MCP over HTTP to the
 * `/mcp` that same serve already offers an agent. Not a face of its own: the
 * same path, the same admission rule, the same members.
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
 *
 * Every SIGTERM additionally goes through the GUARD first (`@olai/sigterm` —
 * a package of its own: one file of TS and a few lines of C):
 * a stranger's TERM is refused and named, an accepted one is handed back to
 * the disposition these listeners armed and re-raised — so the listener
 * below fires on the guard's own reraise, which is by construction: an
 * honored TERM reads exactly like today in a journal.
 */

import { NodeHttpServer, NodeRuntime, NodeServices } from "@effect/platform-node"
import { reportingRunEdge, surfaceCommands, surfaceHelp } from "@kolu/surface-cli"
import { addressOf, printAddress } from "@olai/format"
import { identityConfig } from "@olai/identity"
import { TOOLS } from "@olai/ops"
import { surface } from "@olai/surface"
import { atLevel, toStdout } from "@olai/log"
import { dlopen, FFIType } from "bun:ffi"
import { Effect, Layer } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"

import { allowedOrigins } from "./allowedOrigins.ts"
import { clientDist } from "./clientDist.ts"
import { dialOlai, endpointFlags } from "./dial.ts"
import { MCP } from "./faces.ts"
import { remoteFrom } from "./mcp/tools.ts"
import { gitFlags, gitPin } from "./gitPolicy.ts"
import { serve } from "./serve.ts"
import { installSigtermGuard } from "@olai/sigterm"

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
  ...webGit,
}, ({ commits, directory, host, noCommit, port, pushes }) =>
  Effect.gen(function*() {
    // The SIGTERM guard (@olai/sigterm): `web` is the server a stray pkill
    // wants — `surface` is a client and its TERM is an ordinary stop —
    // and first, so the armed line leads the boot's journal. Everything
    // the arm asks for (Bun's listener-armed disposition, a settled
    // parent) is true by the time ANY command handler runs.
    yield* Effect.promise(() => installSigtermGuard())
    const faulted = yield* serve({
      root: directory,
      port,
      host,
      pin: gitPin(commits, noCommit, pushes),
      clientDist: yield* clientDist,
      allowedOrigins: allowedOrigins(),
      identity: identityConfig(),
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

/** The verbs that only ANSWER — the four query tools, the two document reads,
 *  and this face's own three readers. Spelled out because "read" is a fact
 *  about what a verb MEANS rather than about its `kind`: `list` and `keys` are
 *  the projection's, not the table's, and they belong on the page beside the
 *  reads they resemble. */
const READING = [
  "get",
  "keys",
  "list",
  "list_outlines",
  "read_node",
  "read_subtree",
  "list_documents",
  "read_document",
] as const

/** Everything else the table offers, alphabetically — see the group's comment. */
const writing = (): ReadonlyArray<string> =>
  TOOLS.map((tool) => tool.name)
    .filter((name) => name !== "capture" && name !== "search_nodes")
    .filter((name) => !(READING as ReadonlyArray<string>).includes(name))
    .sort((a, b) => a.localeCompare(b))

/**
 * THE HELP PAGE'S WORDING — olai's half of it.
 *
 * The layout is `@kolu/surface-cli`'s, so every surface client's `--help` has
 * the same shape; what only this app can write is what its verbs are FOR. This
 * is also the documentation: there is no `docs/surface.md`, deliberately (ruled,
 * human 2026-08-23) — a page beside a binary is a page that goes stale, and the
 * one thing a person always has to hand is `--help`.
 *
 * The groups are what a person came to do, not how the ops layer is built:
 * capture first because it is the reason most people type this at all, then
 * reading, then finding, then everything that changes the vault.
 */
const HELP = {
  command: "surface",
  purpose:
    "Call any verb of a running olai from a terminal — the same verbs an agent has, against the vault --url names.",
  groups: [
    { title: "Capture", verbs: ["capture"] },
    { title: "Read", verbs: READING },
    { title: "Search", verbs: ["search_nodes"] },
    // DERIVED, and the only group that is: everything the table offers that is
    // not one of the three above changes the vault, and there are twenty-odd of
    // them. Listing those by hand would be a second copy of the table — the one
    // place that stops being true the day a tool is added, which is exactly the
    // silence "a verb added to the table is a verb here with no code written"
    // exists to avoid.
    { title: "Write", verbs: writing() },
  ],
  examples: {
    capture: 'capture "look into the new cabinets" --text "the brass ones"',
    read_node: "read_node a1b2c3",
    search_nodes: "search_nodes --text 'is:todo prop:pr'",
    get: "get outlines _olai/Inbox.olai",
    list_outlines: "list_outlines",
  },
  flags: [
    {
      spelling: "--url <server>",
      description:
        "the olai to call — the address a browser opens (required; there is no default, and no remembered vault)",
    },
  ],
  answer: [
    "A write prints one line — where it landed, and a link to the row it made; --json prints the whole",
    "record instead. Every other answer goes to stdout as JSON already. A refusal goes to stderr, also as",
    "JSON, on exit 1.",
    "Exit 2 is a command that was wrong and never left this process, 3 is nothing serving at --url, 130 is Ctrl-C.",
    "Locally the server admits loopback with no credential; through a reverse proxy the login it injects is the",
    "authentication, and is what a capture is recorded as. Off loopback and with no proxy, set $OLAI_TOKEN.",
  ].join("\n"),
}

/**
 * WHAT A WRITE SAYS, in one line a person can act on.
 *
 * The answer underneath is the ops layer's `Applied` — id, title, file,
 * summary, sort, captured, rev, why, did — which is the right record for an
 * agent and the wrong one for a terminal: nine fields, of which none is a thing
 * you can open. So a write says where it landed and gives the address of the row
 * it made, and `--json` hands over the record whole for anything that wants it
 * (ruled, human 2026-08-23; the flag decides, never the terminal).
 *
 * THE VAULT IS NAMED because not naming it is what made the reverted design
 * dangerous: a capture that went to the wrong directory answered exactly like
 * one that went to the right one. `root` comes off the answer — the server
 * stamped it, so it cannot be this side's guess — and `url` is what this side
 * dialled, which is the half the server cannot know behind a proxy.
 */
const wrote = (out: unknown): string => {
  const said = out as {
    readonly did?: string
    readonly root?: string
    readonly url?: string
    readonly file?: string
    readonly id?: string
  }
  // "captured into" for the verb the whole door was built around, and the verb's
  // own name for every other write — rather than one sentence bent to fit them
  // all, or a table of past tenses this file would have to keep.
  const what = said.did === "capture" ? "captured into" : `${said.did ?? "wrote"} in`
  const where = said.root ?? "the vault"
  const at = rowAt(said)
  return at === null ? `${what} ${where}` : `${what} ${where} — ${at}`
}

/** The URL of the row a write made, or `null` for a write that made no row
 *  (`commit`, `push`, `empty_trash`).
 *
 *  Built through `@olai/format`'s own address grammar rather than by joining
 *  strings here: which half of `<file>#<id>` a node's address writes, and what
 *  needs escaping in each, is that module's rule and has one home. A row whose
 *  file is not known is still addressable by id alone, which is what the node
 *  arm of that grammar is. */
const rowAt = (said: { readonly file?: string; readonly id?: string; readonly url?: string }): string | null => {
  if (said.url === undefined || said.id === undefined) return null
  const address = addressOf(said.file ?? null, said.id)
  if (address === null) return null
  try {
    return new URL(`/${printAddress(address)}`, said.url).toString()
  } catch {
    // A `--url` that parsed well enough to dial but not to build on. The line is
    // still worth printing without it.
    return null
  }
}

/**
 * `olai surface <verb>` — the projection.
 *
 * A VALUE, not a program: `surfaceCommands` returns the commands and runs
 * nothing, so this binary keeps its own run edge and mounts them beside `web`.
 *
 * `expose: MCP` is the RESOURCES half — the same read-only map the agent face
 * publishes, so `olai surface get outlines <path>` reads what an agent reads.
 * `verbs` is the tool table itself, so `capture` is one verb with one schema
 * rather than two spellings of it.
 *
 * **`remoteFrom`, and not `bespokeFrom`, is the whole difference between this
 * and the server.** Both project the same table under the same names; the
 * server's handlers RUN each verb, and these CALL it — one MCP `tools/call` on
 * the connection `./dial.ts` opened. So the verb executes over there, under the
 * gate over there, with the identity over there. That is what makes
 * `captured-by` an attribution instead of a claim: this process could compose a
 * capture naming anybody, and a caller who could name anybody is a caller whose
 * `prop:captured-by=…` means nothing (ruled, human 2026-08-23 — "never
 * caller-set"). It also means there is no second implementation of a verb to
 * keep in step, and no writer to bind here.
 *
 * `annotate` is CLI-only ergonomics, keyed by verb name and BESIDE the table
 * rather than inside it: a scalar-ish argument reads better as a position than
 * as a flag (`olai surface read_node a1b2c3`), and that is a fact about argv
 * which the MCP face has no use for. The `render` on every WRITE is the same
 * kind of fact — a line a person can act on, in place of the ops layer's
 * `Applied` record, which is nine fields of which none is a thing to click.
 */
const surfaceCli = {
  surface,
  expose: MCP,
  verbs: remoteFrom(TOOLS),
  endpoint: {
    flags: endpointFlags,
    resolve: dialOlai,
    // The door is `/mcp`, which answers one POST with one frame and pushes
    // nothing — so `watch` and `--follow` are not mounted at all rather than
    // offered and then always failing (`./dial.ts`).
    streaming: false,
  },
  annotate: {
    // Every verb that WRITES gets the one-line summary, derived from the table
    // rather than listed here: a tool added to `TOOLS` is a verb here with no
    // code written for it, and a hand-kept list of writes would be the one place
    // that stopped being true.
    ...Object.fromEntries(
      TOOLS.filter((tool) => tool.kind !== "read").map((tool) => [tool.name, { render: wrote }]),
    ),
    capture: { positional: ["title"], render: wrote },
    read_node: { positional: ["id"] },
    read_subtree: { positional: ["id"] },
  },
  help: HELP,
  info: { name: "olai" },
} as const

const surfaceCmd = Command.make("surface").pipe(
  Command.withDescription(surfaceHelp(surfaceCli)),
  Command.withSubcommands([...surfaceCommands(surfaceCli)]),
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

// When the parent dies, this process should die with it. The e2e harness
// used to leak a server per cancelled run: `detached: true` put each olai
// in its own process group, so SIGKILL of cucumber (odu's timeout, a
// Ctrl-C that never reached AfterAll) reparented them to init and they
// sat on `/tmp` directories that no longer existed. SIGTERM, not SIGKILL,
// so the lock-file finalizer still runs. Linux only — `prctl` is the
// syscall; darwin has no equivalent we can call without a helper.
dieWithParent()

/**
 * `prctl(PR_SET_PDEATHSIG, SIGTERM)`, then a getppid check for the race
 * where the parent died between spawn and this call. Best-effort: a
 * machine without the syscall still serves.
 */
function dieWithParent(): void {
  if (process.platform !== "linux") return
  for (const name of ["libc.so.6", "libc.so"] as const) {
    try {
      const lib = dlopen(name, {
        prctl: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
        getppid: { args: [], returns: FFIType.i32 },
      })
      // PR_SET_PDEATHSIG = 1, SIGTERM = 15
      lib.symbols.prctl(1, 15)
      // getppid() === 1 is the race where the parent died between spawn and
      // this call. A system systemd unit has PID 1 as parent and would
      // self-SIGTERM here; olai ships only a user unit (`olai.service`),
      // whose parent is the user manager, not 1 — so this check and
      // PDEATHSIG are inert there.
      if (lib.symbols.getppid() === 1) process.kill(process.pid, "SIGTERM")
      return
    } catch {
      // try the next soname
    }
  }
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

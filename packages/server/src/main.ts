import { DocumentPath, NodeId, type Address } from "@olai/format"
import { NodeHttpServer, NodeRuntime, NodeServices } from "@effect/platform-node"
import { reportingRunEdge, surfaceCommands, surfaceHelp } from "@kolu/surface-cli"
import { addressOf, printAddress } from "@olai/format"
import { CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
import { toStdout } from "@olai/log"
import { Effect, Layer, Option } from "effect"
import { Argument, CliConfig, Command, Flag, GlobalFlag } from "effect/cli"

import { allowedOrigins } from "./allowedOrigins.ts"
import { clientDist } from "./clientDist.ts"
import { dialOlai, endpointFlags } from "./dial.ts"
import { dieWithParent } from "./dieWithParent.ts"
import { AGENT_SIBLINGS } from "@olai/bundle/agent-face"
import type { Tool } from "@olai/ops"
import { remoteFrom } from "@olai/bundle/remote"
import { serve } from "./serve.ts"
import { installSigtermGuard } from "@olai/sigterm"

const directory = Argument.Directory("directory", { mustExist: true }).pipe(
  Argument.withDescription("the directory of outlines, read recursively"),
)

const DEFAULT_PORT = 0

const web = Command.make("web", {
  directory,
  profile: Flag.Literals("profile", ["web", "surface", "test-minimal"] as const).pipe(
    Flag.withDescription("row bundle: web, MCP-only surface, or no transports"),
    Flag.withDefault("web"),
  ),
  port: Flag.Int("port").pipe(
    Flag.withDescription(
      "TCP port to listen on; 0 (the default) asks the OS for one",
    ),
    Flag.optional,
  ),
  host: Flag.String("host").pipe(
    Flag.withDescription(
      "interface to bind; loopback by default, because the surface is unauthenticated",
    ),
    Flag.optional,
  ),
}, ({
  directory,
  host: requestedHost,
  port: requestedPort,
  profile,
}) =>
  Effect.gen(function*() {
    yield* Effect.promise(() => installSigtermGuard())
    const faulted = yield* serve({
      root: directory,
      profile,
      port: Option.getOrElse(requestedPort, () => DEFAULT_PORT),
      host: Option.getOrElse(requestedHost, () => "127.0.0.1"),
      addressAuthors: { host: Option.isSome(requestedHost) ? "flag" : "default",
        port: Option.isSome(requestedPort) ? "flag" : "default" },

      clientDist: clientDist.pipe(Effect.provide(NodeServices.layer), Effect.orDie),
      allowedOrigins: allowedOrigins(),
    })
    yield* faulted
  })).pipe(
    Command.withDescription(`serve a directory of outlines in the browser; policy lives in ${CONFIGURATION_FILE}`),
  )

const TOOLS = Object.values(AGENT_SIBLINGS).flatMap((row) => row.tools as ReadonlyArray<Tool>)

const POSITIONALS: Readonly<Record<string, ReadonlyArray<string>>> = {
  capture_add: ["title"],
  outlines_read: ["id"],
  outlines_subtree: ["id"],
}

const annotationsFor = (row: string, tools: ReadonlyArray<Tool>) =>
  Object.fromEntries(tools.map((tool) => [tool.name, {
    ...(POSITIONALS[`${row}_${tool.name}`] === undefined ? {} : { positional: POSITIONALS[`${row}_${tool.name}`] }),
    ...(tool.kind === "read" ? {} : { render: wrote }),
  }]).filter(([, one]) => Object.keys(one as object).length > 0))

const HELP = {
  command: "surface",
  purpose:
    "Call any verb of a running olai from a terminal — the same verbs an agent has, against the vault --url names.",
  groups: [
    { title: "Capture", verbs: ["capture"] },
    { title: "Outlines and documents", verbs: ["outlines", "markdown"] },
    { title: "Search", verbs: ["search"] },
    { title: "Files", verbs: ["files", "trash"] },
    { title: "The vault itself", verbs: ["vault", "git", "vault-plugins"] },
    { title: "This face", verbs: ["list"] },
  ],
  examples: {
    capture: 'capture add "look into the new cabinets" --text "the brass ones"',
    outlines: "outlines read a1b2c3",
    search: "search nodes --text 'is:todo prop:pr'",
    markdown: "markdown map",
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

const wrote = (out: unknown): string => {
  const said = out as {
    readonly did?: string
    readonly root?: string
    readonly url?: string
    readonly file?: string
    readonly id?: string
  }
  const what = said.did === "capture_add" ? "captured into" : `${said.did ?? "wrote"} in`
  const where = said.root ?? "the vault"
  const at = rowAt(said)
  return at === null ? `${what} ${where}` : `${what} ${where} — ${at}`
}

const rowAt = (said: { readonly file?: string; readonly id?: string; readonly url?: string }): string | null => {
  if (said.url === undefined || said.id === undefined) return null
  const address: Address = said.file === undefined
    ? { kind: "node", id: NodeId.make(said.id) }
    : said.id === said.file
      ? { kind: "document", path: DocumentPath.make(said.file) }
      : { kind: "row", path: DocumentPath.make(said.file), id: NodeId.make(said.id) }
  if (address === null) return null
  try {
    return new URL(`/${printAddress(address)}`, said.url).toString()
  } catch {
    return null
  }
}

const surfaceCli = {
  surfaces: Object.fromEntries(Object.entries(AGENT_SIBLINGS).map(([key, row]) => [key, {
    surface: row.surface,
    expose: row.expose ?? {},
    verbs: remoteFrom(key, row.tools as ReadonlyArray<Tool>),
    annotate: annotationsFor(key, row.tools as ReadonlyArray<Tool>),
  }])),
  endpoint: {
    flags: endpointFlags,
    resolve: dialOlai,
    streaming: false,
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

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    process.stderr.write(`olai web: received ${signal}\n`)
  })
}

dieWithParent()

NodeRuntime.runMain(
  Command.run(olai, { version: "0.1.0" }).pipe(
    reportingRunEdge,
    Effect.scoped,
    Effect.provide(
      Layer.mergeAll(NodeServices.layer, NodeHttpServer.layerHttpServices, toStdout,
        CliConfig.layer({ builtIns: GlobalFlag.BuiltIns.filter(flag => flag !== GlobalFlag.LogLevel) })),
    ),
  ),
  { disableErrorReporting: true },
)

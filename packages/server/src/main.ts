/**
 * `olai web <dir> [--port] [--host]` — the binary.
 *
 * There is no CLI product (the rewrite plan, decision 3): the two write
 * surfaces are the browser and the agent's MCP tools. This entry point exists
 * only to start the thing that serves them, so it has exactly one subcommand
 * and three inputs, and it uses Effect's own CLI rather than an argument
 * parser dependency — usage errors are part of the format's error taxonomy,
 * and they may as well come from the same runtime as every other error.
 *
 * Loopback by default. The surface is unauthenticated, so binding anywhere
 * else is a decision the operator has to type out and gets warned about.
 */

import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { parseAllowedOrigins } from "@kolu/surface/ws-origin"
import { Effect, Layer } from "effect"
import { Argument, Command, Flag } from "effect/unstable/cli"

import { clientDist } from "./clientDist.ts"
import { serve } from "./serve.ts"

/** No registered port, and memorable: 7714 is "olai" on a phone keypad. */
const DEFAULT_PORT = 7714

const web = Command.make("web", {
  directory: Argument.directory("directory", { mustExist: true }).pipe(
    Argument.withDescription("the directory of outlines to serve, read recursively"),
  ),
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
}, ({ directory, host, port }) =>
  Effect.gen(function*() {
    yield* serve({
      root: directory,
      port,
      host,
      clientDist: clientDist(),
      allowedOrigins: parseAllowedOrigins(process.env.OLAI_ALLOWED_ORIGINS),
      log: (message) => {
        console.log(message)
      },
    })
    // The listener owns the process from here; its scope closes on signal.
    yield* Effect.never
  })).pipe(
    Command.withDescription("serve a directory of outlines in the browser"),
  )

const olai = Command.make("olai").pipe(
  Command.withDescription("olai — outlines in flat-record JSONL"),
  Command.withSubcommands([web]),
)

Command.run(olai, { version: "0.1.0" }).pipe(
  Effect.scoped,
  // NodeServices carries the CLI's own needs (stdio, terminal, file system);
  // layerHttpServices carries the static file layer's (the file-response
  // platform and ETags).
  Effect.provide(Layer.mergeAll(NodeServices.layer, NodeHttpServer.layerHttpServices)),
  Effect.runPromise,
).catch((cause: unknown) => {
  console.error(String(cause))
  process.exit(1)
})

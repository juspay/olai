import { writeFixturePolicy, type FixturePolicy } from "@olai/bundle/testlib"
import { collector, findSaid, type Logged } from "@olai/log/testlib"
import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { serve } from "./serve.ts"
process.env.KOLU_ACP_AGENT = ""
process.env.OLAI_ACP_CODEX = ""
process.env.OLAI_ACP_PI = ""
process.env.OLAI_AGENT_PATH = ""
const NOTHING_IS_LISTENING = "http://127.0.0.1:1"
process.env.ODU_WEB_ORIGIN = NOTHING_IS_LISTENING

export const SERVER_LAYERS = Layer.mergeAll(
  NodeServices.layer,
  NodeHttpServer.layerHttpServices,
)

export const served = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-served-"))
  fs.writeFileSync(path.join(root, "a.olai"), `{"id":"a","ord":"a0","title":"a"}\n`)
  return root
}

export const withServe = async <A>(
  options: {
    readonly profile?: import("./profiles.ts").Profile
    readonly root: string
    readonly commits?: "off" | "manual" | "auto"
    readonly clientDist?: string
    readonly vars?: Record<string, string | undefined>
    readonly policy?: FixturePolicy
    readonly plugins?: ReadonlyArray<string>
  },
  body: (said: ReadonlyArray<Logged>) => Promise<A>,
): Promise<A> => {
  writeFixturePolicy(options.root, { commit: options.commits, only: options.plugins, ...options.policy })
  const { layer, said } = collector()
  return Effect.gen(function*() {
    yield* serve({
      profile: options.profile,
      root: options.root,
      port: 0,
      host: "127.0.0.1",
      clientDist: options.clientDist ?? served(),
      allowedOrigins: [],
      ...(options.vars === undefined ? {} : { vars: options.vars }),

    })
    return yield* Effect.promise(() => body(said))
  }).pipe(
    Effect.scoped,
    Effect.provide(SERVER_LAYERS),
    Effect.provide(layer),
    Effect.runPromise,
  )
}

export const withServing = <A>(
  options: {
    readonly profile?: import("./profiles.ts").Profile
    readonly root: string
    readonly commits?: "off" | "manual" | "auto"
    readonly clientDist?: string
    readonly vars?: Record<string, string | undefined>
    readonly policy?: FixturePolicy
    readonly plugins?: ReadonlyArray<string>
  },
  body: (url: string, said: ReadonlyArray<Logged>) => Promise<A>,
): Promise<A> =>
  withServe(options, (said) => {
    const url = findSaid(said, "serving")?.annotations.url
    if (typeof url !== "string") {
      throw new Error(
        `the server never said where it was serving, so there is nothing to ask: ${
          JSON.stringify(said)
        }`,
      )
    }
    return body(url, said)
  })

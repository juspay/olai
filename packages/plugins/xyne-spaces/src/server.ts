import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import type { ConversationSeen } from "@olai/plugin-api"
import {
  Clock,
  definePlugin,
  Deliveries,
  detached,
  Env,
  LocalState,
  Surfaces,
  Vault,
  Watching,
} from "@olai/plugin-api/services"
import { inMemoryStore } from "@kolu/surface/server"
import { type Derived, type OutlineSet } from "@olai/format"
import { Effect } from "effect"

import { makeClient, originOf, type Dial } from "./client.ts"
import {
  bindOf,
  Config,
  spacesConfigIn,
  Seating,
  type SpacesReading,
} from "./config.ts"
import { openLocalState } from "./local.ts"
import { laneOf, makeMirror, skipHeartbeat, unconfiguredBody, type Mirror } from "./mirror.ts"
import {
  name,
  type SpacesLink,
  surface,
} from "./wire.ts"

export { faces, name, surface } from "./wire.ts"
import { faces } from "./wire.ts"

export interface VaultRevision {
  readonly value: {
    readonly set: OutlineSet
    readonly derived: Derived
  }
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

const linkFromEnv = (
  env: Record<string, string | undefined>,
  now: string,
): { readonly url: string | null; readonly token: string | null; readonly link: SpacesLink } => {
  const url = env.OLAI_SPACES_URL?.trim() || null
  const token = env.OLAI_SPACES_TOKEN?.trim() || null
  if (url === null || token === null) {
    return {
      url,
      token,
      link: {
        status: "absent",
        where: url === null && token === null
          ? "OLAI_SPACES_URL, OLAI_SPACES_TOKEN"
          : url === null
          ? "OLAI_SPACES_URL"
          : "OLAI_SPACES_TOKEN",
        told: url !== null,
        why: null,
        since: now,
      },
    }
  }
  const origin = originOf(url)
  return {
    url: origin,
    token,
    link: {
      status: "connected",
      where: origin,
      told: true,
      why: null,
      since: now,
    },
  }
}

export { Config } from "./config.ts"

export default definePlugin({
  environment: [
    {"key": "OLAI_SPACES_URL", "secret": false, "says": "the Spaces server to reach"},
    {"key": "OLAI_SPACES_TOKEN", "secret": true, "says": "the credential for Spaces"},
  ],
  name,
  needs: [Seating, Clock, Deliveries, Env, LocalState, Surfaces, Vault, Watching],
  config: Config,
  apply: (settings) => Effect.gen(function*() {
    const clock = yield* Clock
    const deliveries = yield* Deliveries
    const environment = yield* Env
    const localState = yield* openLocalState(yield* LocalState)
    const surfaces = yield* Surfaces
    const vault = yield* Vault
    const seating = yield* Seating
    const watching = yield* Watching
    const run = yield* detached

    const env = linkFromEnv(environment.vars, clock.now())
    let current: SpacesLink = env.link
    const link = inMemoryStore(current)
    let linkCell: { set: (value: SpacesLink) => void } | undefined
    let reading: SpacesReading = { binds: [], named: [], trim: settings["reply-limit"] }
    const mirrors = new Map<string, Mirror>()
    let lastBound: { agent: string; session: string } | undefined
    let chain = Promise.resolve()

    const paint = (next: SpacesLink): void => {
      current = next
      link.set(next)
      linkCell?.set(next)
    }

    const serial = (work: () => Promise<void>): void => {
      chain = chain.then(work, work).then(undefined, (error: unknown) => {
        run(Effect.logWarning(`spaces: ${error instanceof Error ? error.message : String(error)}`))
      })
    }

    const deliverFault = (
      body: string,
      coalesce: "fault" | "recovered" | "overflow",
    ): Effect.Effect<void> => {
      const to = lastBound
      if (to === undefined) return Effect.logWarning(`spaces: ${body.split("\n")[0] ?? body}`)
      return deliveries.notify(to, () => body, { coalesce })
    }

    const connected = (): SpacesLink => ({
      status: "connected",
      where: env.url ?? current.where,
      told: true,
      why: null,
      since: clock.now(),
    })

    const missingEnv = env.url === null || env.token === null

    const namedWhere = (): string => {
      const one = reading.named[0]
      return one === undefined ? "a node agent" : `${one.file} node \`${one.node}\``
    }

    const sayUnconfigured = (): string => {
      const body = unconfiguredBody(env.link.where, namedWhere(), clock.now())
      const why = body.split("\n")[0] ?? body
      if (current.status !== "fault" || current.why !== why) {
        paint({
          status: "fault",
          where: env.link.where,
          told: env.link.told,
          why,
          since: clock.now(),
        })
      }
      return body
    }

    const ensureMirror = (channel: string): Effect.Effect<Mirror | null> =>
      Effect.gen(function*() {
        if (env.url === null || env.token === null) return null
        const existing = mirrors.get(channel)
        if (existing !== undefined) return existing
        const client = makeClient(env.url, env.token, environment.dial as Dial | undefined)
        const loaded = localState.load(channel)
        const mirror = makeMirror({
          client,
          channel,
          now: () => clock.now(),
          onRecovered: () => paint(connected()),
          hold: {
            load: () => loaded,
            save: (snapshot) =>
              run(Effect.ignore(localState.save(snapshot))),
          },
          deliverFault: (body, coalesce) => {
            if (coalesce === "fault") {
              paint({
                status: "fault",
                where: env.url ?? current.where,
                told: true,
                why: body.split("\n")[0] ?? body,
                since: clock.now(),
              })
            }
            run(deliverFault(body, coalesce))
          },
        })
        mirrors.set(channel, mirror)
        return mirror
      })

    const onSeen = (event: ConversationSeen): Effect.Effect<void> =>
      Effect.gen(function*() {
        const bind = bindOf(reading, event.agent, event.session)
        if (bind === undefined) return
        lastBound = { agent: event.agent, session: event.session }
        if (event.kind === "delivered" && event.from === name) return
        const mirror = yield* ensureMirror(bind.channel)
        if (mirror === null) {
          yield* deliverFault(sayUnconfigured(), "fault")
          return
        }
        const lane = laneOf(event.agent, event.session)

        if (event.kind === "delivered") {
          if (skipHeartbeat(event.body)) return
          serial(async () => {
            await mirror.postDigest(event.body, lane, reading.trim)
          })
          return
        }
        if (event.kind === "replied") {
          serial(async () => {
            await mirror.postReply(event.text, lane, reading.trim)
          })
          return
        }
        serial(async () => {
          await mirror.progress(event.status, event.session)
        })
      })

    yield* watching.subscribe(onSeen)

    yield* surfaces.register({
      surface,
      faces,
      deps: {
        cells: {
          link: {
            store: link,
            connect: (cell: { set: (value: SpacesLink) => void }) =>
              Effect.sync(() => {
                linkCell = cell
                cell.set(current)
              }),
          },
        },
      } satisfies ImplementSurfaceDeps<typeof surface.spec>,
    })

    yield* vault.revision((revision: VaultRevision) =>
      Effect.sync(() => {
        reading = spacesConfigIn(revision.value.derived, seating.in(revision.value.derived), settings["reply-limit"])
        if (!missingEnv) return
        if (reading.named.length > 0) run(deliverFault(sayUnconfigured(), "fault"))
        else if (current.status !== "absent") paint(env.link)
      })
    )

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        for (const mirror of mirrors.values()) mirror.stop()
        mirrors.clear()
      })
    )
  }),
})

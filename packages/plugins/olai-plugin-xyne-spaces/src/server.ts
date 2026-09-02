/**
 * SPACES' SERVER HALF — the outbound mirror, assembled where the judgement
 * about it lives.
 *
 * Watch-only: this half posts, updates, and signals progress. It declares no
 * `wake` and no probe. Binding is the config file, not the doorbell picker.
 * Faults still go INTO the bound conversation through `deliveries.deliver`,
 * which is the doorbell fault pattern and does not need a wake declaration.
 *
 * Conversation events arrive through `services.watching` — core PUSHES
 * doorbells that landed, agent replies that settled, and turn start/end.
 * This plugin never reads a transcript.
 */

import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import { inMemoryStore } from "@kolu/surface/server"
import {
  conventionServed,
  type Convention,
  type Derived,
  type OutlineSet,
} from "@olai/format"
import { Effect } from "effect"

import { makeClient, originOf, type Dial } from "./client.ts"
import {
  boundTo,
  DEFAULT_TRIM,
  spacesConfigIn,
  spacesFileIn,
  type SpacesReading,
} from "./config.ts"
import { recordOf, snapshotOf } from "./hold.ts"
import { laneOf, makeMirror, skipHeartbeat, unconfiguredBody, type Mirror } from "./mirror.ts"
import {
  name,
  type SpacesLink,
  surface,
} from "./wire.ts"

export { faces, name, surface } from "./wire.ts"

/**
 * WHAT THIS HALF ASKS CORE FOR, out of what core offers every plugin.
 *
 * `watching` is the new door this tenant exists to spend: conversation
 * events, pushed, with human messages simply not among them. `deliveries`
 * is the fault path the other way — a refused post is said ONCE into the
 * bound conversation. `held` is the thread map and the outbound queue,
 * core's file in the state home. `dial` is a fake `fetch`, for the suite.
 */
export interface Services {
  readonly env: Record<string, string | undefined>
  readonly served: string
  readonly now: () => string
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
  readonly dial?: unknown
  readonly deliveries: Deliveries
  readonly watching: Watching
  /** Re-declared STRUCTURALLY — `@olai/plugin-api`'s `PluginHeld`. Core owns
   *  the file and orders the writes; this half parses what it wrote. */
  readonly held: Held
}

/** Re-declared STRUCTURALLY — `@olai/plugin-api`'s `PluginHeld`. */
export interface Held {
  readonly load: () => Record<string, unknown> | null
  readonly save: (value: Record<string, unknown>) => void
}

/** Re-declared STRUCTURALLY — `@olai/plugin-api`'s `Deliveries`. This package
 *  must not import that one. */
export interface Deliveries {
  readonly scopes: () => ReadonlyArray<{
    readonly agent: string
    readonly session: string
    readonly file: string
  }>
  readonly deliver: (
    to: { readonly agent: string; readonly session: string },
    say: () => string | null,
    options?: { readonly coalesce?: string },
  ) => void
}

/** Re-declared STRUCTURALLY — `@olai/plugin-api`'s `Watching`. */
export interface Watching {
  readonly subscribe: (handler: (event: ConversationSeen) => void) => () => void
}

export type ConversationSeen =
  | {
    readonly kind: "delivered"
    readonly id: string
    readonly from: string
    readonly agent: string
    readonly session: string
    readonly body: string
  }
  | {
    readonly kind: "replied"
    readonly id: string
    readonly agent: string
    readonly session: string
    readonly text: string
  }
  | {
    readonly kind: "turn"
    readonly agent: string
    readonly session: string
    readonly status: "working" | "done"
  }

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

export const serve = (services: Services): {
  readonly deps: ImplementSurfaceDeps<typeof surface.spec>
  readonly published: (ctx: unknown) => void
  readonly revision: (revision: VaultRevision) => void
  readonly unloaded: () => void
  /** The pill's current reading — what `link` last painted. Tests read
   *  this; the browser reads the cell. */
  readonly link: () => SpacesLink
} => {
  const env = linkFromEnv(services.env, services.now())
  let current: SpacesLink = env.link
  let linkCell: { set: (value: SpacesLink) => void } | undefined
  let file: Convention | undefined
  let reading: SpacesReading = { bind: null, trim: DEFAULT_TRIM, malformed: [] }
  let mirror: Mirror | undefined
  let lastBound: { agent: string; session: string } | undefined
  let chain = Promise.resolve()

  const paint = (next: SpacesLink): void => {
    current = next
    linkCell?.set(next)
  }

  const serial = (work: () => Promise<void>): void => {
    chain = chain.then(work, work).then(undefined, (error: unknown) => {
      services.warn(`spaces: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  const deliverFault = (body: string, coalesce: "fault" | "recovered" | "overflow"): void => {
    const to = lastBound
    if (to === undefined) {
      services.warn(`spaces: ${body.split("\n")[0] ?? body}`)
      return
    }
    services.deliveries.deliver(to, () => body, { coalesce })
  }

  const connected = (): SpacesLink => ({
    status: "connected",
    where: env.url ?? current.where,
    told: true,
    why: null,
    since: services.now(),
  })

  const missingEnv = env.url === null || env.token === null

  const boundFile = (): string => file?.file ?? "_olai/Spaces.olai"

  /** Bind without env is a FAULT: the user named a channel. Quiet
   *  `absent` is only for a machine that never did. */
  const sayUnconfigured = (): string => {
    const body = unconfiguredBody(env.link.where, boundFile(), services.now())
    const why = body.split("\n")[0] ?? body
    if (current.status !== "fault" || current.why !== why) {
      paint({
        status: "fault",
        where: env.link.where,
        told: env.link.told,
        why,
        since: services.now(),
      })
    }
    return body
  }

  const ensureMirror = (): Mirror | null => {
    if (env.url === null || env.token === null) return null
    const channel = reading.bind?.channel
    if (channel === undefined) return null
    if (mirror !== undefined) return mirror
    const client = makeClient(env.url, env.token, services.dial as Dial | undefined)
    const loaded = snapshotOf(services.held.load())
    mirror = makeMirror({
      client,
      channel,
      now: services.now,
      onRecovered: () => paint(connected()),
      hold: {
        load: () => loaded !== undefined && loaded.channel === channel ? loaded : undefined,
        save: (held) => services.held.save(recordOf(held)),
      },
      deliverFault: (body, coalesce) => {
        if (coalesce === "fault") {
          paint({
            status: "fault",
            where: env.url ?? current.where,
            told: true,
            why: body.split("\n")[0] ?? body,
            since: services.now(),
          })
        }
        deliverFault(body, coalesce)
      },
    })
    return mirror
  }

  const onSeen = (event: ConversationSeen): void => {
    if (!boundTo(reading.bind, event.agent, event.session)) return
    lastBound = { agent: event.agent, session: event.session }
    if (event.kind === "delivered" && event.from === name) return
    const held = ensureMirror()
    if (held === null) {
      deliverFault(sayUnconfigured(), "fault")
      return
    }
    const lane = laneOf(event.agent, event.session)

    if (event.kind === "delivered") {
      if (skipHeartbeat(event.body)) return
      serial(async () => {
        await held.postDigest(event.body, lane, reading.trim)
      })
      return
    }
    if (event.kind === "replied") {
      serial(async () => {
        await held.postReply(event.text, lane, reading.trim)
      })
      return
    }
    serial(async () => {
      await held.progress(event.status, event.session)
    })
  }

  const stop = services.watching.subscribe(onSeen)

  return {
    deps: {
      cells: {
        link: {
          store: inMemoryStore(current),
          connect: (cell: { set: (value: SpacesLink) => void }) =>
            Effect.sync(() => {
              linkCell = cell
              cell.set(current)
            }),
        },
      },
    },
    published: () => {},
    revision: (revision) => {
      file = conventionServed(spacesFileIn, revision.value.set, revision, file)
      const next = spacesConfigIn(revision.value.derived.nodes, file.file ?? null)
      for (const line of next.malformed) {
        if (!reading.malformed.includes(line)) services.warn(line)
      }
      const channelChanged = next.bind?.channel !== reading.bind?.channel
      reading = next
      if (channelChanged) {
        mirror?.stop()
        mirror = undefined
      }
      if (missingEnv) {
        if (next.bind !== null) deliverFault(sayUnconfigured(), "fault")
        else if (current.status !== "absent") paint(env.link)
      }
    },
    link: () => current,
    unloaded: () => {
      stop()
      mirror?.stop()
      file = undefined
      mirror = undefined
    },
  }
}

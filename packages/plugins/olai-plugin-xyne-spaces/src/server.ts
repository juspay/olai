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
import { makeMirror, skipHeartbeat, type Mirror } from "./mirror.ts"
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
 * bound conversation. `dial` is a fake `fetch`, for the suite.
 */
export interface Services {
  readonly env: Record<string, string | undefined>
  readonly now: () => string
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
  readonly dial?: unknown
  readonly deliveries: Deliveries
  readonly watching: Watching
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
    readonly from: string
    readonly agent: string
    readonly session: string
    readonly body: string
  }
  | {
    readonly kind: "replied"
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
        where: url === null
          ? "OLAI_SPACES_URL"
          : "OLAI_SPACES_TOKEN",
        told: url !== null,
        why: null,
        since: now,
      },
    }
  }
  return {
    url: originOf(url),
    token,
    link: {
      status: "connected",
      where: originOf(url),
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
} => {
  const env = linkFromEnv(services.env, services.now())
  let current: SpacesLink = env.link.since === ""
    ? { ...env.link, since: services.now() }
    : env.link
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
    chain = chain.then(work, work)
  }

  const deliverFault = (body: string): void => {
    const to = lastBound
    if (to === undefined) {
      services.warn(`spaces: ${body.split("\n")[0] ?? body}`)
      return
    }
    services.deliveries.deliver(to, () => body, { coalesce: "fault" })
  }

  const ensureMirror = (): Mirror | null => {
    if (env.url === null || env.token === null) return null
    const channel = reading.bind?.channel
    if (channel === undefined) return null
    if (mirror !== undefined) return mirror
    const client = makeClient(env.url, env.token, services.dial as Dial | undefined)
    mirror = makeMirror({
      client,
      channel,
      now: services.now,
      deliverFault: (body) => {
        paint({
          status: "fault",
          where: env.url ?? current.where,
          told: true,
          why: body.split("\n")[0] ?? body,
          since: services.now(),
        })
        deliverFault(body)
      },
    })
    return mirror
  }

  const onSeen = (event: ConversationSeen): void => {
    if (!boundTo(reading.bind, event.agent, event.session)) return
    lastBound = { agent: event.agent, session: event.session }
    const held = ensureMirror()
    if (held === undefined || held === null) return

    if (event.kind === "delivered") {
      if (event.from === name) return
      if (skipHeartbeat(event.body)) return
      serial(async () => {
        await held.postDigest(event.body)
        if (!held.faulted() && current.status === "fault") {
          paint({
            status: "connected",
            where: env.url ?? current.where,
            told: true,
            why: null,
            since: services.now(),
          })
        }
      })
      return
    }
    if (event.kind === "replied") {
      serial(async () => {
        await held.postReply(event.text, reading.trim)
        if (!held.faulted() && current.status === "fault") {
          paint({
            status: "connected",
            where: env.url ?? current.where,
            told: true,
            why: null,
            since: services.now(),
          })
        }
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
      if (channelChanged) mirror = undefined
    },
    unloaded: () => {
      stop()
      file = undefined
      mirror = undefined
    },
  }
}

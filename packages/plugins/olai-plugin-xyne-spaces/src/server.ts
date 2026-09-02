/**
 * SPACES' SERVER HALF — the outbound mirror, assembled where the judgement
 * about it lives.
 *
 * Watch-only: this half posts, updates, and signals progress. It declares no
 * `wake` and no probe. Binding is `xyne-channel` on a node agent, not a
 * sidecar file and not the doorbell picker.
 * Faults still go INTO the bound conversation through `deliveries.deliver`,
 * which is the doorbell fault pattern and does not need a wake declaration.
 *
 * Conversation events arrive through `ctx.watching` — core PUSHES
 * doorbells that landed, agent replies that settled, and turn start/end.
 * This plugin never reads a transcript.
 */

import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import type { ConversationSeen } from "@olai/plugin-api"
import type {} from "@olai/plugin-api/services"
import type { Context } from "cordis"
import { inMemoryStore } from "@kolu/surface/server"
import { type Derived, type OutlineSet } from "@olai/format"
import { Effect } from "effect"

import { makeClient, originOf, type Dial } from "./client.ts"
import {
  bindOf,
  DEFAULT_TRIM,
  spacesConfigIn,
  type SpacesReading,
} from "./config.ts"
import { recordAll, snapshotsOf } from "./hold.ts"
import { laneOf, makeMirror, skipHeartbeat, unconfiguredBody, type Mirror } from "./mirror.ts"
import {
  name,
  type SpacesLink,
  surface,
} from "./wire.ts"

export { faces, name, surface } from "./wire.ts"
import { faces } from "./wire.ts"

/**
 * WHAT THIS HALF NAMES, out of what core offers every plugin — the reactive
 * coeffect, and the whole of what replaced a hand-written `Services` subset.
 *
 * The runtime holds this fiber PENDING until all of them exist, unloads it when
 * one leaves and re-applies it when one returns. `watching` is the door this
 * tenant exists to spend: conversation events, pushed, with human messages
 * simply not among them. `deliveries` is the fault path the other way — a
 * refused post is said ONCE into the bound conversation. `held` is the thread
 * map and the outbound queue, core's file in the state home. `env` carries the
 * secrets AND the test seam: `ctx.env.dial()` answers this fiber's own fake
 * `fetch`, keyed by the name the registry bound it under.
 *
 * The three shapes this file used to re-declare STRUCTURALLY — `Deliveries`,
 * `Watching`, `PluginHeld` — are imported now. They were copied because
 * `@olai/plugin-api` was the registry and imported this package back, which is
 * a cycle the manifests could not express; the registry is `@olai/bundle` and
 * the interface names no plugin, so the copies went.
 */
export const inject = [
  "clock",
  "deliveries",
  "env",
  "held",
  "log",
  "surfaces",
  "vault",
  "watching",
] as const

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


/**
 * THE SPACES HALF, INSTALLED — the bound channels it mirrors into, as
 * revertible effects on this fiber.
 *
 * It was `serve(services)`, whose return value core took apart: a `deps`, a
 * `published` hand-back, a `revision` hook, an `unloaded` hook and a `link()` a
 * test read. Every one of those is a registration this function makes for
 * itself now, and every registration carries its own undo.
 *
 * ## The `unloaded` hook was doing two different jobs, and only one of them was
 * its own
 *
 * It stopped the watching subscription and stopped every mirror — which is
 * TEARDOWN, and `unloaded` never meant that: it means the STORE has never
 * published, which is a fact about the vault and not about this plugin.
 * Reading it as teardown meant a disk that went away for a beat tore down every
 * live mirror and the subscription that would have noticed it coming back.
 *
 * Both halves land where they belong. The subscription is an effect on this
 * fiber, so it goes when the fiber goes and nothing calls `stop()`. The mirrors
 * are this half's own teardown, which is the disposer `apply` returns — the
 * seam the phase named for exactly a half with teardown beyond its
 * registrations, and this is the first plugin to have one.
 */
export function apply(ctx: Context): () => void {
  const env = linkFromEnv(ctx.env.vars, ctx.clock.now())
  let current: SpacesLink = env.link
  /** THE PILL.S READING, and the one place it lives. The cell.s store is what
   *  the framework serves and what the browser reads; `linkCell` below is the
   *  live publisher the connector hands over, and it does not exist until a
   *  runtime implements this sibling. Writing the STORE as well is what makes
   *  the reading true before that — and what lets a bench read the same value a
   *  person sees rather than a second one beside it. */
  const link = inMemoryStore(current)
  let linkCell: { set: (value: SpacesLink) => void } | undefined
  let reading: SpacesReading = { binds: [], named: [], trim: DEFAULT_TRIM }
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
      ctx.log.warn(`spaces: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  const deliverFault = (body: string, coalesce: "fault" | "recovered" | "overflow"): void => {
    const to = lastBound
    if (to === undefined) {
      ctx.log.warn(`spaces: ${body.split("\n")[0] ?? body}`)
      return
    }
    ctx.deliveries.deliver(to, () => body, { coalesce })
  }

  const connected = (): SpacesLink => ({
    status: "connected",
    where: env.url ?? current.where,
    told: true,
    why: null,
    since: ctx.clock.now(),
  })

  const missingEnv = env.url === null || env.token === null

  const namedWhere = (): string => {
    const one = reading.named[0]
    return one === undefined ? "a node agent" : `${one.file} node \`${one.node}\``
  }

  /** A node agent with xyne-channel and no env is a FAULT: the user named
   *  a channel. Quiet `absent` is only for a machine that never did. */
  const sayUnconfigured = (): string => {
    const body = unconfiguredBody(env.link.where, namedWhere(), ctx.clock.now())
    const why = body.split("\n")[0] ?? body
    if (current.status !== "fault" || current.why !== why) {
      paint({
        status: "fault",
        where: env.link.where,
        told: env.link.told,
        why,
        since: ctx.clock.now(),
      })
    }
    return body
  }

  const ensureMirror = (channel: string): Mirror | null => {
    if (env.url === null || env.token === null) return null
    const existing = mirrors.get(channel)
    if (existing !== undefined) return existing
    const client = makeClient(env.url, env.token, ctx.env.dial() as Dial | undefined)
    const loaded = snapshotsOf(ctx.held.load()).get(channel)
    const mirror = makeMirror({
      client,
      channel,
      now: () => ctx.clock.now(),
      onRecovered: () => paint(connected()),
      hold: {
        load: () => loaded,
        save: (held) => {
          const next = snapshotsOf(ctx.held.load())
          next.set(held.channel, held)
          ctx.held.save(recordAll(next))
        },
      },
      deliverFault: (body, coalesce) => {
        if (coalesce === "fault") {
          paint({
            status: "fault",
            where: env.url ?? current.where,
            told: true,
            why: body.split("\n")[0] ?? body,
            since: ctx.clock.now(),
          })
        }
        deliverFault(body, coalesce)
      },
    })
    mirrors.set(channel, mirror)
    return mirror
  }

  const onSeen = (event: ConversationSeen): void => {
    const bind = bindOf(reading, event.agent, event.session)
    if (bind === undefined) return
    lastBound = { agent: event.agent, session: event.session }
    if (event.kind === "delivered" && event.from === name) return
    const held = ensureMirror(bind.channel)
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


  /** BE TOLD WHAT HAPPENED IN A CONVERSATION — the whole reason this tenant
   *  exists, and an EFFECT rather than a handle. `subscribe` returns a disposer
   *  attached to this fiber, so a plugin that unloads stops being told without
   *  anything here remembering to say so. */
  ctx.watching.subscribe(onSeen)

  /** THE SIBLING SURFACE — one cell. `deps` is annotated against THIS package's
   *  own spec, so a cell the mirror re-shaped is a type error in this file
   *  rather than a boot crash in somebody's composition root. No `published`:
   *  this half writes to its member from inside the framework's own connector. */
  ctx.surfaces.register({
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

  /** A VAULT REVISION LANDED — the bind rows and the trim, re-read.
   *
   *  THE PAYLOAD IS NARROWED HERE, in this plugin's own signature: core emits
   *  the whole published snapshot and {@link VaultRevision} names the parts this
   *  half touches. */
  ctx.on("vault/revision", (snapshot) => {
    const revision = snapshot as VaultRevision
    reading = spacesConfigIn(revision.value.derived)
    if (missingEnv) {
      if (reading.named.length > 0) deliverFault(sayUnconfigured(), "fault")
      else if (current.status !== "absent") paint(env.link)
    }
  })

  /** ...AND THIS HALF'S OWN TEARDOWN, which is the one thing the runtime cannot
   *  do for it: a mirror holds a channel and a queue, and dropping the fiber has
   *  to drop those too. Returned from `apply`, which is where the runtime looks
   *  for a disposer, and it runs after every registration above has unwound. */
  return () => {
    for (const mirror of mirrors.values()) mirror.stop()
    mirrors.clear()
  }
}

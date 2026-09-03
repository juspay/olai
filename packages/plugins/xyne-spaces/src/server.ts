/**
 * SPACES' SERVER HALF — the outbound mirror, assembled where the judgement about
 * it lives.
 *
 * Watch-only: this half posts, updates, and signals progress. It declares no
 * `wake` and no probe. Binding is `xyne-channel` on a node agent, not a sidecar
 * file and not the doorbell picker.
 * Faults still go INTO the bound conversation through `deliveries.deliver`,
 * which is the doorbell fault pattern and does not need a wake declaration.
 *
 * Conversation events arrive through the `Watching` door — core PUSHES doorbells
 * that landed, agent replies that settled, and turn start/end. This plugin never
 * reads a transcript.
 */

import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import type { ConversationSeen } from "@olai/plugin-api"
import {
  Clock,
  definePlugin,
  Deliveries,
  detached,
  Env,
  Held,
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
 * THE SPACES HALF, INSTALLED — the bound channels it mirrors into, as finalizers
 * on this plugin's scope.
 *
 * It was `serve(services)`, whose return value core took apart: a `deps`, a
 * `published` hand-back, a `revision` hook, an `unloaded` hook and a `link()` a
 * test read. Every one of those is a registration this Effect makes for itself
 * now, and every registration carries its own undo.
 *
 * ## WHAT THIS HALF NAMES, and the subset IS the documentation
 *
 * The runtime holds this plugin PENDING until all of them exist, unloads it when
 * one leaves and re-applies it when one returns; the compiler holds the same
 * line one step earlier, because `needs` is what this Effect's `R` is computed
 * from. `Watching` is the door this tenant exists to spend: conversation events,
 * pushed, with human messages simply not among them. `Deliveries` is the fault
 * path the other way — a refused post is said ONCE into the bound conversation.
 * `Held` is the thread map and the outbound queue, core's file in the state
 * home. `Env` carries the secrets AND the test seam: `env.dial` is this plugin's
 * own fake `fetch`, resolved from the word the registry bound it under.
 *
 * ## The `unloaded` hook was doing two different jobs, and only one of them was
 * its own
 *
 * It stopped the watching subscription and stopped every mirror — which is
 * TEARDOWN, and `unloaded` never meant that: it means the STORE has never
 * published, which is a fact about the vault and not about this plugin. Reading
 * it as teardown meant a disk that went away for a beat tore down every live
 * mirror and the subscription that would have noticed it coming back.
 *
 * Both halves land where they belong. The subscription is a finalizer on this
 * plugin's scope, so it goes when the plugin goes and nothing calls `stop()`.
 * The mirrors are this half's own teardown, which is the `Effect.addFinalizer`
 * at the foot of this function — the seam the phase named for exactly a half
 * with teardown beyond its registrations, and this is the first plugin to have
 * one.
 */
export default definePlugin({
  name,
  needs: [Clock, Deliveries, Env, Held, Surfaces, Vault, Watching],
  apply: Effect.gen(function*() {
    // EVERY SERVICE THIS PLUGIN NAMED, YIELDED ONCE, at the top — the same list
    // `needs` carries, in the same order, so a reader checks the two against each
    // other by looking at one screen.
    const clock = yield* Clock
    const deliveries = yield* Deliveries
    const environment = yield* Env
    const held = yield* Held
    const surfaces = yield* Surfaces
    const vault = yield* Vault
    const watching = yield* Watching
    /** THE ONE SEAM ACROSS THE BOUNDARY — `@olai/effect-cordis`'s `detached`.
     *  `makeMirror` is not written in Effect: it calls back to save a snapshot
     *  and to say a fault, and both of those are Effects on this side. */
    const run = yield* detached

    const env = linkFromEnv(environment.vars, clock.now())
    let current: SpacesLink = env.link
    /** THE PILL'S READING, and the one place it lives. The cell's store is what
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

    /** THE OUTBOUND POSTS, ONE AT A TIME — a promise chain rather than a fiber,
     *  because `makeMirror` is a promise API and the ORDER is the point: two
     *  digests for one lane must land in the order the conversation had them. */
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
      return deliveries.deliver(to, () => body, { coalesce })
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

    /** A node agent with xyne-channel and no env is a FAULT: the user named a
     *  channel. Quiet `absent` is only for a machine that never did. */
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
        const loaded = snapshotsOf(yield* held.load).get(channel)
        const mirror = makeMirror({
          client,
          channel,
          now: () => clock.now(),
          onRecovered: () => paint(connected()),
          hold: {
            load: () => loaded,
            save: (snapshot) =>
              run(Effect.gen(function*() {
                const next = snapshotsOf(yield* held.load)
                next.set(snapshot.channel, snapshot)
                yield* held.save(recordAll(next))
              })),
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

    /** BE TOLD WHAT HAPPENED IN A CONVERSATION — the whole reason this tenant
     *  exists, and a REGISTRATION rather than a handle. `subscribe` attaches to
     *  this plugin's scope, so a plugin that unloads stops being told without
     *  anything here remembering to say so. */
    yield* watching.subscribe(onSeen)

    /** THE SIBLING SURFACE — one cell. `deps` is annotated against THIS package's
     *  own spec, so a cell the mirror re-shaped is a type error in this file
     *  rather than a boot crash in somebody's composition root. No `published`:
     *  this half writes to its member from inside the framework's own
     *  connector. */
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

    /**
     * A VAULT REVISION LANDED — the bind rows and the trim, re-read.
     *
     * THE PAYLOAD IS NARROWED HERE, in this plugin's own signature: core rings
     * the whole published snapshot and {@link VaultRevision} names the parts
     * this half touches. The door is generic in its payload, so that signature
     * IS the narrowing — inferred, rather than asserted inside the handler, and
     * a CLAIM rather than a check: the payload type is the caller's to pick, so
     * nothing holds this line against what the root publishes (the door's own
     * paragraph argues why a checked one needs a schema and a decode).
     *
     * ## THE RE-DERIVE IS THE HANDLER; THE FAULT IS DETACHED
     *
     * The door AWAITS every handler and the root awaits the door, so whatever
     * this function yields is a statement the directory fiber waits for before
     * it writes the collections, the heads and the roster. What that await is
     * FOR is *"every plugin has re-derived"* — and the re-derive here is the one
     * synchronous assignment above, the same shape kolu's and odu's handlers
     * keep.
     *
     * The fault is not that. `deliverFault` is a `deliveries.deliver`, which
     * flushes into a conversation — and when `lastBound` is the idle on-screen
     * one, that means writing a transcript row and BEGINNING A TURN. Yielded
     * here, a misconfigured channel put an agent turn on the directory fiber's
     * critical path, once per revision. It was fire-and-forget before this
     * phase and it is again, through the one named seam.
     */
    yield* vault.revision((revision: VaultRevision) =>
      Effect.sync(() => {
        reading = spacesConfigIn(revision.value.derived)
        if (!missingEnv) return
        if (reading.named.length > 0) run(deliverFault(sayUnconfigured(), "fault"))
        else if (current.status !== "absent") paint(env.link)
      })
    )

    /** ...AND THIS HALF'S OWN TEARDOWN, which is the one thing the runtime cannot
     *  do for it: a mirror holds a channel and a queue, and dropping the plugin
     *  has to drop those too. A finalizer on this plugin's scope, registered
     *  LAST so it runs FIRST — the accumulator unwinds in reverse, so the
     *  mirrors stop before the subscription that feeds them is taken off the
     *  bus. */
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        for (const mirror of mirrors.values()) mirror.stop()
        mirrors.clear()
      })
    )
  }),
})

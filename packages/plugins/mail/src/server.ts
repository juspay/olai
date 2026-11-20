/**
 * The activation gate cuts and joins tool calls before resources close. The
 * watcher and refresh fibers stop before attachments and the config directory
 * close.
 */
import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import { inMemoryStore } from "@kolu/surface/server"
import {
  Clock,
  Deliveries,
  Offers,
  Wakes,
  definePlugin,
  detached,
  Env,
  LocalState,
  Surfaces,
} from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import { Effect, Queue, Stream } from "effect"

import { type Account, MAIL_UNCONNECTED, name, surface, faces } from "./wire.ts"
import { type Configuration } from "@olai/plugin-api/configuration"
import { ConfigurationWatch, serviceTag } from "@olai/plugin-api/services"
import { Config, pollMillis } from "./settings.ts"
import { makeWatch } from "./watch.ts"
import { openMailbox } from "./mailbox.ts"
import { makeTools } from "./tools.ts"
import { makeAccount } from "./account.ts"
import { DOOR } from "./doors.ts"
import { makeHimalaya } from "./himalaya/run.ts"
import { openMemory } from "./local.ts"
import { FORM_CONTENT_TYPE, googleOf } from "./oauth.ts"
import { mailRoute } from "./route.ts"

export { Config } from "./settings.ts"
export { faces, name, surface } from "./wire.ts"

const doorOf = (vars: Record<string, string | undefined>, key: string): string | undefined => {
  const value = vars[key]
  return value === undefined || value.trim() === "" ? undefined : value.trim()
}

const DEFAULT_POLL_MS = 120_000

export default definePlugin({
  environment: [
    {
      key: DOOR.himalaya,
      secret: false,
      says: "the pinned Himalaya this build runs, baked on the wrapper",
    },
    {
      key: DOOR.client,
      secret: false,
      says: "the Google OAuth client id (type: Web application) for this serve",
    },
    {
      key: DOOR.secret,
      secret: true,
      says: "the Google OAuth client secret that goes with the client id",
    },
    {
      key: DOOR.google,
      secret: false,
      says: "the Google origin this serve talks to — loopback only, and unset in every deployment",
    },
  ],
  name,
  needs: [Clock, Env, LocalState, Surfaces, TransportSurface, Deliveries, Wakes, Offers],
  config: Config,
  configUpdates: "live",
  apply: Effect.gen(function*() {
    const deliveries = yield* Deliveries
    yield* (yield* Wakes).register(wake)
    const clock = yield* Clock
    const environment = yield* Env
    const localState = yield* LocalState
    const surfaces = yield* Surfaces
    const transport = yield* TransportSurface
    const run = yield* detached
    const warn = (line: string): void => run(Effect.logWarning(line))

    const himalaya = makeHimalaya({ binary: doorOf(environment.vars, DOOR.himalaya), env: environment.vars })
    yield* Effect.addFinalizer(() => Effect.promise(() => himalaya.close()))

    const memory = yield* openMemory(localState, warn)

    const store = inMemoryStore(MAIL_UNCONNECTED)
    let connector: { set: (value: Account) => void } | undefined
    const paint = (next: Account): void => {
      if (connector === undefined) store.set(next)
      else connector.set(next)
    }

    const machine = makeAccount({
      clock,
      client: doorOf(environment.vars, DOOR.client),
      secret: doorOf(environment.vars, DOOR.secret),
      google: googleOf(doorOf(environment.vars, DOOR.google)),
      himalaya,
      memory,
      post: async (request) => {
        const answer = await fetch(request.url, {
          method: "POST",
          headers: { "content-type": FORM_CONTENT_TYPE },
          body: request.body,
          signal: AbortSignal.timeout(30_000),
        })
        return { status: answer.status, body: await answer.text() }
      },
      paint,
      warn,
    })

    const mailbox = yield* openMailbox(himalaya, machine, environment.vars["XDG_RUNTIME_DIR"])

    yield* surfaces.register({
      surface,
      faces,
      tools: yield* makeTools(mailbox),
      deps: {
        cells: {
          account: {
            store,
            connect: (cell: { set: (value: Account) => void }) =>
              Effect.sync(() => {
                connector = cell
                cell.set(machine.current())
              }),
          },
        },
        procedures: {
          connect: {
            begin: ({ input }) => machine.begin(input.origin),
            disconnect: () => machine.disconnect().pipe(Effect.as({})),
          },
        },
      } satisfies ImplementSurfaceDeps<typeof surface.spec>,
    })

    yield* transport.register({ passive: true, routes: mailRoute(machine) })

    yield* Effect.forkScoped(machine.boot())
    yield* Effect.forkScoped(machine.refresh)
    const watcher = makeWatch({ mailbox, memory, machine, deliveries, clock, warn,
      debug: line => run(Effect.logDebug(line)),
    })
    let pollMs = DEFAULT_POLL_MS
    const changed = yield* Queue.unbounded<void>()
    yield* (yield* Offers).own("poll", () => ({ set: (next: number) => {
      if (next !== pollMs) { pollMs = next; Queue.offerUnsafe(changed, undefined) }
    } }))
    yield* Effect.forkScoped(Effect.forever(Effect.gen(function*() {
      const due = yield* Effect.raceFirst(Effect.sleep(pollMs).pipe(Effect.as(true)), Queue.take(changed).pipe(Effect.as(false)))
      if (due) yield* watcher.poll
    })))
  }),
})

const Poll = serviceTag<{ readonly set: (ms: number) => void }>("mail.poll")
export const wake = { subject: "wake on new mail", waiting: { one: "mail event waiting", many: "mail events waiting" } }
export const components = {
  cadence: definePlugin({ name: "cadence", needs: [ConfigurationWatch, Poll], apply: Effect.gen(function*() {
    const watch = yield* ConfigurationWatch
    const poll = yield* Poll
    const update = (value: Configuration) => Effect.sync(() => {
      const configured = value.rows.get("mail")?.config.poll
      poll.set(typeof configured === "string" ? pollMillis(configured) ?? DEFAULT_POLL_MS : DEFAULT_POLL_MS)
    })
    const now = watch.current()
    if (now !== undefined) yield* update(now)
    yield* Effect.forkScoped(Stream.runForEach(
      Stream.filter(watch.changes, (value): value is Configuration => value !== undefined),
      update,
    ))
  }) }),
}

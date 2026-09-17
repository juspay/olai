/**
 * Mail owns its OAuth route, token broker, generated config and account cell.
 * Its MCP tool closures also own a label cache, four spawn permits, per-thread
 * write permits and a temporary attachment directory. The activation gate cuts
 * and joins tool calls before resources close. The watcher and refresh fibers
 * stop before attachments and the config directory close. The watcher reads
 * Deliveries.scopes() for its recipients and holds no vault reading. All pending
 * digest state dies with the row.
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
import { ConfigurationSource } from "@olai/plugin-api/configuration"
import { serviceTag } from "@olai/plugin-api/services"
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

/** The trimmed value of a door, or `undefined` — because an empty string is how
 *  a wrapper's off switch and a systemd unit's blank line both arrive, and both
 *  mean *not set*. */
const doorOf = (vars: Record<string, string | undefined>, key: string): string | undefined => {
  const value = vars[key]
  return value === undefined || value.trim() === "" ? undefined : value.trim()
}

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
    /** THE ONE SEAM ACROSS THE BOUNDARY — a `warn` from the synchronous parts
     *  of the machine into this plugin's own log line. */
    const run = yield* detached
    const warn = (line: string): void => run(Effect.logWarning(line))

    // THE CHILD'S ENVIRONMENT IS COMPOSED HERE, from the declared `Env` door
    // rather than from `process.env` — `./himalaya/run.ts` says which names
    // and why that list is an allowlist rather than an inheritance. Which
    // BINARY is not read here at all: the runner holds that fact and the
    // machine asks it (`./doors.ts` names the variable).
    const himalaya = makeHimalaya({ binary: doorOf(environment.vars, DOOR.himalaya), env: environment.vars })
    yield* Effect.addFinalizer(() => Effect.promise(() => himalaya.close()))

    const memory = yield* openMemory(localState, warn)

    /** THE CELL'S TWO READERS, and the ONE WRITER each paint uses.
     *
     * `connector` is the live publisher the sibling connector hands over, and
     * it does not exist until a client implements this sibling; the `store` is
     * what the framework serves, and it is what a reader's first frame is read
     * from — so it is written while no client is bound, and what a bench reads
     * off the same value a person sees rather than a second one beside it.
     *
     * ONCE A CONNECTOR EXISTS, IT IS THE ONLY WRITER, and that is a rule rather
     * than a tidiness. The connector's `set` is the framework's own write path —
     * the equals gate, the store write and the bus publish that every OPEN
     * subscription is relayed by — and it is gated on the value being DIFFERENT
     * from the store's. Writing the store here first therefore did not `publish
     * twice`: it made the connector's write a no-op, so a tab that was already
     * open never heard about a connect at all while a tab opened later read the
     * new value out of the store and looked perfectly right. */
    const store = inMemoryStore(MAIL_UNCONNECTED)
    let connector: { set: (value: Account) => void } | undefined
    /** THE ONE WRITER. The reading itself is the MACHINE's (`./account.ts` keeps
     *  it and hands it back through `current`), so this half owns only what to
     *  do with it: the framework's write path once a connector has been bound,
     *  and the store before that, which is what makes the reading true for a
     *  client that attaches later. Two copies of the value — one here and one
     *  there — is exactly how they would drift. */
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
      // THE PLATFORM'S OWN POST, and the only line of this plugin that knows
      // what a `fetch` is. `FORM_CONTENT_TYPE` is `./oauth.ts`'s, because the
      // body it describes was composed there.
      post: async (request) => {
        const answer = await fetch(request.url, {
          method: "POST",
          headers: { "content-type": FORM_CONTENT_TYPE },
          body: request.body,
          // BOUNDED, and the deadline is what makes the timeout arm reachable:
          // a socket nobody answers throws here, the machine reads that as
          // `unreachable` and retries with backoff rather than parking a row
          // that would otherwise sit on the seed `absent` forever
          // (`./account.ts`'s header says which failures are which).
          signal: AbortSignal.timeout(30_000),
        })
        return { status: answer.status, body: await answer.text() }
      },
      paint,
      warn,
    })

    const mailbox = yield* openMailbox(himalaya, machine, environment.vars["XDG_RUNTIME_DIR"])

    /** ONE CELL AND TWO PROCEDURES. `deps` is annotated against THIS package's
     *  own spec, so a member renamed in `./wire.ts` is a type error here rather
     *  than a boot crash in somebody's composition root. No `published`: this
     *  half writes to its member from inside the framework's own connector. */
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

    /** THE REDIRECT'S DOOR, on the listener this serve already has. Passive:
     *  the route is added to a transport somebody else opened, and it is
     *  withdrawn with this row. */
    yield* transport.register({ passive: true, routes: mailRoute(machine) })

    /** THE TWO FIBERS, forked onto this plugin's scope so the row's switch is
     *  what stops them. Boot FIRST, because it is what offers the refresh
     *  fiber its first deadline — the fiber takes from a queue of deadlines and
     *  parks while it has none, so the other order would only have it wait a
     *  moment longer. Both are forked rather than awaited: activation must not
     *  wait on a network round trip, and a serve whose mailbox is slow to
     *  answer still draws its app. */
    yield* Effect.forkScoped(machine.boot())
    yield* Effect.forkScoped(machine.refresh)
    const watcher = makeWatch({ mailbox, memory, machine, deliveries, clock, warn,
      debug: line => run(Effect.logDebug(line)),
    })
    let pollMs = 120_000
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
  cadence: definePlugin({ name: "cadence", needs: [ConfigurationSource, Poll], apply: Effect.gen(function*() {
    const source = yield* ConfigurationSource
    const poll = yield* Poll
    const update = (value: ReturnType<typeof source.current>) => Effect.sync(() => {
      const configured = value.rows.get("mail")?.config.poll
      poll.set(typeof configured === "string" ? pollMillis(configured) ?? 120_000 : 120_000)
    })
    yield* update(source.current())
    yield* Effect.forkScoped(Stream.runForEach(source.changes, update))
  }) }),
}

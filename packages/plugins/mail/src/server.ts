/**
 * MAIL'S SERVER HALF — the row, assembled where the judgement about Gmail
 * lives.
 *
 * ## What this half owns, and what owns it
 *
 * Four things are this row's, and all four are tied to this activation:
 *
 *   - the TOKEN BROKER (`./account.ts`) — the refresh token in core's memory
 *     door, the access token in a generated config, and the fiber that keeps it
 *     live;
 *   - the CONFIG DIRECTORY (`./himalaya/run.ts`) — a `mkdtemp` of the process,
 *     removed when the scope closes;
 *   - the PASSIVE ROUTE (`./route.ts`) — Google's redirect lands on this
 *     serve's own listener while the row is standing, and the route leaves with
 *     it;
 *   - the ACCOUNT CELL, which is the pill and the panel row.
 *
 * Switching the row off withdraws all four, in the reverse of the order they
 * were taken, because every one of them is a registration or a finalizer on
 * this apply's scope rather than a value something else holds.
 *
 * ## The doors, and why each is DECLARED rather than reached for
 *
 * `Env` is where `OLAI_HIMALAYA` and the two credential doors arrive — never
 * `process.env`, because a plugin that read the process directly would be a
 * plugin nobody could tell what it spends, and the panel's environment readings
 * are drawn from this declaration. `Clock` is the serve's time, so a stamp in a
 * cell and a stamp in a log are the same clock. `LocalState` is the memory file.
 * `Surfaces` publishes the account and the two procedures. `TransportSurface` is
 * the listener the redirect lands on.
 *
 * `Vault` is NOT named. The plan for this plugin lists it, and nothing in PR 1
 * reads the served directory: a `needs` entry is a claim that this plugin
 * cannot start without that door, and this plugin can — the account's record is
 * keyed by core's own hashing of the served directory, and the value never has
 * to be looked at. It arrives when an attachment needs somewhere to land (PR 2)
 * and the tools need the vault's context, which is where naming it becomes true.
 *
 * ## Off by default
 *
 * The row is `disabled: true` in `packages/bundle/olai.yml`, for
 * `olai-plugin-xyne-spaces`' reason: this plugin needs a credential, and a
 * pill in every bar for an integration nobody pointed at is the wrong default.
 * The row itself still says what it wants in its environment readings — which
 * is how a person finds out what to set before switching it on.
 */

import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import { inMemoryStore } from "@kolu/surface/server"
import {
  Clock,
  definePlugin,
  detached,
  Env,
  LocalState,
  Surfaces,
} from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import { Effect } from "effect"

import { type Account, MAIL_UNCONNECTED, name, surface, faces } from "./wire.ts"
import { makeAccount } from "./account.ts"
import { makeHimalaya } from "./himalaya/run.ts"
import { openMemory } from "./local.ts"
import { endpointsOf, FORM_CONTENT_TYPE } from "./oauth.ts"
import { mailRoute } from "./route.ts"

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
      key: "OLAI_HIMALAYA",
      secret: false,
      says: "the pinned Himalaya this build runs, baked on the wrapper",
    },
    {
      key: "OLAI_MAIL_OAUTH_CLIENT",
      secret: false,
      says: "the Google OAuth client id (type: Web application) for this serve",
    },
    {
      key: "OLAI_MAIL_OAUTH_SECRET",
      secret: true,
      says: "the Google OAuth client secret that goes with the client id",
    },
    {
      key: "OLAI_MAIL_GOOGLE",
      secret: false,
      says: "the Google origin this serve talks to — unset in every deployment",
    },
  ],
  name,
  needs: [Clock, Env, LocalState, Surfaces, TransportSurface],
  apply: Effect.gen(function*() {
    const clock = yield* Clock
    const environment = yield* Env
    const localState = yield* LocalState
    const surfaces = yield* Surfaces
    const transport = yield* TransportSurface
    /** THE ONE SEAM ACROSS THE BOUNDARY — a `warn` from the synchronous parts
     *  of the machine into this plugin's own log line. */
    const run = yield* detached
    const warn = (line: string): void => run(Effect.logWarning(line))

    const binary = doorOf(environment.vars, "OLAI_HIMALAYA")
    const himalaya = makeHimalaya(binary)
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
    let current: Account = MAIL_UNCONNECTED
    const store = inMemoryStore(current)
    let connector: { set: (value: Account) => void } | undefined
    const paint = (next: Account): void => {
      current = next
      if (connector === undefined) store.set(next)
      else connector.set(next)
    }

    const machine = makeAccount({
      binary,
      clock,
      client: doorOf(environment.vars, "OLAI_MAIL_OAUTH_CLIENT"),
      secret: doorOf(environment.vars, "OLAI_MAIL_OAUTH_SECRET"),
      endpoints: endpointsOf(doorOf(environment.vars, "OLAI_MAIL_GOOGLE")),
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
        })
        return { status: answer.status, body: await answer.text() }
      },
      paint,
      warn,
    })

    /** ONE CELL AND TWO PROCEDURES. `deps` is annotated against THIS package's
     *  own spec, so a member renamed in `./wire.ts` is a type error here rather
     *  than a boot crash in somebody's composition root. No `published`: this
     *  half writes to its member from inside the framework's own connector. */
    yield* surfaces.register({
      surface,
      faces,
      deps: {
        cells: {
          account: {
            store,
            connect: (cell: { set: (value: Account) => void }) =>
              Effect.sync(() => {
                connector = cell
                cell.set(current)
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
     *  what stops them. Boot FIRST — the refresh fiber parks itself for a
     *  second when there is nothing to refresh, and ordering the two the other
     *  way would have it wake to a deadline that has not been set yet. Both are
     *  forked rather than awaited: activation must not wait on a network round
     *  trip, and a serve whose mailbox is slow to answer still draws its app. */
    yield* Effect.forkScoped(machine.boot())
    yield* Effect.forkScoped(machine.refresh)
  }),
})

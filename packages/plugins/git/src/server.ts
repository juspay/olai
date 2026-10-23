/**
 * GIT'S SERVER HALF — the plumbing, what is waiting, the quiet-window loop,
 * and the four verbs, as a row.
 *
 * `@olai/server`'s `runtime.ts` held the git cells, the three clocks that
 * republish them, and `gitWiring`. They are here now. Core defines a Ledger
 * door this row stands behind; `ops.commit` / `ops.push` call through it and
 * refuse in words when nobody is mounted.
 */

import type { ImplementSurfaceDeps, SurfaceCtx } from "@kolu/surface/server"
import { inMemoryStore } from "@kolu/surface/server"
import {
  COMMIT_DEFAULT,
  COMMIT_MODES,
  DEFAULT_POLICY,
  GIT_OFF,
  type GitPolicy,
  type GitState,
  NOTHING_PENDING,
  type Pending,
  PUSH_DEFAULT,
  PUSH_MODES,
  type Reading,
  type Writer,
} from "@olai/format"
import {
  definePlugin,
  detached,
  ConfigurationWatch,
  Ledger,
  Offers,
  Ops,
  Surfaces,
  Vault,
  VaultViews,
} from "@olai/plugin-api/services"
import { type Configuration, preference } from "@olai/plugin-api/configuration"
import { Duration, Effect, Schema, Stream, SubscriptionRef } from "effect"

import type { Ops as Gate } from "@olai/ops"
import { type Committing, make } from "./ledger/pending.ts"
import { faces, name, surface } from "./wire.ts"
/** THIS ROW'S AGENT VERBS ({@link ./tools.ts}), handed to the host beside its
 *  faces. They were entries in `@olai/ops`' one closed table until #546, which
 *  meant a general package named this row's vocabulary and a serve without this
 *  row still advertised them; declaring them here is what makes switching the
 *  row off take its tools along. */
import { tools } from "./tools.ts"

export { faces, name, surface } from "./wire.ts"

type Ctx = SurfaceCtx<typeof surface.spec>

const SWEEP = Duration.seconds(30)

/** The policy declaration: defaults and panel prose live on each field. */
export const Config = Schema.Struct({
  commit: Schema.Literals(COMMIT_MODES).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(COMMIT_DEFAULT)),
    Schema.annotate({ description: "when a write is recorded" }),
    preference,
  ),
  push: Schema.Literals(PUSH_MODES).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(PUSH_DEFAULT)),
    Schema.annotate({ description: "when recorded writes are pushed" }),
    preference,
  ),
})
export type Config = typeof Config.Type

interface VaultRevision {
  readonly value: Reading
}

export default definePlugin({
  name,
  needs: [Offers, Surfaces, Vault, VaultViews, Ops, ConfigurationWatch],
  config: Config,
  // The ledger reads this row's policy at every decision (`./ledger/pending.ts`'s
  // `mode`), so a config edit must not take the fiber with it: the row keeps its
  // cells, its panel and the pause/refusal it remembers. The activation follows
  // the Settings file through `ConfigurationWatch` and assigns the value below.
  configUpdates: "live",
  apply: Effect.gen(function*() {
    const offers = yield* Offers
    const surfaces = yield* Surfaces
    const vault = yield* Vault
    const ops = (yield* Ops).gate as Gate
    const detach = yield* detached
    const watch = yield* ConfigurationWatch

    /** The git row's policy, already decoded with defaults filled by
     *  `@olai/plugin-api/configuration`, or `undefined` when nobody is reading
     *  the file or it names no git row. */
    const rowPolicy = (value: Configuration | undefined): GitPolicy | undefined =>
      value?.rows.get("git")?.config as GitPolicy | undefined

    /** THE POLICY IN FORCE, seeded from the file BEFORE anything is forked or
     *  surveyed — so a boot under `commit: off` asks git nothing, and a boot
     *  under `push: auto` arms the window the file asked for rather than the
     *  defaults for one turn. It is replaced by a pick rather than captured,
     *  and the ledger asks this accessor at every decision. */
    let policy: GitPolicy = rowPolicy(watch.current()) ?? DEFAULT_POLICY

    yield* Effect.logInfo(
      `git: commit=${policy.commit} push=${policy.push}; ${
        policy.commit === "auto"
          ? "quiet window arms when writes settle"
          : "quiet window not armed"
      }`,
    )

    let at: Reading | null = null
    let mine: Ctx | undefined
    const settled = yield* SubscriptionRef.make(0)
    const commits: Committing = make({
      ops,
      root: vault.served,
      at: Effect.sync(() => at),
      policy: () => policy,
      onSettled: () => {
        detach(SubscriptionRef.update(settled, (count) => count + 1).pipe(Effect.asVoid))
      },
    })

    const republish = (): Effect.Effect<void> =>
      Effect.gen(function*() {
        const status = yield* commits.status
        yield* commits.observe(status.pending)
        mine?.cells.git.set(status.git)
        mine?.cells.pending.set(status.pending)
      })

    /**
     * A NEW POLICY, ON THE RUNNING ROW — the one thing a pick does here.
     *
     * It ASSIGNS first, so the survey `republish` takes and the quiet window it
     * re-arms both see the value a person just chose. The republish is what puts
     * the new `GitState.policy` on the cell and re-arms the window under
     * `@olai/format`'s `armedOn`; the ledger's own remembered pause is left
     * alone, which is the point of not restarting it.
     *
     * `push: off → auto` is the ONE behaviour this owes that a restart used to
     * provide: `catchUp` was forked once at activation and returned because
     * pushing was off, so without a fresh run the commits already recorded here
     * would sit unpushed until the next one. A boot never comes through here —
     * the policy is seeded above, so the first value is not a transition and
     * `catchUp`'s own fork runs under it.
     */
    const set = (next: GitPolicy): Effect.Effect<void> =>
      Effect.gen(function*() {
        const before = policy
        const moved = before.commit !== next.commit || before.push !== next.push
        policy = next
        if (!moved) return
        yield* Effect.logInfo(
          `git: commit=${next.commit} push=${next.push}; ${
            next.commit === "auto"
              ? "quiet window arms when writes settle"
              : "quiet window not armed"
          }`,
        )
        yield* republish()
        if (before.push !== "auto" && next.push === "auto") yield* commits.catchUp
      })

    const ledger: Ledger = {
      wrote: (writer) => commits.wrote(writer as Writer),
      whyWaiting: (writer) => commits.whyWaiting(writer as Writer),
      record: (request, writer) => commits.commit(request, writer as Writer),
      push: commits.push,
      resume: commits.resume,
      waiting: commits.waiting,
      // The hold is the ledger's own, and it is why `Committing` carries one at
      // all: a caller that is about to write and then commit those writes
      // itself must not have the quiet window record half of them as `auto`
      // (`@olai/plugin-api`'s `Ledger.hold` states the contract).
      hold: commits.hold,
    }
    yield* offers.offer(Ledger, () => ledger)
    /**
     * ...AND THE SAME DOOR, TOLD TO THE STORE THAT WRITES THROUGH IT.
     *
     * The vault's settings carry a ledger, and the vault cannot name this key:
     * this row waits for `Vault`, so the reverse edge would be a cycle. It used
     * to be a lookup at the far end (`HostServices.current(Ledger)`, over the
     * whole host, for a key the vault never declared — the audit's §5), so the
     * arrow points this way instead: the PROVIDER registers, which costs this
     * row no wait it did not already have, and the registration unwinds with
     * this activation so a vault outliving git falls back to refusing.
     */
    yield* (yield* VaultViews).ledger(ledger)

    yield* surfaces.register({
      surface,
      faces,
      tools,
      deps: {
        cells: {
          repository: { store: inMemoryStore<string | null>(vault.served) },
          git: { store: inMemoryStore<GitState>(GIT_OFF) },
          pending: { store: inMemoryStore<Pending>(NOTHING_PENDING) },
        },
        procedures: {
          git: {
            // `commit` is the one verb that records WHO asked. The browser
            // face binds `"web"` itself; MCP `commit` / `push` call through
            // the ledger door with the face's writer.
            commit: ({ input }) => commits.commit(input, "web"),
            push: () => commits.push,
            resume: () => Effect.as(commits.resume, {}),
            unlock: () => commits.unlock,
          },
        },
      } satisfies ImplementSurfaceDeps<typeof surface.spec>,
      published: (bound) => {
        mine = bound as Ctx
      },
    })

    yield* vault.revision((revision: VaultRevision) =>
      Effect.gen(function*() {
        at = revision.value
        yield* republish()
      }),
    )
    yield* vault.unloaded(Effect.sync(() => {
      at = null
      mine?.cells.git.set(GIT_OFF)
      mine?.cells.pending.set(NOTHING_PENDING)
    }))

    yield* Effect.forkScoped(Effect.forever(Effect.andThen(Effect.sleep(SWEEP), republish)))
    yield* Effect.forkScoped(
      Stream.runForEach(SubscriptionRef.changes(settled), () => republish()),
    )
    yield* Effect.forkScoped(commits.loop)
    yield* Effect.forkScoped(commits.catchUp)
    /**
     * ...AND THE FILE, followed for the life of the activation. Forked AFTER the
     * loop and the boot catch-up so `set` — which republishes and re-arms — can
     * never run before the machinery it changes exists. `ConfigurationWatch`
     * answers `undefined` when nobody is reading the file (a stopped settings
     * row, a vault with no `Settings.olai`), and the last policy stands.
     */
    yield* Effect.forkScoped(Stream.runForEach(watch.changes, (value) => {
      const next = rowPolicy(value)
      return next === undefined ? Effect.void : set(next)
    }))
  }),
})

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
import { tools } from "./tools.ts"

export { faces, name, surface } from "./wire.ts"

type Ctx = SurfaceCtx<typeof surface.spec>

const SWEEP = Duration.seconds(30)

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
  configUpdates: "live",
  apply: Effect.gen(function*() {
    const offers = yield* Offers
    const surfaces = yield* Surfaces
    const vault = yield* Vault
    const ops = (yield* Ops).gate as Gate
    const detach = yield* detached
    const watch = yield* ConfigurationWatch

    const rowPolicy = (value: Configuration | undefined): GitPolicy | undefined =>
      value?.rows.get("git")?.config as GitPolicy | undefined

    let policy: GitPolicy = rowPolicy(watch.current()) ?? DEFAULT_POLICY

    const sayPolicy = (of: GitPolicy): Effect.Effect<void> =>
      Effect.logInfo(
        `git: commit=${of.commit} push=${of.push}; ${
          of.commit === "auto"
            ? "quiet window arms when writes settle"
            : "quiet window not armed"
        }`,
      )
    yield* sayPolicy(policy)

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

    const set = (next: GitPolicy): Effect.Effect<void> =>
      Effect.gen(function*() {
        const before = policy
        const moved = before.commit !== next.commit || before.push !== next.push
        policy = next
        if (!moved) return
        yield* sayPolicy(next)
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
      hold: commits.hold,
    }
    yield* offers.offer(Ledger, () => ledger)
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
    yield* Effect.forkScoped(Stream.runForEach(watch.changes, (value) => {
      const next = rowPolicy(value)
      return next === undefined ? Effect.void : set(next)
    }))
  }),
})

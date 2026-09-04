/**
 * GIT'S SERVER HALF — the plumbing, what is waiting, the quiet-window loop,
 * and the three verbs, as a row.
 *
 * `@olai/server`'s `runtime.ts` held the git cells, the three clocks that
 * republish them, and `gitWiring`. They are here now. Core defines a Ledger
 * door this row stands behind; `ops.commit` / `ops.push` call through it and
 * refuse in words when nobody is mounted.
 */

import type { ImplementSurfaceDeps, SurfaceCtx } from "@kolu/surface/server"
import { inMemoryStore } from "@kolu/surface/server"
import {
  COMMIT_MODES,
  GIT_OFF,
  type GitState,
  NOTHING_PENDING,
  type Pending,
  PUSH_MODES,
  type Reading,
  type Writer,
} from "@olai/format"
import {
  definePlugin,
  detached,
  Ledger,
  Offers,
  Surfaces,
  Vault,
} from "@olai/plugin-api/services"
import { Duration, Effect, Schema, Stream, SubscriptionRef } from "effect"

import { type Committing, fixedPolicy, make } from "./ledger/pending.ts"
import { faces, name, surface } from "./wire.ts"

export { faces, name, surface } from "./wire.ts"

type Ctx = SurfaceCtx<typeof surface.spec>

const SWEEP = Duration.seconds(30)

/** This row's `config:` — `--commit` / `--push` as given, omitted for a flag
 *  nobody typed. Defaults are folded in by {@link fixedPolicy}. */
export const Config = Schema.Struct({
  commit: Schema.optionalKey(Schema.Literals(COMMIT_MODES)),
  push: Schema.optionalKey(Schema.Literals(PUSH_MODES)),
})
export type Config = typeof Config.Type

interface VaultRevision {
  readonly value: Reading
}

export default definePlugin({
  name,
  needs: [Offers, Surfaces, Vault],
  config: Config,
  apply: (config: Config) =>
    Effect.gen(function*() {
    const offers = yield* Offers
    const surfaces = yield* Surfaces
    const vault = yield* Vault
    const detach = yield* detached

    let at: Reading | null = null
    let mine: Ctx | undefined
    const policy = fixedPolicy({
      commit: config.commit ?? null,
      push: config.push ?? null,
    })
    const settled = yield* SubscriptionRef.make(0)
    const commits: Committing = make({
      root: vault.served,
      at: Effect.sync(() => at),
      policy,
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

    yield* offers.offer(Ledger, () => ({
      wrote: (writer) => commits.wrote(writer as Writer),
      whyWaiting: (writer) => commits.whyWaiting(writer as Writer),
      record: (request, writer) => commits.commit(request, writer as Writer),
      push: commits.push,
      resume: commits.resume,
    }))

    yield* surfaces.register({
      surface,
      faces,
      deps: {
        cells: {
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
  }),
})

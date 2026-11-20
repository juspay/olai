import { LocalState } from "@olai/plugin-api/services"
import { fileScopes, ringing as ringingScopes, fileFault, fileWakeFaults } from "@olai/plugin-api/file-wakes"

import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import {
  Clock,
  definePlugin,
  Deliveries,
  detached,
  Env,
  Kinds,
  SessionStart,
  Surfaces,
  Vault,
  Wakes,
} from "@olai/plugin-api/services"
import {
  declarationsOf,
  type Derived,
  NO_TYPING,
  type PropDeclarations,
} from "@olai/format"
import { Effect } from "effect"
import { type DialService, oduHalf, type RunNotice } from "olai-plugin-odu/appliance"

import { boardedIn } from "./boarded.ts"
import { bodyFor, claimedIn, claimingIn, coalesceOf, countsFor } from "./doorbell.ts"
import { probing } from "./probe.ts"
import { wake, fileFaultWords } from "./wake.ts"
import { kinds as ours, ownKinds } from "./kinds.ts"
import { faces, name, surface } from "./wire.ts"

export { kinds } from "./kinds.ts"

export { faces, name, surface } from "./wire.ts"

export { probing } from "./probe.ts"

export { wake } from "./wake.ts"

export interface VaultRevision {
  readonly value: {
    readonly derived: Derived
    readonly set: { readonly documents: ReadonlyArray<{ readonly path: string }> }
  }
}

export default definePlugin({
  environment: [
    {"key": "OLAI_ODU_BIN", "secret": false, "says": "the directory placed first on PATH for Odu"},
    {"key": "ODU_WEB_ORIGIN", "secret": false, "says": "the odu service origin this olai dials"},
  ],
  name,
  needs: [LocalState, Clock, Deliveries, Env, Kinds, SessionStart, Surfaces, Vault, Wakes],
  apply: Effect.gen(function*() {
    // the same list `needs` carries, in the same order
    const clock = yield* Clock
    const deliveries = yield* Deliveries
    const env = yield* Env
    const kinds = yield* Kinds
    const opening = yield* SessionStart
    const surfaces = yield* Surfaces
    const vault = yield* Vault
    const local = yield* LocalState
    const wakes = yield* Wakes
    const run = yield* detached

    let derived: Derived | undefined

    let declaring: PropDeclarations = NO_TYPING

    let paths: ReadonlyArray<string> = []
    const judge = (file: string) => derived ? fileFault(derived.claims, paths, file) : "gone" as const
    const wakeScopes = () => fileScopes(deliveries.scopes()).filter(row => judge(row.file) === null)
    const faults = yield* fileWakeFaults(local, deliveries, judge, fileFaultWords)

    type ScopeRow = ReturnType<typeof wakeScopes>[number]
    const sameScope = (left: ScopeRow, right: ScopeRow): boolean =>
      left.agent === right.agent
      && left.session === right.session
      && left.file === right.file
      && left.under === right.under

    const said = (scope: ScopeRow, notice: RunNotice): string | null => {
      const at = derived
      if (at === undefined) return null
      const claim = claimingIn(claimedIn(declaring, at, scope.file)).get(notice.run.id)
      if (claim === undefined) return null
      if (!ringingScopes(wakeScopes(), derived, scope.file, claim.node).some((row) => sameScope(row, scope))) return null
      if (notice.kind === "first-red") {
        return bodyFor(notice, claim, clock.now(), countsFor(half.rows(), notice))
      }
      return bodyFor(notice, claim, clock.now())
    }

    const ring = (notice: RunNotice): Effect.Effect<void> =>
      Effect.gen(function*() {
        const at = derived
        if (at === undefined) return
        const perFile = new Map<string, ReturnType<typeof claimingIn>>()
        const claimingFor = (file: string) => {
          const held = perFile.get(file)
          if (held !== undefined) return held
          const fresh = claimingIn(claimedIn(declaring, at, file))
          perFile.set(file, fresh)
          return fresh
        }
        const scopes = wakeScopes()
        const ringing = scopes.flatMap((scope) => {
          const claim = claimingFor(scope.file).get(notice.run.id)
          return claim === undefined ? [] : [`${notice.run.id}@${claim.node}`]
        })
        const claimed = [...new Set(scopes.flatMap((scope) => [...claimingFor(scope.file).keys()]))]
        yield* Effect.logDebug(
          `odu doorbell derived kind=${notice.kind} run=${notice.run.id} claims=${claimed.length} ringing=${
            ringing.length === 0 ? "none" : ringing.join(",")
          } unmatched=${claimed.includes(notice.run.id) ? "none" : notice.run.id}`,
        )
        for (const scope of scopes) {
          const claim = claimingFor(scope.file).get(notice.run.id)
          if (
            claim === undefined
            || !ringingScopes(wakeScopes(), derived, scope.file, claim.node).some((row) => sameScope(row, scope))
          ) continue
          yield* deliveries.deliver(
            scope,
            () => said(scope, notice),
            { coalesce: coalesceOf(notice) },
          )
        }
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("odu: the doorbell could not ring for this run notice", cause)
        ),
      )

    const half = oduHalf({
      options: {
        env: env.vars,
        dial: env.dial as DialService | undefined,
      },
      rang: (notice) => run(ring(notice)),
      say: (line) => run(Effect.logDebug(line)),
      warn: (line) => run(Effect.logWarning(line)),
    })

    for (const kind of ours) yield* kinds.register(kind)

    yield* wakes.register(wake)

    yield* surfaces.register({
      surface,
      faces,
      deps: half.handlers satisfies ImplementSurfaceDeps<typeof surface.spec>,
    })

    yield* vault.revision((revision: VaultRevision) =>
      Effect.sync(() => {
        declaring = declarationsOf(revision.value.derived, ownKinds)
        paths = revision.value.set.documents.map(doc => doc.path)
        derived = revision.value.derived
        half.revision(boardedIn(revision.value.derived))
      }).pipe(Effect.andThen(faults))
    )

    yield* vault.unloaded(Effect.sync(() => {
      declaring = NO_TYPING
      derived = undefined
      half.unloaded()
    }))

    yield* opening.ask(Effect.scoped(probing(env.vars)))
  }),
})

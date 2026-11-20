import { LocalState } from "@olai/plugin-api/services"
import { fileScopes, ringing as ringingScopes, fileFault, fileWakeFaults } from "@olai/plugin-api/file-wakes"

import type { ImplementSurfaceDeps, SurfaceCtx } from "@kolu/surface/server"
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
  type Convention,
  conventionServed,
  declarationsOf,
  type Derived,
  type Located,
  NO_TYPING,
  type OutlineSet,
  type PropDeclarations,
} from "@olai/format"
import { Effect } from "effect"
import { type Dial, koluHalf } from "olai-plugin-kolu/appliance"
import type { KoluEvent } from "olai-plugin-kolu/appliance/wire"

import { claimantsIn } from "./claimants.ts"
import { watchConfigIn, watchReadingIn } from "./config.ts"
import { configurationFileIn } from "@olai/plugin-api/configuration"
import { Config } from "./settings.ts"
export { Config } from "./settings.ts"
import {
  bodyFor,
  classify,
  type Heartbeat,
  makeHeartbeat,
  type Meaning,
  type Ringing,
  ringingIn,
  standingIn,
  terminalsIn,
  whyOut,
} from "./doorbell.ts"
import { probe } from "./probe.ts"
import { listed, type Trace, tracing } from "./trace.ts"
import { wake, fileFaultWords } from "./wake.ts"
import { faces, name, surface } from "./wire.ts"

export { kinds } from "./kinds.ts"
import { kinds, ownKinds } from "./kinds.ts"

export { faces, name, surface } from "./wire.ts"

export { probe } from "./probe.ts"

export { wake } from "./wake.ts"

export interface VaultRevision {
  readonly value: {
    readonly set: OutlineSet
    readonly derived: Derived
  }
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

type Ctx = SurfaceCtx<typeof surface.spec>

export default definePlugin({
  environment: [
    {"key": "PADI_SOCKET", "secret": false, "says": "the padi daemon socket"},
  ],
  name,
  needs: [LocalState, Clock, Deliveries, Env, Kinds, SessionStart, Surfaces, Vault, Wakes],
  config: Config,
  configUpdates: "live",
  apply: (_settings) => Effect.gen(function*() {
    const clock = yield* Clock
    const deliveries = yield* Deliveries
    const env = yield* Env
    const vocabulary = yield* Kinds
    const opening = yield* SessionStart
    const surfaces = yield* Surfaces
    const vault = yield* Vault
    const local = yield* LocalState
    const wakes = yield* Wakes
    const run = yield* detached

    let mine: Ctx | undefined

    const half = koluHalf<Located>({
      options: {
        env: env.vars,
        now: () => clock.now(),
        dial: env.dial as Dial | undefined,
      },
      fleet: () => mine?.collections.fleet,
      events: () => mine?.collections.events,
      pulse: () => mine?.cells.pulse,
      claimants: (nodes) => claimantsIn(declaring, nodes),
      config: () => currentWatch,
      rang: (event) => run(ring(event)),
      beating: (everyMs) => {
        run(beats(everyMs))
      },
      say: (line) => run(Effect.logDebug(line)),
      warn: (line) => run(Effect.logWarning(line)),
    })

    let file: Convention | undefined

    let currentWatch = watchConfigIn([], null)
    let declaring: PropDeclarations = NO_TYPING

    let derived: Derived | undefined

    let paths: ReadonlyArray<string> = []
    const judge = (file: string) => derived ? fileFault(derived.claims, paths, file) : "gone" as const
    const wakeScopes = () => fileScopes(deliveries.scopes()).filter(row => judge(row.file) === null)
    const faults = yield* fileWakeFaults(local, deliveries, judge, fileFaultWords)

    type ScopeRow = ReturnType<typeof wakeScopes>[number]
    const sameScope = (left: Pick<ScopeRow, "agent" | "session" | "file" | "under">, right: Pick<ScopeRow, "agent" | "session" | "file" | "under">): boolean =>
      left.agent === right.agent
      && left.session === right.session
      && left.file === right.file
      && left.under === right.under
    const claimsFor = (
      scope: { readonly file: string; readonly under?: string; readonly agent: string; readonly session: string },
      claiming: Ringing["claiming"],
    ): Ringing["claiming"] => new Map([...claiming].filter(([, claim]) =>
      ringingScopes(wakeScopes(), derived, scope.file, claim.node).some((row) => sameScope(row, scope))
    ))

    const trace: Trace = tracing((line) => run(Effect.logDebug(line)))

    const said = (scope: ScopeRow, meaning: Meaning, event: KoluEvent): string | null => {
      const file = scope.file
      const at = derived
      if (at === undefined) {
        trace("dropped", { file, meaning, why: "no-revision" })
        return null
      }
      const rows = half.rows()
      const ringing = ringingIn(declaring, at, file, [...rows.keys()], trace)
      const standing = standingIn(claimsFor(scope, ringing.claiming), rows, meaning)
      if (standing.length === 0) {
        trace("dropped", { file, meaning, why: "nobody-standing" })
        return null
      }
      trace("said", {
        file,
        meaning,
        standing: standing.length,
        nag: event.nag?.index ?? null,
        terminal: event.row?.terminal ?? null,
        terminals: listed(standing.map((one) => one.terminal)),
      })
      return bodyFor(meaning, standing, file, clock.now(), event)
    }

    const ring = (event: KoluEvent): Effect.Effect<void> =>
      Effect.gen(function*() {
        trace("event", {
          kind: event.kind,
          at: event.at,
          terminal: event.row?.terminal ?? null,
          state: event.row?.state ?? null,
        })
        if (event.row === null) return
        heart.saw(event.at)
        const at = derived
        if (at === undefined) {
          trace("dropped", { terminal: event.row.terminal, why: "no-revision" })
          return
        }
        const rows = half.rows()
        const fleet = [...rows.keys()]
        const perFile = new Map<string, Ringing>()
        const ringingFor = (file: string): Ringing => {
          const held = perFile.get(file)
          if (held !== undefined) return held
          const fresh = ringingIn(declaring, at, file, fleet, trace)
          perFile.set(file, fresh)
          return fresh
        }
        const perStanding = new Map<string, number>()
        const standingFor = (
          scope: ScopeRow,
          meaning: Meaning,
          claiming: Ringing["claiming"],
        ): number => {
          const key = `${meaning}:${scope.file}:${scope.under ?? "*"}`
          const held = perStanding.get(key)
          if (held !== undefined) return held
          const fresh = standingIn(claiming, rows, meaning).length
          perStanding.set(key, fresh)
          return fresh
        }
        const scopes = wakeScopes()
        trace("scopes", {
          terminal: event.row.terminal,
          scoped: scopes.length,
          files: listed(new Set(scopes.map((scope) => scope.file))),
        })
        for (const scope of scopes) {
          const whole = ringingFor(scope.file)
          const eventClaim = whole.claiming.get(event.row.terminal)
          if (
            eventClaim === undefined
            || !ringingScopes(wakeScopes(), derived, scope.file, eventClaim.node)
              .some((row) => sameScope(row, scope))
          ) continue
          const ringing = { ...whole, claiming: claimsFor(scope, whole.claiming) }
          const meaning = classify(event, ringing.claiming)
          trace("classified", {
            terminal: event.row.terminal,
            file: scope.file,
            agent: scope.agent,
            session: scope.session,
            meaning: meaning ?? "none",
            why: meaning === null ? whyOut(event.row.terminal, ringing) : null,
          })
          if (meaning === null) continue
          if (standingFor(scope, meaning, ringing.claiming) === 0) {
            trace("dropped", { file: scope.file, meaning, why: "nobody-standing" })
            continue
          }
          trace("delivering", {
            file: scope.file,
            meaning,
            agent: scope.agent,
            session: scope.session,
            coalesce: `${name}:${meaning}`,
          })
          yield* deliveries.deliver(
            scope,
            () => {
              const body = said(scope, meaning, event)
              if (body !== null) heart.delivered(scope)
              trace("delivered", {
                file: scope.file,
                meaning,
                agent: scope.agent,
                session: scope.session,
                said: body !== null,
              })
              return body
            },
            { coalesce: `${name}:${meaning}` },
          )
        }
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("kolu: the doorbell could not ring for this fleet event", cause)
        ),
      )

    const terminals = (scope: { readonly file: string; readonly under?: string; readonly agent: string; readonly session: string; readonly current: () => boolean }): number | null => {
      const at = derived
      return at === undefined ? null : terminalsIn(declaring, at, scope.file, scope.under)
    }

    const heart: Heartbeat = makeHeartbeat({
      scopes: () => wakeScopes(),
      deliver: (to, say, options) => run(deliveries.deliver(to, say, options)),
      terminals,
      now: () => clock.now(),
      coalesce: `${name}:heartbeat`,
      trace,
    })

    const beats = (everyMs: number): Effect.Effect<void> =>
      Effect.sync(() => heart.beat(everyMs)).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("kolu: the doorbell could not beat for this watch window", cause)
        ),
      )

    for (const kind of kinds) yield* vocabulary.register(kind)

    yield* wakes.register(wake)

    yield* surfaces.register({
      surface,
      faces,
      deps: half.handlers satisfies ImplementSurfaceDeps<typeof surface.spec>,
      published: (bound) => {
        mine = bound as Ctx
      },
    })

    yield* vault.revision((revision: VaultRevision) =>
      Effect.sync(() => {
        file = conventionServed(revision.value.derived.claims, configurationFileIn, revision.value.set, revision, file)
        declaring = declarationsOf(revision.value.derived, ownKinds)
        paths = revision.value.set.documents.map(doc => doc.path)
        derived = revision.value.derived
        currentWatch = watchReadingIn(revision.value)
        half.revision(revision.value.derived.nodes, file.file ?? null)
      }).pipe(Effect.andThen(faults))
    )

    yield* vault.unloaded(Effect.sync(() => {
      derived = undefined
      file = undefined
    }))

    yield* opening.ask(Effect.promise(() => probe(env.vars)))

    yield* Effect.addFinalizer(() => Effect.sync(() => half.stop()))
  }),
})

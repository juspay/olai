/**
 * olai-plugin-odu/appliance — HOW OLAI REACHES ODU, and the only place that knows how.
 *
 * One package holds the link to the per-user service, the board and stream
 * holds, and the projection into olai's own vocabulary. What leaves is
 * `./wire`'s shapes — a `CiRun`, a `RunCell`, an `OduLink` — so a change to
 * odu's contract is a change HERE and stops.
 *
 * The appliance is a service client. One websocket to the origin
 * `ODU_WEB_ORIGIN` names. Olai never starts the service. Discovery stays
 * board-driven: the set of watched runs is the `odu-run` values the vault
 * names.
 */

import { inMemoryStore } from "@kolu/surface/server"
import { Effect } from "effect"

import { type DialService, SPEAKS } from "./link.ts"
import { makeWatch, type BoardedRun, type RunNotice, type Watch } from "./runs.ts"
import { type CiRun, type CiRuns, type OduLink, NO_RUNS, ODU_UNDIALED } from "./wire/index.ts"

export { type DialService, type RunNotice, type BoardedRun }
export { SPEAKS }

export interface OduDeps<N> {
  readonly options: {
    readonly env: Record<string, string | undefined>
    readonly dial?: DialService
  } | null
  readonly boarded: (vault: N) => Iterable<BoardedRun>
  readonly rang: (notice: RunNotice) => void
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
}

export interface OduHalf<N> {
  readonly handlers: OduHandlers
  readonly revision: (vault: N) => void
  readonly unloaded: () => void
  readonly rows: () => ReadonlyArray<CiRun>
}

export interface OduHandlers {
  readonly cells: {
    readonly ci: {
      readonly store: { get: () => CiRuns; set: (value: CiRuns) => void }
      readonly connect: (cell: { set: (value: CiRuns) => void }) => Effect.Effect<void>
    }
    readonly service: {
      readonly store: { get: () => OduLink; set: (value: OduLink) => void }
      readonly connect: (cell: { set: (value: OduLink) => void }) => Effect.Effect<void>
    }
  }
}

export type VaultNode = unknown

export const oduHalf = <N,>(deps: OduDeps<N>): OduHalf<N> => {
  const store = inMemoryStore<CiRuns>(NO_RUNS)
  const serviceStore = inMemoryStore<OduLink>(ODU_UNDIALED)
  let cell: { set: (value: CiRuns) => void } | undefined
  let serviceCell: { set: (value: OduLink) => void } | undefined

  if (deps.options === null) {
    return {
      revision: () => {},
      unloaded: () => {},
      rows: () => [],
      handlers: {
        cells: {
          ci: {
            store,
            connect: () => Effect.never,
          },
          service: {
            store: serviceStore,
            connect: () => Effect.never,
          },
        },
      },
    }
  }

  const { env, dial } = deps.options
  const watch: Watch = makeWatch({
    publish: (runs) => cell?.set({ runs }),
    service: (state) => serviceCell?.set(state),
    rang: deps.rang,
    say: deps.say,
    warn: deps.warn,
    env,
    dial,
  })

  return {
    revision: (vault) => watch.reclaim(deps.boarded(vault)),
    unloaded: () => watch.reclaim([]),
    rows: watch.rows,
    handlers: {
      cells: {
        ci: {
          store,
          connect: (handle) =>
            Effect.suspend(() => {
              cell = handle
              handle.set({ runs: watch.rows() })
              return watch.run
            }),
        },
        service: {
          store: serviceStore,
          connect: (handle) =>
            Effect.suspend(() => {
              serviceCell = handle
              handle.set(serviceStore.get())
              return Effect.never
            }),
        },
      },
    },
  }
}

import { type Accessor, createContext, createMemo, type JSX, useContext } from "solid-js"

import { type CiRun, type CiRuns, NO_RUNS } from "olai-plugin-odu/appliance/wire"

export interface Runs {
  readonly runOf: (runId: string) => CiRun | undefined
}

const RunsContext = createContext<Runs>()

const NO_CI: Runs = { runOf: () => undefined }

export const useRuns = (): Runs => useContext(RunsContext) ?? NO_CI

export function createRuns(runs: Accessor<CiRuns | undefined>): Runs {
  const byId = createMemo(() => {
    const held = new Map<string, CiRun>()
    for (const run of (runs() ?? NO_RUNS).runs) held.set(run.id, run)
    return held
  })
  return { runOf: (runId) => byId().get(runId) }
}

export function RunsProvider(props: {readonly value: Runs;readonly children: JSX.Element}): JSX.Element {
  return <RunsContext.Provider value={props.value}>{props.children}</RunsContext.Provider>
}

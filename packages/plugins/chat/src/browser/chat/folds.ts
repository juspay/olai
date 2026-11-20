import type { FileDiff } from "@kolu/acp/wire"
import { createStore } from "solid-js/store"

export const diffKey = (call: string, at: number, path: string): string =>
  `${call}\u0000${at}\u0000${path}`

export interface DiffBlock {
  readonly key: string
  readonly diff: FileDiff
}

export const diffBlocks = (
  call: string,
  diffs: ReadonlyArray<FileDiff> | undefined,
): ReadonlyArray<DiffBlock> =>
  (diffs ?? []).map((diff, at) => ({ key: diffKey(call, at, diff.path), diff }))


export const createFolds = () => {
const [unfolded, setUnfolded] = createStore<Record<string, boolean>>({})

const isUnfolded = (id: string): boolean => unfolded[id] === true

const toggleFold = (id: string): void => {
  setUnfolded(id, value => !value)
}

return { empty: () => !Object.values(unfolded).some(Boolean), isUnfolded, toggleFold }
}

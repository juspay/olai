/** Reactive views of store rows. mapArray gives each source row one owner;
 * pruning changes membership and children, never copies its other fields. */
import { createMemo, createSelector, getOwner, runWithOwner, untrack, mapArray, type Accessor } from "solid-js"
import { shownRecord, type Row, type Selected } from "@olai/format"

const sameRows = (a: readonly Row[], b: readonly Row[]) => a.length === b.length && a.every((row, i) => row === b[i])
const view = (row: Row, children: Accessor<readonly Row[]>): Row => new Proxy(row, {
  get: (target, key, receiver) => key === "children" ? children() : Reflect.get(target, key, receiver),
})

/** Descendant readers are born only when a consumer asks for children. Their
 * owner is still the source row, so removal disposes even a lazily opened arm. */
const lazy = <T>(make: () => Accessor<T>): Accessor<T> => {
  const owner = getOwner()
  let read: Accessor<T> | undefined
  return () => {
    read ??= untrack(() => runWithOwner(owner, make))!
    return read()
  }
}

const prune = (rows: Accessor<readonly Row[]>, visible: (row: Row) => boolean): Accessor<readonly Row[]> => {
  const branches = mapArray(rows, row => ({
    row: view(row, lazy(() => prune(() => row.children, visible))),
    shown: createMemo(() => visible(row)),
  }))
  return createMemo(() => branches().filter(branch => branch.shown()).map(branch => branch.row), undefined, { equals: sameRows })
}

export function createDoneRows(rows: Accessor<readonly Row[]>, hidden: Accessor<boolean>, kept: Accessor<ReadonlySet<string> | undefined>): Accessor<readonly Row[]> {
  const revealed = createSelector(kept, (key: string, keys) => keys?.has(key) === true)
  return prune(rows, row => !hidden() || row.status !== "done" || revealed(row.key))
}

export function createMatchedRows(rows: Accessor<readonly Row[]>, selected: Accessor<Selected | null>): Accessor<readonly Row[]> {
  const selectedNode = createSelector(selected, (id: string, found) => found === null || found.has(id))
  const walk = (rows: Accessor<readonly Row[]>, ancestor: Accessor<boolean>): Accessor<readonly Row[]> => {
    const branches = mapArray(rows, row => {
      const matches = createMemo(() => ancestor() || selectedNode(shownRecord(row).node.id))
      const children = lazy(() => walk(() => row.children, matches))
      return { row: view(row, children), shown: createMemo(() => matches() || children().length > 0) }
    })
    return createMemo(() => branches().filter(branch => branch.shown()).map(branch => branch.row), undefined, { equals: sameRows })
  }
  return walk(rows, () => false)
}

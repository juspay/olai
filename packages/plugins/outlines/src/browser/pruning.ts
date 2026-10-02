/** Reactive views of store rows. mapArray gives each source row one owner;
 * pruning changes membership and children, never copies its other fields. */
import { createMemo, mapArray, type Accessor } from "solid-js"
import { shownRecord, type Row, type Selected } from "@olai/format"

const sameRows = (a: readonly Row[], b: readonly Row[]) => a.length === b.length && a.every((row, i) => row === b[i])
const view = (row: Row, children: Accessor<readonly Row[]>): Row => new Proxy(row, {
  get: (target, key, receiver) => key === "children" ? children() : Reflect.get(target, key, receiver),
})

export function createDoneRows(rows: Accessor<readonly Row[]>, hidden: Accessor<boolean>, kept: Accessor<ReadonlySet<string> | undefined>): Accessor<readonly Row[]> {
  const branches = mapArray(rows, row => {
    const children = createDoneRows(() => row.children, hidden, kept)
    const shown = createMemo(() => !hidden() || row.status !== "done" || kept()?.has(row.key) === true)
    return { row: view(row, children), shown }
  })
  return createMemo(() => branches().filter(branch => branch.shown()).map(branch => branch.row), undefined, { equals: sameRows })
}

export function createMatchedRows(rows: Accessor<readonly Row[]>, selected: Accessor<Selected | null>, ancestor: Accessor<boolean> = () => false): Accessor<readonly Row[]> {
  const branches = mapArray(rows, row => {
    const matches = createMemo(() => ancestor() || selected() === null || selected()!.has(shownRecord(row).node.id))
    const children = createMatchedRows(() => row.children, selected, matches)
    return { row: view(row, children), shown: createMemo(() => matches() || children().length > 0) }
  })
  return createMemo(() => branches().filter(branch => branch.shown()).map(branch => branch.row), undefined, { equals: sameRows })
}

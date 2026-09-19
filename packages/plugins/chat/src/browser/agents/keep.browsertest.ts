import { expect, test } from "bun:test"
import { createRoot, createSignal, onCleanup } from "solid-js"
import { createKeeps } from "./keep.ts"

type Rows = ReturnType<Parameters<typeof createKeeps>[0]["rows"]>
const initial: Rows = [
  { id: "one", engine: "alpha", session: "first", standing: "idle" },
  { id: "two", engine: "alpha", session: "second", standing: "idle" },
  { id: "sleep", engine: "alpha", session: "sleeping", standing: "asleep" },
  { id: "new", engine: "alpha", session: null, standing: "unbound" },
]
const bench = (run: (state: {
  keep: ReturnType<typeof createKeeps>
  active: Set<string>
  opened: string[]
  setRows: (rows: Rows) => void
  dispose: () => void
}) => void) => {
  const active = new Set<string>()
  const opened: string[] = []
  const [rows, setRows] = createSignal<Rows>(initial)
  let dispose = () => {}
  const keep = createRoot(stop => {
    dispose = stop
    return createKeeps({ rows }, to => {
      const key = `${to.agent}/${to.session}`
      opened.push(key)
      active.add(key)
      onCleanup(() => active.delete(key))
    })
  })
  try { run({ keep, active, opened, setRows, dispose }) } finally { dispose() }
}

test("keep composes callers by union and follows each caller's live IDs", () => bench(({ keep, active, opened }) => {
  const [ids, setIds] = createSignal<ReadonlySet<string>>(new Set(["one", "two"]))
  const first = keep(ids)
  const second = keep(() => new Set(["one"]))
  expect([...active]).toEqual(["alpha/first", "alpha/second"])
  expect(opened).toEqual(["alpha/first", "alpha/second"])
  setIds(new Set(["two"]))
  expect(active.has("alpha/first")).toBe(true)
  second()
  expect([...active]).toEqual(["alpha/second"])
  first()
  expect(active.size).toBe(0)
}))

test("keep follows session and engine bindings without churning on roster frames", () => bench(({ keep, active, opened, setRows }) => {
  keep(() => new Set(["one"]))
  setRows(initial.map(row => ({ ...row })))
  expect(opened).toEqual(["alpha/first"])
  setRows(initial.map(row => row.id === "one" ? { ...row, session: "fresh" } : row))
  expect([...active]).toEqual(["alpha/fresh"])
  setRows(initial.map(row => row.id === "one" ? { ...row, engine: "beta", session: "next" } : row))
  expect([...active]).toEqual(["beta/next"])
  setRows([])
  expect(active.size).toBe(0)
}))

test("keep skips asleep, unbound and missing rows and releases a row that sleeps", () => bench(({ keep, active, opened, setRows }) => {
  keep(() => new Set(["one", "sleep", "new", "missing"]))
  expect([...active]).toEqual(["alpha/first"])
  setRows(initial.map(row => row.id === "one" ? { ...row, standing: "asleep" } : row))
  expect(active.size).toBe(0)
  setRows(initial.map(row => row.id === "one" ? { ...row, standing: "asleep" } : row))
  expect(opened).toEqual(["alpha/first"])
}))

test("keep release is idempotent and stops following the released caller", () => bench(({ keep, active }) => {
  const [ids, setIds] = createSignal<ReadonlySet<string>>(new Set(["one"]))
  const release = keep(ids)
  release()
  release()
  setIds(new Set(["two"]))
  expect(active.size).toBe(0)
}))

test("chat owner disposal releases every hold and rejects late claims", () => bench(({ keep, active, dispose }) => {
  const first = keep(() => new Set(["one"]))
  const second = keep(() => new Set(["two"]))
  expect(active.size).toBe(2)
  dispose()
  expect(active.size).toBe(0)
  first()
  second()
  keep(() => new Set(["one"]))()
  expect(active.size).toBe(0)
}))

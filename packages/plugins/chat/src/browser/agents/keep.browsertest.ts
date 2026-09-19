import { expect, test } from "bun:test"
import { createRoot, createSignal, onCleanup } from "solid-js"
import { createKeeps } from "./keep.ts"

test("holds compose, follow bindings, never wake, and release with either owner", () => {
  const active = new Set<string>()
  const opened: string[] = []
  const initial = [
    { id: "one", engine: "alpha", session: "first", standing: "idle" as const },
    { id: "sleep", engine: "alpha", session: "sleeping", standing: "asleep" as const },
    { id: "new", engine: "alpha", session: null, standing: "unbound" as const },
  ]
  const [rows, setRows] = createSignal<ReturnType<Parameters<typeof createKeeps>[0]["rows"]>>(initial)
  const [ids, setIds] = createSignal<ReadonlySet<string>>(new Set(["one", "sleep", "new", "missing"]))
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
  const first = keep(ids)
  const second = keep(() => new Set(["one"]))
  expect([...active]).toEqual(["alpha/first"])
  expect(opened).toEqual(["alpha/first"])
  setRows(before => before.map(row => ({ ...row })))
  expect(opened).toEqual(["alpha/first"])
  first()
  first()
  expect([...active]).toEqual(["alpha/first"])
  setRows(before => before.map(row => row.id === "one" ? { ...row, engine: "beta", session: "next" } : row))
  expect([...active]).toEqual(["beta/next"])
  setRows(before => before.map(row => row.id === "one" ? { ...row, standing: "asleep" } : row))
  expect([...active]).toEqual([])
  setIds(new Set(["one"]))
  expect(opened).toEqual(["alpha/first", "beta/next"])
  second()
  setRows(initial)
  const third = keep(ids)
  expect([...active]).toEqual(["alpha/first"])
  setIds(new Set<string>())
  expect([...active]).toEqual([])
  setIds(new Set(["one"]))
  expect([...active]).toEqual(["alpha/first"])
  setRows([])
  expect([...active]).toEqual([])
  setRows(initial)
  dispose()
  expect([...active]).toEqual([])
  third()
  keep(ids)()
  expect([...active]).toEqual([])
})

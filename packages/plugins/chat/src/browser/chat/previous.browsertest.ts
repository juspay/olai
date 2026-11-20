import { expect, test } from "bun:test"
import { type Accessor, createMemo, createRoot, createSignal, type Owner, getOwner, runWithOwner } from "solid-js"

import { createPrevious } from "./previous.ts"

const rows = (initial: ReadonlyArray<string>) => {
  const [order, setOrder] = createSignal<ReadonlyArray<string>>(initial)
  const runs = new Map<string, number>()
  const above = new Map<string, Accessor<string | undefined>>()
  const scopes = new Map<string, () => void>()
  let owner: Owner | null = null
  const dispose = createRoot((dispose) => {
    owner = getOwner()
    return dispose
  })
  const previousOf = runWithOwner(owner, () => createPrevious(order))!
  const draw = (key: string) => {
    runWithOwner(owner, () =>
      createRoot((release) => {
        const previous = previousOf(key)
        const memo = createMemo(() => {
          runs.set(key, (runs.get(key) ?? 0) + 1)
          return previous()
        })
        memo()
        above.set(key, memo)
        scopes.set(key, release)
      }))
  }
  for (const key of initial) draw(key)
  const set = (next: ReadonlyArray<string>) => {
    for (const key of next) if (!scopes.has(key)) draw(key)
    setOrder(next)
    for (const [key, release] of scopes) {
      if (next.includes(key)) continue
      release()
      scopes.delete(key)
      above.delete(key)
    }
    for (const memo of above.values()) memo()
  }
  const woken = (fn: () => void): ReadonlyArray<string> => {
    const before = new Map(runs)
    fn()
    return [...runs]
      .filter(([key, count]) => scopes.has(key) && count !== (before.get(key) ?? 0))
      .map(([key]) => key)
      .sort()
  }
  return { above: (key: string) => above.get(key)?.(), set, woken, stop: dispose }
}

test("each row is told the row above it, and the first is told nothing", () => {
  const list = rows(["a", "b", "c"])
  expect(list.above("a")).toBeUndefined()
  expect(list.above("b")).toBe("a")
  expect(list.above("c")).toBe("b")
  list.stop()
})

test("a row arriving at the foot wakes only that row", () => {
  const keys = Array.from({ length: 50 }, (_, at) => `r${at}`)
  const list = rows(keys)
  const woken = list.woken(() => list.set([...keys, "new"]))
  expect(woken).toEqual(["new"])
  expect(list.above("new")).toBe("r49")
  list.stop()
})

test("a row inserted between two wakes the row it pushed down", () => {
  const list = rows(["a", "b", "c", "d"])
  const woken = list.woken(() => list.set(["a", "b", "x", "c", "d"]))
  expect(woken).toEqual(["c", "x"])
  expect(list.above("x")).toBe("b")
  expect(list.above("c")).toBe("x")
  expect(list.above("d")).toBe("c")
  list.stop()
})

test("a row leaving wakes the row that closes the gap", () => {
  const list = rows(["a", "b", "c", "d"])
  const woken = list.woken(() => list.set(["a", "c", "d"]))
  expect(woken).toEqual(["c"])
  expect(list.above("c")).toBe("a")
  list.stop()
})

test("a row replaced in place wakes the row under it", () => {
  const list = rows(["a", "b", "c"])
  const woken = list.woken(() => list.set(["a", "x", "c"]))
  expect(woken).toEqual(["c", "x"])
  expect(list.above("c")).toBe("x")
  list.stop()
})

test("an order that moved nothing wakes nobody", () => {
  const list = rows(["a", "b", "c"])
  expect(list.woken(() => list.set(["a", "b", "c"]))).toEqual([])
  list.stop()
})

test("a row drawn again after it left is told its new neighbour", () => {
  const list = rows(["a", "b", "c"])
  list.set(["a", "c"])
  list.set(["c", "a", "b"])
  expect(list.above("b")).toBe("a")
  expect(list.above("a")).toBe("c")
  expect(list.above("c")).toBeUndefined()
  list.stop()
})

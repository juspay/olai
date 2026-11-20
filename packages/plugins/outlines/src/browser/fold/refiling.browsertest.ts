import { expect, jest, test } from "bun:test"
import { Result } from "effect"
import { createRoot } from "solid-js"

import type { HomesAnswer, HomesRequest } from "@olai/format"

import { collapsedNodes, FOLDS_KEY, folded, setFolded } from "./memory.ts"
import { type Asking, createRefiling, SETTLE_MS } from "./refiling.ts"

const INSTALL = { id: "install", file: "house.olai" }
const HELD = `{"house.olai":["install"]}`

const shimmed = () => {
  const store = new Map<string, string>()
  const g = globalThis as Record<string, unknown>
  g.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  return { store, restore: () => void delete g.localStorage }
}

const emptied = () => {
  setFolded(
    [...folded().byFile].flatMap(([file, ids]) => [...ids].map((id) => ({ id, file }))),
    false,
  )
}

const tidied = async () => {
  jest.advanceTimersByTime(SETTLE_MS + 1)
  await Promise.resolve()
  await Promise.resolve()
}

const driving = <A>(
  answer: HomesAnswer,
  body: (asked: ReadonlyArray<HomesRequest>, store: Map<string, string>) => Promise<A>,
): Promise<A> => running({ answer }, body)

const running = <A>(
  wiring: { readonly answer?: HomesAnswer; readonly offline?: boolean },
  body: (asked: ReadonlyArray<HomesRequest>, store: Map<string, string>) => Promise<A>,
): Promise<A> => {
  const storage = shimmed()
  jest.useFakeTimers()
  const asked: Array<HomesRequest> = []
  const wire: Asking = {
    ask: (request) => {
      asked.push(request)
      return Promise.resolve(
        Result.succeed(wiring.answer ?? { homes: [], loaded: [] }),
      )
    },
    reachable: () => wiring.offline !== true,
  }
  emptied()
  const dispose = createRoot((dispose) => {
    createRefiling(wire)
    return dispose
  })
  return body(asked, storage.store).finally(() => {
    dispose()
    emptied()
    jest.useRealTimers()
    storage.restore()
  })
}

test("what this browser is holding is asked about, and what moved is re-filed", () =>
  driving(
    { homes: [{ id: "install", file: "_olai/Trash.olai" }], loaded: ["house.olai"] },
    async (asked, store) => {
      setFolded([INSTALL], true)
      expect(store.get(FOLDS_KEY)).toBe(HELD)
      await tidied()
      expect(asked[0]).toEqual({ ids: ["install"], files: ["house.olai"] })
      expect(store.get(FOLDS_KEY)).toBe(`{"_olai/Trash.olai":["install"]}`)
      expect(collapsedNodes().has("install")).toBe(true)
    },
  ))

test("a node the set called GONE can be folded again the moment it is back", () =>
  driving({ homes: [], loaded: ["house.olai"] }, async (asked, store) => {
    setFolded([INSTALL], true)
    await tidied()
    expect(asked.length).toBe(1)
    expect(collapsedNodes().has("install")).toBe(false)
    expect(store.get(FOLDS_KEY)).toBeUndefined()

    setFolded([INSTALL], true)
    expect(collapsedNodes().has("install")).toBe(true)
    expect(store.get(FOLDS_KEY)).toBe(HELD)
    await Promise.resolve()
    expect(collapsedNodes().has("install")).toBe(true)
    expect(store.get(FOLDS_KEY)).toBe(HELD)
    expect(asked.length).toBe(1)
  }))

test("an answer that has been overtaken says nothing", () => {
  const answers: Array<(answer: HomesAnswer) => void> = []
  const storage = shimmed()
  jest.useFakeTimers()
  const wire: Asking = {
    ask: () => new Promise((settle) => answers.push((a) => settle(Result.succeed(a)))),
    reachable: () => true,
  }
  emptied()
  const dispose = createRoot((dispose) => {
    createRefiling(wire)
    return dispose
  })
  return (async () => {
    setFolded([INSTALL], true)
    jest.advanceTimersByTime(SETTLE_MS + 1)
    setFolded([{ id: "herbs", file: "garden.olai" }], true)
    jest.advanceTimersByTime(SETTLE_MS + 1)
    expect(answers.length).toBe(2)

    answers[1]!({ homes: [{ id: "install", file: "house.olai" }], loaded: [] })
    answers[0]!({ homes: [], loaded: ["house.olai"] })
    await Promise.resolve()
    await Promise.resolve()
    expect(storage.store.get(FOLDS_KEY)).toBe(
      `{"garden.olai":["herbs"],"house.olai":["install"]}`,
    )
  })().finally(() => {
    dispose()
    emptied()
    jest.useRealTimers()
    storage.restore()
  })
})

test("a wire that cannot be reached is not asked, and nothing is written", () =>
  running({ offline: true }, async (asked, store) => {
    setFolded([INSTALL], true)
    await tidied()
    expect(asked).toEqual([])
    expect(store.get(FOLDS_KEY)).toBe(HELD)
  }))

/**
 * The door's own rule: WHEN a question goes, and how many times an answer is
 * applied.
 *
 * `./memory.test.ts` says what the memory DOES with an answer — the arithmetic,
 * as a pure question. What is pinned here is the half that is only about TIME,
 * and it is checkable at all because the wire is an argument (`Asking`): this
 * file hands the door an answer of its own and reads the entry afterwards.
 *
 * IT EXISTS FOR ONE BUG, found by review on #276 and named in the second test.
 * The answer used to live in a `createResource` and be applied by an effect
 * reading it — and `refiled` reads the memory, so that effect subscribed to the
 * memory too and re-ran on every later fold, re-applying a verdict it had
 * already applied. Harmless for a home and destructive for a `null`: a node the
 * set had called GONE could not be folded again once it came back. That is a
 * fact about a dependency set, which no pure test reaches and no browser
 * scenario provokes — the e2e never restores a node and re-folds it against a
 * standing verdict.
 *
 * THE CLOCK IS DRIVEN rather than waited out: the settle is three quarters of a
 * second, and a suite that slept through it three times would be paying two and
 * a half seconds for a rule about ordering.
 */

import { expect, jest, test } from "bun:test"
import { Result } from "effect"
import { createRoot } from "solid-js"

import type { HomesAnswer, HomesRequest } from "@olai/format"

import { collapsedNodes, FOLDS_KEY, folded, setFolded } from "./memory.ts"
import { type Asking, createRefiling, SETTLE_MS } from "./refiling.ts"

const INSTALL = { id: "install", file: "house.olai" }
const HELD = `{"house.olai":["install"]}`

/** Storage this test can read back, in the shape `../preference.ts` asks for —
 *  the shim `./memory.test.ts` keeps, for its reason. */
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

/** The fold signal belongs to the PROCESS and not to a test (`pref` in
 *  ./memory.ts), so a test that reads the entry starts from nothing and leaves
 *  it that way — the reason `./memory.test.ts`'s last test ends by unfolding
 *  everything. */
const emptied = () => {
  setFolded(
    [...folded().byFile].flatMap(([file, ids]) => [...ids].map((id) => ({ id, file }))),
    false,
  )
}

/** Past the settle, and past the microtasks an answer resolves through. Solid's
 *  own effects need none of it: a signal write flushes them where it happens. */
const tidied = async () => {
  jest.advanceTimersByTime(SETTLE_MS + 1)
  await Promise.resolve()
  await Promise.resolve()
}

/** One run of the door, over a wire that answers `answer` at once and keeps
 *  what it was asked. */
const driving = <A>(
  answer: HomesAnswer,
  body: (asked: ReadonlyArray<HomesRequest>, store: Map<string, string>) => Promise<A>,
): Promise<A> => running({ answer }, body)

const running = <A>(
  wiring: { readonly answer?: HomesAnswer; readonly offline?: string },
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
    offline: () => wiring.offline ?? null,
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
      // The press is instant and prunes nothing; the tidy is the round trip.
      expect(store.get(FOLDS_KEY)).toBe(HELD)
      await tidied()
      expect(asked[0]).toEqual({ ids: ["install"], files: ["house.olai"] })
      expect(store.get(FOLDS_KEY)).toBe(`{"_olai/Trash.olai":["install"]}`)
      // ...and the node is still shut, which is the point of re-filing rather
      // than dropping: one node, one fold state, wherever the node now lives.
      expect(collapsedNodes().has("install")).toBe(true)
    },
  ))

test("a node the set called GONE can be folded again the moment it is back", () =>
  // THE BUG, as a sequence. `install` is folded, the tidy asks, the set says it
  // is gone and the fold is dropped — all correct. Then the node comes back
  // (undo, unarchive, a `git pull`) and the reader shuts it again. That write
  // must not be undone by the verdict of a question asked before the node
  // existed again, which is what happened while the apply was an effect over a
  // resource: the write itself re-ran the apply, and the fold was gone before
  // the finger was off the triangle.
  //
  // ASSERTED ON WHAT A ROW READS ({@link collapsedNodes}) and not only on the
  // entry, because that is where the bug SHOWS and the two came apart: the
  // re-application ran inside the fold's own write, so the signal went back to
  // unfolded while `createPreference` finished that write and put the fold in
  // storage anyway. The triangle springs open; the entry says otherwise. A test
  // that read the entry alone watched the half that lied in the reader's
  // favour.
  driving({ homes: [], loaded: ["house.olai"] }, async (asked, store) => {
    setFolded([INSTALL], true)
    await tidied()
    // Gone means gone from the set: asked about, under a file that was read.
    expect(asked.length).toBe(1)
    expect(collapsedNodes().has("install")).toBe(false)
    expect(store.get(FOLDS_KEY)).toBeUndefined()

    setFolded([INSTALL], true)
    expect(collapsedNodes().has("install")).toBe(true)
    expect(store.get(FOLDS_KEY)).toBe(HELD)
    // ...and it is still shut a beat later, with nothing asked in between: the
    // fold stands on its own, and the question about it goes when the settle is
    // up, like any other.
    await Promise.resolve()
    expect(collapsedNodes().has("install")).toBe(true)
    expect(store.get(FOLDS_KEY)).toBe(HELD)
    expect(asked.length).toBe(1)
  }))

test("an answer that has been overtaken says nothing", () => {
  // The other half of the same rule, from the other side: a question that left
  // before the last three writes is about a directory that has moved, and its
  // verdict must not land on top of the one that followed it.
  const answers: Array<(answer: HomesAnswer) => void> = []
  const storage = shimmed()
  jest.useFakeTimers()
  const wire: Asking = {
    ask: () => new Promise((settle) => answers.push((a) => settle(Result.succeed(a)))),
    offline: () => null,
  }
  emptied()
  const dispose = createRoot((dispose) => {
    createRefiling(wire)
    return dispose
  })
  return (async () => {
    setFolded([INSTALL], true)
    jest.advanceTimersByTime(SETTLE_MS + 1)
    // A second fold, and a second question, while the first is still open.
    setFolded([{ id: "herbs", file: "garden.olai" }], true)
    jest.advanceTimersByTime(SETTLE_MS + 1)
    expect(answers.length).toBe(2)

    // The FIRST one answers last, saying `install` is gone. It is not applied:
    // it was asked before `herbs` was folded and cannot speak for the memory
    // that followed it.
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
  running({ offline: "olai is not connected" }, async (asked, store) => {
    setFolded([INSTALL], true)
    await tidied()
    expect(asked).toEqual([])
    // The memory is not wrong while the wire is down, only untidy.
    expect(store.get(FOLDS_KEY)).toBe(HELD)
  }))

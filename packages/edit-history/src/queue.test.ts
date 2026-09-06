/**
 * The write queue's two promises: the order, and the count.
 *
 * The order was always this file's subject and had no test — `then(step, step)`
 * is one line, and the thing it buys (a step that THREW does not wedge the
 * ones a person typed after it) is invisible until the day it is gone.
 *
 * The count is the new one. A key that enqueues here is a key this tab has not
 * finished with until the step settles, and the two ways to get that wrong are
 * both silent: hold from inside the STEP, and the key's dispatch is long over
 * by the time the hold is taken, so a wait built on it returns while the write
 * is still queued; forget the `catch` half, and a refused write leaves the
 * count high for ever.
 */

import { expect, test } from "bun:test"

import { serial } from "./queue.ts"

/** Enough counter for this file's subject: how many holds are open, and
 *  whether a key is being handled — set by hand, because what makes a step a
 *  key's is decided one layer up. */
const counting = (underKey: boolean) => {
  let open = 0
  return {
    open: () => open,
    counter: {
      held: () => {
        if (!underKey) return undefined
        open += 1
        let dropped = false
        return () => {
          if (dropped) return
          dropped = true
          open -= 1
        }
      },
    },
  }
}

/** Past every continuation the steps below queue. */
const settled = async () => {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
}

// ── the order ──────────────────────────────────────────────────────────

test("each step waits for the one before it, however it ended", async () => {
  const said: Array<string> = []
  const enqueue = serial()

  enqueue(async () => {
    await Promise.resolve()
    said.push("first")
  })
  enqueue(() => {
    said.push("threw")
    throw new Error("refused")
  })
  enqueue(() => {
    said.push("after the throw")
  })

  await settled()
  expect(said).toEqual(["first", "threw", "after the throw"])
})

// ── the count ──────────────────────────────────────────────────────────

test("a key's step is counted from the moment it is enqueued", async () => {
  const { open, counter } = counting(true)
  const enqueue = serial(counter)

  let land = () => {}
  const first = new Promise<void>((ok) => (land = ok))
  enqueue(() => first)
  // The SECOND key, pressed while the first write is still out — which is what
  // a person typing faster than a round trip produces. Its step has not
  // started, and the tab is not finished with either key.
  enqueue(async () => {})
  expect(open()).toBe(2)

  await settled()
  expect(open()).toBe(2)

  land()
  await settled()
  expect(open()).toBe(0)
})

test("a step that was REFUSED lets go, and so does one that threw", async () => {
  const { open, counter } = counting(true)
  const enqueue = serial(counter)

  enqueue(() => Promise.reject(new Error("the wire went")))
  enqueue(() => {
    throw new Error("a bug in a step")
  })
  expect(open()).toBe(2)

  await settled()
  expect(open()).toBe(0)
})

test("a pointer's write goes on the same queue and is counted by nobody", async () => {
  const { open, counter } = counting(false)
  const enqueue = serial(counter)

  enqueue(async () => {})
  expect(open()).toBe(0)
  await settled()
  expect(open()).toBe(0)
})

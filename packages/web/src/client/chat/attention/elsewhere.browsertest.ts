/**
 * TWO TABS OF ONE OLAI, and the bit that stops the one you are not reading
 * from chiming about the form on your screen.
 *
 * It is TWO DOCUMENTS or it is nothing: the failure has no single-document
 * shape at all, and the only other way to meet it is to open two windows by
 * hand. So the channel is injected — `air()` below is a `BroadcastChannel`'s
 * one rule (a word reaches every endpoint but the one that said it) and
 * nothing else — and two `createElsewhere`s share it.
 *
 * UNDER THE BROWSER CONDITION, for `../../settled.browsertest.ts`'s reason: the
 * decay is a signal a timer flips, and the server build runs no effect and
 * re-runs no memo, so a suite about a signal moving would pass having moved
 * nothing.
 */

import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { type Aired, createElsewhere } from "./elsewhere.ts"

/** A fake browser: endpoints that hear each other and never themselves. */
const air = () => {
  const takers = new Map<number, () => void>()
  let next = 0
  return (): Aired => {
    const me = next++
    return {
      say: () => {
        for (const [who, take] of takers) if (who !== me) take()
      },
      heard: (take) => takers.set(me, take),
      close: () => takers.delete(me),
    }
  }
}

/** Long enough to watch decay without making the suite wait. What the real
 *  number is and why is `./elsewhere.ts`'s. */
const LAPSE = 30

const rest = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

test("a tab that beats is heard by its sibling and not by itself", async () => {
  const join = air()
  await createRoot(async (dispose) => {
    const one = createElsewhere(join(), LAPSE)
    const two = createElsewhere(join(), LAPSE)

    expect(one.watched()).toBe(false)
    expect(two.watched()).toBe(false)

    one.beat()
    // THE FINDING: tab two is hidden, so it would ring — except that somebody
    // is looking at tab one, and one person is what the ruling is about.
    expect(two.watched()).toBe(true)
    // ... and tab one does not hear its own beat, or every tab would report
    // itself as somebody else and nothing would ever ring.
    expect(one.watched()).toBe(false)

    one.close()
    two.close()
    dispose()
  })
})

test("a saying that stops is let go of", async () => {
  // The whole reason this is a decaying bit rather than a remembered one: a
  // tab that is closed retracts nothing and a tab that CRASHES retracts
  // nothing, and a standing claim from either would silence the browser for
  // good — a worse failure than the one being fixed.
  const join = air()
  await createRoot(async (dispose) => {
    const one = createElsewhere(join(), LAPSE)
    const two = createElsewhere(join(), LAPSE)
    one.beat()
    expect(two.watched()).toBe(true)
    await rest(LAPSE * 2)
    expect(two.watched()).toBe(false)
    one.close()
    two.close()
    dispose()
  })
})

test("a beat that keeps coming keeps the answer", async () => {
  const join = air()
  await createRoot(async (dispose) => {
    const one = createElsewhere(join(), LAPSE)
    const two = createElsewhere(join(), LAPSE)
    for (let n = 0; n < 4; n += 1) {
      one.beat()
      await rest(LAPSE / 2)
      expect(two.watched()).toBe(true)
    }
    one.close()
    two.close()
    dispose()
  })
})

test("three tabs: one watching answers for both the others", async () => {
  const join = air()
  await createRoot(async (dispose) => {
    const one = createElsewhere(join(), LAPSE)
    const two = createElsewhere(join(), LAPSE)
    const three = createElsewhere(join(), LAPSE)
    two.beat()
    expect(one.watched()).toBe(true)
    expect(three.watched()).toBe(true)
    expect(two.watched()).toBe(false)
    one.close()
    two.close()
    three.close()
    dispose()
  })
})

test("a browser with no channel at all answers for this tab alone", async () => {
  // An old browser, or a context that does not expose one. The page behaves
  // exactly as it did before this existed rather than failing to load.
  await createRoot(async (dispose) => {
    const lone = createElsewhere(undefined, LAPSE)
    expect(lone.watched()).toBe(false)
    lone.beat()
    expect(lone.watched()).toBe(false)
    lone.close()
    dispose()
  })
})

test("a closed tab stops hearing", async () => {
  const join = air()
  await createRoot(async (dispose) => {
    const one = createElsewhere(join(), LAPSE)
    const two = createElsewhere(join(), LAPSE)
    two.close()
    one.beat()
    expect(two.watched()).toBe(false)
    one.close()
    dispose()
  })
})

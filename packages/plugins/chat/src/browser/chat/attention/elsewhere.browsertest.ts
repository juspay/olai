import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { type Aired, createElsewhere } from "./elsewhere.ts"

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
    expect(two.watched()).toBe(true)
    expect(one.watched()).toBe(false)

    one.close()
    two.close()
    dispose()
  })
})

test("a saying that stops is let go of", async () => {
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

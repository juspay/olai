import { expect, test } from "bun:test"

import { createQuiescence, type Deferrals, framesOver, type Painting } from "./quiescence.ts"

const byHand = () => {
  const tasks: Array<() => void> = []
  const frames: Array<() => void> = []
  const after: Deferrals = {
    task: (go) => {
      tasks.push(go)
    },
    frames: (go) => {
      frames.push(go)
    },
  }
  return {
    after,
    endTask: () => {
      for (const go of tasks.splice(0)) go()
    },
    paint: () => {
      for (const go of frames.splice(0)) go()
    },
  }
}

test("a key is held past its own dispatch, and past the frame that draws it", () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  expect(counter.count()).toBe(0)
  counter.began()
  expect(counter.count()).toBe(1)

  endTask()
  expect(counter.count()).toBe(1)

  paint()
  expect(counter.count()).toBe(0)
})

test("the window a call may recognise itself in is the dispatch, and no longer", () => {
  const { after, endTask } = byHand()
  const counter = createQuiescence(after)

  expect(counter.underKey()).toBe(false)
  counter.began()
  expect(counter.underKey()).toBe(true)
  endTask()
  expect(counter.underKey()).toBe(false)
})

test("a key dispatched inside a key nests rather than closing the window", () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  counter.began()
  counter.began()
  expect(counter.count()).toBe(2)
  expect(counter.underKey()).toBe(true)

  endTask()
  expect(counter.underKey()).toBe(false)
  paint()
  expect(counter.count()).toBe(0)
})

test("a call started under a key is held until the server answers it", async () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  counter.began()
  let answer = (_: string) => {}
  const held = counter.holding(new Promise<string>((ok) => (answer = ok)))

  endTask()
  paint()
  expect(counter.count()).toBe(1)

  answer("landed")
  expect(await held).toBe("landed")
  paint()
  expect(counter.count()).toBe(0)
})

test("a call with no key behind it comes back as the very promise it went in as", () => {
  const { after, endTask } = byHand()
  const counter = createQuiescence(after)

  const call = Promise.resolve("nothing to do with a key")
  expect(counter.holding(call)).toBe(call)

  counter.began()
  expect(counter.holding(call)).not.toBe(call)
  endTask()
})

test("a call started after the dispatch is nobody's key", async () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  counter.began()
  endTask()
  const held = counter.holding(new Promise<string>(() => {}))
  paint()
  expect(counter.count()).toBe(0)
  void held
})

test("a REFUSED call still lets go", async () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  counter.began()
  const held = counter.holding(Promise.reject(new Error("the wire went")))
  endTask()
  paint()
  expect(counter.count()).toBe(1)

  await expect(held).rejects.toThrow("the wire went")
  paint()
  expect(counter.count()).toBe(0)
})

test("a hold let go twice is one key, not minus one", () => {
  const { after, paint } = byHand()
  const counter = createQuiescence(after)

  counter.began()
  const drop = counter.held()
  expect(drop).toBeDefined()
  expect(counter.count()).toBe(2)

  drop?.()
  drop?.()
  paint()
  expect(counter.count()).toBe(1)
})

test("no key means no hold, so nothing a pointer does can be left open", () => {
  const { after } = byHand()
  const counter = createQuiescence(after)

  expect(counter.held()).toBeUndefined()
  expect(counter.count()).toBe(0)
})

test("a run of keys ends at zero and stays there", async () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  for (let key = 0; key < 5; key += 1) {
    counter.began()
    if (key % 2 === 0) {
      void counter.holding(
        key === 2 ? Promise.reject(new Error("no")) : Promise.resolve(key),
      ).catch(() => {})
    }
    endTask()
  }
  await Promise.resolve()
  await Promise.resolve()
  paint()
  paint()
  expect(counter.count()).toBe(0)

  endTask()
  paint()
  expect(counter.count()).toBe(0)
})

const aTab = () => {
  const frames: Array<() => void> = []
  const tasks: Array<() => void> = []
  const watchers = new Set<() => void>()
  let hidden = false
  const view: Painting = {
    hidden: () => hidden,
    frame: (go) => {
      frames.push(go)
    },
    watch: (go) => {
      watchers.add(go)
      return () => watchers.delete(go)
    },
    task: (go) => {
      tasks.push(go)
    },
  }
  return {
    view,
    watching: () => watchers.size,
    paint: () => {
      for (const go of frames.splice(0)) go()
    },
    endTask: () => {
      for (const go of tasks.splice(0)) go()
    },
    hide: () => {
      hidden = true
      for (const go of [...watchers]) go()
    },
  }
}

test("a painting tab waits for TWO frames, and for nothing else at all", () => {
  const tab = aTab()
  let released = 0
  framesOver(tab.view)(() => (released += 1))

  tab.endTask()
  expect(released).toBe(0)

  tab.paint()
  expect(released).toBe(0)
  tab.paint()
  expect(released).toBe(1)
  expect(tab.watching()).toBe(0)
})

test("a tab that is already hidden takes the task queue, because no frame is coming", () => {
  const tab = aTab()
  tab.hide()
  let released = 0
  framesOver(tab.view)(() => (released += 1))

  tab.paint()
  expect(released).toBe(0)
  tab.endTask()
  tab.endTask()
  expect(released).toBe(1)
  expect(tab.watching()).toBe(0)
})

test("a tab hidden WHILE it waits is let go by the event, not by a timer", () => {
  const tab = aTab()
  let released = 0
  framesOver(tab.view)(() => (released += 1))

  tab.hide()
  expect(released).toBe(0)
  tab.endTask()
  tab.endTask()
  expect(released).toBe(1)

  tab.paint()
  expect(released).toBe(1)
  expect(tab.watching()).toBe(0)
})

test("a counter over that browser reaches zero only after both paints", () => {
  const tab = aTab()
  const counter = createQuiescence({
    task: tab.view.task,
    frames: framesOver(tab.view),
  })

  counter.began()
  tab.endTask()
  expect(counter.count()).toBe(1)
  tab.paint()
  expect(counter.count()).toBe(1)
  tab.paint()
  expect(counter.count()).toBe(0)
  expect(tab.watching()).toBe(0)
})

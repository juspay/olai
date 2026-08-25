/**
 * The key counter's rules, over deferrals this file drives by hand.
 *
 * WHAT IS UNDER TEST is the pairing, and the pairing only: what opens a hold,
 * what closes one, and — the case the whole design is answerable for — that
 * NOTHING can leave one open, and — its twin — that nothing can close one
 * EARLY. A counter that lies idle-high is worse than no counter, because every
 * wait built on it becomes a timeout in a scenario about something else; a
 * counter that reaches zero a paint too soon is worse still, because the wait
 * PASSES and the failure lands four steps later.
 *
 * `createQuiescence` takes its task and its frames as an argument for exactly
 * this: a `setTimeout` and a `requestAnimationFrame` cannot be asked "did you
 * fire yet" without a clock and a browser, and neither is what these rules are
 * about. The fakes below are queues this file drains, so every step of a
 * release is a line rather than a wait.
 *
 * WHAT IS NOT HERE is the listener (`followKeys` is three lines over a window
 * that does not exist under `bun test`) and the attribute (a render effect
 * over a signal, which the browser suite reads for real on every key it
 * presses). What the counter MEANS — which of this app's effects it covers —
 * is a claim about the whole client, and the place that claim is made is
 * `packages/tests`.
 */

import { expect, test } from "bun:test"

import { createQuiescence, type Deferrals, framesOver, type Painting } from "./quiescence.ts"

/** The two deferrals as queues, plus the two verbs that drain them: `endTask`
 *  is the end of the dispatch a key arrived in, `paint` is the frames that
 *  draw what its handlers did. Drained by splice, so a release scheduled BY a
 *  release needs a second drain rather than being swept up by the first. */
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

// ── a key, and the two things that have to happen before it is done ────

test("a key is held past its own dispatch, and past the frame that draws it", () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  expect(counter.count()).toBe(0)
  counter.began()
  expect(counter.count()).toBe(1)

  // The handlers have run and returned. That is not "landed": what they did to
  // the document has not been drawn yet.
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

  // A handler that forwards a synthetic key of its own — a menu passing Enter
  // down, the suite's own `retypedAndTaken`. A flag would be cleared by the
  // inner one and leave the outer key's calls unheld.
  counter.began()
  counter.began()
  expect(counter.count()).toBe(2)
  expect(counter.underKey()).toBe(true)

  endTask()
  expect(counter.underKey()).toBe(false)
  paint()
  expect(counter.count()).toBe(0)
})

// ── what a key SENT ────────────────────────────────────────────────────

test("a call started under a key is held until the server answers it", async () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  counter.began()
  let answer = (_: string) => {}
  const held = counter.holding(new Promise<string>((ok) => (answer = ok)))

  // The key's own hold has been paid off, and the count has not reached zero:
  // the write it sent is still out.
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

  // IDENTITY, and not merely "resolves with the same value". `./run.ts` puts
  // every call in this client through `holding`, so a wrapper here — even one
  // that only awaits — would settle a microtask or two after the promise it
  // wraps, for every procedure this app ever calls. This counter is an
  // observer of the keyboard: an observer that moved when anything else in the
  // app answered would be a change to the app rather than a reading of it, and
  // there are pages here that measure themselves against when a call came back
  // (`./scroll.ts`'s restore).
  const call = Promise.resolve("nothing to do with a key")
  expect(counter.holding(call)).toBe(call)

  // ...and inside a key it is wrapped, which is the whole point of the other
  // half — so this is a claim about the branch rather than about `holding`
  // never touching anything.
  counter.began()
  expect(counter.holding(call)).not.toBe(call)
  endTask()
})

test("a call started after the dispatch is nobody's key", async () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  counter.began()
  endTask()
  // A subscription arriving, a turn's own traffic, an upload's next chunk.
  // Never answered here, which is the point: it must not be able to hold the
  // count up at all.
  const held = counter.holding(new Promise<string>(() => {}))
  paint()
  expect(counter.count()).toBe(0)
  void held
})

// ── the leak case, in each of the three shapes it comes in ─────────────

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

  // A caller that pairs the release in a `finally` AND on a path out — which
  // is what a `catch` that also releases is. Counting it twice would take the
  // number BELOW zero, and then the next key's `0` would arrive one key early:
  // a wait that returns while a write is still in flight is the one failure
  // this counter exists to stop.
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

// ── and the shape a whole scenario is: back to zero, and STILL zero ────

test("a run of keys ends at zero and stays there", async () => {
  const { after, endTask, paint } = byHand()
  const counter = createQuiescence(after)

  for (let key = 0; key < 5; key += 1) {
    counter.began()
    // Every other one sends something, and one of those is refused.
    if (key % 2 === 0) {
      void counter.holding(
        key === 2 ? Promise.reject(new Error("no")) : Promise.resolve(key),
      ).catch(() => {})
    }
    endTask()
  }
  // Let every continuation run, then drain the releases they scheduled — twice,
  // because a release scheduled by a release is a second frame.
  await Promise.resolve()
  await Promise.resolve()
  paint()
  paint()
  expect(counter.count()).toBe(0)

  // Nothing left to fire: a stray deferral landing later would take the count
  // negative, which is the same lie as leaving it high.
  endTask()
  paint()
  expect(counter.count()).toBe(0)
})

// ── the frames themselves: two paints, and never a clock ───────────────
//
// `framesOver` is the one deferral with a rule of its own, and the rule is
// what a release may NOT do: report quiet before the paints it is counting.
// It used to arm a 250ms timer beside the frame, which is exactly that lie on
// any box that hitches for longer than a quarter of a second — which is the
// loaded box this whole counter exists for (grok, review of #379).

/** A browser this file plays: frames arrive when `paint()` says, the tab is
 *  visible until `hide()` says otherwise, and every listener is counted so a
 *  release that forgot to drop one is a number rather than a leak nobody
 *  sees. */
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

  // However long the page hitches — a long task, a big paint, a loaded lane —
  // nothing releases it but a frame. This is the assertion the 250ms backstop
  // could not make: there is no clock in this path to run out.
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

  // The second tab of a multi-tab scenario, sent to the back mid-release. Its
  // DOM is committed; the frame it is waiting for arrives when somebody looks
  // at it again, which may be never — and a counter stuck high there is the
  // leak this file is answerable for.
  tab.hide()
  expect(released).toBe(0)
  tab.endTask()
  tab.endTask()
  expect(released).toBe(1)

  // ...and a frame arriving late over the top of it is not a second release.
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

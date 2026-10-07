import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Fiber, Option, Scope, Stream } from "effect"
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { type Cdp, type CdpEvent, CdpFailure, decodeMessage, encodeCall, framesOf, openCdp } from "./cdp.ts"
import { LaunchFailure } from "./chromium.ts"
import { openLive, type LiveOptions } from "./live.ts"
import type { Standing } from "./wire.ts"

test("CDP calls frame with or without a session; answers, refusals and events decode", () => {
  expect(encodeCall({ id: 1, method: "Target.getTargets", params: {} })).toBe('{"id":1,"method":"Target.getTargets","params":{}}\0')
  expect(JSON.parse(encodeCall({ id: 2, method: "Page.navigate", params: { url: "x" }, sessionId: "S" }).slice(0, -1))).toEqual({ id: 2, method: "Page.navigate", params: { url: "x" }, sessionId: "S" })
  expect(framesOf('{"id":1}\0{"id"')).toEqual({ frames: ['{"id":1}'], rest: '{"id"' })
  expect(framesOf('{"id":1}\0{"id":2}\0')).toEqual({ frames: ['{"id":1}', '{"id":2}'], rest: "" })
  expect(decodeMessage('{"id":3,"result":{"a":1}}')).toEqual({ _tag: "answer", id: 3, result: { a: 1 } })
  expect(decodeMessage('{"id":4}')).toEqual({ _tag: "answer", id: 4, result: {} })
  expect(decodeMessage('{"id":5,"error":{"code":-32000,"message":"No target"}}')).toEqual({ _tag: "refusal", id: 5, why: "No target" })
  expect(decodeMessage('{"method":"Page.screencastFrame","params":{"sessionId":7},"sessionId":"S"}'))
    .toEqual({ _tag: "event", method: "Page.screencastFrame", params: { sessionId: 7 }, sessionId: "S" })
  expect(decodeMessage('{"method":"Target.targetDestroyed","params":{"targetId":"T"}}'))
    .toEqual({ _tag: "event", method: "Target.targetDestroyed", params: { targetId: "T" }, sessionId: null })
  expect(() => decodeMessage("[1]")).toThrow()
  expect(() => decodeMessage("{}")).toThrow()
})

/** A browser double: a launch the test settles, and a CDP connection that
 *  records every call and lets the test speak events. */
const double = () => {
  const calls: Array<{ method: string; params: Record<string, unknown>; sessionId?: string }> = []
  const listeners = new Set<(event: CdpEvent) => void>()
  const launches: Array<{ exited: Deferred.Deferred<string>; released: boolean }> = []
  let gate: Deferred.Deferred<void> | null = null
  let failNext: string | null = null
  let targets: Array<Record<string, unknown>> = [{ targetId: "T1", type: "page", title: "blank", url: "about:blank" }]
  const retitled = new Map<string, Record<string, unknown>>()
  const cdp: Cdp = {
    send: (method, params = {}, sessionId) => Effect.suspend(() => {
      calls.push({ method, params, ...(sessionId === undefined ? {} : { sessionId }) })
      if (method === "Target.getTargets") return Effect.succeed({ targetInfos: targets })
      if (method === "Target.attachToTarget") return Effect.succeed({ sessionId: `S-${String(params["targetId"])}` })
      if (method === "Target.createTarget") return Effect.succeed({ targetId: "T9" })
      if (method === "Target.getTargetInfo") return Effect.succeed({ targetInfo: { ...targets.find((one) => one["targetId"] === params["targetId"]), ...retitled.get(String(params["targetId"])) } })
      if (method === "Page.navigate" && params["url"] === "https://refused.example") return Effect.succeed({ errorText: "net::ERR_NAME_NOT_RESOLVED" })
      if (method === "Target.closeTarget" && params["targetId"] === "gone") return Effect.fail(new CdpFailure({ why: "No target with given id found" }))
      return Effect.succeed({})
    }),
    listen: (listener) => Effect.acquireRelease(Effect.sync(() => { listeners.add(listener) }), () => Effect.sync(() => { listeners.delete(listener) })),
    closed: Effect.never,
  }
  const options = (overrides: Partial<LiveOptions> = {}): LiveOptions & { readonly seen: Array<Standing>; readonly profile: Effect.Effect<string> } => {
    const seen: Array<Standing> = []
    return {
      chromium: "/bin/chromium",
      absentWhy: "nothing configured",
      profile: Effect.succeed("/unused/profile"),
      now: () => "2026-10-07T00:00:00.000Z",
      publish: { standing: (standing: Standing) => seen.push(standing), tab: () => {}, untab: () => {} },
      launch: () => Effect.gen(function*() {
        if (gate !== null) yield* Deferred.await(gate)
        if (failNext !== null) {
          const why = failNext
          failNext = null
          return yield* new LaunchFailure({ why })
        }
        const held = { exited: Deferred.makeUnsafe<string>(), released: false }
        launches.push(held)
        yield* Effect.addFinalizer(() => Effect.sync(() => { held.released = true }))
        return { pid: 4000 + launches.length, endpoint: `ws://127.0.0.1:1/devtools/browser/${launches.length}`, pipe: undefined as never, exited: Deferred.await(held.exited) }
      }),
      connect: () => Effect.succeed(cdp),
      ...overrides,
      seen,
    } as never
  }
  const emit = (event: CdpEvent) => { for (const listener of listeners) listener(event) }
  return {
    calls, launches, emit, options,
    hold: () => { gate = Deferred.makeUnsafe<void>(); return gate },
    failNextLaunch: (why: string) => { failNext = why },
    setTargets: (next: Array<Record<string, unknown>>) => { targets = next },
    retitle: (targetId: string, title: string) => { retitled.set(targetId, { title }) },
    listening: () => listeners.size,
  }
}

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(effect))

test("a blank knob is absent for the row's life, and refuses every demand in its own words", () => run(Effect.gen(function*() {
  const browser = double()
  const options = browser.options({ chromium: null })
  const live = yield* openLive(options)
  expect(live.standing()).toEqual({ kind: "absent", why: "nothing configured" })
  expect((yield* Effect.flip(live.attach)).says).toBe("nothing configured")
  expect(browser.launches).toEqual([])
})))

test("standing walks down → starting → up, and concurrent demands share one launch", () => run(Effect.gen(function*() {
  const browser = double()
  const options = browser.options()
  const live = yield* openLive(options)
  expect(live.standing()).toEqual({ kind: "down" })
  const gate = browser.hold()
  const asks = yield* Effect.forkChild(Effect.all([live.attach, live.attach, live.start], { concurrency: "unbounded" }))
  yield* Effect.yieldNow
  expect(live.standing()).toEqual({ kind: "starting" })
  yield* Deferred.succeed(gate, undefined)
  const [one, two] = yield* Fiber.join(asks)
  expect(one).toEqual({ endpoint: "ws://127.0.0.1:1/devtools/browser/1", profile: "/unused/profile" })
  expect(two).toEqual(one)
  expect(browser.launches.length).toBe(1)
  expect(live.standing()).toEqual({ kind: "up", pid: 4001, since: "2026-10-07T00:00:00.000Z" })
  expect(options.seen.map((standing) => standing.kind)).toEqual(["down", "starting", "up"])
  expect([...live.tabs().values()]).toEqual([{ id: "T1", title: "blank", url: "about:blank" }])
  expect(browser.calls.slice(0, 2).map((call) => call.method)).toEqual(["Target.setDiscoverTargets", "Target.getTargets"])
})))

test("a failed launch is failed{why}, and the next demand launches again", () => run(Effect.gen(function*() {
  const browser = double()
  const live = yield* openLive(browser.options())
  browser.failNextLaunch("Chromium exited with code 1 before opening DevTools.")
  expect((yield* Effect.flip(live.start)).says).toBe("Chromium exited with code 1 before opening DevTools.")
  expect(live.standing()).toEqual({ kind: "failed", why: "Chromium exited with code 1 before opening DevTools." })
  yield* live.start
  expect(live.standing().kind).toBe("up")
})))

test("a crash takes the browser down to failed, clears its tabs and tells its panes; the next demand relaunches", () => run(Effect.gen(function*() {
  const browser = double()
  const live = yield* openLive(browser.options())
  yield* live.start
  const watching = yield* Effect.forkChild(Stream.runCollect(live.screencast({ targetId: "T1", maxWidth: 800, quality: 60 })))
  yield* Effect.sleep("10 millis")
  yield* Deferred.succeed(browser.launches[0]!.exited, "Chromium was stopped by SIGSEGV.")
  const frames = yield* Fiber.join(watching)
  expect([...frames]).toEqual([{ _tag: "refused", says: "The browser stopped: Chromium was stopped by SIGSEGV." }])
  yield* Effect.sleep("10 millis")
  expect(live.standing()).toEqual({ kind: "failed", why: "Chromium was stopped by SIGSEGV." })
  expect(live.tabs().size).toBe(0)
  expect(browser.launches[0]!.released).toBe(true)
  expect(browser.listening()).toBe(0)
  yield* live.start
  expect(live.standing()).toEqual({ kind: "up", pid: 4002, since: "2026-10-07T00:00:00.000Z" })
})))

test("withdrawing the row releases the browser it launched", async () => {
  const browser = double()
  await run(Effect.gen(function*() {
    const row = yield* Scope.make()
    const live = yield* openLive(browser.options()).pipe(Scope.provide(row))
    yield* live.start
    expect(browser.launches[0]!.released).toBe(false)
    yield* Scope.close(row, Exit.void)
    expect(browser.launches[0]!.released).toBe(true)
  }))
})

test("withdrawing the row mid-launch interrupts the launch and refuses its waiters", async () => {
  const browser = double()
  await run(Effect.gen(function*() {
    const row = yield* Scope.make()
    const live = yield* openLive(browser.options()).pipe(Scope.provide(row))
    browser.hold()
    const waiting = yield* Effect.forkChild(Effect.exit(live.attach))
    yield* Effect.yieldNow
    yield* Scope.close(row, Exit.void)
    const exit = yield* Fiber.join(waiting)
    expect(Exit.isSuccess(exit)).toBe(false)
    expect(browser.launches).toEqual([])
  }))
})

const frame = (sessionId: string, n: number): CdpEvent => ({
  method: "Page.screencastFrame",
  sessionId,
  params: { data: `JPEG${n}`, sessionId: n, metadata: { deviceWidth: 1280, deviceHeight: 800, pageScaleFactor: 1, scrollOffsetX: 0, scrollOffsetY: 0, timestamp: n } },
})

test("one screencast per tab however many panes watch it; every frame acked; the last pane stops it", () => run(Effect.gen(function*() {
  const browser = double()
  const live = yield* openLive(browser.options())
  yield* live.start
  const ask = { targetId: "T1", maxWidth: 800, quality: 60 }
  const first = yield* Effect.forkChild(Stream.runCollect(Stream.take(live.screencast(ask), 2)))
  yield* Effect.sleep("10 millis")
  browser.emit(frame("S-T1", 1))
  // A pane joining a still page is handed the last picture at once.
  const second = yield* Effect.forkChild(Stream.runCollect(Stream.take(live.screencast(ask), 2)))
  yield* Effect.sleep("10 millis")
  browser.emit(frame("S-T1", 2))
  const one = [...(yield* Fiber.join(first))].map((got) => got._tag === "frame" ? got.jpeg : got.says)
  const two = [...(yield* Fiber.join(second))].map((got) => got._tag === "frame" ? got.jpeg : got.says)
  expect(one).toEqual(["JPEG1", "JPEG2"])
  expect(two).toEqual(["JPEG1", "JPEG2"])
  const methods = (name: string) => browser.calls.filter((call) => call.method === name)
  expect(methods("Target.attachToTarget").length).toBe(1)
  expect(methods("Page.startScreencast").map((call) => call.params)).toEqual([
    { format: "jpeg", quality: 60, maxWidth: 800, maxHeight: 1600, everyNthFrame: 1 },
  ])
  expect(methods("Page.screencastFrameAck").map((call) => call.params["sessionId"])).toEqual([1, 2])
  expect(methods("Page.stopScreencast").length).toBe(1)
  // A tab nobody is watching runs no screencast, and a new pane starts one.
  const third = yield* Effect.forkChild(Stream.runHead(live.screencast(ask)))
  yield* Effect.sleep("10 millis")
  browser.emit(frame("S-T1", 3))
  expect(Option.map(yield* Fiber.join(third), (got) => got._tag)).toEqual(Option.some("frame"))
  expect(methods("Page.startScreencast").length).toBe(2)
  expect(methods("Page.stopScreencast").length).toBe(2)
})))

test("tabs follow the browser's page targets; a closed tab ends its panes", () => run(Effect.gen(function*() {
  const browser = double()
  const live = yield* openLive(browser.options())
  yield* live.start
  browser.emit({ method: "Target.targetCreated", sessionId: null, params: { targetInfo: { targetId: "W1", type: "service_worker", title: "", url: "" } } })
  browser.emit({ method: "Target.targetCreated", sessionId: null, params: { targetInfo: { targetId: "T2", type: "page", title: "", url: "about:blank" } } })
  browser.emit({ method: "Target.targetInfoChanged", sessionId: null, params: { targetInfo: { targetId: "T2", type: "page", title: "X", url: "https://x.com/" } } })
  expect([...live.tabs().keys()]).toEqual(["T1", "T2"])
  expect(live.tabs().get("T2")).toEqual({ id: "T2", title: "X", url: "https://x.com/" })
  const watching = yield* Effect.forkChild(Stream.runCollect(live.screencast({ targetId: "T2", maxWidth: 800, quality: 60 })))
  yield* Effect.sleep("10 millis")
  browser.emit({ method: "Target.targetDestroyed", sessionId: null, params: { targetId: "T2" } })
  expect([...(yield* Fiber.join(watching))]).toEqual([{ _tag: "refused", says: "This tab was closed." }])
  expect([...live.tabs().keys()]).toEqual(["T1"])
  const missing = yield* Stream.runCollect(live.screencast({ targetId: "nope", maxWidth: 800, quality: 60 }))
  expect([...missing]).toEqual([{ _tag: "refused", says: "There is no such tab in the browser." }])
})))

test("the person's gestures reach the tab's session as CDP input", () => run(Effect.gen(function*() {
  const browser = double()
  const live = yield* openLive(browser.options())
  expect((yield* Effect.flip(live.navigate("T1", "https://x.com"))).says).toBe("The browser is not running. Start it from this pane.")
  yield* live.start
  yield* live.input("T1", { kind: "mouse", type: "mousePressed", x: 10, y: 20, button: "left", buttons: 1, clickCount: 1, modifiers: 0, deltaX: 0, deltaY: 0 })
  yield* live.input("T1", { kind: "mouse", type: "mouseWheel", x: 10, y: 20, button: "none", buttons: 0, clickCount: 0, modifiers: 0, deltaX: 0, deltaY: 120 })
  yield* live.input("T1", { kind: "key", type: "keyDown", key: "a", code: "KeyA", text: "a", keyCode: 65, modifiers: 0 })
  yield* live.input("T1", { kind: "key", type: "keyDown", key: "Enter", code: "Enter", text: "", keyCode: 13, modifiers: 0 })
  yield* live.input("T1", { kind: "key", type: "keyUp", key: "a", code: "KeyA", text: "", keyCode: 65, modifiers: 0 })
  yield* live.input("T1", { kind: "text", text: "pasted" })
  yield* live.navigate("T1", "https://x.com")
  expect((yield* Effect.flip(live.navigate("T1", "https://refused.example"))).says).toContain("ERR_NAME_NOT_RESOLVED")
  expect(yield* live.open).toEqual({ targetId: "T9" })
  expect((yield* Effect.flip(live.close("gone"))).says).toContain("No target")
  const onSession = browser.calls.filter((call) => call.sessionId === "S-T1").map(({ method, params }) => ({ method, params }))
  expect(onSession).toEqual([
    { method: "Page.enable", params: {} },
    { method: "Emulation.setFocusEmulationEnabled", params: { enabled: true } },
    { method: "Input.dispatchMouseEvent", params: { type: "mousePressed", x: 10, y: 20, button: "left", buttons: 1, clickCount: 1, modifiers: 0 } },
    { method: "Input.dispatchMouseEvent", params: { type: "mouseWheel", x: 10, y: 20, button: "none", buttons: 0, clickCount: 0, modifiers: 0, deltaX: 0, deltaY: 120 } },
    { method: "Input.dispatchKeyEvent", params: { type: "keyDown", key: "a", code: "KeyA", modifiers: 0, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, text: "a", unmodifiedText: "a" } },
    { method: "Input.dispatchKeyEvent", params: { type: "rawKeyDown", key: "Enter", code: "Enter", modifiers: 0, windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 } },
    { method: "Input.dispatchKeyEvent", params: { type: "keyUp", key: "a", code: "KeyA", modifiers: 0, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 } },
    { method: "Input.insertText", params: { text: "pasted" } },
    { method: "Page.navigate", params: { url: "https://x.com" } },
    { method: "Page.navigate", params: { url: "https://refused.example" } },
  ])
  expect(browser.calls.filter((call) => call.method === "Target.createTarget")[0]!.params).toEqual({ url: "about:blank" })
})))

test("forgetting sign-ins stops a running browser first, then removes its profile", async () => {
  const home = mkdtempSync(join(tmpdir(), "olai-forget-"))
  try {
    const profile = join(home, "profile")
    mkdirSync(join(profile, "Default"), { recursive: true })
    writeFileSync(join(profile, "Default", "Cookies"), "signed in")
    const browser = double()
    await run(Effect.gen(function*() {
      const options = browser.options({ profile: Effect.succeed(profile) })
      const live = yield* openLive(options)
      yield* live.start
      yield* live.forget
      expect(browser.launches[0]!.released).toBe(true)
      expect(existsSync(profile)).toBe(false)
      expect(live.standing()).toEqual({ kind: "down" })
      expect(options.seen.map((standing) => standing.kind)).toEqual(["down", "starting", "up", "down", "down"])
      // ...and forgetting while down only removes the profile.
      yield* live.forget
      expect(browser.launches.length).toBe(1)
    }))
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test("a tab's title is read again after its loads and its new pictures, which Chromium announces no other way", () => run(Effect.gen(function*() {
  const browser = double()
  const live = yield* openLive(browser.options({ titleEveryMs: 20 }))
  yield* live.start
  yield* Effect.sleep("10 millis")
  // Every page is attached as it appears, so its loads reach the strip.
  expect(browser.calls.filter((call) => call.method === "Target.attachToTarget").map((call) => call.params["targetId"])).toEqual(["T1"])
  browser.retitle("T1", "Loaded")
  browser.emit({ method: "Page.loadEventFired", sessionId: "S-T1", params: {} })
  yield* Effect.sleep("10 millis")
  expect(live.tabs().get("T1")?.title).toBe("Loaded")
  // A sub-frame's navigation is not the tab's.
  const asked = browser.calls.filter((call) => call.method === "Target.getTargetInfo").length
  browser.emit({ method: "Page.frameNavigated", sessionId: "S-T1", params: { frame: { id: "F2", parentId: "F1" } } })
  yield* Effect.sleep("10 millis")
  expect(browser.calls.filter((call) => call.method === "Target.getTargetInfo").length).toBe(asked)
  browser.retitle("T1", "clicked")
  browser.emit(frame("S-T1", 1))
  yield* Effect.sleep("40 millis")
  expect(live.tabs().get("T1")?.title).toBe("clicked")
  // A tab that appears later is followed too.
  browser.emit({ method: "Target.targetCreated", sessionId: null, params: { targetInfo: { targetId: "T2", type: "page", title: "", url: "about:blank" } } })
  yield* Effect.sleep("10 millis")
  expect(browser.calls.filter((call) => call.method === "Target.attachToTarget").map((call) => call.params["targetId"])).toEqual(["T1", "T2"])
})))

test("over the pipe, calls answer by id, events reach listeners, and a closed pipe fails what is in the air", () => run(Effect.gen(function*() {
  const calls = new PassThrough()
  const answers = new PassThrough()
  const written: Array<string> = []
  calls.on("data", (chunk) => written.push(String(chunk)))
  const cdp = yield* openCdp({ calls, answers })
  const seen: Array<string> = []
  yield* cdp.listen((event) => seen.push(`${event.method}@${event.sessionId}`))
  const asking = yield* Effect.forkChild(cdp.send("Target.getTargets"))
  const refusing = yield* Effect.forkChild(Effect.flip(cdp.send("Page.navigate", { url: "x" }, "S")))
  yield* Effect.sleep("5 millis")
  expect(written.join("")).toBe('{"id":1,"method":"Target.getTargets","params":{}}\0{"id":2,"method":"Page.navigate","params":{"url":"x"},"sessionId":"S"}\0')
  // Split mid-frame, and two frames in one chunk.
  answers.write('{"method":"Target.targetCreated","params":{}}\0{"id":2,"error":{"mess')
  answers.write('age":"No target"}}\0{"id":1,"result":{"targetInfos":[]}}\0')
  expect(yield* Fiber.join(asking)).toEqual({ targetInfos: [] })
  expect((yield* Fiber.join(refusing)).why).toBe("No target")
  expect(seen).toEqual(["Target.targetCreated@null"])
  const hanging = yield* Effect.forkChild(Effect.flip(cdp.send("Browser.getVersion")))
  yield* Effect.sleep("5 millis")
  answers.end()
  expect((yield* Fiber.join(hanging)).why).toBe("the browser's DevTools pipe closed")
  yield* cdp.closed
  expect((yield* Effect.flip(cdp.send("Browser.getVersion"))).why).toBe("the browser's DevTools pipe closed")
})))

test("a stream of pictures asks for the title at most once per interval, and once more after the last", () => run(Effect.gen(function*() {
  const browser = double()
  const live = yield* openLive(browser.options({ titleEveryMs: 200 }))
  yield* live.start
  yield* Effect.sleep("10 millis")
  const reads = () => browser.calls.filter((call) => call.method === "Target.getTargetInfo").length
  const before = reads()
  for (let n = 1; n <= 30; n++) {
    browser.emit(frame("S-T1", n))
    yield* Effect.sleep("5 millis")
  }
  // ~150ms of frames: the first asks at once, the rest wait for one trailing read.
  expect(reads() - before).toBe(1)
  browser.retitle("T1", "after the burst")
  yield* Effect.sleep("250 millis")
  expect(reads() - before).toBe(2)
  expect(live.tabs().get("T1")?.title).toBe("after the burst")
})))

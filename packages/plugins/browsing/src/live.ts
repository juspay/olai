/**
 * THE BROWSER THIS ROW OWNS — one Chromium per serve, launched lazily, shared
 * by every conversation's Playwright MCP over CDP and shown to the person in
 * the `/browser` pane.
 *
 * ## Who owns what
 *
 * The ROW SCOPE owns everything here. Each launch runs in a child scope forked
 * off it — the process, its DevTools connection, the sessions attached to its
 * tabs and the screencasts running on them — so a crash, a "forget sign-ins",
 * a switched-off row and olai stopping all end the same way: that scope
 * closes, the process group is stopped and reaped, and every pane watching it
 * is told in a sentence before its stream ends.
 *
 * Concurrent demands share ONE launch: the first forks it into the row scope
 * and the rest join its result. A failure is the `failed` standing and the
 * next demand tries again. Lifecycle TRANSITIONS — deciding to launch, and
 * stopping — take one permit, so a "forget" cannot interleave with a launch
 * that would reopen the profile it is removing.
 *
 * ## Screencasts are refcounted per tab
 *
 * The first pane on a tab starts CDP's screencast on that tab's session, every
 * frame is acknowledged once and fanned out, and the last pane to leave stops
 * it. A pane joining a running screencast is handed the last frame at once: a
 * still page paints nothing new, so without it a second pane would wait for a
 * change that may never come. A pane's parameters are its own request, but a
 * tab carries one screencast, so the first pane's size and quality hold until
 * the screencast stops; every pane scales the picture it is handed.
 */
import { Cause, Deferred, Effect, Exit, Fiber, Queue, Result, Scope, Semaphore, Stream } from "effect"
import { rm } from "node:fs/promises"
import { launchChromium, type Launched, LaunchFailure } from "./chromium.ts"
import { type Cdp, CdpFailure, type CdpEvent, openCdp } from "./cdp.ts"
import { BrowserRefused, clampViewport, DOWN, type Frame, type InputEvent, type ScreencastAsk, type Standing, type Tab, VIEWPORT } from "./wire.ts"

export interface LiveOptions {
  /** The Chromium executable, or `null` for a serve with none configured. */
  readonly chromium: string | null
  /** Why there is no browser when `chromium` is `null`, in a sentence. */
  readonly absentWhy: string
  /** The profile directory, asked at each launch (core's local directory). */
  readonly profile: Effect.Effect<string, { readonly why: string }>
  readonly now: () => string
  /** Where the standing and tabs are published — the surface's write face,
   *  once core has minted it. */
  readonly publish: {
    readonly standing: (standing: Standing) => void
    readonly tab: (tab: Tab) => void
    readonly untab: (id: string) => void
  }
  /** The least time between two picture-driven title reads of one tab. */
  readonly titleEveryMs?: number
  readonly launch?: typeof launchChromium
  readonly connect?: (launched: Launched) => Effect.Effect<Cdp, never, Scope.Scope>
}

export interface Live {
  readonly standing: () => Standing
  readonly tabs: () => ReadonlyMap<string, Tab>
  /** What an MCP needs to attach — the DevTools endpoint and the profile it
   *  is serving — launching the browser if nothing has yet. */
  readonly attach: Effect.Effect<Attach, BrowserRefused>
  readonly start: Effect.Effect<void, BrowserRefused>
  /** Stop the browser if it is up and remove its profile. */
  readonly forget: Effect.Effect<void, BrowserRefused>
  readonly screencast: (ask: ScreencastAsk) => Stream.Stream<Frame>
  readonly input: (targetId: string, event: InputEvent) => Effect.Effect<void, BrowserRefused>
  readonly navigate: (targetId: string, url: string) => Effect.Effect<void, BrowserRefused>
  readonly resize: (targetId: string, size: { readonly width: number; readonly height: number }) => Effect.Effect<void, BrowserRefused>
  readonly open: Effect.Effect<{ readonly targetId: string }, BrowserRefused>
  readonly close: (targetId: string) => Effect.Effect<void, BrowserRefused>
}

export interface Attach {
  readonly endpoint: string
  readonly profile: string
}

/** One running screencast on one tab, and the quality it was started at. */
interface Cast {
  readonly subscribers: Set<Queue.Queue<Frame, Cause.Done>>
  readonly quality: number
  last: Frame | null
}

/** A screencast's parameters. The size is the ceiling, not a size: frames
 *  come at the tab's own viewport, which follows its pane (`resize`). */
const castOf = (quality: number) => ({
  format: "jpeg",
  quality: Math.max(1, Math.min(100, Math.round(quality))),
  maxWidth: VIEWPORT.max.width,
  maxHeight: VIEWPORT.max.height,
  everyNthFrame: 1,
})

/** One launch, alive. */
interface Instance {
  readonly scope: Scope.Closeable
  readonly launched: Launched
  readonly profile: string
  readonly cdp: Cdp
  /** Each tab's flattened session, attached as the tab appears. */
  readonly sessions: Map<string, Deferred.Deferred<string, BrowserRefused>>
  /** ...and back, from a session to its tab, for the events it carries. */
  readonly targets: Map<string, string>
  readonly casts: Map<string, Cast>
  /** The viewport each tab was last sized to by a pane. */
  readonly sizes: Map<string, { readonly width: number; readonly height: number }>
  /** When each tab's info was last asked for, and which tabs have a
   *  picture-driven ask already waiting. */
  readonly lastRead: Map<string, number>
  readonly soon: Set<string>
}

const refused = (says: string) => new BrowserRefused({ says })
/** A tab's own session events after which its title may have moved. */
const REREAD_ON = new Set(["Page.domContentEventFired", "Page.loadEventFired", "Page.frameNavigated", "Page.navigatedWithinDocument"])
/** A failure's own sentence, whichever kind of failure it was. */
const whyOf = (cause: Cause.Cause<unknown>, interrupted: string): string => {
  if (Cause.hasInterruptsOnly(cause)) return interrupted
  const squashed = Cause.squash(cause)
  return squashed instanceof Error ? squashed.message : String(squashed)
}
const NOT_UP = "The browser is not running. Start it from this pane."
const refusing = (says: string): Stream.Stream<Frame> => Stream.succeed<Frame>({ _tag: "refused", says })

export const openLive = (options: LiveOptions): Effect.Effect<Live, never, Scope.Scope> => Effect.gen(function*() {
  const row = yield* Effect.scope
  const launch = options.launch ?? launchChromium
  const connect = options.connect ?? ((launched: Launched) => openCdp(launched.pipe))
  const titleEveryMs = options.titleEveryMs ?? 1_000
  const transitions = yield* Semaphore.make(1)

  let standing: Standing = options.chromium === null ? { kind: "absent", why: options.absentWhy } : DOWN
  const tabs = new Map<string, Tab>()
  let current: Instance | null = null
  let launching: { readonly result: Deferred.Deferred<Instance, BrowserRefused>; fiber: Fiber.Fiber<unknown> | null } | null = null

  const stand = (next: Standing) => {
    standing = next
    options.publish.standing(next)
  }
  options.publish.standing(standing)

  /** Take one target's info; answers whether it is a page this row had not
   *  seen, which the caller then attaches to. */
  const upsertTab = (info: Record<string, unknown>): boolean => {
    if (info["type"] !== "page" || typeof info["targetId"] !== "string") return false
    const tab: Tab = { id: info["targetId"], title: String(info["title"] ?? ""), url: String(info["url"] ?? "") }
    const held = tabs.get(tab.id)
    if (held !== undefined && held.title === tab.title && held.url === tab.url) return false
    tabs.set(tab.id, tab)
    options.publish.tab(tab)
    return held === undefined
  }

  /** Work on one launch's behalf, owned by its scope: whatever is in flight
   *  when it closes is interrupted with it. */
  const own = (instance: Instance, effect: Effect.Effect<unknown, unknown>) => {
    Effect.runFork(Effect.forkIn(Effect.ignore(effect), instance.scope))
  }

  /**
   * RE-READ ONE TAB'S INFO. Measured against the pinned Chromium (1228,
   * `--headless=new`): `Target.targetInfoChanged` carries a tab's URL changes,
   * and its title only once, for the foreground tab's first load. A background
   * tab's `<title>` and every `document.title =` arrive on no event at all,
   * and the protocol has no other title event. So the strip asks again when
   * the tab's own session says something happened. A load or navigation asks
   * at once; a new picture — the one sign a script retitled the page — asks at
   * most once per {@link LiveOptions.titleEveryMs}, trailing, so a page
   * streaming frames costs one call a second, not one a frame. Reads need no
   * coalescing: the pipe answers in order, so the last read to land is the
   * newest.
   */
  const reread = (instance: Instance, targetId: string) => {
    instance.lastRead.set(targetId, Date.now())
    own(instance, Effect.map(instance.cdp.send("Target.getTargetInfo", { targetId }), (answer) => {
      const info = answer["targetInfo"] as Record<string, unknown> | undefined
      if (current === instance && info !== undefined && tabs.has(targetId)) upsertTab(info)
    }))
  }

  /** ...and the throttled ask a new picture makes: now if the last read was
   *  long enough ago, otherwise once, when it will have been. */
  const glance = (instance: Instance, targetId: string) => {
    if (instance.soon.has(targetId)) return
    const wait = (instance.lastRead.get(targetId) ?? -Infinity) + titleEveryMs - Date.now()
    if (wait <= 0) return reread(instance, targetId)
    instance.soon.add(targetId)
    own(instance, Effect.andThen(Effect.sleep(wait), Effect.sync(() => {
      instance.soon.delete(targetId)
      if (tabs.has(targetId)) reread(instance, targetId)
    })))
  }

  /**
   * SIZE ONE TAB'S VIEWPORT to the box its pane last asked for, with
   * `Emulation.setDeviceMetricsOverride` on that tab's own session. Measured
   * on the pinned Chromium: resizing the shared headless window reaches only
   * the tab in front, so a background tab never followed its pane, while the
   * override sizes exactly this tab, front or not. A running screencast sends
   * no frame for the change, so it is restarted, and its first frame comes at
   * the new size. A cross-process navigation can drop the override (the e2e
   * saw 361×614 frames turn back into 1280×657 after one), so every
   * main-frame navigation of a sized tab sizes it again.
   */
  const sizeTab = (instance: Instance, targetId: string, sessionId: string): Effect.Effect<void, CdpFailure> => Effect.gen(function*() {
    const want = instance.sizes.get(targetId)
    if (want === undefined) return
    yield* instance.cdp.send("Emulation.setDeviceMetricsOverride", { ...want, deviceScaleFactor: 1, mobile: false }, sessionId)
    const cast = instance.casts.get(targetId)
    if (cast === undefined) return
    yield* instance.cdp.send("Page.stopScreencast", {}, sessionId)
    yield* instance.cdp.send("Page.startScreencast", castOf(cast.quality), sessionId)
  })

  /** Attach to a tab as soon as it appears, so its loads reach `reread`. */
  const follow = (instance: Instance, targetId: string) => own(instance, sessionFor(instance, targetId))
  const dropTab = (id: string) => {
    if (!tabs.delete(id)) return
    options.publish.untab(id)
  }

  /** Tell every pane on a tab why its picture stopped, and end their streams. */
  const endCast = (instance: Instance, targetId: string, says: string) => {
    const cast = instance.casts.get(targetId)
    if (cast === undefined) return
    instance.casts.delete(targetId)
    for (const queue of cast.subscribers) {
      Queue.offerUnsafe(queue, { _tag: "refused", says })
      Queue.endUnsafe(queue)
    }
  }

  /** Close one instance, if it is still the current one: panes first, then
   *  the scope (the process and its connection), then the standing. */
  const teardown = (instance: Instance, next: Standing, says: string): Effect.Effect<void> => Effect.suspend(() => {
    if (current !== instance) return Effect.void
    current = null
    for (const targetId of [...instance.casts.keys()]) endCast(instance, targetId, says)
    for (const id of [...tabs.keys()]) dropTab(id)
    return Effect.andThen(Scope.close(instance.scope, Exit.void), Effect.sync(() => stand(next)))
  })

  const onEvent = (instance: Instance) => (event: CdpEvent) => {
    if (event.sessionId !== null) {
      const targetId = instance.targets.get(event.sessionId)
      if (targetId === undefined) return
      if (REREAD_ON.has(event.method)) {
        // A sub-frame's navigation is not the tab's.
        const frame = event.params["frame"] as { readonly parentId?: unknown } | undefined
        if (frame?.parentId !== undefined) return
        reread(instance, targetId)
        if (event.method === "Page.frameNavigated") own(instance, sizeTab(instance, targetId, event.sessionId))
        return
      }
      if (event.method !== "Page.screencastFrame") return
      const params = event.params as { readonly data: string; readonly sessionId: number; readonly metadata: Record<string, number> }
      // Every frame is acknowledged, whoever is watching: an unacknowledged
      // screencast stops sending.
      own(instance, instance.cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId }, event.sessionId))
      glance(instance, targetId)
      const cast = instance.casts.get(targetId)
      if (cast === undefined) return
      const meta = params.metadata
      const frame: Frame = {
        _tag: "frame",
        jpeg: params.data,
        meta: {
          deviceWidth: meta["deviceWidth"] ?? 0,
          deviceHeight: meta["deviceHeight"] ?? 0,
          pageScaleFactor: meta["pageScaleFactor"] ?? 1,
          scrollOffsetX: meta["scrollOffsetX"] ?? 0,
          scrollOffsetY: meta["scrollOffsetY"] ?? 0,
          timestamp: meta["timestamp"] ?? 0,
        },
      }
      cast.last = frame
      for (const queue of cast.subscribers) Queue.offerUnsafe(queue, frame)
      return
    }
    switch (event.method) {
      case "Target.targetCreated":
      case "Target.targetInfoChanged": {
        const info = event.params["targetInfo"] as Record<string, unknown>
        if (upsertTab(info)) follow(instance, String(info["targetId"]))
        return
      }
      case "Target.targetDestroyed": {
        const targetId = String(event.params["targetId"])
        endCast(instance, targetId, "This tab was closed.")
        forgetSessions(instance, targetId)
        dropTab(targetId)
        return
      }
      case "Target.detachedFromTarget": {
        const targetId = String(event.params["targetId"] ?? "")
        endCast(instance, targetId, "The browser let go of this tab.")
        forgetSessions(instance, targetId)
        return
      }
    }
  }

  /** One launch, start to up, in its own scope off the row's. */
  const bringUp = (chromium: string): Effect.Effect<Instance, BrowserRefused> => Effect.gen(function*() {
    const scope = yield* Scope.fork(row)
    const opened = yield* Effect.exit(Effect.gen(function*() {
      const profile = yield* Effect.mapError(options.profile, (failure) => new LaunchFailure({ why: `The browser profile is unavailable: ${failure.why}.` }))
      const launched = yield* launch(chromium, profile)
      const cdp = yield* connect(launched)
      return { launched, profile, cdp }
    }).pipe(Scope.provide(scope)))
    if (Exit.isFailure(opened)) {
      yield* Scope.close(scope, Exit.void)
      return yield* refused(whyOf(opened.cause, "The browser launch was interrupted."))
    }
    const instance: Instance = { scope, ...opened.value, sessions: new Map(), targets: new Map(), casts: new Map(), sizes: new Map(), lastRead: new Map(), soon: new Set() }
    yield* instance.cdp.listen(onEvent(instance)).pipe(Scope.provide(scope))
    const seeded = yield* Effect.exit(Effect.gen(function*() {
      yield* instance.cdp.send("Target.setDiscoverTargets", { discover: true })
      const { targetInfos } = (yield* instance.cdp.send("Target.getTargets")) as { readonly targetInfos: ReadonlyArray<Record<string, unknown>> }
      return targetInfos.filter((info) => upsertTab(info)).map((info) => String(info["targetId"]))
    }))
    if (Exit.isFailure(seeded)) {
      yield* Scope.close(scope, Exit.void)
      return yield* refused(`The browser did not answer DevTools: ${whyOf(seeded.cause, "interrupted")}`)
    }
    current = instance
    for (const targetId of seeded.value) follow(instance, targetId)
    stand({ kind: "up", pid: instance.launched.pid, since: options.now() })
    // A crash, or a DevTools socket that went away under a live process,
    // takes the instance down; the watcher forks the teardown onto the row so
    // closing the instance's scope does not interrupt the teardown itself.
    yield* Effect.forkIn(
      Effect.flatMap(
        Effect.raceFirst(instance.launched.exited, Effect.as(instance.cdp.closed, "The browser's DevTools connection closed.")),
        (why) => Effect.forkIn(teardown(instance, { kind: "failed", why }, `The browser stopped: ${why}`), row),
      ),
      scope,
    )
    return instance
  })

  // The fork happens INSIDE the permit, so a stop that takes the permit next
  // always finds the launch fiber it has to interrupt.
  const demand: Effect.Effect<Instance, BrowserRefused> = Effect.flatten(transitions.withPermit(Effect.suspend(() => {
    if (options.chromium === null) return Effect.succeed(Effect.fail(refused(options.absentWhy)))
    if (current !== null) return Effect.succeed(Effect.succeed(current))
    if (launching !== null) return Effect.succeed(Deferred.await(launching.result))
    const result = Deferred.makeUnsafe<Instance, BrowserRefused>()
    const held: { readonly result: typeof result; fiber: Fiber.Fiber<unknown> | null } = { result, fiber: null }
    launching = held
    stand({ kind: "starting" })
    const run = bringUp(options.chromium).pipe(
      Effect.tapError((failure) => Effect.sync(() => stand({ kind: "failed", why: failure.says }))),
      Effect.onInterrupt(() => Effect.sync(() => { if (current === null) stand(DOWN) })),
      Effect.ensuring(Effect.sync(() => { if (launching === held) launching = null })),
      Deferred.into(result),
    )
    return Effect.map(Effect.forkIn(run, row), (fiber) => {
      held.fiber = fiber
      return Deferred.await(result)
    })
  })))

  /** Stop whatever is running or launching; the standing goes `down`. */
  const stop: Effect.Effect<void> = Effect.gen(function*() {
    const pending = launching
    if (pending !== null) {
      if (pending.fiber !== null) yield* Fiber.interrupt(pending.fiber)
      // A launch interrupted before its first step never reaches the line
      // that settles its waiters, so settle them here.
      yield* Deferred.interrupt(pending.result)
      if (launching === pending) launching = null
      if (current === null && standing.kind === "starting") stand(DOWN)
    }
    if (current !== null) yield* teardown(current, DOWN, "The browser was stopped.")
  })
  yield* Effect.addFinalizer(() => stop)

  const sessionFor = (instance: Instance, targetId: string): Effect.Effect<string, BrowserRefused> => Effect.suspend(() => {
    if (!tabs.has(targetId)) return Effect.fail(refused("There is no such tab in the browser."))
    const held = instance.sessions.get(targetId)
    if (held !== undefined) return Deferred.await(held)
    const result = Deferred.makeUnsafe<string, BrowserRefused>()
    instance.sessions.set(targetId, result)
    const attach = Effect.gen(function*() {
      const { sessionId } = (yield* instance.cdp.send("Target.attachToTarget", { targetId, flatten: true })) as { readonly sessionId: string }
      instance.targets.set(sessionId, targetId)
      yield* instance.cdp.send("Page.enable", {}, sessionId)
      // LOAD-BEARING, measured against the pinned Chromium: every tab lives
      // in one headless window, so only the foreground tab is `visible` and
      // a background tab paints no screencast frames at all. Focus emulation
      // keeps each tab visible and focused whatever is in front — so two
      // panes on two tabs, or the person's tab while an agent works in
      // another, both paint, with no `activateTarget` tug of war. It is also
      // what keeps caret and key handling alive on a page nobody focused.
      yield* instance.cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId)
      return sessionId
    }).pipe(
      Effect.mapError((failure: CdpFailure) => refused(`The browser would not attach to this tab: ${failure.why}.`)),
      Effect.tapError(() => Effect.sync(() => { if (instance.sessions.get(targetId) === result) instance.sessions.delete(targetId) })),
    )
    return Effect.flatMap(Effect.exit(attach), (exit) => Effect.andThen(Deferred.done(result, exit), exit))
  })
  const forgetSessions = (instance: Instance, targetId: string) => {
    instance.sessions.delete(targetId)
    instance.lastRead.delete(targetId)
    instance.sizes.delete(targetId)
    for (const [sessionId, held] of instance.targets) if (held === targetId) instance.targets.delete(sessionId)
  }

  /** Run one call on the running browser, refusing when nothing is up. */
  const onBrowser = <A>(use: (instance: Instance) => Effect.Effect<A, CdpFailure | BrowserRefused>) => Effect.suspend(() => {
    const instance = current
    if (instance === null) return Effect.fail(refused(NOT_UP))
    return Effect.mapError(use(instance), (failure) => failure._tag === "CdpFailure" ? refused(`The browser refused: ${failure.why}.`) : failure)
  })
  /** ...or on one tab's session. */
  const onTab = <A>(targetId: string, use: (instance: Instance, sessionId: string) => Effect.Effect<A, CdpFailure>) =>
    onBrowser((instance) => Effect.flatMap(sessionFor(instance, targetId), (sessionId) => use(instance, sessionId)))

  const screencast = (ask: ScreencastAsk): Stream.Stream<Frame> => Stream.unwrap(Effect.gen(function*() {
    const instance = current
    if (instance === null) return refusing(NOT_UP)
    const session = yield* Effect.result(sessionFor(instance, ask.targetId))
    if (Result.isFailure(session)) return refusing(session.failure.says)
    const sessionId = session.success
    // Sliding: a pane that falls behind skips to the newest frame rather than
    // queueing a backlog of pictures nobody will look at.
    const queue = yield* Queue.sliding<Frame, Cause.Done>(2)
    yield* Effect.acquireRelease(
      Effect.gen(function*() {
        if (current !== instance) {
          Queue.offerUnsafe(queue, { _tag: "refused", says: NOT_UP })
          Queue.endUnsafe(queue)
          return
        }
        const running = instance.casts.get(ask.targetId)
        if (running !== undefined) {
          running.subscribers.add(queue)
          if (running.last !== null) Queue.offerUnsafe(queue, running.last)
          return
        }
        instance.casts.set(ask.targetId, { subscribers: new Set([queue]), quality: ask.quality, last: null })
        const started = yield* Effect.exit(instance.cdp.send("Page.startScreencast", castOf(ask.quality), sessionId))
        if (Exit.isFailure(started)) endCast(instance, ask.targetId, "The browser would not show this tab.")
      }),
      () => Effect.suspend(() => {
        const cast = instance.casts.get(ask.targetId)
        if (cast === undefined || !cast.subscribers.delete(queue) || cast.subscribers.size > 0) return Effect.void
        instance.casts.delete(ask.targetId)
        return Effect.ignore(instance.cdp.send("Page.stopScreencast", {}, sessionId))
      }),
    )
    return Stream.fromQueue(queue)
  }))

  const input = (targetId: string, event: InputEvent) => onTab(targetId, (instance, sessionId) => {
    switch (event.kind) {
      case "mouse":
        return Effect.asVoid(instance.cdp.send("Input.dispatchMouseEvent", {
          type: event.type, x: event.x, y: event.y, button: event.button, buttons: event.buttons,
          clickCount: event.clickCount, modifiers: event.modifiers,
          ...(event.type === "mouseWheel" ? { deltaX: event.deltaX, deltaY: event.deltaY } : {}),
        }, sessionId))
      case "key":
        return Effect.asVoid(instance.cdp.send("Input.dispatchKeyEvent", {
          type: event.type === "keyDown" ? (event.text === "" ? "rawKeyDown" : "keyDown") : "keyUp",
          key: event.key, code: event.code, modifiers: event.modifiers,
          windowsVirtualKeyCode: event.keyCode, nativeVirtualKeyCode: event.keyCode,
          ...(event.type === "keyDown" && event.text !== "" ? { text: event.text, unmodifiedText: event.text } : {}),
        }, sessionId))
      case "text":
        return Effect.asVoid(instance.cdp.send("Input.insertText", { text: event.text }, sessionId))
    }
  })

  return {
    standing: () => standing,
    tabs: () => tabs,
    attach: Effect.map(demand, (instance) => ({ endpoint: instance.launched.endpoint, profile: instance.profile })),
    start: Effect.asVoid(demand),
    forget: transitions.withPermit(Effect.gen(function*() {
      yield* stop
      const profile = yield* Effect.mapError(options.profile, (failure) => refused(`The browser profile is unavailable: ${failure.why}.`))
      yield* Effect.tryPromise({
        try: () => rm(profile, { recursive: true, force: true }),
        catch: (cause) => refused(`The browser profile could not be removed: ${String(cause)}.`),
      })
      if (options.chromium !== null) stand(DOWN)
    })),
    screencast,
    input,
    navigate: (targetId, url) => onTab(targetId, (instance, sessionId) =>
      Effect.flatMap(instance.cdp.send("Page.navigate", { url }, sessionId), (answer) =>
        typeof answer["errorText"] === "string" && answer["errorText"] !== ""
          ? Effect.fail(new CdpFailure({ why: `${url} did not open (${answer["errorText"]})` }))
          : Effect.void)),
    /** Size one tab's viewport to a pane's box ({@link sizeTab}); the
     *  most recent ask wins. */
    resize: (targetId, size) => onTab(targetId, (instance, sessionId) => Effect.gen(function*() {
      const want = clampViewport(size)
      const held = instance.sizes.get(targetId)
      if (held !== undefined && held.width === want.width && held.height === want.height) return
      instance.sizes.set(targetId, want)
      yield* sizeTab(instance, targetId, sessionId)
    })),
    open: onBrowser((instance) => Effect.map(
      instance.cdp.send("Target.createTarget", { url: "about:blank" }),
      (answer) => ({ targetId: String(answer["targetId"]) }),
    )),
    close: (targetId) => onBrowser((instance) => Effect.asVoid(instance.cdp.send("Target.closeTarget", { targetId }))),
  }
})

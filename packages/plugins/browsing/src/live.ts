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
import { BrowserRefused, DOWN, type Frame, type InputEvent, type ScreencastAsk, type Standing, type Tab } from "./wire.ts"

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
  readonly launch?: typeof launchChromium
  readonly connect?: typeof openCdp
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
  readonly open: Effect.Effect<{ readonly targetId: string }, BrowserRefused>
  readonly close: (targetId: string) => Effect.Effect<void, BrowserRefused>
  readonly activate: (targetId: string) => Effect.Effect<void, BrowserRefused>
}

export interface Attach {
  readonly endpoint: string
  readonly profile: string
}

/** One running screencast on one tab. */
interface Cast {
  readonly subscribers: Set<Queue.Queue<Frame, Cause.Done>>
  last: Frame | null
}

/** One launch, alive. */
interface Instance {
  readonly scope: Scope.Closeable
  readonly launched: Launched
  readonly profile: string
  readonly cdp: Cdp
  /** Each tab's flattened session, attached on first use. */
  readonly sessions: Map<string, Deferred.Deferred<string, BrowserRefused>>
  readonly casts: Map<string, Cast>
}

const refused = (says: string) => new BrowserRefused({ says })
/** A failure's own sentence, whichever kind of failure it was. */
const whyOf = (cause: Cause.Cause<unknown>, interrupted: string): string => {
  if (Cause.hasInterruptsOnly(cause)) return interrupted
  const squashed = Cause.squash(cause)
  return squashed instanceof Error ? squashed.message : String(squashed)
}
const NOT_UP = "The browser is not running. Start it from this pane."
const refusing = (says: string): Stream.Stream<Frame> => Stream.succeed<Frame>({ _tag: "refused", says })

/** Make an absolute URL out of what a person typed in an address bar. */
export const addressOf = (typed: string): string => {
  const text = typed.trim()
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^(about|data|blob|javascript|view-source|mailto):/i.test(text)) return text
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(text)) return `http://${text}`
  if (/^[^\s/]+\.[^\s/]+/.test(text) || /^[^\s/]+:\d+(\/|$)/.test(text)) return `https://${text}`
  return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`
}

export const openLive = (options: LiveOptions): Effect.Effect<Live, never, Scope.Scope> => Effect.gen(function*() {
  const row = yield* Effect.scope
  const launch = options.launch ?? launchChromium
  const connect = options.connect ?? openCdp
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

  const upsertTab = (info: Record<string, unknown>) => {
    if (info["type"] !== "page" || typeof info["targetId"] !== "string") return
    const tab: Tab = { id: info["targetId"], title: String(info["title"] ?? ""), url: String(info["url"] ?? "") }
    const held = tabs.get(tab.id)
    if (held !== undefined && held.title === tab.title && held.url === tab.url) return
    tabs.set(tab.id, tab)
    options.publish.tab(tab)
  }
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
      if (event.method !== "Page.screencastFrame") return
      const targetId = [...instance.sessions].find(([, held]) => Deferred.isDoneUnsafe(held) && sessionOf(held) === event.sessionId)?.[0]
      const params = event.params as { readonly data: string; readonly sessionId: number; readonly metadata: Record<string, number> }
      // Every frame is acknowledged, whoever is watching: an unacknowledged
      // screencast stops sending.
      Effect.runFork(Effect.ignore(instance.cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId }, event.sessionId)))
      const cast = targetId === undefined ? undefined : instance.casts.get(targetId)
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
      case "Target.targetInfoChanged":
        upsertTab(event.params["targetInfo"] as Record<string, unknown>)
        return
      case "Target.targetDestroyed": {
        const targetId = String(event.params["targetId"])
        endCast(instance, targetId, "This tab was closed.")
        instance.sessions.delete(targetId)
        dropTab(targetId)
        return
      }
      case "Target.detachedFromTarget": {
        const targetId = String(event.params["targetId"] ?? "")
        endCast(instance, targetId, "The browser let go of this tab.")
        instance.sessions.delete(targetId)
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
      const cdp = yield* Effect.mapError(connect(launched.endpoint), (failure) => new LaunchFailure({ why: failure.why }))
      return { launched, profile, cdp }
    }).pipe(Scope.provide(scope)))
    if (Exit.isFailure(opened)) {
      yield* Scope.close(scope, Exit.void)
      return yield* refused(whyOf(opened.cause, "The browser launch was interrupted."))
    }
    const instance: Instance = { scope, ...opened.value, sessions: new Map(), casts: new Map() }
    yield* instance.cdp.listen(onEvent(instance)).pipe(Scope.provide(scope))
    const seeded = yield* Effect.exit(Effect.gen(function*() {
      yield* instance.cdp.send("Target.setDiscoverTargets", { discover: true })
      const { targetInfos } = (yield* instance.cdp.send("Target.getTargets")) as { readonly targetInfos: ReadonlyArray<Record<string, unknown>> }
      for (const info of targetInfos) upsertTab(info)
    }))
    if (Exit.isFailure(seeded)) {
      yield* Scope.close(scope, Exit.void)
      return yield* refused(`The browser did not answer DevTools: ${whyOf(seeded.cause, "interrupted")}`)
    }
    current = instance
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
      sessions.set(result, sessionId)
      yield* instance.cdp.send("Page.enable", {}, sessionId)
      // A headless page is never focused, and a page that thinks it is not
      // focused drops caret and key handling the person expects.
      yield* Effect.ignore(instance.cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId))
      return sessionId
    }).pipe(
      Effect.mapError((failure: CdpFailure) => refused(`The browser would not attach to this tab: ${failure.why}.`)),
      Effect.tapError(() => Effect.sync(() => { if (instance.sessions.get(targetId) === result) instance.sessions.delete(targetId) })),
    )
    return Effect.flatMap(Effect.exit(attach), (exit) => Effect.andThen(Deferred.done(result, exit), exit))
  })
  const sessions = new WeakMap<Deferred.Deferred<string, BrowserRefused>, string>()
  const sessionOf = (held: Deferred.Deferred<string, BrowserRefused>) => sessions.get(held)

  /** Run one call on a tab's session, refusing when nothing is up. */
  const onTab = <A>(targetId: string, use: (instance: Instance, sessionId: string) => Effect.Effect<A, CdpFailure>) =>
    Effect.suspend(() => {
      const instance = current
      if (instance === null) return Effect.fail(refused(NOT_UP))
      return Effect.flatMap(sessionFor(instance, targetId), (sessionId) =>
        Effect.mapError(use(instance, sessionId), (failure) => refused(`The browser refused: ${failure.why}.`)))
    })

  const onBrowser = <A>(use: (instance: Instance) => Effect.Effect<A, CdpFailure>) => Effect.suspend(() => {
    const instance = current
    if (instance === null) return Effect.fail(refused(NOT_UP))
    return Effect.mapError(use(instance), (failure) => refused(`The browser refused: ${failure.why}.`))
  })

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
        instance.casts.set(ask.targetId, { subscribers: new Set([queue]), last: null })
        const started = yield* Effect.exit(instance.cdp.send("Page.startScreencast", {
          format: "jpeg",
          quality: Math.max(1, Math.min(100, Math.round(ask.quality))),
          maxWidth: Math.max(1, Math.round(ask.maxWidth)),
          maxHeight: Math.max(1, Math.round(ask.maxWidth * 2)),
          everyNthFrame: 1,
        }, sessionId))
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
      Effect.flatMap(instance.cdp.send("Page.navigate", { url: addressOf(url) }, sessionId), (answer) =>
        typeof answer["errorText"] === "string" && answer["errorText"] !== ""
          ? Effect.fail(new CdpFailure({ why: `${addressOf(url)} did not open (${answer["errorText"]})` }))
          : Effect.void)),
    open: onBrowser((instance) => Effect.map(
      instance.cdp.send("Target.createTarget", { url: "about:blank" }),
      (answer) => ({ targetId: String(answer["targetId"]) }),
    )),
    close: (targetId) => onBrowser((instance) => Effect.asVoid(instance.cdp.send("Target.closeTarget", { targetId }))),
    activate: (targetId) => onBrowser((instance) => Effect.asVoid(instance.cdp.send("Target.activateTarget", { targetId }))),
  }
})

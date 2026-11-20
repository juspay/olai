import { BusyFailure, type NodeAgent, type NodeAgents, UsageFailure } from "@olai/format"
import type { OpFailure } from "@olai/format"
import { Deferred, Duration, Effect, Exit, Fiber, Scope, Semaphore } from "effect"

import { AgentGone, type StopReason } from "@kolu/acp-client"
import type { Panel, PanelOptions, WakeScope } from "./chat.ts"
import { makePanel } from "./chat.ts"
import { here } from "./agents/roster.ts"
import * as Memory from "./memory.ts"
import { type LiveMark, type LiveRecord, marksOf, RECORDED } from "./live.ts"
import type { Conversing } from "./sessions.ts"
import type { PanelAddress } from "./wire/session.ts"
import type { Change } from "@kolu/acp-harness"
import { succeeded } from "./succession.ts"
import { pastOf } from "./lineage.ts"
import { agentIn, type ChatEntry, type Listed } from "olai-plugin-chat/wire"

export const DEFAULT_IDLE = Duration.hours(48)

export const recordable = (slot: {
  readonly history: boolean
  readonly state: {
    readonly status: ReturnType<Panel["state"]>["status"]
    readonly unopened: unknown
  }
}): boolean =>
  !slot.history && slot.state.unopened === null && slot.state.status !== "gone"

export interface ToolTicket {
  readonly bearer: string
  readonly release: () => void
}

export interface LiveSession {
  readonly since?: string
  readonly status: ReturnType<Panel["state"]>["status"]
  readonly asking: number
  readonly unopened?: boolean
  readonly sleep?: boolean
}

export interface Chat extends Panel {
  readonly sessionsFor: (agent: string) => Effect.Effect<Listed>
  readonly reading: (to: PanelAddress, observer: ReadingObserver) => Effect.Effect<Panel | null, OpFailure, Scope.Scope>
  readonly inConversation: <A>(to: PanelAddress, scope: string | null | undefined, use: (panel: Panel) => Effect.Effect<A, OpFailure>) => Effect.Effect<A, OpFailure>
  readonly seen: (to: Conversing, at: string) => Effect.Effect<void, OpFailure>
  readonly live: () => ReadonlyMap<string, LiveSession>
  readonly withdraw: (plugin: string, to: Conversing) => Effect.Effect<void>
  readonly sleep: (node: string) => Effect.Effect<void, OpFailure>
  readonly seats: (listen: () => void) => () => void
  readonly startAgentSession: (
    node: string,
    agent: string,
    committed?: (to: Conversing) => Effect.Effect<void, OpFailure>,
  ) => Effect.Effect<Conversing | null, OpFailure>
}

export interface ReadingObserver {
  readonly state: (state: ReturnType<Panel["state"]>) => void
  readonly transcript: (change: Change<ChatEntry>) => void
}

export interface Options extends Omit<PanelOptions, "memory"> {
  readonly memory?: PanelOptions["memory"]
  readonly onConversationClosed?: (state: ReturnType<Panel["state"]>) => void
  readonly onConversationState?: (state: ReturnType<Panel["state"]>, entries: ReturnType<Panel["entries"]>, node: string | null) => void
  readonly onConversationTranscript?: (state: ReturnType<Panel["state"]>, change: Change<ChatEntry>) => void
  readonly wake: (plugin: string) => object | undefined
  readonly live?: LiveRecord | null
  readonly nodeAt: (node: string) => NodeAgent | null
  readonly seatableAt: (node: string) => boolean
  readonly nodes: () => NodeAgents
  readonly ticket: (node: string) => ToolTicket
  readonly nearestAt: (node: string, candidates: ReadonlySet<string>) => string | null
  readonly idle?: Duration.Input
  readonly capacity?: number
  readonly onLive?: () => void
  readonly fork: (work: Effect.Effect<void>) => Fiber.Fiber<void>
}

interface NodeSlot {
  uses: number
  mutingReaders: boolean
  readonly superseded: Set<string>
  readonly lagging: Set<string>
  openingFor: Conversing | null
  readingFor: Conversing | null
  readonly opening: Semaphore.Semaphore
  readonly key: string
  readonly history: boolean
  readonly node: string
  readonly scope: Scope.Closeable
  readonly panel: Panel
  since: string
  state: ReturnType<Panel["state"]>
  touched: number
  generation: number
  closing: boolean
  closeReason: StopReason
  timer: Fiber.Fiber<void, never> | null
}

interface PendingDelivery {
  readonly plugin: string
  readonly to: { readonly agent: string; readonly session: string }
  readonly say: () => string | null
  readonly options?: { readonly coalesce?: string; readonly sleep?: true }
}

const empty: Change<ChatEntry> = { upserts: [], removes: [], appends: [] }

const whole = (panel: Panel, gone: ReadonlyArray<string> = []): Change<ChatEntry> =>
  ({ ...empty, removes: gone, upserts: [...panel.entries().values()] })

export const make = (options: Options): Effect.Effect<Chat, never, never> =>
  Effect.gen(function*() {
    const {
      capacity = RECORDED,
      idle = DEFAULT_IDLE,
      live = null,
      nearestAt,
      wake,
      nodeAt,
      nodes: nodesAt,
      onLive,
      seatableAt,
      ticket: mintTicket,
      fork,
      ...givenPanelOptions
    } = options
    const memory = givenPanelOptions.memory
      ?? Memory.volatile()
    const panelOptions: PanelOptions = { ...givenPanelOptions, memory }
    const gate = yield* Semaphore.make(1)
    const reopening = yield* Semaphore.make(1)
    const nodes = new Map<string, NodeSlot>()
    const closing = new Map<NodeSlot, Deferred.Deferred<void>>()
    const readers = new Map<string, Set<ReadingObserver>>()
    const readerNodes = new Map<ReadingObserver, string>()
    const nodeReaders = new Map<string, Set<ReadingObserver>>()
    let knownEngines = new Set(here(options.roster()).map(row => row.id))
    const readingKey = (to: Conversing) => JSON.stringify([to.agent, to.session])
    const listeners = (state: ReturnType<Panel["state"]>) => {
      const agent = agentIn(state)
      const session = state.session?.id ?? state.unopened?.what
      return agent == null || session == null ? undefined : readers.get(readingKey({ agent: agent.id, session }))
    }
    const readingListeners = (slot: NodeSlot) => new Set([
      ...(!slot.history ? nodeReaders.get(slot.node) ?? [] : []),
      ...(listeners(slot.state)
        ?? (slot.openingFor === null ? undefined : readers.get(readingKey(slot.openingFor)))
        ?? (slot.readingFor === null ? undefined : readers.get(readingKey(slot.readingFor))) ?? []),
    ])
    const read = (slot: NodeSlot) => (readingListeners(slot)?.size ?? 0) > 0
      || [...readerNodes.values()].includes(slot.node)
    const quietState = (state: ReturnType<Panel["state"]>): boolean =>
      (state.status === "idle" || state.status === "gone")
      && state.asking === 0
      && state.watching.length === 0
    const released = (node: string | undefined): void => {
      for (const slot of nodes.values()) {
        if (node === undefined) {
          armIdle(slot)
          continue
        }
        if (slot.node !== node) continue
        slot.touched = Date.now()
        armIdle(slot)
      }
      if (node !== undefined) persistLive()
    }
    const pending = new Map<string, Array<PendingDelivery>>()
    const restore = new Map<string, number>()
    const idleMs = Duration.toMillis(idle)
    const budgetLeft = (touched: number, at: number = Date.now()): number => touched + idleMs - at
    let stopped = false
    let reopenFiber: Fiber.Fiber<void> | null = null
    let inFlight = 0
    let quiet: Deferred.Deferred<void> | undefined
    let active: { readonly kind: "root"; readonly panel: Panel } | {
      readonly kind: "node"
      readonly slot: NodeSlot
    }

    let liveWriting = false
    let liveAgain = false
    const persistLive = (): void => {
      if (live === null || stopped) return
      if (liveWriting) {
        liveAgain = true
        return
      }
      liveWriting = true
      const marks: ReadonlyArray<LiveMark> = marksOf(
        [...nodes.values()]
          .filter(recordable)
          .map((slot) => ({ node: slot.node, touched: slot.touched })),
        [...restore].map(([node, touched]) => ({ node, touched })),
      )
      fork(
        live.write(marks).pipe(
          Effect.catchTag("MemoryFailure", (failure) =>
            Effect.logWarning(
              `chat: the conversations live in this directory could not be written down: ${failure.message}`,
            )),
          Effect.ensuring(Effect.sync(() => {
            liveWriting = false
            if (liveAgain) {
              liveAgain = false
              persistLive()
            }
          })),
        ),
      )
    }

    const liveMoved = (): void => {
      onLive?.()
      persistLive()
    }

    const nodeSessions: Panel["liveSessions"] = (agent) => {
      const slot = [...nodes.values()].find(one => one.panel.liveSessions(agent) !== null)
      if (slot === undefined) return null
      return Effect.acquireUseRelease(
        gate.withPermit(Effect.gen(function*() {
          if (stopped || ![...nodes.values()].includes(slot)) return yield* new AgentGone({
            gone: "unreachable", why: "the running node agent stopped before its listing" })
          slot.uses += 1
          inFlight += 1
          return slot
        })),
        held => held.panel.liveSessions(agent) ?? Effect.fail(new AgentGone({
          gone: "unreachable", why: "the node agent changed engines before its listing" })),
        held => Effect.sync(() => {
          held.uses -= 1
          inFlight -= 1
          armIdle(held)
          if (inFlight === 0 && quiet !== undefined) Deferred.doneUnsafe(quiet, Effect.void)
        }),
      )
    }

    const rootPanel = () => Effect.gen(function*() {
      let panel!: Panel
      panel = yield* makePanel({
        ...panelOptions,
        runningSessions: nodeSessions,
        onState: (state) => {
          options.onConversationState?.(state, panel.entries(), null)
          for (const reader of listeners(state) ?? []) reader.state(state)
          if (active?.kind === "root" && active.panel === panel) {
            panelOptions.onState(state)
          }
        },
        onTranscript: (change) => {
          options.onConversationTranscript?.(panel.state(), change)
          for (const reader of listeners(panel.state()) ?? []) reader.transcript(change)
          if (active?.kind === "root" && active.panel === panel) panelOptions.onTranscript(change)
        },
      })
      return panel
    })
    let root!: Panel
    root = yield* rootPanel()
    active = { kind: "root", panel: root }

    const panelOf = (): Panel => active.kind === "root" ? active.panel : active.slot.panel

    const publishSwitch = (before: Panel, after: Panel): void => {
      const gone = [...before.entries().keys()]
      if (gone.length > 0) panelOptions.onTranscript({ ...empty, removes: gone })
      const arrived = whole(after)
      if (arrived.upserts.length > 0) panelOptions.onTranscript(arrived)
      panelOptions.onState(after.state())
      liveMoved()
    }

    const activateRoot = (): void => {
      if (active.kind === "root") return
      const before = active.slot.panel
      active = { kind: "root", panel: root }
      publishSwitch(before, root)
    }

    const activate = (slot: NodeSlot): void => {
      slot.touched = Date.now()
      if (active.kind === "node" && active.slot === slot) return
      const before = panelOf()
      active = { kind: "node", slot }
      publishSwitch(before, slot.panel)
    }

    const seatWatchers = new Set<() => void>()
    const seatFreed = (): void => {
      for (const listen of [...seatWatchers]) listen()
    }

    const close = (slot: NodeSlot, reason: StopReason = "scope released"): Effect.Effect<void> =>
      Effect.suspend(() => {
        if (slot.closing) {
          const done = closing.get(slot)
          return done === undefined ? Effect.void : Deferred.await(done)
        }
        if (nodes.get(slot.key) !== slot) return Effect.void
        const done = Deferred.makeUnsafe<void>()
        closing.set(slot, done)
        slot.closing = true
        slot.closeReason = reason
        nodes.delete(slot.key)
        if (active.kind === "node" && active.slot === slot) activateRoot()
        liveMoved()
        const timer = slot.timer
        slot.timer = null
        return Effect.andThen(
          timer === null ? Effect.void : Fiber.interrupt(timer),
          Scope.close(slot.scope, Exit.void).pipe(Effect.ensuring(Effect.sync(() => options.onConversationClosed?.(slot.state)))),
        ).pipe(Effect.ensuring(Effect.sync(() => {
          Deferred.doneUnsafe(done, Effect.void)
          closing.delete(slot)
          seatFreed()
        })))
      }).pipe(Effect.uninterruptible)

    const armIdle = (slot: NodeSlot): void => {
      if (slot.closing || stopped) return
      const generation = ++slot.generation
      const former = slot.timer
      slot.timer = null
      if (former !== null) fork(Fiber.interrupt(former))
      let fiber!: Fiber.Fiber<void, never>
      const timer = Effect.gen(function*() {
        yield* Effect.sleep(Duration.millis(Math.max(0, budgetLeft(slot.touched))))
        if (slot.generation !== generation || slot.closing) return
        if (!quietState(slot.state)) return
        if (read(slot) || slot.uses > 0) {
          slot.timer = null
          slot.touched = Date.now()
          persistLive()
          armIdle(slot)
          return
        }
        slot.timer = null
        yield* close(slot, "idle eviction")
      }).pipe(Effect.ensuring(Effect.sync(() => {
        if (slot.timer === fiber) slot.timer = null
      })))
      fiber = fork(timer)
      slot.timer = fiber
    }

    const room = (): Effect.Effect<void, OpFailure> => {
      if (nodes.size < capacity) return Effect.void
      const reaper = [...nodes.values()]
        .filter((slot) =>
          !read(slot)
          && slot.uses === 0
          && quietState(slot.state)
        )
        .sort((left, right) => left.touched - right.touched)[0]
      return reaper === undefined
        ? Effect.fail(new BusyFailure({
          reason: `All ${capacity} agents are awake — put one to sleep in Chats.`,
          cause: { kind: "capacity", capacity },
        }))
        : close(reaper, "capacity eviction")
    }

    const acquire = (
      node: string,
      history?: Conversing,
    ): Effect.Effect<{ readonly slot: NodeSlot; readonly fresh: boolean }, OpFailure> =>
      gate.withPermit(Effect.gen(function*() {
        const key = JSON.stringify([node, history?.agent ?? null, history?.session ?? null])
        const held = nodes.get(key)
        if (held !== undefined && !held.closing) {
          held.uses += 1
          held.touched = Date.now()
          if (quietState(held.state)) {
            armIdle(held)
          } else {
            held.generation++
          }
          return { slot: held, fresh: false }
        }
        if (stopped) {
          return yield* new BusyFailure({ reason: "the server is shutting down" })
        }
        yield* room()
        const scope = Scope.makeUnsafe()
        return yield* Effect.onExit(Effect.gen(function*() {
          const ticket = mintTicket(node)
          yield* Effect.addFinalizer(() => Effect.sync(ticket.release)).pipe(
            Effect.provideService(Scope.Scope, scope),
          )
          let slot!: NodeSlot
          const panel = yield* Effect.acquireRelease(
            makePanel({
              ...panelOptions,
              agentAt: (to) => {
                const bound = panelOptions.agentAt?.(to) ?? null
                if (bound !== null || history === undefined) return bound
                const owner = nodeAt(node)
                return to.agent === history.agent && to.session === history.session
                    && owner?.engine === history.agent ? owner : null
              },
              tools: () => {
                const server = panelOptions.tools()
                if (server === null || ticket.bearer === "") return null
                return { ...server, token: ticket.bearer }
              },
              onState: (state) => {
                const before = slot.state
                const still = quietState(before) && quietState(state)
                  && before.session?.id === state.session?.id
                  && (before.unopened === null) === (state.unopened === null)
                if (before.status !== state.status) slot.since = new Date().toISOString()
                slot.state = state
                const agent = agentIn(state)
                const session = state.session?.id ?? state.unopened?.what
                if (agent != null && session != null) slot.readingFor = { agent: agent.id, session }
                options.onConversationState?.(state, slot.panel.entries(), slot.node)
                if (!still) slot.touched = Date.now()
                if (quietState(state)) {
                  armIdle(slot)
                } else {
                  slot.generation++
                }
                if (active.kind === "node" && active.slot === slot) panelOptions.onState(state)
                if (!slot.mutingReaders) for (const reader of readingListeners(slot) ?? []) reader.state(state)
                liveMoved()
              },
              onTranscript: (change) => {
                options.onConversationTranscript?.(slot.state, change)
                if (active.kind === "node" && active.slot === slot) panelOptions.onTranscript(change)
                if (!slot.mutingReaders) for (const reader of readingListeners(slot) ?? []) reader.transcript(change)
              },
            }),
            (made) => made.stopWithReason(slot?.closeReason ?? "scope released"),
          ).pipe(Effect.provideService(Scope.Scope, scope), Effect.annotateLogs({ node }))
          slot = {
            uses: 1,
            mutingReaders: false,
            superseded: new Set(),
            lagging: new Set(),
            openingFor: null,
            readingFor: null,
            opening: Semaphore.makeUnsafe(1),
            key,
            history: history !== undefined,
            node,
            scope,
            panel,
            since: new Date().toISOString(),
            state: panel.state(),
            touched: Date.now(),
            generation: 0,
            closing: false,
            closeReason: "scope released",
            timer: null,
          }
          nodes.set(key, slot)
          liveMoved()
          return { slot, fresh: true }
        }), (exit) => Exit.isSuccess(exit) ? Effect.void : Scope.close(scope, Exit.void))
      }))

    const working = <A, E, R>(
      node: string,
      history: Conversing | undefined,
      use: (held: { readonly slot: NodeSlot; readonly fresh: boolean }) => Effect.Effect<A, E, R>,
    ): Effect.Effect<A, E | OpFailure, R> =>
      Effect.acquireUseRelease(
        Effect.sync(() => { inFlight += 1 }),
        () => Effect.acquireUseRelease(
          acquire(node, history),
          use,
          (held) => Effect.sync(() => {
            held.slot.uses -= 1
            armIdle(held.slot)
          }),
        ),
        () =>
          Effect.sync(() => {
            inFlight -= 1
            if (inFlight === 0 && quiet !== undefined) Deferred.doneUnsafe(quiet, Effect.void)
          }),
      )

    const settled = Effect.suspend(() => {
      if (inFlight === 0) return Effect.void
      quiet ??= Deferred.makeUnsafe<void>()
      return Deferred.await(quiet)
    })

    const nodeFor = (
      agent: string,
      session: string,
    ): NodeAgent | null => panelOptions.agentAt?.({ agent, session }) ?? null

    let lastListed: Listed | null = null
    const listSessions = Effect.tap(Effect.suspend(() => root.sessions), (listed) => Effect.sync(() => {
      lastListed = listed
    }))

    const locate = (to: Conversing) => Effect.gen(function*() {
      const current = nodeFor(to.agent, to.session)
      if (current !== null) return { node: current, history: false }
      const busy = root.state().status === "thinking" || [...nodes.values()].some(slot => slot.state.status === "thinking")
      const listed = busy ? lastListed : yield* listSessions
      if (listed === null) return null
      const node = nodesAt().find((candidate) =>
        candidate.engine === to.agent && candidate.session !== null
        && pastOf(listed.sessions, to.agent, candidate.session).some((past) => past.id === to.session)
      ) ?? null
      return node === null ? null : { node, history: true }
    })

    const hold = (node: string, delivery: PendingDelivery): void => {
      const held = pending.get(node) ?? []
      const key = delivery.options?.coalesce
      const replace = key === undefined
        ? -1
        : held.findIndex((one) =>
          one.plugin === delivery.plugin && one.options?.coalesce === key
        )
      if (replace < 0) held.push(delivery)
      else held[replace] = delivery
      pending.set(node, held)
    }

    const flush = (slot: NodeSlot): Effect.Effect<void> =>
      Effect.gen(function*() {
        const held = pending.get(slot.node)
        if (held === undefined) return
        pending.delete(slot.node)
        for (const delivery of held) {
          if (nodeFor(delivery.to.agent, delivery.to.session)?.id !== slot.node) continue
          yield* slot.panel.doorFor(delivery.plugin)
            .deliver(delivery.to, delivery.say, delivery.options)
        }
      })

    const ensureNode = (
      node: string,
      open: (panel: Panel) => Effect.Effect<void, OpFailure>,
      foreground: boolean,
    ): Effect.Effect<NodeSlot, OpFailure> =>
      working(node, undefined, ({ slot, fresh }) =>
        Effect.gen(function*() {
          if (foreground) activate(slot)
          if (fresh) yield* open(slot.panel)
          yield* flush(slot)
          return slot
        }))

    const foreground = <A>(use: (panel: Panel) => Effect.Effect<A, OpFailure>) =>
      Effect.suspend(() => use(panelOf()))

    const start = Effect.gen(function*() {
      for (const mark of live?.read() ?? []) {
        restore.set(mark.node, mark.touched)
      }
      yield* root.enginesMoved
      reopenFiber = fork(reopenPending)
    })

    const reopenPending = reopening.withPermit(Effect.gen(function*() {
      if (stopped || restore.size === 0) return
      const now = Date.now()
      const present = new Set(here(options.roster()).map(row => row.id))
      for (const [node, touched] of [...restore].sort((left, right) => right[1] - left[1])) {
        if (stopped) return
        if (budgetLeft(touched, now) <= 0) {
          restore.delete(node)
          continue
        }
        const bound = nodeAt(node)
        const session = bound?.session ?? null
        if (bound === null || session === null || !seatableAt(node)) {
          yield* Effect.logWarning(
            `chat: node ${node} was live before the restart but is no longer a seat for a conversation; not reopening it`,
          )
          restore.delete(node)
          continue
        }
        if (!present.has(bound.engine)) continue
        const key = JSON.stringify([node, null, null])
        if (nodes.has(key)) {
          restore.delete(node)
          continue
        }
        const opened = yield* Effect.result(
          ensureNode(node, (panel) => panel.loadSession(bound.engine, session), false),
        )
        if (opened._tag === "Failure") {
          yield* Effect.logWarning(
            `chat: the conversation that was live on node ${node} could not be reopened: ${opened.failure.message}`,
          )
          const slot = nodes.get(key)
          if (slot !== undefined) {
            if (read(slot)) armIdle(slot)
            else yield* close(slot, "scope released")
          }
          restore.delete(node)
          continue
        }
        restore.delete(node)
        opened.success.touched = touched
        armIdle(opened.success)
      }
      persistLive()
    }))

    const discardPending = (left: ReadonlyArray<{
      readonly agent: string; readonly session: string; readonly plugin: string
    }>): void => {
      for (const [key, held] of pending) {
        const keep = held.filter((one) => !left.some((row) => row.plugin === one.plugin
          && row.agent === one.to.agent && row.session === one.to.session))
        if (keep.length === 0) pending.delete(key)
        else pending.set(key, keep)
      }
    }

    const withdraw = (plugin: string, to: Conversing): Effect.Effect<void> =>
      Effect.suspend(() => {
        for (const [node, held] of pending) {
          const keep = held.filter((one) =>
            !(one.plugin === plugin && one.to.agent === to.agent && one.to.session === to.session))
          if (keep.length === 0) pending.delete(node)
          else pending.set(node, keep)
        }
        return Effect.forEach(
          [...nodes.values()].map((slot) => slot.panel).concat(root),
          (panel) => panel.doorFor(plugin).withdraw(to),
          { discard: true },
        )
      })

    const refreshWakes: Panel["refreshWakes"] = (left) => {
      discardPending(left)
      root.refreshWakes(left)
      for (const slot of nodes.values()) slot.panel.refreshWakes(left)
    }

    const scopedDoor = (plugin: string) => {
      const scopes = (): ReadonlyArray<WakeScope> => {
        const manual = root.doorFor(plugin).scopes().filter(row => nodeFor(row.agent, row.session) !== null)
        const activation = wake(plugin)
        if (activation !== undefined) return manual.map((row) => ({
          ...row, current: () => wake(plugin) === activation && nodeFor(row.agent, row.session) !== null && row.current(),
        }))
        return nodesAt().flatMap(node => node.session === null ? [] : [{
          agent: node.engine, session: node.session, pick: null,
          current: () => wake(plugin) === undefined
            && nodeFor(node.engine, node.session!)?.id === node.id,
        }])
      }
      return {
        scopes,
        withdraw: (to: { readonly agent: string; readonly session: string }) => withdraw(plugin, to),
        deliver: (
          to: { readonly agent: string; readonly session: string; readonly current?: () => boolean },
          say: () => string | null,
          how?: { readonly coalesce?: string; readonly sleep?: true },
        ): Effect.Effect<void> => {
          const allowed = to.current ?? (() => wake(plugin) === undefined)
          const authorized = () => allowed() ? say() : null
          const node = nodeFor(to.agent, to.session)
          if (node === null) return root.doorFor(plugin).deliver(to, authorized, how)
          return Effect.catch(Effect.gen(function*() {
            if (!allowed()) return
            const slot = yield* ensureNode(
              node.id,
              (panel) => panel.loadSession(to.agent, to.session),
              false,
            )
            yield* slot.panel.doorFor(plugin).deliver(to, authorized, how)
          }),
            (failure) => Effect.suspend(() => {
              if (!allowed()) return Effect.void
              hold(node.id, { plugin, to, say: authorized, options: how })
              return Effect.logWarning(
                `node agent ${node.id} could not wake: ${failure.message}; its delivery is held`,
              )
            }),
          )
        },
      }
    }

    const refuseNewWork = (): void => {
      stopped = true
      pending.clear()
    }

    const joinBoot = Effect.gen(function*() {
      const booting = reopenFiber
      reopenFiber = null
      if (booting !== null) yield* Fiber.interrupt(booting)
    })

    const closePanels = (reason: StopReason) =>
      Effect.gen(function*() {
        yield* root.stopWithReason(reason)
        yield* Effect.forEach([...nodes.values()], (slot) => close(slot, reason), { discard: true, concurrency: "unbounded" })
        yield* Effect.forEach([...closing.values()], Deferred.await, { discard: true })
      })

    const stopWithReason = (reason: StopReason) => Effect.gen(function*() {
      refuseNewWork()
      yield* joinBoot
      yield* settled
      yield* closePanels(reason)
    })

    const settledBinding = (slot: NodeSlot, bound: NodeAgent | null): string | null => {
      const binding = bound?.session == null
        ? null
        : readingKey({ agent: bound.engine, session: bound.session })
      if (binding === null || !slot.lagging.has(binding)) slot.lagging.clear()
      return binding
    }

    const inNodeConversation = <A, E, R>(
      place: NonNullable<Effect.Success<ReturnType<typeof locate>>>,
      to: Conversing,
      use: (slot: NodeSlot) => Effect.Effect<A, E, R>,
    ): Effect.Effect<A, E | OpFailure, R> =>
      working(place.node.id, place.history ? to : undefined, ({ slot }) => Effect.gen(function*() {
        const current = yield* slot.opening.withPermit(Effect.gen(function*() {
          if (!slot.history && slot.superseded.has(readingKey(to))) return null
          return { value: yield* use(slot) }
        }))
        if (current !== null) return current.value
        return yield* working(place.node.id, to, ({ slot: history }) =>
          history.opening.withPermit(use(history)))
      }))

    const reading: Chat["reading"] = (to, observer) => Effect.gen(function*() {
        if ("node" in to) {
          if (!seatableAt(to.node)) return yield* new UsageFailure({ reason: "the node is no longer available" })
          yield* Effect.acquireRelease(Effect.sync(() => {
            const held = nodeReaders.get(to.node) ?? new Set<ReadingObserver>()
            held.add(observer)
            nodeReaders.set(to.node, held)
            readerNodes.set(observer, to.node)
            return held
          }), held => Effect.sync(() => {
            held.delete(observer)
            readerNodes.delete(observer)
            if (held.size === 0) nodeReaders.delete(to.node)
            released(to.node)
          }))
          return yield* working(to.node, undefined, ({ slot }) => slot.opening.withPermit(Effect.gen(function*() {
            const bound = nodeAt(to.node)
            const state = slot.panel.state()
            const binding = settledBinding(slot, bound)
            if (state.unopened === null && binding !== null && bound?.session != null
              && !slot.lagging.has(binding)
              && (state.session === null || state.session.id !== bound.session || agentIn(state)?.id !== bound.engine || state.status === "gone")) {
              yield* Effect.catch(slot.panel.loadSession(bound.engine, bound.session), () => Effect.void)
            }
            observer.state(slot.panel.state())
            observer.transcript(whole(slot.panel))
            return slot.panel
          })))
        }
        yield* Effect.acquireRelease(Effect.sync(() => {
          const key = readingKey(to)
          const held = readers.get(key) ?? new Set<ReadingObserver>()
          held.add(observer)
          readers.set(key, held)
          return { key, held }
        }), ({ key, held }) => Effect.sync(() => {
          const node = readerNodes.get(observer)
          readerNodes.delete(observer)
          held.delete(observer)
          if (held.size === 0 && readers.get(key) === held) readers.delete(key)
          released(node)
        }))
        const into = (slot: NodeSlot) => Effect.gen(function*() {
          const state = slot.panel.state()
          if (state.session?.id !== to.session || agentIn(state)?.id !== to.agent || state.status === "gone") {
            slot.openingFor = to
            yield* Effect.catch(slot.panel.loadSession(to.agent, to.session), () => Effect.void).pipe(
              Effect.ensuring(Effect.sync(() => { slot.openingFor = null })),
            )
          }
          if (!slot.history) yield* flush(slot)
          observer.state(slot.panel.state())
          observer.transcript(whole(slot.panel))
          return slot.panel
        })
        if (to.current === true) {
          const node = nodeFor(to.agent, to.session)
          if (node === null) return null
          const answer = yield* working(node.id, undefined, ({ slot, fresh }) => slot.opening.withPermit(Effect.gen(function*() {
            const binding = settledBinding(slot, nodeAt(node.id))
            if (binding !== readingKey(to) || slot.lagging.has(binding)) return { panel: null, unused: fresh ? slot : null }
            readerNodes.set(observer, node.id)
            return { panel: yield* into(slot), unused: null }
          })))
          const unused = answer.unused
          if (unused !== null) yield* Effect.suspend(() => unused.uses === 0 ? close(unused, "scope released") : Effect.void)
          return answer.panel
        }
        const place = yield* locate(to)
        if (place === null) {
          const state = root.state()
          const panel = state.session?.id === to.session && agentIn(state)?.id === to.agent
            ? root
            : yield* Effect.acquireRelease(rootPanel(), panel => panel.stop)
          if (panel !== root) yield* Effect.catch(panel.loadSession(to.agent, to.session), () => Effect.void)
          observer.state(panel.state())
          observer.transcript(whole(panel))
          return panel
        }
        readerNodes.set(observer, place.node.id)
        return yield* inNodeConversation(place, to, into)
      })

    const conversationIn = <A>(
      to: PanelAddress,
      scope: string | null | undefined,
      use: (panel: Panel) => Effect.Effect<A, OpFailure>,
      how: "open-if-needed" | "only-if-open",
    ): Effect.Effect<A, OpFailure> => Effect.suspend(() => {
        const mayOpen = how === "open-if-needed"
        if ("node" in to) {
          const slot = nodes.get(JSON.stringify([to.node, null, null]))
          if (slot === undefined || slot.closing || scope !== slot.panel.state().uploadScope) {
            return Effect.fail(new UsageFailure({ reason: "the conversation changed; this action was not applied" }))
          }
          return working(to.node, undefined, ({ slot: held }) => held === slot && scope === held.panel.state().uploadScope
            ? use(held.panel)
            : Effect.fail(new UsageFailure({ reason: "the conversation changed; this action was not applied" })))
        }
        const matches = (panel: Panel) => {
          const state = panel.state()
          return agentIn(state)?.id === to.agent
            && (state.session?.id === to.session || state.unopened?.what === to.session)
        }
        const refuse = () => Effect.fail(new UsageFailure({ reason: "the conversation changed; this action was not applied" }))
        const apply = (panel: Panel) => matches(panel) && (scope === undefined || scope === panel.state().uploadScope)
          ? use(panel)
          : refuse()
        const held = [...nodes.values()].find(slot => matches(slot.panel))
        if (held !== undefined) return working(held.node, held.history ? to : undefined, ({ slot }) =>
          !mayOpen && slot.closing ? refuse() : apply(slot.panel))
        if (matches(root)) return apply(root)
        if (scope !== undefined || !mayOpen) return refuse()
        return Effect.scoped(Effect.flatMap(reading(to, { state: () => {}, transcript: () => {} }),
          (panel) => panel === null ? refuse() : apply(panel)))
      })

    return {
      reading,
      entries: () => panelOf().entries(),
      state: () => panelOf().state(),
      withdraw,
      sleep: (node: string) => Effect.suspend(() => {
        const slot = [...nodes.values()].find((one) => one.node === node && !one.history && !one.closing)
        return slot === undefined
          ? Effect.fail(new UsageFailure({ reason: `${node} has no agent awake to put to sleep` }))
          : close(slot, "put to sleep")
      }),
      seats: (listen: () => void) => {
        seatWatchers.add(listen)
        return () => { seatWatchers.delete(listen) }
      },
      live: () => new Map(
        [...nodes.values()].filter((slot) => !slot.history).map((slot) => [slot.node, {
          status: slot.state.status,
          since: slot.since,
          asking: slot.state.asking,
          unopened: slot.state.unopened !== null,
          sleep: slot.state.sleep,
        } satisfies LiveSession]),
      ),
      overheard: () => root.overheard(),
      replaced: (to, by) => root.replaced(to, by),
      enginesMoved: Effect.gen(function*() {
        const present = new Set(here(options.roster()).map(row => row.id))
        const returned = new Set([...present].filter(id => !knownEngines.has(id)))
        knownEngines = present
        yield* root.enginesMoved
        for (const slot of [...nodes.values()]) {
          yield* slot.panel.enginesMoved
          const to = slot.readingFor
          if (to !== null && returned.has(to.agent) && read(slot)) {
            yield* Effect.catch(
              working(slot.node, slot.history ? to : undefined, ({ slot }) =>
                slot.opening.withPermit(slot.panel.loadSession(to.agent, to.session))),
              failure => Effect.logWarning(`the returning engine could not reopen its held conversation: ${failure.message}`),
            )
          }
        }
        yield* reopenPending
      }),
      reread: () => {
        for (const node of [...restore.keys()]) if (!seatableAt(node)) restore.delete(node)
        root.reread()
        for (const slot of [...nodes.values()]) {
          if (!seatableAt(slot.node)) {
            pending.delete(slot.node)
            fork(close(slot, "scope released"))
          } else slot.panel.reread()
        }
        persistLive()
      },
      send: (...args) => foreground((panel) => panel.send(...args)),
      signIn: (method) => foreground((panel) => panel.signIn(method)),
      signInInput: (text) => foreground((panel) => panel.signInInput(text)),
      signInCancel: foreground((panel) => panel.signInCancel),
      attach: (chunk) => foreground((panel) => panel.attach(chunk)),
      resend: (id) => foreground((panel) => panel.resend(id)),
      cancel: foreground((panel) => panel.cancel),
      inConversation: (to, scope, use) => conversationIn(to, scope, use, "open-if-needed"),
      setSetting: (agent, session, config, value) => foreground((panel) => panel.setSetting(agent, session, config, value)),
      setModel: (agent, session, value) => foreground((panel) => panel.setModel(agent, session, value)),
      seen: (to, at) => conversationIn(to, undefined, (panel) => panel.seen(to, at), "only-if-open"),
      newSession: (agent) => Effect.gen(function*() {
        activateRoot()
        yield* root.newSession(agent)
      }),
      startAgentSession: (node, agent, committed) =>
        !seatableAt(node)
          ? Effect.fail(new UsageFailure({
            reason: `node ${node} is no longer available for an agent session`,
          }))
          : working(node, undefined, ({ slot }) =>
            slot.opening.withPermit(Effect.gen(function*() {
              activate(slot)
              options.onConversationClosed?.(slot.state)
              const replaced = slot.state.session?.id ?? slot.state.unopened?.what ?? null
              const previous = replaced === null ? null : {
                agent: agentIn(slot.state)?.id, session: replaced,
              }
              const before = [...slot.panel.entries().keys()]
              const completed = Effect.gen(function*() {
                const session = slot.panel.state().session
                if (session === null) return yield* new UsageFailure({
                  reason: `${agent} opened no conversation to bind to this node`,
                })
                slot.superseded.delete(readingKey({ agent, session: session.id }))
                slot.lagging.delete(readingKey({ agent, session: session.id }))
                const replaced = previous?.agent !== undefined
                  && (previous.agent !== agent || previous.session !== session.id)
                  ? readingKey({ agent: previous.agent, session: previous.session })
                  : null
                let written = false
                yield* Effect.gen(function*() {
                  if (replaced !== null) {
                    slot.superseded.add(replaced)
                    slot.lagging.add(replaced)
                  }
                  for (const reader of readingListeners(slot)) {
                    reader.state(slot.state)
                    reader.transcript(whole(slot.panel, before))
                  }
                  yield* flush(slot)
                  yield* Effect.uninterruptible(Effect.tap(
                    committed?.({ agent, session: session.id }) ?? Effect.void,
                    () => Effect.sync(() => { written = true }),
                  ))
                }).pipe(Effect.onExit(() => Effect.sync(() => {
                  if (written || replaced === null) return
                  slot.superseded.delete(replaced)
                  slot.lagging.delete(replaced)
                })))
              })
              const result = yield* Effect.acquireUseRelease(
                Effect.sync(() => { slot.mutingReaders = true }),
                () => Effect.result(slot.panel.newSession(agent, completed)),
                () => Effect.sync(() => { slot.mutingReaders = false }),
              )
              if (result._tag === "Failure") {
                const state = slot.panel.state()
                if (state.unopened !== null && state.signIn?.kind === "choosing") {
                  for (const reader of readingListeners(slot)) {
                    reader.state(state)
                    reader.transcript(whole(slot.panel, before))
                  }
                  return null
                }
                return yield* result.failure
              }
              const session = slot.panel.state().session!
              return { agent, session: session.id }
            }))),
      chooseAgent: (agent) => {
        activateRoot()
        return root.chooseAgent(agent)
      },
      loadSession: (agent, session) => Effect.gen(function*() {
        const to = { agent, session }
        const place = yield* locate(to)
        if (place === null) {
          activateRoot()
          return yield* root.loadSession(agent, session)
        }
        return yield* inNodeConversation(place, to, slot => Effect.gen(function*() {
          activate(slot)
          const state = slot.panel.state()
          if (state.session?.id !== session || agentIn(state)?.id !== agent || state.status === "gone") {
            yield* slot.panel.loadSession(agent, session)
          }
          if (!slot.history) yield* flush(slot)
        }))
      }),
      reopen: foreground((panel) => panel.reopen),
      liveSessions: (agent) => nodeSessions(agent) ?? root.liveSessions(agent),
      sessionsFor: (agent) => Effect.suspend(() => {
        const live = nodeSessions(agent)
        if (live === null) return Effect.succeed({ sessions: [], unreachable: [{ agent,
          why: "the settled node agent is no longer running" }] })
        return Effect.match(live, {
          onFailure: gone => ({ sessions: [], unreachable: [{ agent, why: gone.why }] }),
          onSuccess: rows => succeeded({
            sessions: rows.map(row => ({
              id: row.id,
              agent,
              title: row.title,
              updatedAt: row.updatedAt,
              messageCount: row.messageCount,
              supersededBy: row.supersededBy === null ? null : { agent, session: row.supersededBy },
            })),
            unreachable: [],
          }, panelOptions.overheard?.rows() ?? []),
        })
      }),
      sessions: listSessions,
      answer: (id, answers) => foreground((panel) => panel.answer(id, answers)),
      doorFor: scopedDoor,
      scope: (to, plugin, file) => Effect.gen(function*() {
        const panel = [...nodes.values()].find((slot) =>
          slot.state.session?.id === to.session && agentIn(slot.state)?.id === to.agent
        )?.panel ?? root
        discardPending([{ ...to, plugin }])
        const left = yield* panel.scope(to, plugin, file)
        refreshWakes(left)
        return left
      }),
      refreshWakes,
      recordRefusal: (tool, failure) => panelOf().recordRefusal(tool, failure),
      start,
      stop: stopWithReason("shutdown"),
      stopWithReason,
    }
  })

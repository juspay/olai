/**
 * NODE AGENTS AS EFFECT SCOPES.
 *
 * `chat.ts` is one conversation's state machine. This module is the scheduler
 * above it: one acquired panel per node, a foreground pointer for the browser,
 * and routing by durable node id for wakes. Closing a node scope releases the
 * panel, which stops its ACP process, turns, probes, attachments and delivery
 * inbox in one finalizer.
 *
 * ...AND STOPPING THE SCHEDULER STOPS THE BOOT TOO, which is the half that was
 * missing. The boot is forked and detached on purpose — nobody calling `start`
 * should wait for a session to be recalled and a panel to be acquired — but
 * detached is not the same word as unowned, and it was both: a shutdown could
 * close every slot it could see while the boot was still walking towards one it
 * had not registered yet, leaving a minted credential and a live ACP process
 * with nothing left that could release either. `stopWithReason` holds the
 * handle and joins it, in that order.
 */

import { BusyFailure, type NodeAgent, type NodeAgents, UsageFailure } from "@olai/format"
import type { OpFailure } from "@olai/format"
import { Deferred, Duration, Effect, Exit, Fiber, Scope, Semaphore } from "effect"

import { AgentGone, type StopReason } from "./agent.ts"
import type { Panel, PanelOptions, WakeScope } from "./chat.ts"
import { makePanel } from "./chat.ts"
import * as Memory from "./memory.ts"
import type { Conversing } from "./sessions.ts"
import type { Change } from "./transcript.ts"
import { succeeded } from "./succession.ts"
import { pastOf } from "./lineage.ts"
import { agentIn, type Listed } from "olai-plugin-chat/wire"

/** Long enough not to churn an ordinary working set, finite so sleeping agents
 * do not become a process pool. Tests inject a shorter duration. */
export const DEFAULT_IDLE = Duration.minutes(15)
export const DEFAULT_CAPACITY = 8

/** A per-node credential owned by the node scope that receives it. */
export interface ToolTicket {
  readonly bearer: string
  readonly release: () => void
}

/** The part of a node session's state that the roster reads. */
export interface LiveSession {
  readonly since?: string
  readonly status: ReturnType<Panel["state"]>["status"]
  readonly asking: number
}

/** The public chat is the scheduler over panels, with every acquired node
 * scope exposed for the server's roster projection. */
export interface Chat extends Panel {
  readonly sessionsFor: (agent: string) => Effect.Effect<Listed>
  /** A reader owns its hold until its Effect scope closes. */
  readonly reading: (to: Conversing, observer: ReadingObserver) => Effect.Effect<Panel, OpFailure, Scope.Scope>
  /** Apply a browser gesture only to the conversation it was drawn for. */
  readonly inConversation: <A>(to: Conversing, scope: string | null | undefined, use: (panel: Panel) => Effect.Effect<A, OpFailure>) => Effect.Effect<A, OpFailure>
  readonly live: () => ReadonlyMap<string, LiveSession>
  /** Mark an existing conversation assigned and move the foreground process
   * into the scope of the node that now owns it. */
  readonly assignedTo: (node: string, to: Conversing) => Effect.Effect<void>
  readonly startAgentSession: (
    node: string,
    agent: string,
  ) => Effect.Effect<Conversing, OpFailure>
}

export interface ReadingObserver {
  readonly state: (state: ReturnType<Panel["state"]>) => void
  readonly transcript: (change: Change) => void
}

/** The scheduler's policy and dependencies. Unlike a panel, this always owns
 * a node pool; there is no optional field that changes which lifecycle `make`
 * constructs. */
export interface Options extends PanelOptions {
  readonly onConversationState?: (state: ReturnType<Panel["state"]>, entries: ReturnType<Panel["entries"]>, node: string | null) => void
  readonly onConversationTranscript?: (state: ReturnType<Panel["state"]>, change: Change) => void
  /** Current user-controlled wake activation, read through its Cordis service.
   * Absent for delivery-only plugins, which use node-derived recipients. */
  readonly wake: (plugin: string) => object | undefined
  readonly nodeAt: (node: string) => NodeAgent | null
  /** Whether a node is a record an agent could be SEATED at — which is not the
   * same question as whether it is one already, and is the one the gesture
   * that creates a node agent asks (`server/agents.ts`'s `seatableAt`). */
  readonly seatableAt: (node: string) => boolean
  /** All durable node agents, including sleeping ones. Derived doorbells must
   * be able to wake a scope that has no process yet. */
  readonly nodes: () => NodeAgents
  /** Mint the MCP credential acquired and released with a node scope. */
  readonly ticket: (node: string) => ToolTicket
  /** The nearest candidate node at or above an arbitrary claim node. The
   * server answers from its current derived vault reading. */
  readonly nearestAt: (node: string, candidates: ReadonlySet<string>) => string | null
  /** The idle lifetime of a node scope. */
  readonly idle?: Duration.Input
  /** Maximum concurrently acquired node scopes. */
  readonly capacity?: number
  /** A background node session changed standing. */
  readonly onLive?: () => void
  /**
   * HOW THIS SCHEDULER STARTS WORK IT IS NOT ALREADY INSIDE.
   *
   * The bridge's `detached` is the tree's one named seam for that, and its
   * `held` shape is what the server hands over here — so a line this work logs
   * carries the level the operator asked for, and a fiber still in flight when
   * the row unloads is interrupted with it. Three sites reinvented the seam
   * with a bare `Effect.runFork`, which is a fiber on the default runtime with
   * no owner and no logging settings; one of them logs the only sentence a
   * person gets when a re-bound session cannot enter its node scope, and it was
   * going nowhere.
   *
   * REQUIRED, and no default. A default would have to be `Effect.runFork`,
   * which is the exact thing this field exists to stop: a caller that simply
   * omitted it would get unowned fibers on the default runtime with nothing red
   * anywhere — the defect this field closed, silently re-admitted at the one
   * place it could be. The focused tests that stand this scheduler up without a
   * host pass `Effect.runFork` themselves, which puts the test-only runtime
   * where it is chosen rather than in the production type.
   */
  readonly fork: (work: Effect.Effect<void>) => Fiber.Fiber<void>
}

interface NodeSlot {
  uses: number
  switching: boolean
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
  readonly options?: { readonly coalesce?: string }
}

const empty: Change = { upserts: [], removes: [], appends: [] }

/** Build the scheduler. Focused state-machine tests call `makePanel` directly;
 * package consumers always get the node-scoped lifecycle. */
export const make = (options: Options): Effect.Effect<Chat, never, never> =>
  Effect.gen(function*() {
    const {
      capacity = DEFAULT_CAPACITY,
      idle = DEFAULT_IDLE,
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
    const nodes = new Map<string, NodeSlot>()
    // Reaped slots leave the live map immediately; shutdown still owns their cleanup.
    const closing = new Map<NodeSlot, Deferred.Deferred<void>>()
    const readers = new Map<string, Set<ReadingObserver>>()
    let knownEngines = new Set(options.roster().map(row => row.id))
    const readingKey = (to: Conversing) => JSON.stringify([to.agent, to.session])
    const listeners = (state: ReturnType<Panel["state"]>) => {
      const agent = agentIn(state)
      const session = state.session?.id ?? state.unopened?.what
      return agent == null || session == null ? undefined : readers.get(readingKey({ agent: agent.id, session }))
    }
    const readingListeners = (slot: NodeSlot) => listeners(slot.state)
      ?? (slot.openingFor === null ? undefined : readers.get(readingKey(slot.openingFor)))
      ?? (slot.readingFor === null ? undefined : readers.get(readingKey(slot.readingFor)))
    const read = (slot: NodeSlot) => (readingListeners(slot)?.size ?? 0) > 0
    const pending = new Map<string, Array<PendingDelivery>>()
    let stopped = false
    let relocating = false
    /** How many node operations are in flight, and the wait a stop takes on
     *  them — see {@link working}. */
    let inFlight = 0
    let quiet: Deferred.Deferred<void> | undefined
    let active: { readonly kind: "root"; readonly panel: Panel } | {
      readonly kind: "node"
      readonly slot: NodeSlot
    }

    // The lease is acquired under the same gate as eviction. A listing may
    // borrow an existing slot, but it must never acquire a new node process.
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
      const arrived = [...after.entries()]
      if (arrived.length > 0) panelOptions.onTranscript({ ...empty, upserts: arrived })
      panelOptions.onState(after.state())
      onLive?.()
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
        onLive?.()
        const timer = slot.timer
        slot.timer = null
        return Effect.andThen(
          timer === null ? Effect.void : Fiber.interrupt(timer),
          Scope.close(slot.scope, Exit.void),
        ).pipe(Effect.ensuring(Effect.sync(() => {
          Deferred.doneUnsafe(done, Effect.void)
          closing.delete(slot)
        })))
      }).pipe(Effect.uninterruptible)

    const armIdle = (slot: NodeSlot): void => {
      // NOTHING NEW ONCE EITHER IS DONE. `close` interrupts the timer it can
      // see and then closes the scope, so a timer armed after that would be
      // one nothing is holding — the invariant `close` already assumes, said
      // where a re-arm could otherwise break it.
      if (slot.closing || stopped) return
      const generation = ++slot.generation
      const former = slot.timer
      slot.timer = null
      if (former !== null) fork(Fiber.interrupt(former))
      let fiber!: Fiber.Fiber<void, never>
      const timer = Effect.gen(function*() {
        yield* Effect.sleep(idle)
        if (slot.generation !== generation || slot.closing) return
        const state = slot.state
        if (
          (state.status !== "idle" && state.status !== "gone")
          || state.asking > 0
          || state.watching.length > 0
        ) return
        // The panel somebody is reading is part of their working set. Keep one
        // finite timer armed so it can be reaped after they leave it.
        if (read(slot) || slot.uses > 0) {
          slot.timer = null
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
          && (slot.state.status === "idle" || slot.state.status === "gone")
          && slot.state.asking === 0
          && slot.state.watching.length === 0
        )
        .sort((left, right) => left.touched - right.touched)[0]
      return reaper === undefined
        ? Effect.fail(new BusyFailure({
          reason: `${capacity} node agents are already live; let one become idle before waking another`,
        }))
        : close(reaper, "capacity eviction")
    }

    /**
     * The scope for a node, by the node's OWN id and nothing else.
     *
     * It took a whole `NodeAgent` and read `.id` off it four times, which made
     * a scope look like something only an established node agent could have —
     * and that is the shape the gesture that CREATES one fell out of: a bare
     * node is on no roster, so *start an agent session* could not ask for its
     * scope and opened the conversation in the root panel instead, to be moved
     * afterwards. Moving a conversation between scopes is `session/load`, and
     * a real engine has not written a session it has only just minted and
     * nobody has spoken into — so the move came back `Resource not found` and
     * left the node naming a conversation that could not be opened.
     *
     * A scope is a SEAT — the tools ticket minted below — and a seat is a node,
     * agent or not. What the id gets is the thing that was always true.
     */
    const acquire = (
      node: string,
      history?: Conversing,
    ): Effect.Effect<{ readonly slot: NodeSlot; readonly fresh: boolean }, OpFailure> =>
      gate.withPermit(Effect.gen(function*() {
        // History has its own process and ticket. Reading or continuing it
        // must not replace the node's current conversation or remove its credential.
        const key = JSON.stringify([node, history?.agent ?? null, history?.session ?? null])
        const held = nodes.get(key)
        if (held !== undefined && !held.closing) {
          held.uses += 1
          held.touched = Date.now()
          if (
            (held.state.status === "idle" || held.state.status === "gone")
            && held.state.asking === 0
            && held.state.watching.length === 0
          ) {
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
        // THE SCOPE EXISTS BEFORE ANYTHING IS IN IT, and until the last line
        // of this block the only reference to it is here — `close` reaches a
        // slot's scope through `nodes`, and this one is not in `nodes` yet.
        // The panel below is acquired uninterruptibly, so a shutdown that
        // interrupts the boot mid-acquisition is delivered the moment that
        // acquisition ENDS: which side of the `nodes.set` two lines later the
        // fiber stops on is Effect's to decide, and both answers have to be
        // safe. If the slot is registered, the shutdown's own snapshot closes
        // it; if it is not, this does.
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
              // THE MCP FACE, NARROWED BY THIS SEAT'S OWN CREDENTIAL — and NO
              // FACE AT ALL where there is no credential to narrow it with.
              //
              // An empty bearer is what `@olai/plugin-api`'s `NO_TICKET` is: the
              // bench and headless arm, a serve with no MCP face to mint against.
              // Handed on, it reached the tool door as a session carrying no
              // bearer — which is a session the door cannot place, so the
              // remaining write rule is simply off for it. That is the one thing
              // a seat must not be able to be: seated, and with no credential.
              //
              // `null` rather than a refusal to acquire, because the scope is not
              // the thing at fault and a node agent with no tools is a state this
              // panel already draws. A serve WITH an MCP face always mints
              // (`@olai/server`'s `serve.ts` hands `ticketFor` in the same breath
              // it hands the server), so this arm is the composition it says it
              // is and never a real one.
              tools: () => {
                const server = panelOptions.tools()
                if (server === null || ticket.bearer === "") return null
                return { ...server, token: ticket.bearer }
              },
              onState: (state) => {
                if (slot.state.status !== state.status) slot.since = new Date().toISOString()
                slot.state = state
                const agent = agentIn(state)
                const session = state.session?.id ?? state.unopened?.what
                if (agent != null && session != null) slot.readingFor = { agent: agent.id, session }
                options.onConversationState?.(state, slot.panel.entries(), slot.node)
                slot.touched = Date.now()
                if (
                  (state.status === "idle" || state.status === "gone")
                  && state.asking === 0
                  && state.watching.length === 0
                ) {
                  armIdle(slot)
                } else {
                  slot.generation++
                }
                if (active.kind === "node" && active.slot === slot) panelOptions.onState(state)
                if (!slot.switching) for (const reader of readingListeners(slot) ?? []) reader.state(state)
                onLive?.()
              },
              onTranscript: (change) => {
                options.onConversationTranscript?.(slot.state, change)
                if (active.kind === "node" && active.slot === slot) panelOptions.onTranscript(change)
                if (!slot.switching) for (const reader of readingListeners(slot) ?? []) reader.transcript(change)
              },
            }),
            (made) => made.stopWithReason(slot?.closeReason ?? "scope released"),
          ).pipe(Effect.provideService(Scope.Scope, scope), Effect.annotateLogs({ node }))
          slot = {
            uses: 1,
            switching: false,
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
          onLive?.()
          return { slot, fresh: true }
        }), (exit) => Exit.isSuccess(exit) ? Effect.void : Scope.close(scope, Exit.void))
      }))

    /**
     * ONE NODE OPERATION — from the acquisition to the last thing done with
     * what it acquired, and the unit a shutdown waits for.
     *
     * `acquire` is not called anywhere else, and that is the point rather than
     * a convention. Owning the boot fiber closed the boot's window and only the
     * boot's; three other paths reach an acquisition — a `reread` relocation, a
     * session started at a node, a session loaded into one — and every one of
     * them does its real work AFTER the acquisition answers. A shutdown landing
     * in that gap set its flag, read a node map that already held the slot,
     * closed it — and the caller then went on to open a conversation on the
     * panel it was still holding, spawning an ACP process into a scope that had
     * already closed. Measured, on this bench: one `chat agent ready` with no
     * `chat agent exited` after it.
     *
     * Guarding the map with a second reading of `stopped` cannot close that:
     * the slot is registered and the shutdown is entitled to close it; what is
     * wrong is that the operation carried on. So the operation is the thing
     * that is counted, and `settled` below is what a stop waits for — after
     * `stopped` is set, so nothing new starts, and before the map is read, so
     * nothing lands behind it.
     */
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

    /** ...and the wait itself. Nothing is cancelled: a node operation that has
     *  spawned a process is finished, so that the close which follows has
     *  something to close. */
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
      // Some harnesses serialize session/list behind the running prompt.
      // A navigation press must reach the busy refusal immediately, rather
      // than waiting for that turn to finish and switching after it. The
      // picker already read the lineage; reuse it while root is working.
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

    /** Move a conversation first opened in the unscoped panel into the node
     * scope that owns it. Remembered node sessions never come through here:
     * `start` routes those before any process is spawned. This is for the two
     * bindings that cannot be known beforehand — a fresh session id returned
     * by the agent, and the explicit assignment gesture. */
    const relocateRoot = (assigned?: {
      readonly node: NodeAgent
      readonly to: Conversing
    }, withHistory = false): Effect.Effect<void, OpFailure> =>
      Effect.suspend(() => {
        if (relocating || active.kind !== "root" || active.panel !== root) return Effect.void
        const old = root
        const state = old.state()
        const talking = state.talking
        if (
          state.status !== "idle"
          || state.session === null
          || talking === null
          || talking.kind !== "agent"
        ) return Effect.void
        const to = { agent: talking.id, session: state.session.id }
        if (
          assigned !== undefined
          && (assigned.to.agent !== to.agent || assigned.to.session !== to.session)
        ) return Effect.void
        const immediate = assigned?.node ?? nodeFor(to.agent, to.session)
        // Vault rereads only need to detect a new binding. Listing every
        // harness on every edit would turn ordinary typing into disk probes.
        if (immediate === null && !withHistory) return Effect.void
        relocating = true
        return Effect.gen(function*() {
          const place = immediate === null ? yield* locate(to) : { node: immediate, history: false }
          if (place === null) return
          yield* working(place.node.id, place.history ? to : undefined, ({ slot, fresh }) =>
            Effect.gen(function*() {
          // Acquisition can wait behind a concurrent node operation. Do not
          // move a panel somebody switched in the meantime.
          if (active.kind !== "root" || active.panel !== old) {
            if (fresh) yield* close(slot)
            return
          }
          activate(slot)
          yield* Effect.annotateLogs(Effect.logInfo("moving conversation into node scope"), {
            agent: to.agent, session: to.session, node: place.node.id, reason: "node scope handoff",
          })
          yield* old.stopWithReason("node scope handoff")
          root = yield* rootPanel()
          const held = slot.panel.state()
          if (held.session?.id !== to.session || held.status === "gone") {
            yield* slot.panel.loadSession(to.agent, to.session)
          }
          if (!place.history) yield* flush(slot)
            }))
        }).pipe(Effect.ensuring(Effect.sync(() => {
          relocating = false
        })))
      })

    const relocationFailed = (where: string, failure: OpFailure): Effect.Effect<void> =>
      Effect.logWarning(`${where} could not enter its node scope: ${failure.message}`)

    /** Discovery is available at boot; opening belongs to a reader or a wake. */
    const start = root.enginesMoved

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

    const refreshWakes: Panel["refreshWakes"] = (left) => {
      discardPending(left)
      root.refreshWakes(left)
      for (const slot of nodes.values()) slot.panel.refreshWakes(left)
    }

    const scopedDoor = (plugin: string) => {
      const scopes = (): ReadonlyArray<WakeScope> => {
        const manual = root.doorFor(plugin).scopes()
        const activation = wake(plugin)
        if (activation !== undefined) return manual.map((row) => ({
          ...row, current: () => wake(plugin) === activation && row.current(),
        }))
        const derived = nodesAt().flatMap((node) =>
          node.session === null
            ? []
            : [{ agent: node.engine, session: node.session, file: node.file, under: node.id,
              current: () => nodeFor(node.engine, node.session!)?.id === node.id }]
        )
        return [...manual.filter((scope) => nodeFor(scope.agent, scope.session) === null), ...derived]
          .map((row) => ({ ...row, current: () => wake(plugin) === undefined && row.current() }))
      }
      return {
        scopes,
        ringing: (file: string, node: string): ReadonlyArray<WakeScope> => {
          const rows = scopes().filter((scope) => scope.file === file)
          const candidates = new Set(rows.flatMap((scope) => scope.under ?? []))
          const nearest = nearestAt(node, candidates)
          return rows.filter((scope) => scope.under === undefined || scope.under === nearest)
        },
        deliver: (
          to: { readonly agent: string; readonly session: string; readonly current?: () => boolean },
          say: () => string | null,
          how?: { readonly coalesce?: string },
        ): Effect.Effect<void> => {
          // Capture before startup, queuing or another Effect yield. The body
          // carries this one authority through every owner and checks it at
          // Panel.offer's final transcript-write boundary, not at queue cleanup.
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

    /**
     * THE ORDER HERE IS THE WHOLE OF WHAT IT PROMISES.
     *
     * `stopped` first, so a boot still queued behind the acquisition gate is
     * refused rather than let through. THEN the boot fiber, joined rather than
     * merely signalled — `Fiber.interrupt` awaits, which is what puts anything
     * the boot did register into `nodes` before the line that reads it. Only
     * then the panels.
     *
     * The window that opened was not theoretical: a boot past its `stopped`
     * check registered a node slot after the shutdown had already taken its
     * snapshot of `nodes`, leaving a minted MCP credential and a spawned ACP
     * subprocess that nothing would ever release — resources appearing AFTER
     * shutdown reported itself finished.
     */
    const stopWithReason = (reason: StopReason) => Effect.gen(function*() {
      stopped = true
      pending.clear()
      // ...AND EVERY OTHER NODE OPERATION, joined rather than raced. `stopped`
      // is already set, so nothing new starts; what is still in flight finishes
      // its acquisition and its use, and is therefore in the map the last line
      // reads. See {@link working}.
      yield* settled
      yield* root.stopWithReason(reason)
      yield* Effect.forEach([...nodes.values()], (slot) => close(slot, reason), { discard: true })
      yield* Effect.forEach([...closing.values()], Deferred.await, { discard: true })
    })

    const reading: Chat["reading"] = (to, observer) => Effect.gen(function*() {
        yield* Effect.acquireRelease(Effect.sync(() => {
          const key = readingKey(to)
          const held = readers.get(key) ?? new Set<ReadingObserver>()
          held.add(observer)
          readers.set(key, held)
          return { key, held }
        }), ({ key, held }) => Effect.sync(() => {
          held.delete(observer)
          if (held.size === 0 && readers.get(key) === held) readers.delete(key)
          for (const slot of nodes.values()) armIdle(slot)
        }))
        const place = yield* locate(to)
        if (place === null) {
          const state = root.state()
          const panel = state.session?.id === to.session && agentIn(state)?.id === to.agent
            ? root
            : yield* Effect.acquireRelease(rootPanel(), panel => panel.stop)
          if (panel !== root) yield* Effect.catch(panel.loadSession(to.agent, to.session), () => Effect.void)
          observer.state(panel.state())
          observer.transcript({ ...empty, upserts: [...panel.entries()] })
          return panel
        }
        return yield* working(place.node.id, place.history ? to : undefined, ({ slot }) =>
          Effect.gen(function*() {

            yield* slot.opening.withPermit(Effect.gen(function*() {
              const state = slot.panel.state()
              if (state.session?.id !== to.session || agentIn(state)?.id !== to.agent || state.status === "gone") {
                // An agent's refusal is conversation state, not a broken wire.
                // Keep the reader so Unopened can show it and retry explicitly.
                slot.openingFor = to
                yield* Effect.catch(slot.panel.loadSession(to.agent, to.session), () => Effect.void).pipe(
                  Effect.ensuring(Effect.sync(() => { slot.openingFor = null })),
                )
              }
              if (!place.history) yield* flush(slot)
            }))
            observer.state(slot.panel.state())
            observer.transcript({ ...empty, upserts: [...slot.panel.entries()] })
            return slot.panel
          }))
      })

    return {
      reading,
      entries: () => panelOf().entries(),
      state: () => panelOf().state(),
      live: () => new Map(
        [...nodes.values()].filter((slot) => !slot.history).map((slot) => [slot.node, {
          status: slot.state.status,
          since: slot.since,
          asking: slot.state.asking,
        } satisfies LiveSession]),
      ),
      overheard: () => root.overheard(),
      assigned: (to) => root.assigned(to),
      assignedTo: (node, to) => Effect.gen(function*() {
        yield* root.assigned(to)
        const found = nodeAt(node)
        if (found === null) return
        yield* Effect.catch(
          relocateRoot({ node: { ...found, engine: to.agent, session: to.session }, to }),
          (failure) => relocationFailed("the assigned session", failure),
        )
      }),
      replaced: (to, by) => root.replaced(to, by),
      /**
       * EVERY PANEL, and that is the point rather than thoroughness.
       *
       * An engine leaving orphans a conversation wherever one is seated on it,
       * and a node agent's is no less a conversation for being off screen — it
       * holds a subprocess and a session exactly as the root's does. A fan-out
       * that reached only the foreground would leave the ones a person is not
       * looking at talking to a plugin that is gone, which is the defect this
       * whole verb exists to close, hiding one scope deeper.
       *
       * SEQUENTIAL, like `reread` beside it: each panel takes its own binding
       * permit and stops at most one subprocess, so there is nothing to overlap
       * and an order is one less thing to reason about.
       */
      enginesMoved: Effect.gen(function*() {
        const present = new Set(options.roster().map(row => row.id))
        const returned = new Set([...present].filter(id => !knownEngines.has(id)))
        knownEngines = present
        yield* root.enginesMoved
        for (const slot of [...nodes.values()]) {
          yield* slot.panel.enginesMoved
          const to = slot.readingFor
          // Returning capability resumes only explicitly held readings. It
          // never opens a sleeping binding or picks a different conversation.
          if (to !== null && returned.has(to.agent) && read(slot)) {
            yield* Effect.catch(
              working(slot.node, slot.history ? to : undefined, ({ slot }) =>
                slot.opening.withPermit(slot.panel.loadSession(to.agent, to.session))),
              failure => Effect.logWarning(`the returning engine could not reopen its held conversation: ${failure.message}`),
            )
          }
        }
      }),
      reread: () => {
        root.reread()
        for (const slot of nodes.values()) slot.panel.reread()
        fork(Effect.catch(
          relocateRoot(),
          (failure) => relocationFailed("the newly bound session", failure),
        ))
      },
      send: (...args) => foreground((panel) => panel.send(...args)),
      attach: (chunk) => foreground((panel) => panel.attach(chunk)),
      resend: (id) => foreground((panel) => panel.resend(id)),
      cancel: foreground((panel) => panel.cancel),
      inConversation: (to, scope, use) => Effect.suspend(() => {
        const matches = (panel: Panel) => {
          const state = panel.state()
          return agentIn(state)?.id === to.agent
            && (state.session?.id === to.session || state.unopened?.what === to.session)
        }
        const apply = (panel: Panel) => matches(panel) && (scope === undefined || scope === panel.state().uploadScope)
          ? use(panel)
          : Effect.fail(new UsageFailure({ reason: "the conversation changed; this action was not applied" }))
        const held = [...nodes.values()].find(slot => matches(slot.panel))
        if (held !== undefined) return working(held.node, held.history ? to : undefined, ({ slot }) => apply(slot.panel))
        if (matches(root)) return apply(root)
        // An upload/send names an already acquired lifetime. Reopening a stale
        // pair here could replace a freshly opened session while its binding
        // write is still landing; no new process can satisfy the old token.
        if (scope !== undefined) return Effect.fail(new UsageFailure({
          reason: "the conversation changed; this action was not applied",
        }))
        return Effect.scoped(Effect.flatMap(reading(to, { state: () => {}, transcript: () => {} }), apply))
      }),
      setSetting: (agent, session, config, value) => foreground((panel) => panel.setSetting(agent, session, config, value)),
      setModel: (agent, session, value) => foreground((panel) => panel.setModel(agent, session, value)),
      // Header + new opens an unassigned conversation. Only the node's
      // explicit fresh-session gesture may replace its current scoped panel.
      newSession: (agent) => Effect.gen(function*() {
        activateRoot()
        yield* root.newSession(agent)
      }),
      /**
       * IN THE NAMED NODE'S OWN SCOPE, always — including the node that is not
       * a node agent yet, which is the ordinary case: this gesture is what
       * MAKES one.
       *
       * It used to ask the roster whether the node was already an agent and, on
       * `null`, open the conversation in the root panel — leaving the binding to
       * be written and the conversation to be MOVED into the node scope
       * afterwards ({@link relocateRoot}). Moving one is `session/load`, and a
       * real engine has not written a session it has only just minted and
       * nobody has spoken into: the load came back `Resource not found`, the
       * node was left naming a conversation nothing could open, and *start an
       * agent session* did not work at all against the adapter olai ships.
       * The scripted agent loads any id, so no scenario could see it.
       *
       * There is nothing to relocate now, because nothing was opened anywhere
       * else. A scope is a seat and a seat is a node ({@link acquire}); which
       * node this is for is the argument.
       */
      startAgentSession: (node, agent) =>
        !seatableAt(node)
          ? Effect.fail(new UsageFailure({
            reason: `node ${node} is no longer available for an agent session`,
          }))
          : working(node, undefined, ({ slot }) =>
            Effect.gen(function*() {
              activate(slot)
              const before = [...slot.panel.entries()].map(([id]) => id)
              yield* Effect.acquireUseRelease(
                Effect.sync(() => { slot.switching = true }),
                () => slot.panel.newSession(agent),
                () => Effect.sync(() => { slot.switching = false }),
              )
              const session = slot.panel.state().session
              if (session === null) return yield* new UsageFailure({
                reason: `${agent} opened no conversation to bind to this node`,
              })
              // A harness may return the same identity for fresh start. Its
              // existing readers still need the new state and cleared replay.
              for (const reader of listeners(slot.state) ?? []) {
                reader.state(slot.state)
                reader.transcript({ ...empty, removes: before, upserts: [...slot.panel.entries()] })
              }
              yield* flush(slot)
              return { agent, session: session.id }
            })),
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
        return yield* working(
          place.node.id,
          place.history ? to : undefined,
          ({ slot }) => Effect.gen(function*() {
            activate(slot)
            const state = slot.panel.state()
            if (state.session?.id !== session || state.status === "gone") {
              yield* slot.panel.loadSession(agent, session)
            }
            if (!place.history) yield* flush(slot)
          }),
        )
      }),
      reopen: foreground((panel) => panel.reopen),
      liveSessions: (agent) => nodeSessions(agent) ?? root.liveSessions(agent),
      sessionsFor: (agent) => Effect.suspend(() => {
        const live = nodeSessions(agent)
        if (live === null) return Effect.succeed({ sessions: [], unreachable: [{ agent,
          why: "the settled node agent is no longer running" }] })
        return Effect.match(live, {
          onFailure: gone => ({ sessions: [], unreachable: [{ agent, why: gone.why }] }),
          onSuccess: rows => succeeded({ sessions: rows.map(row => ({ ...row, agent })), unreachable: [] },
            panelOptions.overheard?.rows() ?? []),
        })
      }),
      sessions: listSessions,
      answer: (id, answers) => foreground((panel) => panel.answer(id, answers)),
      doorFor: scopedDoor,
      scope: (to, plugin, file) => Effect.gen(function*() {
        // A sleeping session's preference can be written without acquiring an
        // ACP process. A live one owns its inbox, so the write goes through it.
        const panel = [...nodes.values()].find((slot) =>
          slot.state.session?.id === to.session && agentIn(slot.state)?.id === to.agent
        )?.panel ?? root
        discardPending([{ ...to, plugin }])
        const left = yield* panel.scope(to, plugin, file)
        refreshWakes(left)
        return left
      }),
      refreshWakes,
      faults: (served, sayable) => Effect.gen(function*() {
        const activations = new Map((panelOptions.scoping?.rows() ?? [])
          .map((row) => [row.plugin, wake(row.plugin)] as const))
        const fell = yield* root.faults(served, sayable)
        refreshWakes([])
        return fell.map((row) => ({
          ...row,
          current: () => activations.get(row.plugin) !== undefined
            && wake(row.plugin) === activations.get(row.plugin) && row.current(),
        }))
      }),
      recordRefusal: (tool, failure) => panelOf().recordRefusal(tool, failure),
      start,
      stop: stopWithReason("shutdown"),
      stopWithReason,
    }
  })

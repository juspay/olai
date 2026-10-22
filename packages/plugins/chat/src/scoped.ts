/** Node agents as Effect scopes. Readings, ongoing work and derived wakes
 * hold node conversations live; the scheduler owns capacity and idle reaping.
 * Each scope releases its ACP process, turns, probes, attachments and delivery
 * inbox together. Shutdown joins the owned boot and closes every live scope. */

import { BusyFailure, type NodeAgent, type NodeAgents, UsageFailure } from "@olai/format"
import type { OpFailure } from "@olai/format"
import { Deferred, Duration, Effect, Exit, Fiber, Scope, Semaphore } from "effect"

import { AgentGone, type StopReason } from "./agent.ts"
import type { Panel, PanelOptions, WakeScope } from "./chat.ts"
import { makePanel } from "./chat.ts"
import { here } from "./agents/roster.ts"
import * as Memory from "./memory.ts"
import { type LiveMark, type LiveRecord, marksOf } from "./live.ts"
import type { Conversing } from "./sessions.ts"
import type { PanelAddress } from "./wire/session.ts"
import type { Change } from "./transcript.ts"
import { succeeded } from "./succession.ts"
import { pastOf } from "./lineage.ts"
import { agentIn, type Listed } from "olai-plugin-chat/wire"

/** Keep idle chats warm for 48 hours. With this long window, the capacity cap
 * bounds resident node agents: an LRU of 8, evicting only eligible idle scopes.
 * Credentials and write doors live as long as their scope. Tests inject a shorter duration. */
export const DEFAULT_IDLE = Duration.hours(48)
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
  readonly unopened?: boolean
  /**
   * THE TURN IN FLIGHT IS OLAI'S OWN — a pass over this node agent's own
   * memory, not anybody's question to answer ({@link
   * ./wire/members.ts}'s `ChatState.sleep`, which is where the reason lives).
   *
   * Carried out of the panel's state rather than derived here, because it is
   * decided there: only the delivery knows which turn it started.
   */
  readonly sleep?: boolean
}

/** The public chat is the scheduler over panels, with every acquired node
 * scope exposed for the server's roster projection. */
export interface Chat extends Panel {
  readonly sessionsFor: (agent: string) => Effect.Effect<Listed>
  /** A reader owns its hold until its Effect scope closes. */
  readonly reading: (to: PanelAddress, observer: ReadingObserver) => Effect.Effect<Panel, OpFailure, Scope.Scope>
  /** Apply a browser gesture only to the conversation it was drawn for. */
  readonly inConversation: <A>(to: PanelAddress, scope: string | null | undefined, use: (panel: Panel) => Effect.Effect<A, OpFailure>) => Effect.Effect<A, OpFailure>
  /**
   * WRITE DOWN THAT A PERSON HAS READ THE LINE THIS CONVERSATION'S AGENT LAST
   * SAID — `at` being the ISO instant that was on screen
   * ({@link ./sessions.ts}'s `Sessions.seen`), and `to` the pair the caller read
   * it off.
   *
   * THE SAME MATCHING AS {@link Chat.inConversation} WITH THE ARM THAT OPENS
   * REMOVED, and that is the whole of what makes this a verb about READING: a
   * gesture may open the conversation it names (a person asked for it), where
   * an acknowledgement arrives off a roster frame that is already a round trip
   * old and may name a conversation that has GONE — the agent crashed, its scope
   * was reaped. Opening one to acknowledge it would start an agent nobody asked
   * for and report a node as `idle` whose agent is not running at all. So a pair
   * nothing has open is REFUSED, and the mark stays up until somebody looks at a
   * conversation that is there.
   *
   * It is here, on the scheduler, rather than on a door of its own: a caller
   * reaching a panel itself would be re-deciding which conversation that panel
   * is in, a second copy of the one rule this file keeps.
   */
  readonly seen: (to: Conversing, at: string) => Effect.Effect<void, OpFailure>
  readonly live: () => ReadonlyMap<string, LiveSession>
  /**
   * TAKE BACK ONE PLUGIN'S UNDELIVERED WORDS for one conversation — BOTH HOLDS,
   * because a body can be waiting in either of them.
   *
   * The scheduler holds a delivery whose WAKE failed (`flush` replays it on the
   * next `ensureNode`), and the panel holds one that arrived while a turn was
   * running or while nobody was in the conversation. A caller that is going away
   * — the pass over a node agent's memory, whose scope closes with it — must be
   * able to withdraw its own words from both, or they fire later as a turn
   * nothing owns (`Panel.doorFor`'s `withdraw` argues the whole of it).
   *
   * EVERY PANEL, and that is the same fan-out {@link Chat.enginesMoved} makes
   * for the same reason: the conversation this is about may be in any of them,
   * and a body held by the one a person is not looking at is exactly the case
   * that would otherwise be missed. It costs a map walk over the live scopes.
   */
  readonly withdraw: (plugin: string, to: Conversing) => Effect.Effect<void>
  /** Compatibility metadata verb; assignment never opens or relocates a process. */
  readonly assignedTo: (node: string, to: Conversing) => Effect.Effect<void>
  readonly startAgentSession: (
    node: string,
    agent: string,
    committed?: (to: Conversing) => Effect.Effect<void, OpFailure>,
  ) => Effect.Effect<Conversing | null, OpFailure>
}

export interface ReadingObserver {
  readonly state: (state: ReturnType<Panel["state"]>) => void
  readonly transcript: (change: Change) => void
}

/** The scheduler's policy and dependencies. Unlike a panel, this always owns
 * a node pool; there is no optional field that changes which lifecycle `make`
 * constructs. */
export interface Options extends PanelOptions {
  readonly onConversationClosed?: (state: ReturnType<Panel["state"]>) => void
  readonly onConversationState?: (state: ReturnType<Panel["state"]>, entries: ReturnType<Panel["entries"]>, node: string | null) => void
  readonly onConversationTranscript?: (state: ReturnType<Panel["state"]>, change: Change) => void
  /** Current user-controlled wake activation, read through its Cordis service.
   * Absent for delivery-only plugins, which use node-derived recipients. */
  readonly wake: (plugin: string) => object | undefined
  /**
   * WHERE THE LIVE SET IS WRITTEN DOWN — the node ids that were live a moment
   * ago and when each was last touched, so a restart can reopen them without a
   * browser asking ({@link ./live.ts}).
   *
   * HANDED IN rather than built here, like the doorbell picks and overheard
   * lines beside it: it is one of the records the composition root already
   * opens per served directory, and the scheduler only decides WHICH nodes go
   * in it. `null` — or absent — is a bench that keeps nothing, which is what
   * every scheduler test that is not about a restart wants.
   */
  readonly live?: LiveRecord | null
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
  /** Mute intermediate frames during a fresh-start transaction, including a
   * failed one. This is not routing history: superseded records only successful
   * replacements and remains meaningful after notification delivery resumes. */
  mutingReaders: boolean
  /** Successful replacements, keyed by engine and session; owned by this slot. */
  readonly superseded: Set<string>
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
  /** The caller's own options, verbatim — the coalescing key AND whether this
   *  body is olai's own turn, which the panel reads when it finally hands it
   *  over (`@olai/plugin-api`'s `Deliveries.deliver`). */
  readonly options?: { readonly coalesce?: string; readonly sleep?: true }
}

const empty: Change = { upserts: [], removes: [], appends: [] }

/** Build the scheduler. Focused state-machine tests call `makePanel` directly;
 * package consumers always get the node-scoped lifecycle. */
export const make = (options: Options): Effect.Effect<Chat, never, never> =>
  Effect.gen(function*() {
    const {
      capacity = DEFAULT_CAPACITY,
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
    const nodes = new Map<string, NodeSlot>()
    // Reaped slots leave the live map immediately; shutdown still owns their cleanup.
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
    const pending = new Map<string, Array<PendingDelivery>>()
    /**
     * THE CONVERSATIONS A PREVIOUS PROCESS LEFT LIVE, by node id and the
     * instant each was touched — waiting, one at a time, for the pass that
     * reopens them ({@link reopenPending}).
     *
     * IT OUTLIVES THE PASS, which is the point: an entry whose engine is not in
     * the roster yet stays here, and the next `enginesMoved` tries it again.
     * That is also why the record written below is the live set UNION this map:
     * a write that forgot the waiting half would delete a conversation's only
     * claim to be reopened simply because its engine had not mounted yet.
     */
    const restore = new Map<string, number>()
    /** The idle budget in milliseconds, read once — the timer and the boot
     *  check must divide the same number the same way. */
    const idleMs = Duration.toMillis(idle)
    let stopped = false
    /** How many node operations are in flight, and the wait a stop takes on
     *  them — see {@link working}. */
    let inFlight = 0
    let quiet: Deferred.Deferred<void> | undefined
    let active: { readonly kind: "root"; readonly panel: Panel } | {
      readonly kind: "node"
      readonly slot: NodeSlot
    }

    /**
     * WRITE DOWN WHAT IS LIVE, promptly and continuously.
     *
     * NOT A SHUTDOWN SNAPSHOT, and that is the whole requirement: the restart
     * this exists for is usually a SIGKILL, where nothing runs on the way out.
     * So every moment the live set moves — a slot minted, closed, or touched —
     * asks for a write; a write already in flight absorbs the ask and runs once
     * more when it lands, so a burst of state frames costs one write at a time
     * rather than one per frame.
     *
     * THE `stopped` CHECK IS A CORRECTNESS RULE, not tidiness: shutdown closes
     * every slot, and a record written after the first of those would say the
     * server had no conversations — exactly backwards, since those are the ones
     * the next boot is meant to reopen. The last write before `stopped` is the
     * one we want.
     */
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
        [...nodes.values()].map((slot) => ({
          node: slot.node,
          touched: slot.touched,
          history: slot.history,
          // A CONVERSATION THAT WOULD NOT OPEN IS NOT A CONVERSATION TO COME
          // BACK TO. The boot's own failures are dropped explicitly below, but
          // a slot a READER opened and was refused stays in the pool for that
          // reader — and writing it down would make the next boot retry the
          // same refusal once more.
          refused: slot.state.unopened !== null,
        })),
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

    /** The two things every live-set change does, together: tell the roster
     *  (which publishes to the wire) and write the record. */
    const liveMoved = (): void => {
      onLive?.()
      persistLive()
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
        // THE BUDGET IS PER CONVERSATION, NOT PER ARMING. A reopened slot's
        // `touched` is the instant it was last live BEFORE the restart, so the
        // time it has already been idle comes off the 48 hours rather than
        // restarting the clock — which is the whole reason the record stores an
        // instant. `Math.max` keeps a budget that is already spent from asking
        // for a negative sleep: the boot check drops those, and an arm that
        // races it closes at once.
        yield* Effect.sleep(Duration.millis(Math.max(0, slot.touched + idleMs - Date.now())))
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

    /**
     * Discovery is available at boot, and the conversations that were live a
     * moment before the restart are reopened here — WITHOUT a browser, which is
     * the whole point: the agent is already in them when the first tab arrives.
     *
     * THE RECORD IS READ BEFORE ANYTHING OPENS. Engines register after chat's
     * own apply, so at this instant the roster may be empty or partial; that is
     * why an entry whose engine is not there yet stays pending and `enginesMoved`
     * tries it again ({@link reopenPending}).
     */
    const start = Effect.gen(function*() {
      // Repair conversations filed by builds which retained their inherited
      // wakes. The durable marker preserves deliberate picks after this pass.
      for (const row of root.overheard()) {
        if (row.assigned === true && row.wakesCleared !== true) yield* root.assigned(row)
      }
      for (const mark of live?.read() ?? []) {
        const touched = Date.parse(mark.touched)
        if (!Number.isNaN(touched)) restore.set(mark.node, touched)
      }
      yield* root.enginesMoved
      // THE SEAM, not a bare fiber: ring.held owns the pass, so its lines carry
      // the operator's logging and the plugin's scope interrupts what is left
      // of it. Joined, because boot is not done until the conversations it
      // adopted are open — and because `stop` must not run before the pass has
      // registered what it acquired ({@link working} counts each operation).
      yield* Fiber.join(fork(reopenPending))
    })

    /**
     * ONE PASS OVER THE RECORD, opening the conversations whose engines are
     * here — the boot's, and every one after an engine mounts.
     *
     * WHAT AN ENTRY NAMES IS THE NODE, and the node's CURRENT property is what
     * is opened ({@link Options.nodeAt}). That is deliberate: a fresh start or
     * a rebind moves the node to a different conversation, and the record must
     * never resurrect the one it left. Every failure is DROPPED rather than
     * retried: a refusal, a signature the agent now wants, a node that was
     * trashed, a property removed, an agent that is gone. None of them gets
     * better by asking again in a loop, and every one of them leaves the reader
     * path exactly as it was — opening the node by hand draws the refusal and
     * its retry, as it always has.
     *
     * AN ENGINE THAT IS NOT IN THE ROSTER YET IS NOT A FAILURE. Entries stay in
     * `restore`, and `enginesMoved` is what comes back for them; the record
     * written meanwhile keeps them, because it is the live set UNION this map.
     */
    const reopenPending = Effect.gen(function*() {
      if (stopped || restore.size === 0) return
      const now = Date.now()
      const present = new Set(here(options.roster()).map(row => row.id))
      // Most recently touched first, so a restart that finds more work than it
      // can hold opens the conversations a person would expect to be there.
      for (const [node, touched] of [...restore].sort((left, right) => right[1] - left[1])) {
        if (stopped) return
        // SPENT BUDGET — see `armIdle`, which counts the same instant off the
        // same number. A conversation last live two days ago is not one a
        // restart is bringing back to anybody.
        if (now - touched >= idleMs) {
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
        // Its engine has not mounted (or is switched off). Keep the entry: the
        // next `enginesMoved` is the try.
        if (!present.has(bound.engine)) continue
        const key = JSON.stringify([node, null, null])
        if (nodes.has(key)) {
          // Somebody (a reader, a delivery) already opened it while this pass
          // queued. Nothing to reopen, and the slot is a better witness than
          // the record.
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
          // A READER THAT ARRIVED WHILE THE BOOT WAS OPENING owns this panel
          // now, and closing the scope under it would leave the tab reading
          // "the server is shutting down" where the refusal belongs. The
          // refusal is already the panel's own state, so keeping it is what
          // makes the reader's path unchanged; it is not recorded (a refused
          // conversation is not one to come back to) and its idle timer reaps
          // it once the reader leaves.
          if (slot !== undefined) {
            if (read(slot)) armIdle(slot)
            else yield* close(slot, "scope released")
          }
          restore.delete(node)
          continue
        }
        restore.delete(node)
        // ... AND THE REMAINING BUDGET, which is the recorded instant and not
        // the one the open just stamped. Any state still settling above moves
        // `touched` forward again, which is what a live conversation is
        // entitled to; this is the floor that stops a restart from turning 47
        // spent hours into a fresh 48.
        opened.success.touched = touched
        armIdle(opened.success)
      }
      persistLive()
    })

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

    /**
     * {@link Chat.withdraw}, over both holds — see that member for what it is
     * for and why it reaches every panel.
     *
     * THE SCHEDULER'S OWN HALF is `discardPending`'s rule narrowed to one
     * plugin and one conversation, and it is written here rather than reusing
     * that helper because the two ask different questions: `discardPending`
     * takes the picks a person replaced (a list of rows), this takes one pair.
     */
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
        // Delivery-only plugins address node conversations without a user pick.
        // The recipient grants no file semantics and expires with its binding.
        return nodesAt().flatMap(node => node.session === null ? [] : [{
          agent: node.engine, session: node.session, pick: null,
          current: () => wake(plugin) === undefined
            && nodeFor(node.engine, node.session!)?.id === node.id,
        }])
      }
      return {
        scopes,
        // THE SAME OPERATION AS {@link Chat.withdraw}, for a caller that reached
        // a plugin's door rather than the scheduler's: this one has the plugin
        // closed over already, which is the whole difference.
        withdraw: (to: { readonly agent: string; readonly session: string }) => withdraw(plugin, to),
        deliver: (
          to: { readonly agent: string; readonly session: string; readonly current?: () => boolean },
          say: () => string | null,
          how?: { readonly coalesce?: string; readonly sleep?: true },
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
      yield* Effect.forEach([...nodes.values()], (slot) => close(slot, reason), { discard: true, concurrency: "unbounded" })
      yield* Effect.forEach([...closing.values()], Deferred.await, { discard: true })
    })

    /** One routing rule for subscriptions and explicit navigation. Locate reads
     * durable bindings; this permit reconciles that snapshot with replacements
     * owned by the live slot. History work starts only after releasing it. */
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
            for (const slot of nodes.values()) armIdle(slot)
          }))
          return yield* working(to.node, undefined, ({ slot }) => slot.opening.withPermit(Effect.gen(function*() {
            const bound = nodeAt(to.node)
            const state = slot.panel.state()
            // A refused open belongs to this seat. Reading it must not replace
            // the pending new/resume operation with another load.
            if (state.unopened === null && bound?.session != null
              && (state.session === null || state.session.id !== bound.session || agentIn(state)?.id !== bound.engine || state.status === "gone")) {
              yield* Effect.catch(slot.panel.loadSession(bound.engine, bound.session), () => Effect.void)
            }
            observer.state(slot.panel.state())
            observer.transcript({ ...empty, upserts: [...slot.panel.entries()] })
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
          readerNodes.delete(observer)
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
        readerNodes.set(observer, place.node.id)
        return yield* inNodeConversation(place, to, slot => Effect.gen(function*() {
          const state = slot.panel.state()
          if (state.session?.id !== to.session || agentIn(state)?.id !== to.agent || state.status === "gone") {
            // An agent's refusal is conversation state, not a broken wire.
            // Keep the reader so Unopened can show it and retry explicitly.
            slot.openingFor = to
            yield* Effect.catch(slot.panel.loadSession(to.agent, to.session), () => Effect.void).pipe(
              Effect.ensuring(Effect.sync(() => { slot.openingFor = null })),
            )
          }
          if (!slot.history) yield* flush(slot)
          observer.state(slot.panel.state())
          observer.transcript({ ...empty, upserts: [...slot.panel.entries()] })
          return slot.panel
        }))
      })

    /**
     * WHERE A CONVERSATION-KEYED CALL LANDS — the matching the two doors below
     * share, written once so they cannot disagree about which panel a pair names.
     *
     * `how` is the one thing they differ in: whether a pair that matches
     * nothing may OPEN the conversation it named.
     */
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
          // A slot that is on its way OUT is not one a caller that has nothing
          // to say to it — a read — may hold, and the acquisition this runs
          // inside would put a fresh process behind the closing one.
          !mayOpen && slot.closing ? refuse() : apply(slot.panel))
        if (matches(root)) return apply(root)
        // An upload/send names an already acquired lifetime. Reopening a stale
        // pair here could replace a freshly opened session while its binding
        // write is still landing; no new process can satisfy the old token.
        if (scope !== undefined || !mayOpen) return refuse()
        return Effect.scoped(Effect.flatMap(reading(to, { state: () => {}, transcript: () => {} }), apply))
      })

    return {
      reading,
      entries: () => panelOf().entries(),
      state: () => panelOf().state(),
      withdraw,
      live: () => new Map(
        [...nodes.values()].filter((slot) => !slot.history).map((slot) => [slot.node, {
          status: slot.state.status,
          since: slot.since,
          asking: slot.state.asking,
          unopened: slot.state.unopened !== null,
          // ... AND WHOSE TURN IT IS, which is the one thing on this reading
          // that is about olai rather than about the agent.
          sleep: slot.state.sleep,
        } satisfies LiveSession]),
      ),
      overheard: () => root.overheard(),
      assigned: (to) => root.assigned(to),
      assignedTo: (_node, to) => root.assigned(to),
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
        const present = new Set(here(options.roster()).map(row => row.id))
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
        // THE ENGINE THAT JUST MOUNTED MAY BE THE ONE A RECORDED CONVERSATION
        // WAS WAITING FOR. This pass is also what the boot's own `start` runs;
        // repeating it is cheap because every entry it opens leaves `restore`,
        // and every one it cannot open yet is left alone.
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
        // A node moved to the trash before its engine arrived leaves only a
        // pending record behind; the closes above write for live slots, so this
        // one covers the entries that never had a slot.
        persistLive()
      },
      send: (...args) => foreground((panel) => panel.send(...args)),
      // THE SIGN-IN TRIO, routed the way every other gesture is. The server
      // reaches a node's panel through `inConversation` (which is where the
      // conversation a press was drawn for is resolved); these three exist
      // because the AGGREGATE is a `Panel` too, and a session-less panel —
      // an open refused for want of a signature — is the one case where the
      // foreground panel IS the answer.
      signIn: (method) => foreground((panel) => panel.signIn(method)),
      signInInput: (text) => foreground((panel) => panel.signInInput(text)),
      signInCancel: foreground((panel) => panel.signInCancel),
      attach: (chunk) => foreground((panel) => panel.attach(chunk)),
      resend: (id) => foreground((panel) => panel.resend(id)),
      cancel: foreground((panel) => panel.cancel),
      inConversation: (to, scope, use) => conversationIn(to, scope, use, "open-if-needed"),
      setSetting: (agent, session, config, value) => foreground((panel) => panel.setSetting(agent, session, config, value)),
      setModel: (agent, session, value) => foreground((panel) => panel.setModel(agent, session, value)),
      // ONE HOME FOR THE PAIR RULE: this is the routing an acknowledgement
      // takes, and the panel it hands the write to is the panel the MATCHER
      // named — so `Panel.seen` never re-decides which conversation its panel is
      // in (`inConversation` above is the same helper with the opening arm on).
      seen: (to, at) => conversationIn(to, undefined, (panel) => panel.seen(to, at), "only-if-open"),
      // Private Panel compatibility for scheduler benches. The browser wire
      // exposes only node-bound creation and conversation-keyed gestures.
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
       * afterwards. Moving one is `session/load`, and a
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
      startAgentSession: (node, agent, committed) =>
        !seatableAt(node)
          ? Effect.fail(new UsageFailure({
            reason: `node ${node} is no longer available for an agent session`,
          }))
          : working(node, undefined, ({ slot }) =>
            slot.opening.withPermit(Effect.gen(function*() {
              activate(slot)
              options.onConversationClosed?.(slot.state)
              const previous = slot.state.session === null ? null : {
                agent: agentIn(slot.state)?.id, session: slot.state.session.id,
              }
              const before = [...slot.panel.entries()].map(([id]) => id)
              const completed = Effect.gen(function*() {
                const session = slot.panel.state().session
                if (session === null) return yield* new UsageFailure({
                  reason: `${agent} opened no conversation to bind to this node`,
                })
                // Some adapters/fixtures may reuse an identity after changing
                // engines. The newly opened pair is current, never superseded.
                slot.superseded.delete(readingKey({ agent, session: session.id }))
                if (previous?.agent !== undefined
                  && (previous.agent !== agent || previous.session !== session.id)) {
                  slot.superseded.add(readingKey({ agent: previous.agent, session: previous.session }))
                }
                // Retain old identities for this slot's lifetime: readers may
                // already hold a binding snapshot when persistence catches up.
                // A harness may return the same identity for fresh start. Its
                // existing readers still need the new state and cleared replay.
                for (const reader of readingListeners(slot)) {
                  reader.state(slot.state)
                  reader.transcript({ ...empty, removes: before, upserts: [...slot.panel.entries()] })
                }
                yield* flush(slot)
                if (committed !== undefined) yield* committed({ agent, session: session.id })
              })
              const result = yield* Effect.acquireUseRelease(
                Effect.sync(() => { slot.mutingReaders = true }),
                () => Effect.result(slot.panel.newSession(agent, completed)),
                () => Effect.sync(() => { slot.mutingReaders = false }),
              )
              if (result._tag === "Failure") {
                const state = slot.panel.state()
                if (state.unopened !== null && state.signIn?.kind === "choosing") {
                  // A pending sign-in must reach the current node's readers
                  // before there is a new binding. Other failed starts retain
                  // the existing reader face and report their gesture's error.
                  for (const reader of readingListeners(slot)) {
                    reader.state(state)
                    reader.transcript({ ...empty, removes: before, upserts: [...slot.panel.entries()] })
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
      recordRefusal: (tool, failure) => panelOf().recordRefusal(tool, failure),
      start,
      stop: stopWithReason("shutdown"),
      stopWithReason,
    }
  })

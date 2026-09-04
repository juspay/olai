/**
 * NODE AGENTS AS EFFECT SCOPES.
 *
 * `chat.ts` is one conversation's state machine. This module is the scheduler
 * above it: one acquired panel per node, a foreground pointer for the browser,
 * and routing by durable node id for wakes. Closing a node scope releases the
 * panel, which stops its ACP process, turns, probes, attachments and delivery
 * inbox in one finalizer.
 */

import { BusyFailure, type NodeAgent, type NodeAgents, UsageFailure } from "@olai/format"
import type { OpFailure } from "@olai/format"
import { Duration, Effect, Exit, Fiber, Scope, Semaphore } from "effect"

import type { Panel, PanelOptions, WakeScope } from "./chat.ts"
import { makePanel } from "./chat.ts"
import * as Memory from "./memory.ts"
import type { Conversing } from "./sessions.ts"
import type { Change } from "./transcript.ts"

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
  readonly status: ReturnType<Panel["state"]>["status"]
  readonly asking: number
}

/** The public chat is the scheduler over panels, with every acquired node
 * scope exposed for the server's roster projection. */
export interface Chat extends Panel {
  readonly live: () => ReadonlyMap<string, LiveSession>
  /** Mark an existing conversation assigned and move the foreground process
   * into the scope of the node that now owns it. */
  readonly assignedTo: (node: string, to: Conversing) => Effect.Effect<void>
  readonly startAgentSession: (
    node: string,
    agent: string,
  ) => Effect.Effect<void, OpFailure>
}

/** The scheduler's policy and dependencies. Unlike a panel, this always owns
 * a node pool; there is no optional field that changes which lifecycle `make`
 * constructs. */
export interface Options extends PanelOptions {
  readonly nodeAt: (node: string) => NodeAgent | null
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
}

interface NodeSlot {
  readonly node: string
  readonly scope: Scope.Closeable
  readonly panel: Panel
  state: ReturnType<Panel["state"]>
  touched: number
  generation: number
  closing: boolean
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
      nodeAt,
      nodes: nodesAt,
      onLive,
      ticket: mintTicket,
      ...givenPanelOptions
    } = options
    const memory = givenPanelOptions.memory
      ?? Memory.forDirectory(givenPanelOptions.cwd, givenPanelOptions.engines[0] ?? "")
    const panelOptions: PanelOptions = { ...givenPanelOptions, memory }
    const gate = yield* Semaphore.make(1)
    const nodes = new Map<string, NodeSlot>()
    const pending = new Map<string, Array<PendingDelivery>>()
    let stopped = false
    let relocating = false
    let active: { readonly kind: "root"; readonly panel: Panel } | {
      readonly kind: "node"
      readonly slot: NodeSlot
    }

    const rootPanel = () => Effect.gen(function*() {
      let panel!: Panel
      panel = yield* makePanel({
        ...panelOptions,
        onState: (state) => {
          if (active?.kind === "root" && active.panel === panel) {
            panelOptions.onState(state)
          }
        },
        onTranscript: (change) => {
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

    const close = (slot: NodeSlot): Effect.Effect<void> =>
      Effect.suspend(() => {
        if (slot.closing || nodes.get(slot.node) !== slot) return Effect.void
        slot.closing = true
        nodes.delete(slot.node)
        if (active.kind === "node" && active.slot === slot) activateRoot()
        onLive?.()
        const timer = slot.timer
        slot.timer = null
        return Effect.andThen(
          timer === null ? Effect.void : Fiber.interrupt(timer),
          Scope.close(slot.scope, Exit.void),
        )
      })

    const armIdle = (slot: NodeSlot): void => {
      const generation = ++slot.generation
      const former = slot.timer
      slot.timer = null
      if (former !== null) Effect.runFork(Fiber.interrupt(former))
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
        if (active.kind === "node" && active.slot === slot) {
          slot.timer = null
          armIdle(slot)
          return
        }
        slot.timer = null
        yield* close(slot)
      }).pipe(Effect.ensuring(Effect.sync(() => {
        if (slot.timer === fiber) slot.timer = null
      })))
      fiber = Effect.runFork(timer)
      slot.timer = fiber
    }

    const room = (): Effect.Effect<void, OpFailure> => {
      if (nodes.size < capacity) return Effect.void
      const reaper = [...nodes.values()]
        .filter((slot) =>
          !(active.kind === "node" && active.slot === slot)
          && (slot.state.status === "idle" || slot.state.status === "gone")
          && slot.state.asking === 0
          && slot.state.watching.length === 0
        )
        .sort((left, right) => left.touched - right.touched)[0]
      return reaper === undefined
        ? Effect.fail(new BusyFailure({
          reason: `${capacity} node agents are already live; let one become idle before waking another`,
        }))
        : close(reaper)
    }

    const acquire = (
      node: NodeAgent,
    ): Effect.Effect<{ readonly slot: NodeSlot; readonly fresh: boolean }, OpFailure> =>
      gate.withPermit(Effect.gen(function*() {
        const held = nodes.get(node.id)
        if (held !== undefined && !held.closing) {
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
        const scope = Scope.makeUnsafe()
        const ticket = mintTicket(node.id)
        yield* Effect.addFinalizer(() => Effect.sync(ticket.release)).pipe(
          Effect.provideService(Scope.Scope, scope),
        )
        let slot!: NodeSlot
        const panel = yield* Effect.acquireRelease(
          makePanel({
            ...panelOptions,
            tools: () => {
              const server = panelOptions.tools()
              return server === null ? null : { ...server, token: ticket.bearer }
            },
            onState: (state) => {
              slot.state = state
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
              onLive?.()
            },
            onTranscript: (change) => {
              if (active.kind === "node" && active.slot === slot) panelOptions.onTranscript(change)
            },
          }),
          (made) => made.stop,
        ).pipe(Effect.provideService(Scope.Scope, scope))
        slot = {
          node: node.id,
          scope,
          panel,
          state: panel.state(),
          touched: Date.now(),
          generation: 0,
          closing: false,
          timer: null,
        }
        nodes.set(node.id, slot)
        onLive?.()
        return { slot, fresh: true }
      }))

    const nodeFor = (
      agent: string,
      session: string,
    ): NodeAgent | null => panelOptions.agentAt?.({ agent, session }) ?? null

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
      node: NodeAgent,
      open: (panel: Panel) => Effect.Effect<void, OpFailure>,
      foreground: boolean,
    ): Effect.Effect<NodeSlot, OpFailure> =>
      Effect.gen(function*() {
        const { slot, fresh } = yield* acquire(node)
        if (foreground) activate(slot)
        if (fresh) yield* open(slot.panel)
        yield* flush(slot)
        return slot
      })

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
    }): Effect.Effect<void, OpFailure> =>
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
        const node = assigned?.node ?? nodeFor(to.agent, to.session)
        if (node === null) return Effect.void

        relocating = true
        return Effect.gen(function*() {
          const { slot, fresh } = yield* acquire(node)
          // Acquisition can wait behind a concurrent node operation. Do not
          // move a panel somebody switched in the meantime.
          if (active.kind !== "root" || active.panel !== old) {
            if (fresh) yield* close(slot)
            return
          }
          activate(slot)
          yield* old.stop
          root = yield* rootPanel()
          const held = slot.panel.state()
          if (held.session?.id !== to.session || held.status === "gone") {
            yield* slot.panel.loadSession(to.agent, to.session)
          }
          yield* flush(slot)
        }).pipe(Effect.ensuring(Effect.sync(() => {
          relocating = false
        })))
      })

    const relocationFailed = (where: string, failure: OpFailure): Effect.Effect<void> =>
      Effect.logWarning(`${where} could not enter its node scope: ${failure.message}`)

    const start = Effect.asVoid(Effect.forkDetach(Effect.gen(function*() {
      const recalled = yield* Effect.result(memory.recall)
      if (recalled._tag === "Failure" || recalled.success === null) {
        yield* root.start
        yield* Effect.catch(relocateRoot(), (failure) => relocationFailed("the booted session", failure))
        return
      }
      const held = recalled.success
      const node = nodeFor(held.agent, held.session)
      if (node === null) {
        yield* root.start
        yield* Effect.catch(relocateRoot(), (failure) => relocationFailed("the booted session", failure))
        return
      }
      yield* Effect.catch(
        Effect.asVoid(ensureNode(
          node,
          (panel) => panel.loadSession(held.agent, held.session),
          true,
        )),
        (failure) => relocationFailed("the remembered node agent", failure),
      )
    })))

    const scopedDoor = (plugin: string) => {
      const scopes = (): ReadonlyArray<WakeScope> => {
        const manual = root.doorFor(plugin).scopes()
          .filter((scope) => nodeFor(scope.agent, scope.session) === null)
        const derived = nodesAt().flatMap((node) =>
          node.session === null
            ? []
            : [{ agent: node.engine, session: node.session, file: node.file, under: node.id }]
        )
        return [...manual, ...derived]
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
          to: { readonly agent: string; readonly session: string },
          say: () => string | null,
          how?: { readonly coalesce?: string },
        ): Effect.Effect<void> => {
          const node = nodeFor(to.agent, to.session)
          if (node === null) return root.doorFor(plugin).deliver(to, say, how)
          return Effect.catch(Effect.gen(function*() {
            const slot = yield* ensureNode(
              node,
              (panel) => panel.loadSession(to.agent, to.session),
              false,
            )
            yield* slot.panel.doorFor(plugin).deliver(to, say, how)
          }),
            (failure) =>
              Effect.sync(() => hold(node.id, { plugin, to, say, options: how })).pipe(
                Effect.andThen(
                  Effect.logWarning(
                    `node agent ${node.id} could not wake: ${failure.message}; its delivery is held`,
                  ),
                ),
              ),
          )
        },
      }
    }

    return {
      entries: () => panelOf().entries(),
      state: () => panelOf().state(),
      live: () => new Map(
        [...nodes].map(([node, slot]) => [node, {
          status: slot.state.status,
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
      reread: () => {
        root.reread()
        for (const slot of nodes.values()) slot.panel.reread()
        Effect.runFork(Effect.catch(
          relocateRoot(),
          (failure) => relocationFailed("the newly bound session", failure),
        ))
      },
      send: (...args) => foreground((panel) => panel.send(...args)),
      attach: (chunk) => foreground((panel) => panel.attach(chunk)),
      resend: (id) => foreground((panel) => panel.resend(id)),
      cancel: foreground((panel) => panel.cancel),
      newSession: (agent) => foreground((panel) => panel.newSession(agent)),
      startAgentSession: (node, agent) => {
        const found = nodeAt(node)
        return found === null
          ? Effect.sync(() => {
            activateRoot()
          }).pipe(
            Effect.andThen(root.newSession(agent)),
          )
          : Effect.flatMap(
            acquire(found),
            ({ slot }) => Effect.gen(function*() {
              activate(slot)
              yield* slot.panel.newSession(agent)
              yield* flush(slot)
            }),
          )
      },
      chooseAgent: (agent) => {
        activateRoot()
        return root.chooseAgent(agent)
      },
      loadSession: (agent, session) => {
        const node = nodeFor(agent, session)
        if (node === null) {
          activateRoot()
          return root.loadSession(agent, session)
        }
        return Effect.flatMap(
          acquire(node),
          ({ slot }) => Effect.gen(function*() {
            activate(slot)
            const state = slot.panel.state()
            if (state.session?.id !== session || state.status === "gone") {
              yield* slot.panel.loadSession(agent, session)
            }
            yield* flush(slot)
          }),
        )
      },
      reopen: foreground((panel) => panel.reopen),
      sessions: Effect.suspend(() => root.sessions),
      answer: (id, answers) => foreground((panel) => panel.answer(id, answers)),
      doorFor: scopedDoor,
      scope: (to, plugin, file) => {
        if (nodeFor(to.agent, to.session) !== null) {
          return Effect.fail(new UsageFailure({
            reason: "a node agent wakes from its subtree; its scope is not picked by hand",
          }))
        }
        return root.scope(to, plugin, file)
      },
      faults: (served, sayable) => root.faults(served, sayable),
      recordRefusal: (tool, failure) => panelOf().recordRefusal(tool, failure),
      start,
      stop: Effect.gen(function*() {
        stopped = true
        pending.clear()
        yield* root.stop
        yield* Effect.forEach([...nodes.values()], close, { discard: true })
      }),
    }
  })

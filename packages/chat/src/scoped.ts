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
import type { OpFailure } from "@olai/surface"
import { Duration, Effect, Exit, Fiber, Scope, Semaphore } from "effect"

import type { Panel, PanelOptions } from "./chat.ts"
import { makePanel } from "./chat.ts"
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
  readonly ticket?: (node: string) => ToolTicket
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

const empty: Change = { upserts: [], removes: [], appends: [] }

/** Build the scheduler. Focused state-machine tests call `makePanel` directly;
 * package consumers always get the node-scoped lifecycle. */
export const make = (options: Options): Effect.Effect<Chat, never, never> =>
  Effect.gen(function*() {
    const {
      capacity = DEFAULT_CAPACITY,
      idle = DEFAULT_IDLE,
      nodeAt,
      nodes: nodesAt,
      onLive,
      ticket: mintTicket,
      ...panelOptions
    } = options
    const gate = yield* Semaphore.make(1)
    const nodes = new Map<string, NodeSlot>()
    let stopped = false
    let active: { readonly kind: "root"; readonly panel: Panel } | {
      readonly kind: "node"
      readonly slot: NodeSlot
    }
    let migrateRemembered: (state: ReturnType<Panel["state"]>) => void = () => {}
    let migrationPaused = 0
    let migrationFiber: Fiber.Fiber<void, never> | null = null

    const rootPanel = () => Effect.gen(function*() {
      let panel!: Panel
      panel = yield* makePanel({
        ...panelOptions,
        onState: (state) => {
          if (active?.kind === "root" && active.panel === panel) {
            panelOptions.onState(state)
            migrateRemembered(state)
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
        const ticket = mintTicket?.(node.id)
        if (ticket !== undefined) {
          yield* Effect.addFinalizer(() => Effect.sync(ticket.release)).pipe(
            Effect.provideService(Scope.Scope, scope),
          )
        }
        let slot!: NodeSlot
        const panel = yield* Effect.acquireRelease(
          makePanel({
            ...panelOptions,
            tools: () => {
              const server = panelOptions.tools()
              return server === null || ticket === undefined
                ? server
                : { ...server, token: ticket.bearer }
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

    let migrating: string | null = null
    migrateRemembered = (state) => {
      if (migrationPaused > 0) return
      const talking = state.talking
      if (state.status !== "idle" || state.session === null || talking?.kind !== "agent") return
      const session = state.session.id
      const node = nodeFor(talking.id, session)
      if (node === null) return
      const old = root
      if (active.kind !== "root" || active.panel !== old) return
      const key = `${talking.id}\0${session}`
      if (migrating === key) return
      migrating = key
      let fiber!: Fiber.Fiber<void, never>
      fiber = Effect.runFork(
        Effect.catch(
          Effect.gen(function*() {
            const { slot } = yield* acquire(node)
            if (active.kind === "root" && active.panel === old) activate(slot)
            yield* old.stop
            root = yield* rootPanel()
            yield* slot.panel.loadSession(talking.id, session)
          }),
          (failure) =>
            Effect.logWarning(`the remembered node agent could not be scoped: ${failure.message}`),
        ).pipe(Effect.ensuring(Effect.sync(() => {
          if (migrating === key) migrating = null
          if (migrationFiber === fiber) migrationFiber = null
        }))),
      )
      migrationFiber = fiber
    }

    const ensureNode = (
      node: NodeAgent,
      open: (panel: Panel) => Effect.Effect<void, OpFailure>,
      foreground: boolean,
    ): Effect.Effect<NodeSlot, OpFailure> =>
      Effect.gen(function*() {
        const { slot, fresh } = yield* acquire(node)
        if (foreground) activate(slot)
        if (fresh) yield* open(slot.panel)
        return slot
      })

    const foreground = <A>(use: (panel: Panel) => Effect.Effect<A, OpFailure>) =>
      Effect.suspend(() => use(panelOf()))

    const start = root.start

    const scopedDoor = (plugin: string) => ({
      scopes: () => {
        const manual = root.doorFor(plugin).scopes()
          .filter((scope) => nodeFor(scope.agent, scope.session) === null)
        const derived = nodesAt().flatMap((node) =>
          node.session === null
            ? []
            : [{ agent: node.engine, session: node.session, file: node.file, under: node.id }]
        )
        return [...manual, ...derived]
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
          (failure) => Effect.logWarning(`node agent ${node.id} could not wake: ${failure.message}`),
        )
      },
    })

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
      replaced: (to, by) => root.replaced(to, by),
      reread: () => {
        root.reread()
        for (const slot of nodes.values()) slot.panel.reread()
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
            migrationPaused++
          }).pipe(
            Effect.andThen(root.newSession(agent)),
            Effect.ensuring(Effect.sync(() => migrationPaused--)),
          )
          : Effect.flatMap(
            acquire(found),
            ({ slot }) => {
              activate(slot)
              return slot.panel.newSession(agent)
            },
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
          ({ slot }) => {
            activate(slot)
            const state = slot.panel.state()
            return state.session?.id === session && state.status !== "gone"
              ? Effect.void
              : slot.panel.loadSession(agent, session)
          },
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
        if (migrationFiber !== null) yield* Fiber.interrupt(migrationFiber)
        yield* root.stop
        yield* Effect.forEach([...nodes.values()], close, { discard: true })
      }),
    }
  })

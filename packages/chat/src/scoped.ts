/**
 * NODE AGENTS AS EFFECT SCOPES.
 *
 * `chat.ts` is one conversation's state machine. This module is the scheduler
 * above it: one acquired panel per node, a foreground pointer for the browser,
 * and routing by durable node id for wakes. Closing a node scope releases the
 * panel, which stops its ACP process, turns, probes, attachments and delivery
 * inbox in one finalizer.
 */

import { BusyFailure, type NodeAgent, UsageFailure } from "@olai/format"
import type { OpFailure } from "@olai/surface"
import { Duration, Effect, Exit, Fiber, Scope, Semaphore } from "effect"

import type { Chat, LiveSession, Options } from "./chat.ts"
import { makePanel } from "./chat.ts"
import type { Change } from "./transcript.ts"

/** Long enough not to churn an ordinary working set, finite so sleeping agents
 * do not become a process pool. Tests inject a shorter duration. */
export const DEFAULT_IDLE = Duration.minutes(15)
export const DEFAULT_CAPACITY = 8

interface NodeSlot {
  readonly node: string
  readonly scope: Scope.Closeable
  readonly panel: Chat
  state: ReturnType<Chat["state"]>
  touched: number
  generation: number
  closing: boolean
  timer: Fiber.Fiber<void, never> | null
}

const empty: Change = { upserts: [], removes: [], appends: [] }

/** Build the old panel where no vault-side node lookup was supplied; otherwise
 * build the scheduler. This keeps the package's lower-level fixtures honest:
 * they still exercise exactly one conversation and none accidentally grows a
 * second lifecycle. */
export const make = (options: Options): Effect.Effect<Chat, never, never> =>
  options.nodeAt === undefined ? makePanel(options) : makeScoped(options)

const makeScoped = (options: Options): Effect.Effect<Chat, never, never> =>
  Effect.gen(function*() {
    const nodeAt = options.nodeAt as (node: string) => NodeAgent | null
    const idle = options.idle ?? DEFAULT_IDLE
    const capacity = options.capacity ?? DEFAULT_CAPACITY
    const gate = yield* Semaphore.make(1)
    const nodes = new Map<string, NodeSlot>()
    let stopped = false
    let active: { readonly kind: "root"; readonly panel: Chat } | {
      readonly kind: "node"
      readonly slot: NodeSlot
    }
    let migrateRemembered: (state: ReturnType<Chat["state"]>) => void = () => {}
    let migrationPaused = 0
    let migrationFiber: Fiber.Fiber<void, never> | null = null

    const rootPanel = () => Effect.gen(function*() {
      let panel!: Chat
      panel = yield* makePanel({
        ...options,
        nodeAt: undefined,
        onState: (state) => {
          if (active?.kind === "root" && active.panel === panel) {
            options.onState(state)
            migrateRemembered(state)
          }
        },
        onTranscript: (change) => {
          if (active?.kind === "root" && active.panel === panel) options.onTranscript(change)
        },
      })
      return panel
    })
    let root!: Chat
    root = yield* rootPanel()
    active = { kind: "root", panel: root }

    const panelOf = (): Chat => active.kind === "root" ? active.panel : active.slot.panel

    const publishSwitch = (before: Chat, after: Chat): void => {
      const gone = [...before.entries().keys()]
      if (gone.length > 0) options.onTranscript({ ...empty, removes: gone })
      const arrived = [...after.entries()]
      if (arrived.length > 0) options.onTranscript({ ...empty, upserts: arrived })
      options.onState(after.state())
      options.onLive?.()
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
        options.onLive?.()
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
        const ticket = options.ticket?.(node.id)
        if (ticket !== undefined) {
          yield* Effect.addFinalizer(() => Effect.sync(ticket.release)).pipe(
            Effect.provideService(Scope.Scope, scope),
          )
        }
        let slot!: NodeSlot
        const panel = yield* Effect.acquireRelease(
          makePanel({
            ...options,
            nodeAt: undefined,
            tools: () => {
              const server = options.tools()
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
              if (active.kind === "node" && active.slot === slot) options.onState(state)
              options.onLive?.()
            },
            onTranscript: (change) => {
              if (active.kind === "node" && active.slot === slot) options.onTranscript(change)
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
        options.onLive?.()
        return { slot, fresh: true }
      }))

    const nodeFor = (
      agent: string,
      session: string,
    ): NodeAgent | null => options.agentAt?.({ agent, session }) ?? null

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
      open: (panel: Chat) => Effect.Effect<void, OpFailure>,
      foreground: boolean,
    ): Effect.Effect<NodeSlot, OpFailure> =>
      Effect.gen(function*() {
        const { slot, fresh } = yield* acquire(node)
        if (foreground) activate(slot)
        if (fresh) yield* open(slot.panel)
        return slot
      })

    const foreground = <A>(use: (panel: Chat) => Effect.Effect<A, OpFailure>) =>
      Effect.suspend(() => use(panelOf()))

    const start = root.start

    const scopedDoor = (plugin: string) => ({
      scopes: () => {
        const manual = root.doorFor(plugin).scopes()
          .filter((scope) => nodeFor(scope.agent, scope.session) === null)
        const derived = (options.nodes?.() ?? []).flatMap((node) =>
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

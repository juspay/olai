import { newChat, itemLocations, type LocationQuery, type NewChatInput, seated } from "./server/new-chat.ts"
import { deliveryProvision } from "./server/deliveries.ts"
import { conversationsProvision } from "./server/conversations.ts"
import type { ImplementSurfaceDeps, SurfaceCtx } from "@kolu/surface/server"
import { inMemoryStore } from "@kolu/surface/server"
import {
  type AgentItem,
  documentAt,
  isMarkdown,
  itemKey,
  itemOf,
  type OpFailure,
  notesClaimed,
  othersOf,
  type Reading,
  UsageFailure,
} from "@olai/format"
import {
  Bundle,
  Clock,
  definePlugin,
  Env,
  FileKinds,
  Kinds,
  LocalState,
  Offers,
  Ops,
  type Refusal,
  Surfaces,
  Tools,
  Vault,
  Wakes,
} from "@olai/plugin-api/services"
import {
  Agents as AgentsDoor,
  Conversations,
  Deliveries,
  detached,
  SessionStart,
  Watching,
} from "@olai/plugin-api/services"
import type { Engine, Registering } from "@kolu/acp/engine"
import type { ConversationSeen, Probed, Wake } from "@olai/plugin-api/services"
import { Deferred, Duration, Effect, Scope, Semaphore, Stream } from "effect"

import type { PanelAddress } from "./wire/session.ts"
import { forLocalState as modelsIn } from "./models.ts"
import type { Ops as WriteGate } from "@olai/ops"
import { applyMoves } from "./server/move.ts"
import type { Forecast } from "./wire.ts"
import { type Asked, makeSleeper, START } from "./server/sleep.ts"
import { readings } from "./server/readings.ts"
import type { Change } from "@kolu/acp-harness"
import * as Chat from "./scoped.ts"
import { whyNoAgent } from "./adapter.ts"
import { choiceOf, detecting, here, offBecause } from "./agents/roster.ts"
import { openLocalState } from "./local.ts"
import { forLocalState as liveIn } from "./live.ts"
import { forLocalState as scopesIn } from "./scopes.ts"
import { forLocalState as sessionsIn } from "./sessions.ts"
import { rosterIn, seatingIn } from "./seating.ts"
import { Config, SLEEP_OFF, sleepingPolicy } from "./settings.ts"
export { Config } from "./settings.ts"
import { kinds } from "./kinds.ts"
import { OPENS, SEATS } from "./policy.ts"
import { roster as agentsRoster, type RosterReading } from "./server/agents.ts"
import { closeAgent, type Binding, NO_SLEEP_ON_A_NOTE, retie, setOpens, setSleeping, startAgentSession } from "./server/binding.ts"
import { scopeThrough } from "./server/doorbell.ts"
import { inBundleOrder } from "./server/order.ts"
import { contextFor } from "./server/context.ts"
import type { ChatEntry, ChatState } from "./wire/members.ts"
import { type Agents, NO_AGENT_ROSTER } from "./wire/agents.ts"
import { faces, name, surface } from "./wire.ts"
import { CHARTER } from "./charter.ts"
import { SLEEP_WORD } from "./sleep.ts"

export { kinds } from "./kinds.ts"

export { faces, name, surface } from "./wire.ts"

type Ctx = SurfaceCtx<typeof surface.spec>

interface VaultRevision {
  readonly value: {
    readonly set: Parameters<typeof documentAt>[0]
    readonly derived: Reading["derived"]
    readonly claims: Reading["claims"]
  }
}

const asFailure = (refusal: Refusal): OpFailure => refusal as OpFailure

const MEMO =
  "olai writes it when it tidies this node agent's knowledge base, so a session that stamped it would be claiming a pass nobody ran"

const SLEEPING_MARK =
  "it is whether olai may tidy this chat on its own, which is a person's choice at the chat's own controls"

const needs = [Bundle, Env, FileKinds, Kinds, LocalState, Offers, Ops, Surfaces, Tools, Vault, Wakes] as const

export default definePlugin({
  environment: [
    {"key": "OLAI_AGENT_PATH", "secret": false, "says": "the directories containing agent executables"},
  ],
  name,
  needs,
  config: Config,
  apply: (settings) => Effect.gen(function*() {
    const [bundle, env, fileKinds, kindsDoor, localStateDoor, offers, ops, surfaces, tools, vault, wakes] =
      yield* Effect.all(needs)
    const nodeIdle = settings["idle-ms"]
    const sleeping = settings.sleep === "on"
    const spans = sleepingPolicy(settings)
    const localState = yield* openLocalState(localStateDoor)
    yield* offers.own("seating", () => ({ in: seatingIn }))

    for (const kind of kinds) yield* kindsDoor.register(kind)

    const engines = new Map<string, Engine>()
    let engineChange: Deferred.Deferred<void> | null = null
    const detect = detecting(env.vars, vault.served)
    const mounted = () => inBundleOrder(engines.values(), (one) => one.id, bundle.rank)
    const enginesMoved = (): void => {
      if (chat !== null) ring(
        Effect.sync(() => mine?.cells.engines.set(detect.read(mounted()).map(choiceOf)))
          .pipe(Effect.andThen(chat.enginesMoved)),
      )
      else if (engineChange !== null) ring(Deferred.succeed(engineChange, undefined))
    }
    yield* offers.offer(AgentsDoor, (who) => ({
      register: (engine: Registering) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            if (engines.has(who)) {
              throw new Error(
                `plugins: "${who}" offered a second ACP engine — a plugin is one engine `
                  + "under one id, and the second would silently replace the first.",
              )
            }
            engines.set(who, { ...engine, id: who })
            enginesMoved()
          }),
          () =>
            Effect.sync(() => {
              engines.delete(who)
              detect.forget(who)
              enginesMoved()
            }),
        ).pipe(Effect.asVoid),
    }))

    yield* offers.offer(Deliveries, deliveryProvision(() => chat, wakes.current))

    const watchers: Array<{
      readonly who: string
      readonly handler: (event: ConversationSeen) => Effect.Effect<void>
    }> = []
    yield* offers.offer(Watching, (who) => ({
      subscribe: (handler) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const row = { who, handler }
            watchers.push(row)
            return row
          }),
          (row) =>
            Effect.sync(() => {
              const at = watchers.indexOf(row)
              if (at !== -1) watchers.splice(at, 1)
            }),
        ).pipe(Effect.asVoid),
    }))
    const seen = (event: ConversationSeen): Effect.Effect<void> =>
      Effect.forEach(
        watchers,
        (row) =>
          Effect.catchCause(
            row.handler(event),
            (cause) =>
              Effect.annotateLogs(
                Effect.logWarning(`a conversation event handler failed: ${cause}`),
                { plugin: row.who },
              ),
          ),
        { discard: true },
      )

    const asking: Array<{ readonly who: string; readonly ask: Effect.Effect<Probed> }> = []
    yield* offers.offer(SessionStart, (who) => ({
      ask: (probe) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const row = { who, ask: probe }
            asking.push(row)
            return row
          }),
          (row) =>
            Effect.sync(() => {
              const at = asking.indexOf(row)
              if (at !== -1) asking.splice(at, 1)
            }),
        ).pipe(Effect.asVoid),
    }))

    let chat: Chat.Chat | null = null
    const ready = yield* Deferred.make<Chat.Chat>()
    const streams = yield* readings(Deferred.await(ready))
    let mine: Ctx | null = null
    let sleeper: {
      readonly now: (node: string) => Effect.Effect<Asked, never, Scope.Scope>
      readonly forecast: (node: string) => Forecast | null
    } | null = null
    const owned = yield* Effect.scope
    let sessionsRevision = 0

    const nodeAgents = agentsRoster()
    const levelWith = (reading: RosterReading | null) => nodeAgents.seen(reading)

    const republishAgents = (): void => {
      const cell = mine?.cells.agents
      if (cell === undefined) return
      cell.set(
        nodeAgents.rowsWith(
          chat === null ? [] : chat.overheard(),
          chat === null ? new Map() : chat.live(),
          (node) => sleeper?.forecast(node) ?? null,
        ),
      )
    }

    const whoOf = (state: ChatState): { agent: string; session: string } | null =>
      state.session !== null && state.talking?.kind === "agent"
        ? { agent: state.talking.id, session: state.session.id }
        : null
    const turns = new Map<string, { status: ChatState["status"]; sequence: number }>()
    const deliveredIds = new Set<string>()

    const ring = yield* detached

    const publishState = (state: ChatState, entries: ReadonlyMap<string, ChatEntry>): void => {
      republishAgents()
      const who = whoOf(state)
      if (who !== null) {
        const key = JSON.stringify([who.agent, who.session])
        const previous = turns.get(key)
        const lastStatus = previous?.status
        let agentSeqAtTurn = previous?.sequence ?? -1
        if (state.status === "thinking" && lastStatus !== "thinking") {
          agentSeqAtTurn = Math.max(
            -1,
            ...[...entries.values()]
              .filter((entry): entry is Extract<ChatEntry, { kind: "agent" }> =>
                entry.kind === "agent"
              )
              .map((entry) => entry.seq),
          )
          ring(seen({ kind: "turn", ...who, status: "working" }))
        }
        if (lastStatus === "thinking" && state.status !== "thinking") {
          ring(seen({ kind: "turn", ...who, status: "done" }))
          const produced = [...entries.values()]
            .filter((entry): entry is Extract<ChatEntry, { kind: "agent" }> =>
              entry.kind === "agent" && entry.seq > agentSeqAtTurn
            )
            .sort((a, b) => a.seq - b.seq)
            .at(-1)
          if (produced !== undefined && produced.text !== "") {
            ring(seen({ kind: "replied", id: produced.id, ...who, text: produced.text }))
          }
        }
        turns.set(key, { status: state.status, sequence: agentSeqAtTurn })
      }
    }

    const publishTranscript = (state: ChatState, change: Change<ChatEntry>): void => {
      const who = whoOf(state)
      if (who === null) return
      for (const entry of change.upserts) {
        if (entry.kind === "user" && entry.rang !== undefined && entry.text !== "") {
          const key = JSON.stringify([who.agent, who.session, entry.id])
          if (deliveredIds.has(key)) continue
          deliveredIds.add(key)
          ring(seen({ kind: "delivered", id: entry.id, from: entry.rang, ...who, body: entry.text }))
        }
      }
    }

    const withChat = <A>(
      use: (chat: Chat.Chat) => Effect.Effect<A, OpFailure>,
    ): Effect.Effect<A, OpFailure> =>
      chat === null
        ? Effect.fail(
          new UsageFailure({
            reason: "chat is off: no ACP agent is configured for this directory",
          }),
        )
        : use(chat)

    const bindingPermit = yield* Semaphore.make(1)
    const creationPermit = yield* Semaphore.make(1)
    const gate = ops.gate as WriteGate
    const binding: Binding = {
      exclusive: work => bindingPermit.withPermit(work),
      changed: Effect.sync(() => void mine?.cells.sessionsRevision.set(++sessionsRevision)),
      boundAt: (item) => nodeAgents.nodeAt(item),
      key: () => nodeAgents.key(),
      opensKey: () => nodeAgents.opensKey(),
      write: (node, value) =>
        Effect.mapError(ops.prop({ node, key: nodeAgents.key(), value }), asFailure),
      remove: (node) =>
        Effect.mapError(ops.prop({ node, key: nodeAgents.key(), value: "" }), asFailure),
      mark: (node, value) =>
        Effect.mapError(ops.prop({ node, key: nodeAgents.sleepKey(), value }), asFailure),
      text: (path) =>
        Effect.map(gate.read, (reading) => {
          const document = documentAt(reading.set, path)
          return document !== undefined && isMarkdown(document) ? document.body : null
        }),
      doc: (path, text, was) => Effect.asVoid(gate.run({ op: "doc", file: path, text, was }, "web")),
    }

    const published = Effect.sync(() => void mine?.cells.sessionsRevision.set(++sessionsRevision))

    const mintConversation = (open: Chat.Chat, input: NewChatInput) =>
      creationPermit.withPermit(newChat({
        read: gate.read,
        start: (node, agent, committed) =>
          seated({
            committed,
            level: levelWith,
            read: gate.read,
            start: startAgentSession(open, binding, { node, agent }),
          }),
        chats: (reading) => rosterIn(reading),
      }, input))

    const rings = wakes.declared

    const conversation = {
      send: ({ input }: { input: { conv: PanelAddress; scope: string | null; text: string; attachments?: ReadonlyArray<string>; context?: ReadonlyArray<string>; steer?: boolean } }) =>
        withChat((open) => open.inConversation(input.conv, input.scope, (panel) =>
          Effect.flatMap(ops.reading, (at) => {
            const context = contextFor(at as Reading, input.context ?? [])
            if (context._tag === "Failure") return Effect.fail(context.failure)
            return panel.send(
              input.text,
              input.attachments ?? [],
              context.success,
              input.steer ?? false,
            )
          })
        )),
      attach: ({ input }: { input: Parameters<Chat.Chat["attach"]>[0] & { conv: PanelAddress } }) =>
        withChat((open) => open.inConversation(input.conv, input.uploadScope, (panel) => panel.attach(input))),
      resend: ({ input }: { input: { conv: PanelAddress; scope: string | null; id: string } }) =>
        withChat((open) => open.inConversation(input.conv, input.scope, (panel) => panel.resend(input.id))),
      cancel: ({ input }: { input: { conv: PanelAddress; scope: string | null } }) => withChat((open) => open.inConversation(input.conv, input.scope, (panel) => panel.cancel)),
      signIn: ({ input }: { input: { conv: PanelAddress; scope: string | null; method: string | null } }) =>
        withChat((open) =>
          open.inConversation(input.conv, input.scope, (panel) => panel.signIn(input.method))
        ),
      signInInput: ({ input }: { input: { conv: PanelAddress; scope: string | null; text: string } }) =>
        withChat((open) =>
          open.inConversation(input.conv, input.scope, (panel) => panel.signInInput(input.text))
        ),
      signInCancel: ({ input }: { input: { conv: PanelAddress; scope: string | null } }) =>
        withChat((open) => open.inConversation(input.conv, input.scope, (panel) => panel.signInCancel)),
      setSetting: ({ input }: { input: { agent: string; session: string; config: string; value: string | boolean } }) =>
        withChat((open) => open.inConversation(input, undefined, panel => panel.setSetting(input.agent, input.session, input.config, input.value))),
      setModel: ({ input }: { input: { agent: string; session: string; value: string } }) =>
        withChat((open) => open.inConversation(input, undefined, panel => panel.setModel(input.agent, input.session, input.value))),
      seen: ({ input }: { input: { agent: string; session: string; at: string } }) =>
        withChat((open) => open.seen(input, input.at))
          .pipe(Effect.tap(() => Effect.sync(republishAgents))),
      locations: ({ input }: { input: LocationQuery }) => Effect.map(ops.reading, reading => itemLocations(reading as Reading, input)),
      newChat: ({ input }: { input: NewChatInput }) =>
        withChat(open => Effect.gen(function*() {
          const made = yield* mintConversation(open, input)
          const say = input.say
          if (made.to === null || say === undefined || say.trim() === "") return made
          const said = yield* Effect.result(open.inConversation(made.to, undefined, panel => panel.send(say, [], [], false, [])))
          return said._tag === "Failure" ? { ...made, refusal: said.failure.message } : made
        })).pipe(Effect.tap(() => published)),
      startAgentSession: ({ input }: { input: { node: string; agent: string } }) =>
        withChat((open) => startAgentSession(open, binding, input)).pipe(
          Effect.tap(() => published),
        ),
      setSleeping: ({ input }: { input: { node: string; on: boolean } }) =>
        sleeping
          ? bindingPermit.withPermit(setSleeping(binding, input)).pipe(
            Effect.tap(() => published),
          )
          : Effect.fail(new UsageFailure({ reason: SLEEP_OFF })),
      setOpens: ({ input }: { input: { path: string; beside: boolean } }) =>
        bindingPermit.withPermit(setOpens(binding, input)).pipe(
          Effect.tap(() => published),
        ),
      closeAgent: ({ input }: { input: { node: string } }) =>
        bindingPermit.withPermit(closeAgent(binding, input)).pipe(
          Effect.tap(() => published),
        ),
      retie: ({ input }: { input: { node: string; agent: string; session: string } }) =>
        bindingPermit.withPermit(retie(binding, {
          seatable: (item) => nodeAgents.seatableAt(item),
          claimedBy: (to) => nodeAgents.agentAt(to)?.id ?? null,
        }, input)).pipe(
          Effect.tap(() => published),
        ),
      sleep: ({ input }: { input: { node: string } }) => withChat((open) => open.sleep(input.node)),
      tidyMemory: ({ input }: { input: { node: string } }) =>
        Effect.gen(function*() {
          if (itemOf(input.node).kind === "note") {
            return { _tag: "Refused" as const, said: NO_SLEEP_ON_A_NOTE }
          }
          const pass = sleeper
          if (pass === null) return { _tag: "Refused" as const, said: SLEEP_OFF }
          const asked = yield* Effect.provideService(pass.now(input.node), Scope.Scope, owned)
          if (asked === "started") return { _tag: "Started" as const }
          if (asked === "unknown") {
            return { _tag: "Refused" as const, said: "that node is not a node agent with a conversation" }
          }
          const live = chat?.live() ?? new Map<string, Chat.LiveSession>()
          const at = [...live].find(([, one]) => one.sleep === true)?.[0] ?? input.node
          const title = nodeAgents.nodes().find((one) => one.id === at)?.title ?? at
          return { _tag: "Refused" as const, said: `olai is already tidying ${title}; wait for it to finish` }
        }),
      reopen: ({ input }: { input: { conv: PanelAddress; scope: string | null } }) =>
        withChat((open) => open.inConversation(input.conv, input.scope ?? undefined, (panel) => panel.state().unopened === null ? Effect.void : panel.reopen)),
      sessions: () => withChat((open) => open.sessions),
      answer: ({ input }: { input: { conv: PanelAddress; scope?: string | null; id: string; answers: Parameters<Chat.Chat["answer"]>[1] } }) =>
        withChat((open) => open.inConversation(input.conv, input.scope, panel => panel.answer(input.id, input.answers))),
      decline: ({ input }: { input: { conv: PanelAddress; scope?: string | null; id: string } }) =>
        withChat((open) => open.inConversation(input.conv, input.scope, panel => panel.answer(input.id, null))),
      scope: (
        { input }: {
          input: {
            agent: string
            session: string
            plugin: string
            pick: import("./json.ts").Json
          }
        },
      ) =>
        withChat((open) =>
          Effect.flatMap(rings, (declared) =>
            Effect.mapError(
              scopeThrough(open, declared, input),
              (said) => new UsageFailure(said),
            ))
        ),
      earlier: ({ input }: { input: { conv: PanelAddress; before: number; limit: number } }) =>
        withChat(() => streams.page(input.conv, input.before, input.limit)),
    }

    const chatRowsAt = (
      abouts: ReadonlyArray<AgentItem>,
    ): Effect.Effect<ReadonlyMap<string, { readonly engine: string; readonly session: string | null }>> =>
      Effect.map(ops.reading, (read) => {
        const found = new Map<string, { readonly engine: string; readonly session: string | null }>()
        const reading = read as Reading | null | undefined
        if (reading === null || reading === undefined) return found
        const seated = rosterIn(reading)
        for (const about of abouts) {
          const key = itemKey(about)
          const row = seated.find((one) => one.id === key)
          if (row !== undefined) found.set(key, { engine: row.engine, session: row.session })
        }
        return found
      })
    yield* offers.offer(Conversations, conversationsProvision({
      mint: (input) => withChat(open => mintConversation(open, input)).pipe(Effect.tap(() => published)),
      send: (to, text, preamble) =>
        withChat(open => open.inConversation(to, undefined, panel => panel.send(text, [], [], false, preamble))),
      seatAt: (about) =>
        Effect.map(chatRowsAt([about]), (rows) => {
          const row = rows.get(itemKey(about))
          return row === undefined || row.session === null ? null : { agent: row.engine, session: row.session }
        }),
      chatsAt: (abouts) => Effect.map(chatRowsAt(abouts), (rows) => new Set(rows.keys())),
      deliver: (who, to, text, current) =>
        chat === null
          ? Effect.succeed(false)
          : Effect.as(chat.doorFor(who).deliver({ ...to, current }, () => text), true),
      engines: () => here(detect.read(mounted())).map(row => ({ id: row.id, name: row.name })),
    }))

    yield* surfaces.register({
      surface,
      faces,
      charter: CHARTER,
      deps: {
        cells: {
          engines: { store: inMemoryStore<ChatState["roster"]>([]) },
          sessionsRevision: { store: inMemoryStore<number>(0) },
          agents: { store: inMemoryStore<Agents>(NO_AGENT_ROSTER) },
        },
        streams,
        procedures: { conversation },
      } satisfies ImplementSurfaceDeps<typeof surface.spec>,
      published: (bound) => {
        mine = bound as Ctx
        republishAgents()
      },
    })

    const notesServed = (): boolean => notesClaimed(fileKinds.current().values())
    let moved = false
    let moving = false
    const moveOnce = (): void => {
      if (moved || moving) return
      moving = true
      ring(bindingPermit.withPermit(applyMoves({
        served: notesServed,
        read: gate.read,
        text: binding.text,
        doc: (path, text, was) => Effect.asVoid(gate.run({ op: "doc", file: path, text, was }, "move")),
        remove: (node) => Effect.asVoid(gate.run({ op: "prop", id: node, key: nodeAgents.key(), value: "" }, "move")),
        key: nodeAgents.key,
        opensKey: nodeAgents.opensKey,
        log: (line) => Effect.logInfo(line),
      })).pipe(
        Effect.tap((ran) => Effect.sync(() => { moved = ran })),
        Effect.ensuring(Effect.sync(() => { moving = false })),
        Effect.catchCause((cause) => Effect.logWarning(`chat: the one-time move could not read the directory: ${cause}`)),
        Effect.asVoid,
      ))
    }
    moveOnce()
    yield* Effect.forkScoped(Stream.runForEach(fileKinds.changes, () => Effect.sync(moveOnce)))
    yield* vault.revision((revision: VaultRevision) =>
      Effect.sync(() => {
        levelWith(revision.value)
        moveOnce()
        chat?.reread()
        republishAgents()
      })
    )
    yield* vault.unloaded(Effect.sync(() => {
      levelWith(null)
      republishAgents()
    }))

    yield* ops.refused((refusal) =>
      chat === null || refusal.writer === "web"
        ? Effect.void
        : chat.recordRefusal(refusal.op, asFailure(refusal.failure))
    )

    yield* Effect.forkScoped(Effect.gen(function*() {
      const address = yield* tools.server
      const initialReading = (yield* ops.reading) as Reading | null
      if (initialReading !== null) levelWith(initialReading)
      let [discoveryDuration, table] = yield* Effect.timed(Effect.sync(() => detect.read(mounted())))
      let because = offBecause(table)
      while (because !== null) {
        engineChange = yield* Deferred.make<void>()
        mine?.cells.engines.set(table.map(choiceOf))
        yield* Effect.annotateLogs(Effect.logInfo(whyNoAgent(because)), {
          duration: Math.round(Duration.toMillis(discoveryDuration)) + "ms",
        })
        yield* Deferred.await(engineChange)
        const next = yield* Effect.timed(Effect.sync(() => detect.read(mounted())))
        discoveryDuration = next[0]
        table = next[1]
        because = offBecause(table)
      }
      engineChange = null
      const installed = here(table)

      const absent = table.flatMap((row) => row.standing === "not-here" ? [`${row.id}: ${row.missing.why}`] : [])
      const missing = absent.length === 0 ? {} : { missing: absent.join("; ") }
      yield* Effect.annotateLogs(Effect.logInfo("chat agents detected"), {
        agents: installed.map((row) => row.id).join(", "),
        ...missing,
        duration: Math.round(Duration.toMillis(discoveryDuration)) + "ms",
      })

      chat = yield* Chat.make({
        onConversationClosed: state => {
          const who = whoOf(state)
          if (who === null) return
          turns.delete(JSON.stringify([who.agent, who.session]))
          for (const key of deliveredIds) {
            const [agent, session] = JSON.parse(key) as [string, string, string]
            if (agent === who.agent && session === who.session) deliveredIds.delete(key)
          }
        },
        roster: () => detect.read(mounted()),
        cwd: vault.served,
        tools: () => address,
        advertised: tools.advertised,
        probes: () =>
          Effect.sync(() =>
            inBundleOrder(asking, (one) => one.who, bundle.rank).map((one) => ({
              name: one.who,
              ask: one.ask,
            }))
          ),
        models: modelsIn(localState),
        scoping: yield* scopesIn(localState),
        wake: (plugin) => wakes.current().get(plugin),
        overheard: yield* sessionsIn(localState),
        live: liveIn(localState),
        agentAt: (to) => nodeAgents.agentAt(to),
        remindEvery: settings["remind-every"],
        nodeAt: (node) => nodeAgents.nodeAt(node),
        seatableAt: (node) => nodeAgents.seatableAt(node),
        nodes: () => nodeAgents.nodes(),
        nearestAt: (node, candidates) => nodeAgents.nearestAt(node, candidates),
        ticket: (node) =>
          tools.ticket({
            forbidden: () => [
              ...nodeAgents.keys().map((key) => ({ key, says: SEATS })),
              ...nodeAgents.sleptKeys().map((key) => ({ key, says: MEMO })),
              ...nodeAgents.sleepKeys().map((key) => ({ key, says: SLEEPING_MARK })),
              ...nodeAgents.opensKeys().map((key) => ({ key, says: OPENS })),
            ],
            writer: "chat-agent",
            confined: () => chat?.live().get(node)?.sleep === true
              ? {
                under: node,
                says: "olai is tidying this node's knowledge base, and a turn nobody is watching writes only inside it",
                stop: othersOf(nodeAgents.nodes(), node),
              }
              : null,
          }),
        onState: () => {},
        onConversationState: publishState,
        ...(nodeIdle === undefined ? {} : { idle: nodeIdle }),
        onTranscript: () => {},
        onConversationTranscript: publishTranscript,
        onLive: republishAgents,
        fork: ring.held,
      })
      mine?.cells.engines.set(detect.read(mounted()).map(choiceOf))
      yield* Deferred.succeed(ready, chat)
      yield* Effect.addFinalizer(() => chat === null ? Effect.void : chat.stop)
      yield* chat.start
      const serving = chat
      if (sleeping) {
        sleeper = yield* makeSleeper({
          nodes: () => nodeAgents.nodes().filter((one) => one.kind === "node"),
          reading: () => nodeAgents.reading(),
          sleptAt: (node) => nodeAgents.sleptAt(node),
          sleptKey: () => nodeAgents.sleptKey(),
          sleeps: (node) => nodeAgents.sleeps(node),
          changed: Effect.sync(() => republishAgents()),
          live: () => serving.live(),
          deliver: (to, say) => serving.doorFor(SLEEP_WORD).deliver(to, say, { sleep: true }),
          watch: (to, observer) =>
            Effect.flatMap(serving.reading(to, observer), (panel) => panel === null
              ? Effect.fail(new UsageFailure({ reason: "the conversation changed; nothing to watch" }))
              : Effect.succeed({ cancel: panel.cancel })),
          withdraw: (to) => serving.withdraw(SLEEP_WORD, to),
          read: gate.read,
          write: (request) => gate.run(request, "sleep"),
          waiting: gate.waiting,
          commit: (message, paths) => Effect.map(gate.commit({ message, paths }, "sleep"), (result) => {
            switch (result._tag) {
              case "Committed":
                return null
              case "Blocked":
                return { said: "olai is not committing here, so the memo is on disk and waiting", failed: false }
              case "NothingToCommit":
                return { said: "nothing of the subtree's was waiting to be recorded", failed: false }
              case "Failed":
                return { said: result.said, failed: true }
            }
          }),
          hold: gate.hold,
          after: spans.after,
          floor: spans.floor,
          latest: spans.latest,
          tick: spans.tick,
          question: spans.question,
          limit: spans.limit,
          start: START,
          log: (line) => Effect.logInfo(line),
          warn: (line) => Effect.logWarning(line),
        })
        yield* Effect.addFinalizer(() => Effect.sync(() => { sleeper = null }))
      }
      yield* Effect.annotateLogs(Effect.logDebug("chat agent commands"), {
        agents: installed.map((row) => `${row.id}=${row.adapter.command}`).join(" "),
        ...missing,
        mcp: address.url,
      })
    }))

  }),
})

export { slotContracts as slots } from "./slots.ts"

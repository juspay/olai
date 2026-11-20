import type { Advertised, ToolServer } from "@olai/plugin-api/services"

import { type Attached, type AttachChunk, CHAT_OFF, type ChatEntry, type ChatState, type Wake, type NodeContext, type Listed, type Talking } from "olai-plugin-chat/wire"
import type { PlanStep } from "@kolu/acp/wire"

import { type OpFailure } from "@olai/format"
import { type AskAnswer } from "@kolu/acp/wire"
import { BusyFailure, type NodeAgent, UsageFailure } from "@olai/format"
import { emitter } from "@olai/log"
import { Effect, Fiber, References, Semaphore } from "effect"

import * as AcpAgent from "@kolu/acp-client"
import {
  type Change,
  type Harness,
  type HarnessChange,
  type HarnessOptions,
  HarnessRefused,
  type HarnessState,
  HarnessUnavailable,
  holding,
  type HttpServer,
  joined,
  type Opening,
  type RowHead,
  says,
  startHarness,
  type TurnEnded,
} from "@kolu/acp-harness"
import type { Conversing, Overheard, Sessions } from "./sessions.ts"
import { choiceOf, here, offBecause, type Installed, type Roster } from "./agents/roster.ts"
import * as Attachments from "./attachments.ts"
import * as Context from "./context.ts"
import type { Stored } from "@kolu/acp-client"
import { lastSaid } from "./heard.ts"
import type { Json } from "./json.ts"
import * as Listings from "./listings.ts"
import type { Models } from "@kolu/acp-client"
import { annotated } from "./prompt.ts"
import type { Probe } from "@kolu/acp-client"
import type { Scoped, Scopes } from "./scopes.ts"
import { succeeded } from "./succession.ts"
import { remindingFor, teachingFor } from "./teaching.ts"
import { sameWatching, watching } from "./watching.ts"

export interface WakeScope {
  readonly current: () => boolean
  readonly agent: string
  readonly session: string
  readonly pick: import("./json.ts").Json
}

export interface Addressed {
  readonly agent: string
  readonly session: string
}

export const SLOTS = 32

const CONVERSATIONS = 32

export interface PanelOptions {
  readonly runningSessions?: (agent: string) => Effect.Effect<ReadonlyArray<Stored>, AcpAgent.AgentGone> | null
  readonly roster: () => Roster
  readonly cwd: string
  readonly models?: Models
  readonly memory: AcpAgent.Memory
  readonly tools: () => ToolServer | null
  readonly advertised?: (server: string, tool: string) => Advertised | null
  readonly probes?: () => Effect.Effect<ReadonlyArray<Probe>>
  readonly scoping?: Scopes | null
  readonly overheard?: Sessions | null
  readonly agentAt?: (to: Conversing) => NodeAgent | null
  readonly remindEvery?: number
  readonly onState: (state: ChatState) => void
  readonly onTranscript: (change: Change<ChatEntry>) => void
}

export interface Panel {
  readonly entries: () => ReadonlyMap<string, ChatEntry>
  readonly state: () => ChatState
  readonly enginesMoved: Effect.Effect<void>
  readonly overheard: () => ReadonlyArray<Overheard>
  readonly replaced: (to: Conversing, by: Conversing) => Effect.Effect<void>
  readonly reread: () => void
  readonly send: (
    text: string,
    attachments: ReadonlyArray<string>,
    context: ReadonlyArray<NodeContext>,
    steer?: boolean,
    preamble?: ReadonlyArray<string>,
  ) => Effect.Effect<void, OpFailure>
  readonly attach: (
    chunk: AttachChunk,
  ) => Effect.Effect<Attached, OpFailure>
  readonly resend: (id: string) => Effect.Effect<void, OpFailure>
  readonly signIn: (method: string | null) => Effect.Effect<void, OpFailure>
  readonly signInInput: (text: string) => Effect.Effect<void, OpFailure>
  readonly signInCancel: Effect.Effect<void, OpFailure>
  readonly setSetting: (agent: string, session: string, config: string, value: string | boolean) => Effect.Effect<void, OpFailure>
  readonly setModel: (agent: string, session: string, value: string) => Effect.Effect<void, OpFailure>
  readonly seen: (to: Conversing, at: string) => Effect.Effect<void, OpFailure>
  readonly cancel: Effect.Effect<void, OpFailure>
  readonly newSession: (agent: string, completed?: Effect.Effect<void, OpFailure>) => Effect.Effect<void, OpFailure>
  readonly chooseAgent: (agent: string) => Effect.Effect<void, OpFailure>
  readonly loadSession: (agent: string, id: string) => Effect.Effect<void, OpFailure>
  readonly reopen: Effect.Effect<void, OpFailure>
  readonly liveSessions: (agent: string) => Effect.Effect<ReadonlyArray<Stored>, AcpAgent.AgentGone> | null
  readonly sessions: Effect.Effect<Listed>
  readonly answer: (
    id: string,
    answers: ReadonlyArray<AskAnswer> | null,
  ) => Effect.Effect<void, OpFailure>
  readonly doorFor: (plugin: string) => {
    readonly scopes: () => ReadonlyArray<WakeScope>

    readonly deliver: (
      to: { readonly agent: string; readonly session: string; readonly current?: () => boolean },
      say: () => string | null,
      options?: {
        readonly coalesce?: string
        readonly sleep?: true
      },
    ) => Effect.Effect<void>
    readonly withdraw: (to: Addressed) => Effect.Effect<void>
  }
  readonly scope: (
    to: { readonly agent: string; readonly session: string },
    plugin: string,
    pick: import("./json.ts").Json,
  ) => Effect.Effect<ReadonlyArray<Scoped>, OpFailure>
  readonly refreshWakes: (left: ReadonlyArray<Scoped>) => void
  readonly recordRefusal: (
    tool: string,
    failure: OpFailure,
  ) => Effect.Effect<void>
  readonly start: Effect.Effect<void>
  readonly stop: Effect.Effect<void>
  readonly stopWithReason: (reason: AcpAgent.StopReason) => Effect.Effect<void>
}

const sameWake = (
  a: ReadonlyArray<Wake>,
  b: ReadonlyArray<Wake>,
): boolean =>
  a.length === b.length
  && a.every((row, at) => {
    const was = b[at]
    return was !== undefined
      && row.name === was.name
      && JSON.stringify(row.pick) === JSON.stringify(was.pick)
      && row.waiting === was.waiting

  })
const CANCEL_GRACE = "5 seconds"

interface Bound {
  readonly row: Installed
  readonly harness: Harness<ChatEntry>
}

interface Teaching {
  readonly to: Addressed
  readonly lines: ReadonlyArray<string>
  readonly taught: boolean
}

const silence = (agent: string): string =>
  `${agent} ended the turn without saying anything. That is what an agent that ` +
  `cannot reach a model looks like from here — check that it is signed in and ` +
  `that its provider key is set in the environment olai itself runs in, then ` +
  `send again.`

const noting = (
  write: Effect.Effect<void, AcpAgent.MemoryFailure> | undefined,
  why: (failure: AcpAgent.MemoryFailure) => string,
): Effect.Effect<void> =>
  write === undefined ? Effect.void : Effect.gen(function*() {
    const done = yield* Effect.result(write)
    if (done._tag === "Failure") yield* Effect.logWarning(why(done.failure))
  })

const tookLost = (teach: Teaching, failure: AcpAgent.MemoryFailure): string =>
  teach.taught
    ? `a node agent was taught its contract and it could not be written down ` +
      `(${failure.why}) — the next message in this session will say it again`
    : `a node agent's message could not be counted (${failure.why}) — ` +
      `its writing rule is reminded one message later than it would have been`

const replaceLost = (failure: AcpAgent.MemoryFailure): string =>
  `a node agent was given a fresh session and what it replaced could not be written down ` +
  `(${failure.why}) — the new session is bound, and the old one comes back as a chat ` +
  `no node claims`

const OURS = "olai:"

const remembranceLost = (failure: AcpAgent.MemoryFailure): string =>
  `which conversation this directory was in could not be written down (${failure.why}) — ` +
  `a restart opens whichever one this agent has most recently`

export const makePanel = (options: PanelOptions): Effect.Effect<Panel, never, never> =>
  Effect.gen(function*() {
    const memory = options.memory
    const tell = yield* Effect.annotateLogs(emitter, { surface: "chat" })

    const ownServers = (): ReadonlyArray<HttpServer> => {
      const own = options.tools()
      return own === null ? [] : [{
        kind: "http" as const,
        name: own.name,
        url: own.url,
        headers: { Authorization: `Bearer ${own.token}` },
      }]
    }

    const logContext = yield* Effect.service(References.CurrentLogAnnotations)
    const probeFor = (row: Installed) =>
      AcpAgent.make({
        id: row.id,
        leg: row.leg,
        command: row.adapter.command,
        args: row.adapter.args,
        env: row.adapter.env,
        unset: row.adapter.unset,
        cwd: options.cwd,
        tools: ownServers,
        probes: options.probes,
        advertised: options.advertised,
        memory,
        models: options.models,
        onEvent: () => {},
      }).pipe(Effect.annotateLogs({ ...logContext, purpose: "session list" }))

    const rows = new Map<string, ChatEntry>()
    const files = Attachments.make()

    const bound = (row: Installed): Talking => ({
      kind: "agent",
      id: row.id,
      name: row.name,
      queues: conversation?.queues ?? false,
      steers: conversation?.steers ?? false,
      methods: conversation?.methods ?? [],
    })

    let state: ChatState = {
      ...CHAT_OFF,
      uploadScope: files.scope(),
      status: "idle",
      talking: { kind: "asking" },
      roster: options.roster().map(choiceOf),
    }
    let talking: Bound | null = null
    let closing = false
    let conversation: HarnessState | null = null
    const held = holding<Addressed, { readonly say: () => string | null; readonly sleep: boolean }>({
      keyOf: (to) => JSON.stringify([to.agent, to.session]),
      slots: SLOTS,
      conversations: CONVERSATIONS,
    })
    const switchingSession = yield* Semaphore.make(1)
    const bindingAgent = yield* Semaphore.make(1)
    const startingTurn = yield* Semaphore.make(1)
    const usingConversation = yield* Semaphore.make(1)
    let heard = 0

    const publish = (change: Change<ChatEntry>) => {
      if (!says(change)) return
      if (!replaying) {
        options.onTranscript(change)
        return
      }
      if (change.removes.length > 0) {
        options.onTranscript({ upserts: [], removes: change.removes, appends: [] })
      }
    }

    const fold = (change: Change<ChatEntry>): void => {
      const theirs = [...rows.keys()].filter((id) => !id.startsWith(OURS))
      const wipe = change.removes.length > 0
        && theirs.length > 0
        && theirs.every((id) => change.removes.includes(id))
      const removes = wipe
        ? [...change.removes, ...[...rows.keys()].filter((id) => id.startsWith(OURS))]
        : change.removes
      for (const row of change.upserts) rows.set(row.id, row)
      for (const id of removes) rows.delete(id)
      for (const piece of change.appends) {
        const row = rows.get(piece.of)
        if (row === undefined) continue
        rows.set(piece.of, {
          ...row,
          text: `${row.text.slice(0, piece.at)}${piece.text}`,
        })
      }
      publish(wipe ? { ...change, removes } : change)
    }

    let minted = 0

    const ours = (
      content:
        | { readonly kind: "notice"; readonly text: string }
        | { readonly kind: "refusal"; readonly text: string; readonly refusal: OpFailure },
    ): void => {
      minted += 1
      let last = -1
      for (const row of rows.values()) last = Math.max(last, row.seq)
      fold({
        upserts: [{ ...content, id: `${OURS}${minted}`, seq: last + 1, since: new Date().toISOString() }],
        removes: [],
        appends: [],
      })
    }

    let replaying = false
    const replayed = <E>(open: Effect.Effect<void, E>) =>
      Effect.gen(function*() {
        replaying = true
        const before = new Set(rows.keys())
        const outcome = yield* Effect.result(open)
        if (outcome._tag === "Failure") {
          for (const [id, row] of [...rows]) {
            if (!before.has(id) && row.kind !== "notice") rows.delete(id)
          }
          replaying = false
        } else {
          replaying = false
          publish({ upserts: [...rows.values()], removes: [], appends: [] })
        }
        return outcome
      })

    const move = (next: Partial<ChatState>) => {
      state = { ...state, ...next, uploadScope: files.scope() }
      options.onState(state)
    }

    const watched = (): void => {
      const out = watching(rows)
      if (!sameWatching(out, state.watching)) move({ watching: out })
    }

    const conversationOf = (): Addressed | null => {
      const at = talking
      const open = conversation?.sessionId ?? null
      return at === null || open === null ? null : { agent: at.row.id, session: open }
    }

    const boundTo = (
      to: Addressed | null = conversationOf(),
    ): string | null => (to === null ? null : options.agentAt?.(to)?.id ?? null)

    const teaching = (preamble: ReadonlyArray<string> = []): Teaching | null => {
      const to = conversationOf()
      const overheard = options.overheard
      if (to === null || overheard === undefined || overheard === null) return null
      const node = options.agentAt?.(to) ?? null
      if (node === null) return null
      const row = overheard.at(to)
      const teaches = row?.taught !== true
      const every = options.remindEvery ?? 0
      const reminds = !teaches && every > 0 && ((row?.taken ?? 0) + 1) % every === 0
      const lines = teaches
        ? [...teachingFor(node), ...preamble]
        : reminds ? remindingFor(node) : []
      if (talking === null) return null
      switch (talking.row.prompt.kind) {
        case "first-turn":
          return { to, lines, taught: teaches }
      }
    }

    const contracted = (teach: Teaching, key: string): Effect.Effect<void> =>
      Effect.gen(function*() {
        const overheard = options.overheard
        if (overheard === undefined || overheard === null) return
        const row = rows.get(key)
        if (row === undefined || row.kind !== "user" || row.delivery !== undefined) return
        const done = yield* Effect.result(overheard.took(teach.to, teach.taught))
        if (done._tag === "Failure") {
          yield* Effect.logWarning(tookLost(teach, done.failure))
          return
        }
        if (teach.lines.length === 0) return
        const after = rows.get(key)
        if (after === undefined || after.kind !== "user" || after.delivery !== undefined) return
        ours({ kind: "notice", text: teach.lines.join("\n") })
      })

    const saidHere = (): Effect.Effect<void> =>
      Effect.gen(function*() {
        const to = conversationOf()
        const overheard = options.overheard
        if (to === null || overheard === undefined || overheard === null) return
        if (options.agentAt?.(to) == null) return
        const said = lastSaid(rows)
        if (said === null) return
        const done = yield* Effect.result(overheard.said(to, said))
        if (done._tag === "Failure") {
          yield* Effect.logWarning(
            `what a node agent last said could not be written down ` +
              `(${done.failure.why}) — its door draws the line before this one`,
          )
          return
        }
        move({})
      })

    const wakeOf = (
      to: Addressed | null = conversationOf(),
    ): ChatState["wake"] => {
      if (to === null) return []
      const counted = held.counts(to)
      return (options.scoping?.rows() ?? [])
        .filter((row) => row.agent === to.agent && row.session === to.session)
        .map((row) => ({
          name: row.plugin,
          pick: row.pick,
          waiting: counted.get(row.plugin) ?? 0,

        }))
    }

    let planAt: string | null = null

    let sleepTurn: string | null = null

    const facing = (now: HarnessState): ChatState["status"] =>
      now.phase === "offline"
        ? now.refusal !== null && talking?.harness.alive() === true
          ? "idle"
          : "gone"
        : now.phase === "starting"
        ? "booting"
        : now.phase === "idle"
        ? "idle"
        : "thinking"

    const choices = (now: HarnessState): ChatState["models"] =>
      now.options.find((one) => one.kind === "model")?.choices
        .map((one) => ({ value: one.value, name: one.label })) ?? []

    let dismissed = false

    const signingIn = (now: HarnessState): ChatState["signIn"] => {
      const attempt = now.signIn?.attempt ?? null
      if (now.signIn === null) return null
      if (attempt === null) return dismissed ? null : { kind: "choosing" }
      const label = now.methods.find((one) => one.id === attempt.method)?.name ?? attempt.method
      return attempt.link !== null
        ? {
          kind: "agent",
          method: attempt.method,
          label,
          link: attempt.link,
          why: attempt.state === "failed" ? attempt.output : null,
        }
        : {
          kind: "terminal",
          method: attempt.method,
          label,
          output: attempt.output,
          running: attempt.state === "running",
          code: attempt.code,
          why: null,
        }
    }

    let reported: string | null = null

    const projecting = (): void => {
      const now = conversation
      const at = talking
      if (now === null || at === null) return
      const to = conversationOf()
      const entered = to !== null && to.session !== reported
      reported = to === null ? null : to.session
      if (entered) dismissed = false
      move({
        ...(entered ? { unopened: null, trouble: null } : {}),
        ...(state.status === "off" ? {} : { status: facing(now) }),
        talking: bound(at.row),
        session: to === null ? null : { id: to.session, title: now.title, updatedAt: null },
        bound: boundTo(to),
        wake: wakeOf(to),
        model: now.model === null ? null : now.model.name,
        models: choices(now),
        settings: now.options,
        commands: now.commands,
        servers: now.servers,
        usage: now.usage,
        identity: now.identity,
        asking: now.openAsks.length,
        signIn: signingIn(now),
        ...(now.busySince === null ? {} : { cancelled: false }),
      })
    }

    const onChange = (change: HarnessChange<ChatEntry>): void => {
      heard++
      if (change.kind === "state") {
        conversation = change.state
        projecting()
        return
      }
      if (change.kind === "turn") {
        ended(change)
        return
      }
      const upserts: Array<ChatEntry> = []
      let plan: ReadonlyArray<PlanStep> | null = null
      for (const row of change.upserts as ReadonlyArray<ChatEntry | (RowHead & { kind: "plan"; steps: ReadonlyArray<PlanStep> })>) {
        if (row.kind === "plan") {
          planAt = row.id
          plan = row.steps
          continue
        }
        upserts.push(row)
      }
      const removes = change.removes.filter((id) => id !== planAt)
      if (planAt !== null && removes.length !== change.removes.length) {
        planAt = null
        plan = []
      }
      fold({ upserts, removes, appends: change.appends })
      if (plan !== null) move({ plan })
      if (upserts.length === 0 && removes.length === 0) return
      watched()
    }
    const rowFor = (id: string): Installed | null =>
      here(options.roster()).find((row) => row.id === id) ?? null

    const logging = (
      at: (message: string) => Effect.Effect<void>,
      about: unknown,
      said?: string,
    ): Effect.Effect<void> =>
      said === undefined
        ? at(String(about))
        : Effect.annotateLogs(
          at(said),
          typeof about === "object" && about !== null ? about as Record<string, unknown> : {},
        )

    const harnessLog = {
      info: (about: unknown, said?: string) => tell(logging(Effect.logInfo, about, said)),
      warn: (about: unknown, said?: string) => tell(logging(Effect.logWarning, about, said)),
      error: (about: unknown, said?: string) => tell(logging(Effect.logError, about, said)),
    }

    const alongside = (work: Effect.Effect<void>): void => tell(aside(work))

    const readCall: HarnessOptions<ChatEntry>["readCall"] = (frame, held) => {
      if (frame.terminals !== undefined) return { extra: { terminals: frame.terminals } }
      const owned = frame.mcp.map((one) => options.advertised?.(one.server, one.tool) ?? null)
      const ours = owned.length > 0 && owned.every((one) => one !== null)
        ? {
          title: [...new Set(owned.map((one) => one!.title))].join(" · "),
          owner: new Set(owned.map((one) => one!.owner)).size === 1 ? owned[0]!.owner : undefined,
        }
        : null
      const reply = ours === null || frame.mcp.length !== 1 ? undefined : frame.answer as Json
      const named = frame.called === undefined ? {} : { untilNamed: { called: frame.called } }
      const asking = frame.asksThroughForm === true ? { asksThroughForm: true as const } : undefined
      if (ours === null) {
        return asking === undefined && frame.called === undefined
          ? undefined
          : { ...(asking === undefined ? {} : { extra: asking }), ...named }
      }
      const asked = frame.input === undefined || frame.input === null
        ? held?.detail
        : JSON.stringify(frame.input, null, 2)
      return {
        extra: {
          text: ours.title,
          ...(ours.owner === undefined ? {} : { row: ours.owner }),
          ...(reply === undefined ? {} : { reply }),
          ...(asked === undefined ? {} : { detail: asked }),
          ...asking,
        },
        ...named,
      }
    }

    const remembering = (): Effect.Effect<void, AcpAgent.MemoryFailure> | undefined => {
      const at = talking
      const now = conversation
      if (at === null || now === null || now.sessionId === null) return undefined
      return memory.remember({
        agent: at.row.id,
        session: now.sessionId,
        model: now.model?.id ?? null,
      })
    }

    const ended = (turn: TurnEnded): void => {
      const at = talking
      let outcome: Partial<ChatState> = {}
      if (turn.outcome === "cancelled") {
        outcome = { cancelled: true, trouble: null }
      } else if (turn.outcome === "ended" && turn.silent && at !== null) {
        const why = silence(at.row.name)
        ours({ kind: "notice", text: why })
        outcome = { trouble: why }
      } else if (turn.outcome === "ended") {
        outcome = { trouble: null }
      } else if (turn.why !== null) {
        outcome = { trouble: turn.why }
      }
      if (sleepTurn === turn.row) {
        sleepTurn = null
        outcome = { ...outcome, sleep: false }
      }
      move(outcome)
      alongside(saidHere())
      alongside(flushing)
    }
    const left = (): void => {
      publish({ upserts: [], removes: [...rows.keys()], appends: [] })
      rows.clear()
      planAt = null
      move({
        session: null,
        settings: [],
        plan: [],
        bound: null,
        commands: [],
        asking: 0,
        watching: [],
        servers: [],
        usage: null,
        wake: wakeOf(null),
        signIn: null,
        identity: null,
      })
    }

    const unbind = (at: Bound, why: AcpAgent.StopReason): Effect.Effect<void> =>
      Effect.gen(function*() {
        listings.forget(at.row.id)
        talking = null
        conversation = null
        left()
        yield* Effect.promise(() => at.harness.stop(why))
      })

    const SIGNED_IN_FROM = "the environment olai itself runs in"

    const using = (
      row: Installed,
      opens: Opening,
    ): Effect.Effect<void, HarnessRefused | HarnessUnavailable> =>
      bindingAgent.withPermit(Effect.gen(function*() {
        if (closing) {
          return yield* Effect.fail(new HarnessUnavailable("the server is shutting down"))
        }
        attempting = opens.kind === "resume" ? opens.id : null
        const already = talking
        if (already !== null && already.row.id === row.id && already.harness.alive()) {
          listings.forget(already.row.id)
          opened()
          switch (opens.kind) {
            case "fresh":
              yield* Effect.tryPromise({
                try: () => already.harness.newSession(),
                catch: (cause) => cause as HarnessRefused | HarnessUnavailable,
              })
              break
            case "resume":
              yield* Effect.tryPromise({
                try: () => already.harness.loadSession(opens.id),
                catch: (cause) => cause as HarnessRefused | HarnessUnavailable,
              })
              break
            case "adopt":
              break
          }
          conversation = already.harness.state()
          projecting()
          yield* noting(remembering(), remembranceLost)
          return
        }
        if (already !== null) {
          yield* unbind(already, "agent switched")
        }
        opened()
        move({
          talking: bound(row),
          model: null,
          trouble: null,
          signIn: null,
        })
        const made = yield* Effect.tryPromise({
          try: (signal) =>
            startHarness<ChatEntry>({
              leg: row.leg,
              adapter: row.adapter,
              cwd: options.cwd,
              configDir: SIGNED_IN_FROM,
              mcpServers: ownServers(),
              probes: options.probes,
              teaching: "",
              taught: true,
              log: harnessLog,
              opens,
              agent: row.id,
              ...(options.models === undefined ? {} : { models: options.models }),
              readCall,
              whenNewSession: "clear",
              numbering: "restarts",
              whenLoadRefused: "report",
              whenReplayed: "keep",
              abandonWhen: { signal, reason: "scope released" },
              onChange,
            }),
          catch: (cause) => cause as HarnessRefused | HarnessUnavailable,
        })
        talking = { row, harness: made }
        conversation = made.state()
        projecting()
        if (conversation.refusal !== null) {
          return yield* Effect.fail(
            new HarnessRefused(conversation.refusal, "signed-out", false),
          )
        }
        yield* noting(remembering(), remembranceLost)
      }))

    const enginesMoved: Effect.Effect<void> = bindingAgent.withPermit(Effect.gen(function*() {
      const roster = options.roster()
      const startable = here(roster)
      const at = talking
      const orphaned = at !== null && !startable.some((row) => row.id === at.row.id)
      if (at !== null && orphaned) {
        yield* unbind(at, "plugin disabled")
      }
      const because = offBecause(roster)
      if (because !== null) {
        move({
          roster: roster.map(choiceOf),
          status: "off",
          off: because,
          talking: null,
          model: null,
          trouble: null,
        })
        return
      }
      move({
        roster: roster.map(choiceOf),
        ...(state.status === "off"
          ? { status: "idle" as const, off: null, talking: { kind: "asking" as const } }
          : {}),
        ...(orphaned
          ? {
            status: "gone" as const,
            talking: null,
            model: null,
            trouble: at === null
              ? null
              : `${at.row.name} was switched off at the plugins panel, so this `
                + `conversation ended. Turning it back on lets you start another.`,
          }
          : {}),
      })
    }))

    const withRow = <A>(
      id: string,
      use: (row: Installed) => Effect.Effect<A, OpFailure>,
    ): Effect.Effect<A, OpFailure> =>
      Effect.suspend(() => {
        const row = rowFor(id)
        return row === null
          ? Effect.fail(
            new UsageFailure({
              reason: `there is no agent called \`${id}\` on this machine`,
            }),
          )
          : use(row)
      })

    const startsWith: Effect.Effect<Installed | null> = Effect.gen(function*() {
      const rows = here(options.roster())
      const only = rows.length === 1 ? rows[0] ?? null : null
      if (only !== null) return only
      const held = yield* Effect.catchTag(
        memory.recall,
        "MemoryFailure",
        (failure) =>
          Effect.sync(() => {
            ours({
              kind: "notice",
              text: `the agent this directory was last talking to could not be read (${failure.why}) — ` +
                `asking which one to use instead`,
            })
            return null
          }),
      )
      return held === null ? null : rowFor(held.agent)
    })

    const settled = (): void => {
      move({ status: conversation?.phase === "working" || conversation?.phase === "asking" ? "thinking" : "idle" })
    }

    const openWith = (
      id: string,
      opens: Opening,
      completed?: Effect.Effect<void, OpFailure>,
    ): Effect.Effect<void, OpFailure> =>
      withRow(id, (row) => changeSession(using(row, opens), completed))

    const storedIn = (harness: Harness<ChatEntry>): Effect.Effect<ReadonlyArray<Stored>, AcpAgent.AgentGone> =>
      Effect.tryPromise({
        try: () => harness.sessions(),
        catch: (cause) =>
          new AcpAgent.AgentGone({
            gone: "unreachable",
            why: cause instanceof Error ? cause.message : String(cause),
          }),
      })

    const listings = yield* Listings.make({
      roster: () => here(options.roster()),
      running: (row) => {
        const at = talking
        return at !== null && at.row.id === row.id
          ? storedIn(at.harness)
          : options.runningSessions?.(row.id) ?? null
      },
      aside: (row) =>
        bindingAgent.withPermit(Effect.gen(function*() {
          if (closing) {
            return yield* new AcpAgent.AgentGone({
              gone: "unreachable",
              why: "the server is shutting down",
            })
          }
          const at = talking
          if (at !== null && at.row.id === row.id) {
            return { stored: yield* storedIn(at.harness), keep: false }
          }
          const borrowed = options.runningSessions?.(row.id)
          if (borrowed != null) return { stored: yield* borrowed, keep: false }
          const probe = yield* probeFor(row)
          const stored = yield* Effect.ensuring(probe.sessions, probe.stopWithReason("session list complete"))
          return { stored, keep: true }
        })),
      now: () => Date.now(),
    })

    const onConversation = <A>(
      use: (harness: Harness<ChatEntry>) => Promise<A>,
    ): Effect.Effect<A, OpFailure> =>
      Effect.suspend(() => {
        const at = talking
        return at === null
          ? Effect.fail(
            new UsageFailure({
              reason: "no agent has been chosen for this chat yet — pick one to start",
            }),
          )
          : Effect.tryPromise({
            try: () => use(at.harness),
            catch: (cause) => asFailure(cause),
          })
      })

    const asFailure = (cause: unknown): OpFailure =>
      cause instanceof HarnessRefused
        ? new UsageFailure({ reason: cause.why })
        : new BusyFailure({
          reason: cause instanceof Error ? cause.message : String(cause),
        })
    const outgoing = new Map<string, string>()

    const send = (
      text: string,
      attachments: ReadonlyArray<string>,
      context: ReadonlyArray<NodeContext>,
      steer = false,
      preamble: ReadonlyArray<string> = [],
    ): Effect.Effect<void, OpFailure> =>
      Effect.gen(function*() {
        const said = text.trim()
        if (said === "" && attachments.length === 0 && context.length === 0) {
          return yield* new UsageFailure({ reason: "there is nothing to send" })
        }
        yield* Effect.forEach(attachments, files.claim, { concurrency: "unbounded" })

        yield* usingConversation.withPermit(Effect.gen(function*() {
          const at = talking
          if (at === null) {
            return yield* new UsageFailure({
              reason: "no agent has been chosen for this chat yet — pick one to start",
            })
          }
          const teach = teaching(preamble)
          const body = Attachments.promptWith(
            Context.promptWith(annotated(said, teach?.lines ?? []), context),
            attachments,
          )
          const sent = yield* startingTurn.withPermit(Effect.tryPromise({
            try: () =>
              at.harness.prompt({
                text: said,
                body,
                extra: {
                  ...(attachments.length === 0
                    ? {}
                    : { attachments: attachments.map(Attachments.nameOf) }),
                  ...(context.length === 0 ? {} : { context }),
                },
                files: [],
              }, steer),
            catch: (cause) => asFailure(cause),
          }))
          outgoing.set(sent.rowId, body)
          if (teach !== null) yield* contracted(teach, sent.rowId)
        }))
      })
    const offer = (
      to: Addressed,
      say: () => string | null,
      from: string,
      sleep: boolean,
    ): Effect.Effect<"handed" | "held" | "nothing"> =>
      usingConversation.withPermit(Effect.gen(function*() {
        const at = talking
        const now = at === null ? null : at.harness.state()
        if (
          at === null || now === null || now.sessionId === null
          || at.row.id !== to.agent || now.sessionId !== to.session
        ) return "held"
        return yield* startingTurn.withPermit(Effect.gen(function*() {
          if (at.harness.state().busySince !== null) return "held" as const
          const body = say()
          if (body === null) return "nothing" as const
          if (sleep) move({ sleep: true })
          const started = yield* Effect.result(Effect.tryPromise({
            try: () => at.harness.hostTurn({ kind: "user", text: body, rang: from }, body),
            catch: (cause) => asFailure(cause),
          }))
          if (started._tag === "Failure") {
            if (sleep) move({ sleep: false })
            return "held" as const
          }
          outgoing.set(started.success.rowId, body)
          if (sleep) sleepTurn = started.success.rowId
          return "handed" as const
        }))
      }))

    const flush = (to: Addressed): Effect.Effect<void> =>
      Effect.gen(function*() {
        for (;;) {
          const waiting = held.waiting(to)
          const oldest = waiting[0]
          if (oldest === undefined) return
          const batch = waiting.filter((slot) => slot.from === oldest.from)
          const arm = yield* offer(to, () => joined(batch, (body) => body.say()), oldest.from, oldest.value.sleep)
          if (arm === "held") return
          held.took(to, batch)
          move({ wake: wakeOf() })
          if (arm === "handed") return
        }
      })

    const flushing: Effect.Effect<void> = Effect.suspend(() => {
      const to = conversationOf()
      return to === null ? Effect.void : flush(to)
    })

    const deliverTo = (
      to: Addressed,
      say: () => string | null,
      from: string,
      how?: { readonly coalesce?: string; readonly sleep?: true },
    ): Effect.Effect<void> =>
      Effect.gen(function*() {
        held.hold(to, from, { say, sleep: how?.sleep === true }, how?.coalesce)
        const here = conversationOf()
        if (here !== null && here.agent === to.agent && here.session === to.session) {
          move({ wake: wakeOf() })
        }
        yield* flush(to)
      })

    const cancel: Effect.Effect<void, OpFailure> = Effect.gen(function*() {
      const running = conversation?.busySince != null
      yield* onConversation((harness) => harness.cancel())
      if (!running) return
      const quietSince = heard
      yield* aside(Effect.gen(function*() {
        yield* Effect.sleep(CANCEL_GRACE)
        if (conversation?.busySince == null) return
        if (heard !== quietSince) return
        move({
          trouble:
            "the agent was asked to stop and has said nothing since — the turn below is still running",
        })
      }))
    })

    const resend = (id: string): Effect.Effect<void, OpFailure> =>
      usingConversation.withPermit(Effect.gen(function*() {
        const prompt = yield* startingTurn.withPermit(Effect.sync(() => {
          const waiting = outgoing.get(id)
          if (waiting !== undefined) outgoing.delete(id)
          return waiting ?? null
        }))
        if (prompt === null) {
          return yield* new UsageFailure({
            reason: "that message is not waiting to be sent — it went, or its conversation did",
          })
        }
        const went = yield* Effect.result(
          onConversation((harness) => harness.sendAgain(id, prompt, [])),
        )
        if (went._tag === "Failure") {
          outgoing.set(id, prompt)
          return yield* Effect.fail(went.failure)
        }
      }))

    let unopened: { readonly again: Effect.Effect<void, HarnessRefused | HarnessUnavailable>; readonly completed?: Effect.Effect<void, OpFailure> } | null = null

    let attempting: string | null = null
    const askingToSignIn = (cause: HarnessRefused): boolean =>
      cause.signIn !== "no" && (conversation?.methods.length ?? 0) > 0

    const refusedOpen = (
      failure: HarnessRefused,
      again: Effect.Effect<void, HarnessRefused | HarnessUnavailable>,
      completed?: Effect.Effect<void, OpFailure>,
    ): void => {
      unopened = { again, completed }
      const at = talking
      const what = at === null || attempting === null
        ? null
        : { agent: at.row.id, session: attempting }
      move({
        status: "idle",
        unopened: {
          why: failure.message,
          what: attempting,
          ...(failure.missing === true ? { cause: { kind: "missing" as const } } : {}),
        },
        bound: boundTo(what),
        servers: [],
        signIn: askingToSignIn(failure) ? { kind: "choosing" } : null,
      })
      dismissed = false
    }

    const signIn = (method: string | null): Effect.Effect<void, OpFailure> =>
      Effect.suspend(() => {
        const at = talking
        if (at === null) {
          return Effect.fail(
            new UsageFailure({
              reason: "no agent has been chosen for this chat yet — pick one to start",
            }),
          )
        }
        dismissed = false
        if (method === null) {
          at.harness.askSignIn()
          projecting()
          return Effect.void
        }
        return aside(Effect.gen(function*() {
          const outcome = yield* Effect.tryPromise({
            try: () => at.harness.signIn(method),
            catch: (cause) => asFailure(cause),
          })
          if (outcome !== "signed-in") return
          yield* Effect.catch(signedIn(at), (failure) =>
            Effect.sync(() => move({ trouble: failure.reason })))
        }).pipe(Effect.catch((failure) =>
          Effect.sync(() => move({ trouble: failure.reason }))
        )))
      })
    const signedIn = (at: Bound): Effect.Effect<void, OpFailure> =>
      Effect.suspend(() => {
        const waiting = unopened
        if (waiting !== null) return changeSession(waiting.again, waiting.completed)
        const session = state.session?.id ?? state.unopened?.what ?? null
        return openWith(
          at.row.id,
          session === null ? { kind: "adopt", memory } : { kind: "resume", id: session },
        )
      })


    const signInInput = (text: string): Effect.Effect<void, OpFailure> =>
      onConversation((harness) => harness.signInInput(text))

    const signInCancel: Effect.Effect<void, OpFailure> = Effect.suspend(() => {
      const at = talking
      dismissed = true
      move({ signIn: null })
      return at === null
        ? Effect.void
        : Effect.asVoid(Effect.tryPromise({
          try: () => at.harness.signInCancel(),
          catch: (cause) => asFailure(cause),
        }))
    })

    const opened = (): void => {
      unopened = null
    }

    const wentAway = (why: string): void => {
      opened()
      move({
        status: "gone",
        trouble: why,
        unopened: null,
        servers: [],
        signIn: null,
      })
    }

    const changeSession = (
      what: Effect.Effect<void, HarnessRefused | HarnessUnavailable>,
      completed?: Effect.Effect<void, OpFailure>,
    ): Effect.Effect<void, OpFailure> =>
      switchingSession.withPermit(
        Effect.gen(function*() {
          if (conversation?.busySince != null) {
            return yield* new BusyFailure({
              reason: "a turn is running; cancel it before switching conversations",
            })
          }
          yield* files.discard
          const resting = state.unopened === null ? null : state.status
          move({ status: "booting" })
          const outcome = yield* replayed(usingConversation.withPermit(what)).pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                if (resting === null || unopened !== null || state.unopened === null) return
                unopened = { again: what, ...(completed === undefined ? {} : { completed }) }
                move({ status: resting })
              })
            ),
          )
          if (outcome._tag === "Failure") {
            if (outcome.failure instanceof HarnessRefused) {
              refusedOpen(outcome.failure, what, completed)
            } else {
              wentAway(outcome.failure.message)
            }
            return yield* Effect.fail(asFailure(outcome.failure))
          }
          if (completed !== undefined) yield* completed
          settled()
          yield* aside(flushing)
        }),
      )

    const beside = new Set<Fiber.Fiber<void, unknown>>()
    const aside = <E>(work: Effect.Effect<void, E>): Effect.Effect<void> =>
      Effect.gen(function*() {
        const running: Fiber.Fiber<void, E> = yield* Effect.forkDetach(
          Effect.ensuring(work, Effect.sync(() => { beside.delete(running) })),
        )
        beside.add(running)
      })

    const setSetting = (agent: string, session: string, config: string, value: string | boolean): Effect.Effect<void, OpFailure> => usingConversation.withPermit(startingTurn.withPermit(Effect.gen(function*() {
        if (state.status !== "idle" || talking?.row.id !== agent || state.session?.id !== session) {
          return yield* new UsageFailure({ reason: "wait for this conversation to be idle before changing its settings" })
        }
        yield* onConversation((harness) => harness.setOption(config, String(value)))
      })))

    const seen = (to: Conversing, at: string): Effect.Effect<void> => Effect.gen(function*() {
      const overheard = options.overheard
      if (overheard === undefined || overheard === null) return
      const done = yield* Effect.result(overheard.seen(to, at))
      if (done._tag === "Failure") {
        yield* Effect.logWarning(
          `what a person had read could not be written down (${done.failure.why}) — ` +
            `that conversation goes on saying it has something new`,
        )
      }
    })

    const stopWithReason = (reason: AcpAgent.StopReason) => Effect.gen(function*() {
      closing = true
      const at = talking
      talking = null
      conversation = null
      if (at !== null) yield* Effect.promise(() => at.harness.stop(reason))
      const alongside = [...beside]
      beside.clear()
      for (const fiber of alongside) yield* Fiber.interrupt(fiber)
      yield* switchingSession.withPermit(files.discard)
    })

    return {
      entries: () => rows,
      refreshWakes: (left) => {
        for (const row of left) held.dropped(row, row.plugin)
        const wake = wakeOf()
        if (!sameWake(wake, state.wake)) move({ wake })
      },
      state: () => state,
      enginesMoved,
      overheard: () => options.overheard?.rows() ?? [],
      replaced: (to, by) => Effect.gen(function*() {
        listings.forget(to.agent)
        yield* noting(options.overheard?.supersede(to, by), replaceLost)
      }),
      reread: () => {
        const now = boundTo()
        if (now !== state.bound) move({ bound: now })
      },
      send,
      attach: (chunk) => switchingSession.withPermit(files.receive(chunk)),
      resend,
      signIn,
      signInInput,
      signInCancel,
      cancel,
      setSetting,
      setModel: (agent, session, value) =>
        setSetting(agent, session, talking?.row.leg.models?.config ?? "", value),
      seen,
      newSession: (id: string, completed) => openWith(id, { kind: "fresh" }, completed),
      chooseAgent: (id: string) => openWith(id, { kind: "adopt", memory }),
      loadSession: (agentId: string, id: string) =>
        Effect.suspend(() => {
          const at = talking
          return at !== null && at.row.id === agentId && at.harness.alive()
            ? changeSession(Effect.suspend(() => {
              attempting = id
              return Effect.tryPromise({
                try: () => at.harness.loadSession(id),
                catch: (cause) => cause as HarnessRefused | HarnessUnavailable,
              })
            }))
            : openWith(agentId, { kind: "resume", id })
        }),
      reopen: Effect.suspend(() => {
        const waiting = unopened
        if (waiting === null) {
          return Effect.fail(
            new UsageFailure({
              reason: "no conversation is waiting to be opened — one is open, or none was refused",
            }),
          )
        }
        unopened = null
        return changeSession(waiting.again, waiting.completed)
      }),
      liveSessions: (agent) => talking !== null && talking.row.id === agent ? storedIn(talking.harness) : null,
      sessions: Effect.map(
        listings.all,
        (listed) => succeeded(listed, options.overheard?.rows() ?? []),
      ),
      answer: (id, answers) =>
        Effect.flatMap(
          onConversation((harness) => harness.answer(id, answers)),
          (took) =>
            took ? Effect.void : Effect.fail(
              new UsageFailure({
                reason: "that question is not waiting any more — it was answered or withdrawn",
              }),
            ),
        ),

      doorFor: (plugin) => {
        const scopes = (): ReadonlyArray<WakeScope> =>
          (options.scoping?.rows() ?? [])
            .filter((row) => row.plugin === plugin)
            .map((row) => options.scoping!.recipient(row))
        return {
          scopes,
          deliver: (to, say, how) => deliverTo(to, say, plugin, how),
          withdraw: (to) =>
            Effect.sync(() => {
              held.dropped(to, plugin)
              const wake = wakeOf()
              if (!sameWake(wake, state.wake)) move({ wake })
            }),
        }
      },
      scope: (to, plugin, pick) =>
        Effect.gen(function*() {
          const scoping = options.scoping ?? null
          if (scoping === null) {
            return yield* new UsageFailure({
              reason: "this chat keeps no doorbells: no plugin here rings a conversation",
            })
          }
          held.dropped(to, plugin)
          const left = yield* Effect.mapError(
            scoping.set(to, plugin, pick),
            (failure) => new BusyFailure({ reason: failure.why }),
          )
          for (const row of left) held.dropped(row, row.plugin)
          move({ wake: wakeOf() })
          return left
        }),

      recordRefusal: (tool: string, failure: OpFailure) =>
        Effect.sync(() => {
          ours({ kind: "refusal", text: `\`${tool}\` was refused`, refusal: failure })
        }),
      start: Effect.gen(function*() {
        yield* Effect.gen(function*() {
          const chosen = yield* startsWith
          if (chosen === null) {
            move({ status: "idle", talking: { kind: "asking" } })
            return
          }
          const outcome = yield* replayed(
            usingConversation.withPermit(using(chosen, { kind: "adopt", memory })),
          )
          if (outcome._tag === "Failure") {
            yield* Effect.logWarning(outcome.failure.message).pipe(
              Effect.annotateLogs({ agent: chosen.id }),
            )
            if (outcome.failure instanceof HarnessRefused) {
              refusedOpen(outcome.failure, using(chosen, { kind: "adopt", memory }))
            } else {
              wentAway(outcome.failure.message)
            }
            return
          }
          settled()
          yield* aside(flushing)
        })
      }),
      stop: stopWithReason("shutdown"),
      stopWithReason,
    }
  })

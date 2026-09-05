/**
 * CHAT'S SERVER HALF — the conversation, the node scopes, the doorbell's other
 * end, and the fourteen verbs, as a row.
 *
 * ## What this module is, in one sentence
 *
 * `@olai/server`'s `serve.ts` held a fifty-line `Chat.make({…})` and its
 * `runtime.ts` held two cells, two collections, fourteen procedures, a cadence,
 * a doorbell fault walk and three publishers — six hundred lines of one
 * feature's judgement inside the two files every other feature also passes
 * through. It is here now, whole, and what core does instead is mount a row.
 *
 * ## Chat PROVIDES four doors, and that is the shape of the phase
 *
 * `Agents`, `Deliveries`, `Watching` and `SessionStart` left `openPlugins` and
 * are offered here ({@link @olai/plugin-api}'s `Offers`). Every plugin that
 * names one is held `waiting` until this row mounts and unloads when it leaves;
 * that is the paper's rule and the ruling accepts its cost. Under
 * `--plugins=kolu` alone, kolu sits `waiting`, and the plugins panel says on
 * whose account — the fiber's `PENDING` reading names the missing key. The
 * engines are `waiting` without chat too, which is correct: an engine plugin's
 * whole registration is an offer to seat a conversation, and there is nobody to
 * seat one.
 *
 * ## THE ORDER, and why the chat is built on a forked fiber
 *
 * Three things have to happen in an order this file cannot get by writing them
 * down one after another:
 *
 *   1. **The doors are offered and the surface is registered, EAGERLY.** The
 *      composition root composes the wire out of the registered siblings and
 *      then binds it, so a sibling registered late is a sibling nothing serves.
 *   2. **The engine rows mount.** They name `Agents`, which is offered in (1),
 *      so their fibers activate after this `apply` has provided it — which is
 *      after this `apply` has returned. The registry is empty on the line below
 *      the offer, and full a moment later.
 *   3. **The listener binds.** Only then is there an MCP address to hand a
 *      session, which is the whole of what {@link Tools} answers.
 *
 * So the roster is read and the chat is built on a fiber that AWAITS
 * `tools.server`, which settles after `listen` — by which time every row has
 * mounted and the engines registry is whatever this build has. That is the
 * composition root's hand-kept "the chat is built, the surface is bound, and
 * only then is the agent started" turned into a dependency a reader can see,
 * which is what {@link Tools}'s own header says it is for.
 *
 * What a browser sees in the gap is `CHAT_OFF`, which is the value a tab that
 * has not heard yet holds anyway — and the first frame after the build fills it.
 *
 * ## ...AND THE ORDER IS NO LONGER THE WHOLE STORY
 *
 * That sequence is about the BUILD, and it still holds exactly as written. What
 * it used to also settle — WHICH ENGINES THERE ARE — it does not, because an
 * engine is a plugin and a plugin can be turned off at the panel while this
 * process runs. So the engines table is READ WHEN ASKED rather than captured at
 * (3), and `enginesMoved` beside the offer is what tells the panel to look
 * again. The order above is what makes the FIRST reading complete; the live
 * reading is what keeps every one after it true.
 *
 * ## THE FENCE, and what this half may reach
 *
 * `./wire.ts` is what every listener statically pulls in and may carry no UI
 * runtime and no ACP transport. `./browser.tsx` is where this plugin's faces
 * hang and is SolidJS. This is everything that runs in a server process, and it
 * is reached BY NAME: `@olai/bundle`'s `olai.yml` carries the row
 * `olai-plugin-chat/server` and the loader mounts this module's DEFAULT export
 * as a fiber.
 */

import type { ImplementSurfaceDeps, SurfaceCtx } from "@kolu/surface/server"
import { inMemoryStore } from "@kolu/surface/server"
import {
  documentAt,
  type OpFailure,
  type Reading,
  UsageFailure,
} from "@olai/format"
import {
  Bundle,
  Clock,
  definePlugin,
  Env,
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
  Deliveries,
  detached,
  SessionStart,
  Watching,
} from "@olai/plugin-api/services"
import type { Engine, Registering } from "@olai/acp/engine"
import type { ConversationSeen, Probed, Wake } from "@olai/plugin-api/services"
import { Deferred, Effect } from "effect"

import { type Cadence, cadence } from "./cadence.ts"
import type { Change } from "./transcript.ts"
import * as Chat from "./scoped.ts"
import { whyNoAgent } from "./adapter.ts"
import { detecting } from "./agents/roster.ts"
import { openLocalState } from "./local.ts"
import { forLocalState as scopesIn } from "./scopes.ts"
import { forLocalState as sessionsIn } from "./sessions.ts"
import { forLocalState as memoryIn } from "./memory.ts"
import { kinds } from "./kinds.ts"
import { roster as agentsRoster } from "./server/agents.ts"
import { assignSession, type Binding, startAgentSession } from "./server/binding.ts"
import { faultedIn, scopeThrough } from "./server/doorbell.ts"
import { inBundleOrder } from "./server/order.ts"
import { contextFor } from "./server/context.ts"
import type { ChatEntry, ChatState } from "./wire/members.ts"
import { CHAT_OFF } from "./wire/members.ts"
import {
  type Agents,
  type Migration,
  NO_AGENT_ROSTER,
  NO_MIGRATION,
} from "./wire/agents.ts"
import { faces, name, surface } from "./wire.ts"

/** The kinds this plugin teaches a vault — see {@link ./kinds.ts} for the word
 *  and the migration row an existing vault needs. */
export { kinds } from "./kinds.ts"

/** The wire half, re-exported so a composition root reads ONE entry per plugin
 *  — and so the sibling key the surface is composed under and the key its deps
 *  are filed under are the same word by construction. */
export { faces, name, surface } from "./wire.ts"

/** This surface's own write face, which is what the runtime hands back under
 *  this plugin's key. Named here because it is this package's spec that decides
 *  what is on it — core carries the value as `unknown` and could not spell
 *  `cells.state` if it wanted to, which is the point. */
type Ctx = SurfaceCtx<typeof surface.spec>

/** ONE REVISION OF THE VAULT, as much of it as this half reads — the narrowing
 *  {@link Vault.revision} leaves to the plugin, in the plugin's own signature.
 *  The SET is what a scoped file is looked for among, and the DERIVED reading is
 *  what the node-agent roster and the nearest-ancestor walk are taken off. */
interface VaultRevision {
  readonly value: {
    readonly set: Parameters<typeof documentAt>[0]
    readonly derived: Reading["derived"]
  }
}

/** A frame's upserts and removes, written onto a collection in the ONE order
 *  that never shows a paragraph getting shorter: rows before pieces, because a
 *  row's upsert carries its text whole and supersedes every piece of it. */
const applyFrame = <T>(
  collection: {
    upsert: (key: string, value: T) => void
    remove: (key: string) => void
  } | undefined,
  change: {
    readonly upserts: ReadonlyArray<readonly [string, T]>
    readonly removes: ReadonlyArray<string>
  },
): void => {
  for (const [key, entry] of change.upserts) collection?.upsert(key, entry)
  for (const key of change.removes) collection?.remove(key)
}

/** A refusal off the write door, as the vault's own union — the one narrowing
 *  this half makes across the plugin boundary, said once here rather than at
 *  each of the two call sites. {@link Refusal} carries the `_tag` Effect's
 *  matching is structural on; what it cannot carry is the union, because
 *  `@olai/plugin-api` does not depend on `@olai/format` and must not. */
const asFailure = (refusal: Refusal): OpFailure => refusal as OpFailure

/**
 * WHY A SESSION MAY NOT WRITE THE KEY IT IS SEATED ON — this plugin's own
 * sentence, carried on the ticket beside the keys it is about.
 *
 * A node agent may write anywhere under its own node and still may not rewrite
 * the property that says WHICH conversation it is: that is the binding rather
 * than the work, and it is a person's gesture in the panel. The refusal spends
 * this clause verbatim (`@olai/ops`' `fenceRefusal`), which is why it reads as a
 * reason and starts in lower case.
 */
const SEATS =
  "it is what seats a conversation on a node, and that is a person's gesture in the panel"

export default definePlugin({
  name,
  needs: [Bundle, Env, Kinds, LocalState, Offers, Ops, Surfaces, Tools, Vault, Wakes],
  apply: Effect.gen(function*() {
    // EVERY SERVICE THIS PLUGIN NAMED, YIELDED ONCE, at the top — the same list
    // `needs` carries, in the same order, so a reader checks the two against
    // each other by looking at one screen.
    const bundle = yield* Bundle
    const env = yield* Env
    const kindsDoor = yield* Kinds
    const localState = yield* openLocalState(yield* LocalState)
    const offers = yield* Offers
    const ops = yield* Ops
    const surfaces = yield* Surfaces
    const tools = yield* Tools
    const vault = yield* Vault
    const wakes = yield* Wakes

    for (const kind of kinds) yield* kindsDoor.register(kind)

    // ── the four doors this row stands behind ────────────────────────────

    /**
     * THE ENGINE TABLE, keyed by the offering plugin's own word.
     *
     * It was `openPlugins`' `registry`; it is chat's, because the id an engine
     * is offered under is the fiber's name and what READS the table is the
     * roster this file builds. Two plugins cannot claim one id — the loader
     * will not mount two rows under one word — so the reachable case is a plugin
     * registering twice, which dies out of `register` and lands that fiber
     * `failed` with its siblings untouched.
     */
    const engines = new Map<string, Engine>()
    let engineChange: Deferred.Deferred<void> | null = null
    /**
     * ...AND WHO IS TOLD WHEN IT MOVES, which is the half that was missing.
     *
     * The table was always live — the release below has always deleted the row —
     * but what READ it was a boot snapshot taken once, when the serve came up,
     * and handed to the panel as two arrays. So switching the claude row off
     * removed claude from this map and changed nothing a person could see: the
     * picker went on offering it, and picking it went on WORKING, because the id
     * was resolved against the same frozen list.
     *
     * The reading is live now ({@link ../chat.ts}'s `PanelOptions.roster`), and
     * a live reading nobody re-reads is a snapshot with extra steps — the picker
     * is a published value, so something has to say when to publish it again.
     * This is that something, and it is HERE because the acquire and the release
     * are already the two moments it is true at; a second place that noticed
     * would be a second place to keep in step.
     *
     * THROUGH THE DETACHED SEAM, because `enginesMoved` is an Effect (it stops a
     * subprocess) and this runs inside a fiber's teardown, which is not one. A
     * failure there is contained and named with this plugin's word, like every
     * other detached edge in this row.
     *
     * NOTHING BEFORE THE CHAT IS BUILT: `chat` is null until the serve is up,
     * and an engine that registered before then is simply in the table the build
     * reads. There is no lost signal to catch up on.
     */
    const enginesMoved = (): void => {
      if (chat !== null) ring(chat.enginesMoved)
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
              enginesMoved()
            }),
        ).pipe(Effect.asVoid),
    }))

    /**
     * WHERE A DOORBELL MAY DELIVER — the chat's own door, per calling plugin.
     *
     * `null` until the chat is built, which is every moment before the listener
     * bound, and the arms are the honest ones rather than a wait: `scopes()` is
     * the empty list, `ringing` is nothing, and `deliver` is a no-op. A doorbell
     * that rang in that window rang about a conversation that does not exist
     * yet, and holding the ring would deliver yesterday's news into today's
     * first turn.
     */
    yield* offers.offer(Deliveries, (who) => ({
      scopes: () => chat?.doorFor(who).scopes() ?? [],
      ringing: (file, node) => chat?.doorFor(who).ringing(file, node) ?? [],
      deliver: (...args) => Effect.suspend(() => chat?.doorFor(who).deliver(...args) ?? Effect.void),
    }))

    /** WHAT A PLUGIN THAT MIRRORS A CONVERSATION IS TOLD — a bus this row owns,
     *  contained per handler with the subscribing plugin's word on the line. */
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

    /**
     * WHAT TO ASK THIS HOST WHEN A CONVERSATION OPENS, keyed by the plugin that
     * registered it — the door that replaced `probe()`.
     *
     * A ROSTER rather than a table: a plugin may legitimately register more than
     * one probe, and there is no key here to collide on — the stamp is on the
     * answer, not on the address.
     */
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

    // ── what this row holds while it is up ───────────────────────────────

    /** The chat, once the listener has bound and an enabled engine is installed.
     *  Until then the build waits for engine registrations on this plugin's scope. */
    let chat: Chat.Chat | null = null
    /** This sibling's own write face, the moment the runtime has minted it. */
    let mine: Ctx | null = null

    /** THE VAULT'S HALF OF THE AGENTS ROSTER, held across revisions: which node
     *  carries a session property, what it is called, how big its subtree is. */
    const nodeAgents = agentsRoster()

    /**
     * WHAT A GROWING ROW COSTS THE WIRE — the transcript's changes, turned into
     * frames on a clock ({@link ./cadence.ts}, which argues the whole thing).
     *
     * HERE rather than beside the panel, for the reason it was in the
     * composition root before: what it decides is a DELIVERY question — which
     * member a fact lands on, in what order, and what a new subscriber is seeded
     * with — and the panel knows only that it published a change.
     */
    const saying: Cadence = cadence({
      onFrame: (frame) => {
        applyFrame(mine?.collections.transcript, frame.rows)
        applyFrame(mine?.collections.saying, frame.pieces)
      },
    })
    // A window still open when this row unloads is a piece nothing will ever be
    // published to. On this plugin's own scope, beside the thing it stops.
    yield* Effect.addFinalizer(() => Effect.sync(() => saying.stop()))

    /**
     * THE ROSTER, ASSEMBLED AND PUBLISHED — the one place the two halves are put
     * together, called from both of the clocks that move either.
     *
     * A published revision moves the vault's half; a chat frame moves the
     * machine's half. Two assemblers over one carrier would be two answers to
     * what the roster is, and the one that disagreed would be the one nobody was
     * looking at. The cell's `equals` is what makes hanging this off every chat
     * frame affordable: nearly none of them says anything new about a roster of
     * three rows.
     */
    const republishAgents = (): void => {
      const cell = mine?.cells.agents
      if (cell === undefined) return
      cell.set(
        nodeAgents.rowsWith(
          chat === null ? [] : chat.overheard(),
          chat === null ? new Map() : chat.live(),
        ),
      )
    }

    const whoOf = (state: ChatState): { agent: string; session: string } | null =>
      state.session !== null && state.talking?.kind === "agent"
        ? { agent: state.talking.id, session: state.session.id }
        : null
    let lastStatus: ChatState["status"] | undefined
    /** Agent rows already in the transcript when the current turn started —
     *  `replied` is the row THIS turn produced, not the newest agent row in the
     *  whole conversation (a cancelled turn has no prose). */
    let agentSeqAtTurn = -1
    /** Doorbell rows already pushed, so a later mark on the same entry is not a
     *  second digest. */
    const deliveredIds = new Set<string>()
    let deliveredFor: string | undefined

    /**
     * THE ONE SEAM ACROSS THE BOUNDARY — see `@olai/effect-cordis`'s `detached`.
     *
     * Three things drive this plugin from outside an Effect: the panel's own
     * `onState` and `onTranscript` callbacks, and the vault's revision handler,
     * which is synchronous. Everything below that starts work from one of those
     * goes through here, which forks it under THIS plugin's services — so a line
     * carries the level the operator asked for — and onto THIS plugin's scope, so
     * work still in flight when the row unloads is interrupted with it.
     *
     * AND FORGET IS NOT SILENT: a defect is caught by the seam and said with this
     * plugin's own word on it, where a bare `Effect.runPromise` would have
     * dropped it with nothing anywhere saying so.
     */
    const ring = yield* detached

    const publishState = (state: ChatState): void => {
      mine?.cells.state.set(state)
      // ... AND THE ROSTER WITH IT, because this is the one door every chat
      // frame comes through and the bindings move behind exactly these frames:
      // a session opening, a contract taught, a line written down at the end of
      // a turn.
      republishAgents()
      const who = whoOf(state)
      if (who !== null) {
        if (state.status === "thinking" && lastStatus !== "thinking") {
          agentSeqAtTurn = Math.max(
            -1,
            ...[...(chat?.entries().values() ?? [])]
              .filter((entry): entry is Extract<ChatEntry, { kind: "agent" }> =>
                entry.kind === "agent"
              )
              .map((entry) => entry.seq),
          )
          ring(seen({ kind: "turn", ...who, status: "working" }))
        }
        if (lastStatus === "thinking" && state.status !== "thinking") {
          ring(seen({ kind: "turn", ...who, status: "done" }))
          const produced = [...(chat?.entries().values() ?? [])]
            .filter((entry): entry is Extract<ChatEntry, { kind: "agent" }> =>
              entry.kind === "agent" && entry.seq > agentSeqAtTurn
            )
            .sort((a, b) => a.seq - b.seq)
            .at(-1)
          if (produced !== undefined && produced.text !== "") {
            ring(seen({ kind: "replied", id: produced.id, ...who, text: produced.text }))
          }
        }
      }
      lastStatus = state.status
    }

    const publishTranscript = (change: Change): void => {
      // Through the CADENCE, never straight onto the collection: a row that
      // grows reaches the wire as pieces on a clock rather than as itself once
      // per token.
      saying.publish(change)
      const who = chat === null ? null : whoOf(chat.state())
      if (who === null) return
      const whoKey = `${who.agent}/${who.session}`
      if (deliveredFor !== whoKey) {
        deliveredIds.clear()
        deliveredFor = whoKey
      }
      for (const [, entry] of change.upserts) {
        if (entry.kind === "user" && entry.rang !== undefined && entry.text !== "") {
          if (deliveredIds.has(entry.id)) continue
          deliveredIds.add(entry.id)
          ring(seen({ kind: "delivered", id: entry.id, from: entry.rang, ...who, body: entry.text }))
        }
      }
    }

    // ── the verbs ────────────────────────────────────────────────────────

    /** A chat verb, when there may be no chat. The cell already reads `off`, so
     *  a caller can branch on it — which is why this is a refusal in words
     *  rather than a defect. */
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

    /** WHAT THE TWO BINDING GESTURES REACH — the roster's reading of a node, and
     *  ONE property write through the gate a keystroke goes through, with the
     *  vault's own refusal on the way back out.
     *
     *  THE KEY IS THE ROSTER'S ANSWER, asked per gesture rather than captured:
     *  which column this board keeps its bindings in is a DECLARATION
     *  ({@link ./kinds.ts}), so it moves with a revision, and the first key that
     *  carrier names is the one a writer should prefer — a vault's own migration
     *  row over the word this kind claims. */
    const binding: Binding = {
      boundAt: (node) => nodeAgents.nodeAt(node),
      key: () => nodeAgents.key(),
      write: (node, value) =>
        Effect.mapError(ops.prop({ node, key: nodeAgents.key(), value }), asFailure),
    }

    /** WHICH PLUGINS RING AT ALL — core's registry, read afresh at every use.
     *
     *  The declarations are `Wakes`' and every ringing plugin writes its own; what
     *  this row has is the PICKS, so it is the end that judges them — the member
     *  that writes a scope refuses a plugin that declared no wake, and the fault
     *  walk indexes the sentence a broken one says. Two readers, one table, and no
     *  second list for them to disagree across.
     *
     *  AN EFFECT AND NOT A SNAPSHOT, which is the reactive half doing its job: a
     *  plugin that unloaded between one revision and the next declared nothing by
     *  the time either reader asks. */
    const rings = wakes.declared

    const conversation = {
      // The ids the composer was armed with become NODES here, over the same
      // reading a keystroke's write is resolved against — so what the agent is
      // told is the set's answer rather than the tab's, and an id nothing
      // declares refuses the send instead of quietly sending a message with no
      // subject.
      send: ({ input }: { input: { text: string; attachments?: ReadonlyArray<string>; context?: ReadonlyArray<string>; steer?: boolean } }) =>
        withChat((open) =>
          Effect.flatMap(ops.reading, (at) => {
            const context = contextFor(at as Reading, input.context ?? [])
            if (context._tag === "Failure") return Effect.fail(context.failure)
            return open.send(
              input.text,
              input.attachments ?? [],
              context.success,
              // Straight through: whether this send interrupts the turn in
              // flight is a gesture a person made, and this end has no second
              // opinion about what they meant by it.
              input.steer ?? false,
            )
          })
        ),
      attach: ({ input }: { input: Parameters<Chat.Chat["attach"]>[0] }) =>
        withChat((open) => open.attach(input)),
      resend: ({ input }: { input: { id: string } }) => withChat((open) => open.resend(input.id)),
      cancel: () => withChat((open) => open.cancel),
      setModel: ({ input }: { input: { agent: string; session: string; value: string } }) =>
        withChat((open) => open.setModel(input.agent, input.session, input.value)),
      newSession: ({ input }: { input: { agent: string } }) =>
        withChat((open) => open.newSession(input.agent)),
      // THE TWO GESTURES THAT ARE TWO ACTS, and the only ones here that are —
      // {@link ./server/binding.ts} argues both orders and the refusal.
      startAgentSession: ({ input }: { input: { node: string; agent: string } }) =>
        withChat((open) => startAgentSession(open, binding, input)),
      assignSession: (
        { input }: { input: { node: string; agent: string; session: string } },
      ) => withChat((open) => assignSession(open, binding, input)),
      chooseAgent: ({ input }: { input: { agent: string } }) =>
        withChat((open) => open.chooseAgent(input.agent)),
      loadSession: ({ input }: { input: { agent: string; id: string } }) =>
        withChat((open) => open.loadSession(input.agent, input.id)),
      reopen: () => withChat((open) => open.reopen),
      sessions: () => withChat((open) => open.sessions),
      answer: ({ input }: { input: { id: string; answers: Parameters<Chat.Chat["answer"]>[1] } }) =>
        withChat((open) => open.answer(input.id, input.answers)),
      decline: ({ input }: { input: { id: string } }) =>
        withChat((open) => open.answer(input.id, null)),
      // WHOSE doorbell a conversation may be pointed at — the gate, and the
      // sentence a refusal reaches a person in ({@link ./server/doorbell.ts}).
      scope: (
        { input }: {
          input: {
            agent: string
            session: string
            plugin: string
            file: string | null
          }
        },
      ) =>
        withChat((open) =>
          Effect.flatMap(rings, (declared) =>
            // THE GATE ANSWERS ITS OWN SENTENCE, and the vault's refusal union
            // is what a wire member fails with — a `UsageFailure` is what a
            // refusal a person reads has always been on this surface.
            Effect.mapError(
              scopeThrough(open, declared, input),
              (said) => new UsageFailure(said),
            ))
        ),
    }

    // ── the sibling ──────────────────────────────────────────────────────

    yield* surfaces.register({
      surface,
      faces,
      deps: {
        cells: {
          // NO CHAT IS A STATE WITH A REASON, and the reason rides the same cell
          // rather than a second one: the panel draws this face out of one value
          // it already subscribes to, and a tab that has not heard yet holds
          // `CHAT_OFF` itself, whose `off` is `null` — "not told" rather than any
          // of the three ways of being off.
          state: { store: inMemoryStore<ChatState>(CHAT_OFF) },
          agents: { store: inMemoryStore<Agents>(NO_AGENT_ROSTER) },
          // WHAT THIS VAULT IS OWED to get those agents back, or nothing — and
          // nothing is what every board reaches (`./wire/agents.ts` argues why
          // this is a cell of ours rather than a finding of the validator's).
          migration: { store: inMemoryStore<Migration | null>(NO_MIGRATION) },
        },
        collections: {
          // Server-authored, one writer: `readAll` reads the transcript itself,
          // so a fresh subscription is seeded from the same object every later
          // upsert moves. There is no second copy to keep in step.
          transcript: {
            readAll: () => new Map(chat === null ? [] : chat.entries()),
            upsert: () => {},
            remove: () => {},
          },
          // The pieces of the row still being said — everything the cadence has
          // PUT on the wire and not taken off again. Seeded with what is LIVE
          // rather than empty: a tab subscribes to the two members one after the
          // other, and a piece published in between belongs to neither.
          saying: {
            readAll: () => new Map(saying.onWire()),
            upsert: () => {},
            remove: () => {},
          },
        },
        procedures: { conversation },
      } satisfies ImplementSurfaceDeps<typeof surface.spec>,
      published: (bound) => {
        mine = bound as Ctx
      },
    })

    // ── the world, as it moves ───────────────────────────────────────────

    /**
     * A VAULT REVISION LANDED — re-derive the node-agent roster, re-read which
     * node the open conversation belongs to, and mark the scopes whose doorbell
     * can no longer watch what they were pointed at.
     *
     * THE PAYLOAD IS NARROWED HERE, in this plugin's own signature: core rings
     * the whole published snapshot and {@link VaultRevision} names the parts
     * chat touches.
     */
    yield* vault.revision((revision: VaultRevision) =>
      Effect.sync(() => {
        nodeAgents.seen(revision.value.derived)
        // ...AND WHAT THE BOARD IS OWED, in the same breath and off the same
        // reading. It is published HERE rather than from {@link republishAgents}
        // because it moves for one reason only — a declarations file — and
        // that reason is a revision. Hanging it off every chat frame would be
        // a second answer to a question no conversation can change.
        mine?.cells.migration.set(nodeAgents.migration())
        // WHICH NODE AGENT THE OPEN CONVERSATION BELONGS TO is a PROPERTY, so a
        // revision can change it. Without this the panel would go on saying it
        // belonged to nobody until the next time a session opened.
        chat?.reread()
        republishAgents()
        faulted(revision)
      })
    )
    yield* vault.unloaded(Effect.sync(() => {
      nodeAgents.seen(null)
      mine?.cells.migration.set(NO_MIGRATION)
      republishAgents()
    }))

    /** A SCOPE ITS DOORBELL CANNOT WATCH — the walk, over this revision.
     *  {@link ./server/doorbell.ts} argues every clause of it; what is here is
     *  the two readings it does not take for itself. */
    const faulted = (snapshot: VaultRevision): void => {
      const open = chat
      if (open === null) return
      ring(Effect.flatMap(rings, (declared) =>
        faultedIn(open, {
          served: (file) => documentAt(snapshot.value.set, file) !== undefined,
          declared,
        })))
    }

    /** WHAT THIS SERVE REFUSED A WRITER — a row in the transcript, so what the
     *  agent then says about it is prose and the unfinished children are data. */
    yield* ops.refused((refusal) =>
      chat === null ? Effect.void : chat.recordRefusal(refusal.op, asFailure(refusal.failure))
    )

    // ── the build, once the serve is up ──────────────────────────────────

    yield* Effect.forkScoped(Effect.gen(function*() {
      // THE ONE SIGNAL THAT THE SERVE IS UP, and the reason the roster is read
      // here rather than at the top of `apply` — see the header.
      const address = yield* tools.server
      /**
       * THE ENGINES MOUNTED RIGHT NOW, in the build's order — asked, not
       * captured.
       *
       * `inBundleOrder` because registration order is the order two dynamic
       * imports came back in, which is a fact about the filesystem on the day;
       * a person reads this list, and one that reshuffles between boots is a
       * list nobody can read twice. The sort is cheap and this is asked when the
       * table moves rather than per frame.
       */
      const mounted = () => inBundleOrder(engines.values(), (one) => one.id, bundle.rank)
      /**
       * ...AND WHICH OF THEM THIS MACHINE HAS, over the same moving list.
       *
       * ONE DETECTOR for the life of the process, so the machine's half is asked
       * once per engine and never again while the build's half follows the
       * fibers ({@link ./agents/roster.ts}'s `detecting` argues both).
       */
      const detect = detecting(env.vars, vault.served)
      let found = detect(mounted())
      while (found.kind === "none") {
        // Arm before publishing or yielding, so an arriving engine cannot be
        // lost between the empty reading and the wait. This fiber is scoped:
        // turning chat off also cancels a build waiting for its first engine.
        engineChange = yield* Deferred.make<void>()
        mine?.cells.state.set({ ...CHAT_OFF, off: found.because })
        yield* Effect.logInfo(whyNoAgent(found.because))
        yield* Deferred.await(engineChange)
        found = detect(mounted())
      }
      engineChange = null
      const installed = found.installed

      chat = yield* Chat.make({
        // BOTH HALVES OF THE TABLE, READ WHEN ASKED. What this hands over is the
        // reading rather than an answer, so a row switched off at the panel
        // leaves the picker and one switched on enters it — see
        // `../chat.ts`'s `PanelOptions.roster`, and `enginesMoved` above for
        // what tells the panel to look again.
        //
        // THE EMPTY ANSWER IS LEGAL HERE and was not: the guard above is what
        // refuses to BUILD a panel that never had an agent, and it still does.
        // What is new is that a panel which had one can watch its last engine
        // leave, and the state machine has the face for it.
        roster: () => {
          const now = detect(mounted())
          return now.kind === "here" ? now.installed : []
        },
        engines: () => mounted().map((one) => one.id),
        cwd: vault.served,
        tools: () => address,
        // WHATEVER ELSE THIS HOST IS RUNNING, asked once per conversation — the
        // registrations, read afresh per opening so a plugin that unloaded
        // between conversations contributes nothing to the next one. The ORDER
        // is the build's, imposed here, because registration order is the order
        // two dynamic imports came back in and a person reads these lists.
        probes: () =>
          Effect.sync(() =>
            inBundleOrder(asking, (one) => one.who, bundle.rank).map((one) => ({
              name: one.who,
              ask: one.ask,
            }))
          ),
        memory: memoryIn(localState, mounted()[0]?.id ?? ""),
        scoping: yield* scopesIn(localState),
        overheard: yield* sessionsIn(localState),
        agentAt: (to) => nodeAgents.agentAt(to),
        nodeAt: (node) => nodeAgents.nodeAt(node),
        seatableAt: (node) => nodeAgents.seatableAt(node),
        nodes: () => nodeAgents.nodes(),
        nearestAt: (node, candidates) => nodeAgents.nearestAt(node, candidates),
        // EVERY KEY THIS VAULT DECLARES THE BINDING KIND ON, not the one a write
        // would land on: a board mid-migration has two, this plugin's roster
        // reads a binding off either, and a fence that named only the writing
        // key would leave the other as a door a seated agent could re-seat
        // itself through. A THUNK, so the answer follows the revision — a
        // migration row landing mid-conversation moves what the ticket forbids.
        ticket: (node) =>
          tools.ticket(
            // ...AND THE SENTENCE IS THIS PLUGIN'S, beside the keys it is
            // about. It used to be composed inside `@olai/ops`' refusal, which
            // was a general package writing prose about a word only this
            // package owns — invisible while there was one forbidden key and
            // untrue of half its subjects the moment there were two.
            () => ({
              under: node,
              forbidden: nodeAgents.keys().map((key) => ({ key, says: SEATS })),
            }),
            nodeAgents.above,
          ),
        onState: publishState,
        onTranscript: publishTranscript,
        onLive: republishAgents,
      })
      yield* Effect.addFinalizer(() => chat === null ? Effect.void : chat.stop)
      yield* chat.start
      yield* Effect.annotateLogs(Effect.logDebug("chat agent commands"), {
        agents: installed.map((row) => `${row.id}=${row.adapter.command}`).join(" "),
        mcp: address.url,
      })
      yield* Effect.annotateLogs(Effect.logInfo("chat agents detected"), {
        agents: installed.map((row) => row.id).join(", "),
      })
    }))

  }),
})

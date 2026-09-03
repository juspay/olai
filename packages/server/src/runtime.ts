/**
 * The surface, bound to the store and to the conversation.
 *
 * Two subjects, and the bindings say which is which:
 *
 *   - the DIRECTORY is the store's. One fiber follows `SubscriptionRef.changes`
 *     of the snapshot — current value first, then every later one — and each
 *     revision it sees becomes the writes of that revision: for each of the two
 *     collections the entries whose file moved and the keys whose file is gone,
 *     then the manifest. It is an OWNED source (the `manifest` cell's
 *     `connect`), like the error cell's, so it lives on the runtime's own scope
 *     and a failure in it settles `done`.
 *
 *     What makes that ONE fiber rather than three is that the collections and
 *     the cell are halves of one revision: publishing them from separate
 *     subscriptions to the same ref would let a reader see a manifest naming a
 *     revision whose entries had not been written yet, from a server that knew
 *     both.
 *
 *     One thing a revision names is NOT published from here, and it is the one
 *     the server does not hold: a body the set keeps only the path of goes to
 *     `./bodies.ts`, which reads the file when a reader opens it, publishes it
 *     on that reader's own key, and goes on doing so for exactly as long as
 *     somebody holds that key — the subscription's own lifetime, which the
 *     collection's own handler deps report (`holders`, beside `readOne`).
 *   - the CONVERSATION is the chat's: a cell for where it stands, a collection
 *     for the rows, and the procedures. The collection is deliberately
 *     server-authored — `readAll` is the transcript itself and the writes come
 *     from `ctx`, never from the wire — because a transcript is something that
 *     HAPPENED and the only way to add to it is to prompt.
 *   - the SIDEBAR's two DATE readings are the ops layer's as well, and they
 *     are the one binding here that publishes nothing: a stream re-READS its
 *     own answer when the directory moves, so what this file provides is the
 *     read, a pulse saying a revision was published, and the
 *     schema-derived equality that keeps a revision which moved no dot from
 *     sending a frame. `vault-in-browser.md` §2's mechanism, wired.
 *   - the KEYBOARD is the ops layer's: one procedure, no member of its own,
 *     and nothing published from here when one lands. That absence IS the
 *     design — an edit changes a FILE, and a file reaches every open tab
 *     through the store binding above, the same way a `git pull` does. A
 *     procedure that also echoed its result would be a second answer to what
 *     the directory says, arriving first and occasionally disagreeing.
 *
 * Two members are neither the directory nor a fact about it but a READING of
 * it, and they are the first: the pinned SHELF and how full the INBOX is,
 * which the sidebar draws and used to work out for itself over a copy of
 * every outline in the browser (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`
 * §6's item 5, and the inbox door's count). Each connector is the whole of
 * it — re-read `@olai/format`'s `shelfIn` / `inboxHeldIn` on every
 * published revision and write the cell, whose `equals` keeps a revision
 * that moved nothing about that reading from sending anything. That is §2's
 * mechanism, and the reason the browser needs no token to ask on: the
 * server is the one that knows when the directory moved. WHICH FILE each of
 * the two reads is not re-derived per revision — that answer moves only when
 * a file is added, removed or renamed, so it is carried with the path set it
 * describes (`conventions.ts`, and the two bindings beside the cells).
 *
 * And two facts belong to neither: what GIT is doing for the directory, and
 * what is WAITING to be committed to it. Both are the ops layer's — the only
 * thing here that commits — and both are recomputed by one connector, from one
 * survey, on the same three clocks: every published revision, every landed
 * commit, and a slow sweep because nothing watches `.git`. They are two cells
 * because two controls draw them, and one derivation because they are two
 * readings of one question (MCP and Web ops must be consistent).
 *
 * Nothing here interprets an outline or an agent. It moves what the store and
 * the chat decided onto the wire, and that is all — with one exception, and it
 * is one indirection deep: an edit's INTENT is resolved into an op by
 * `./edit.ts`, because that is a question about the snapshot rather than about
 * the wire.
 */

import {
  type Convention,
  conventionRecorded,
  conventionServed,
  documentAt,
  type InboxHeld,
  inboxHeldIn,
  inboxIn,
  NO_INBOX,
  NO_PINS,
  NOTHING_PENDING,
  NOTHING_WRONG,
  pinsIn,
  sameDated,
  sameMoving,
  sameNarrowing,
  sameOwed,
  samePageReading,
  type Shelf,
  shelfIn,
  type Verdict,
} from "@olai/format"
import { type Caller, type Ops, type Policy, type Request, type Status, type Store } from "@olai/ops"
import type {
  CommitRequest,
  Pending,
  PushResult,
  Writer,
} from "@olai/format"
import {
  type Agents,
  type Applied,
  type ChatEntry,
  CHAT_OFF,
  type ChatState,
  type Edit,
  GIT_OFF,
  type GitState,
  LOADED,
  type Manifest,
  NO_AGENT_ROSTER,
  NO_ROSTER,
  type OffBecause,
  type OpFailure,
  type PluginRoster,
  type PluginState,
  surface,
  watchable,
  type Who,
} from "@olai/surface"
import {
  AGENT_PROP,
  customText,
  isRegular,
  type Located,
  type Reading,
  sessionValue,
  UsageFailure,
} from "@olai/format"
import type { Snapshot } from "@olai/store"
import { type SurfaceSpec, surfaceTag } from "@kolu/surface/define"
import {
  emptyHandlers,
  type ImplementSurfaceDeps,
  implementRootedSurfaces,
  inMemoryChannel,
  inMemoryStore,
  type MountedSurface,

  type SurfaceHandler,
  type SurfaceHandlers,
  type SurfaceRuntime,
} from "@kolu/surface/server"
import { Duration, Effect, Result, type Scope, Stream, SubscriptionRef } from "effect"

import { cadence } from "@olai/chat"
/**
 * THE ONLY PLACE THIS FILE MEETS AN APPLIANCE, and it meets none of them by
 * name — nor, now, by list.
 *
 * What arrives is a mounted RUNTIME ({@link Wiring.plugins}): olai's own doors
 * whose services every plugin fiber has already registered itself into. This
 * file reads three of those registries — the sibling surfaces, the wake
 * declarations and the kinds — and drives two events. It composes no list, it
 * calls no half's constructor, and it holds no plugin's name except as a key it
 * was handed.
 *
 * `@olai/plugin-api/services` and not `@olai/plugin-api`: the root is the
 * manifest door and a manifest carries a plugin's CHROME and its DRESSINGS,
 * which are SolidJS components and, behind one of them, a terminal emulator —
 * and this process renders nothing. What is imported here is type-only anyway;
 * the services themselves are constructed in `./serve.ts`, which is where the
 * environment, the clock and the two log channels are reached for.
 */
import type { ConversationSeen, Plugins, Registered, Wake } from "@olai/plugin-api/services"
import type { RowReport } from "@olai/bundle/bundle"


import type { Cadence, Change, Chat } from "@olai/chat"
import { type Emit, emitter } from "@olai/log"
import type { Roster } from "./agents.ts"
import * as Bodies from "./bodies.ts"
import { contextFor } from "./context.ts"
import { inverseOf, reresolves, requestFor } from "./edit.ts"
import { runResolved } from "./resolving.ts"
import {
  type Change as CollectionChange,
  type Published,
  publishedOf,
} from "./published.ts"
import { facesOf } from "./faces.ts"
import { CurrentWho } from "./identity.ts"
import { readFailed } from "./report.ts"

/**
 * What a transport needs, and nothing else. `ctx` is the write face, which
 * belongs to the bindings below rather than to whoever serves them.
 *
 * Still named off olai's OWN surface, and that stays exactly true of the two
 * fields a transport reads: `group` and `handlers` are erased of the spec
 * (`SurfaceRuntimeHandle` types them as a flat `RpcGroup` and a tag-keyed
 * record), so the fused pair {@link bind} returns is the same shape whether or
 * not a plugin contributed a tag to it. What the annotation is worth is the
 * lifetime pair beside them, which is olai's runtime's — see the supervision
 * paragraph on the return.
 */
export type Bound = Omit<SurfaceRuntime<typeof surface.spec>, "ctx">

/**
 * ONE PUBLISHED REVISION, as a plugin's server half is handed it — the store's
 * own snapshot, whole.
 *
 * Named here because this is where the two vocabularies meet: `@olai/plugin-api`
 * types its revision hook PARAMETRICALLY and never names a vault record (its
 * manifest declines `@olai/format` on purpose — the format is downstairs, and a
 * floor package that imported it would be the plugin interface learning what an
 * outline is), so the concrete reading is pinned at the composition root, which
 * is the only place it exists.
 *
 * THE RICHER of what the tenants ask for, deliberately: each narrows it in its
 * own signature to the part it reads, which is a claim the compiler checks —
 * and the annotation on {@link bind}'s plugin list is what proves every built
 * plugin can be driven by this reading, so a plugin that asked for something the
 * store does not publish fails here, naming the list.
 */
type VaultRevision = Snapshot<Reading>

/** How often the two git cells are recomputed with nothing having asked. Same
 *  argument as the store's backstop: a watcher is a latency optimisation and
 *  never a guarantee, and here there is no watcher at all — `.git` is
 *  deliberately not watched (it is the busiest thing under a served directory).
 *  A person committing in a terminal is the case this covers. */
const SWEEP = Duration.seconds(30)

/** The channel's required error choice, for a pulse that carries nothing: there
 *  is no failure to report on a publish of `void`, and the one thing that CAN
 *  go wrong downstream — a re-read that refuses — is reported where it happens
 *  ({@link ./report.ts}'s `readFailed`). Named rather than an inline `() => {}`
 *  at both call sites, so "this swallow was a decision" is written once. */
const NEVER = (): void => {}

/** One collection's revision, written to the collection. The two directory
 *  collections are published by the same two statements in the same order, and
 *  one spelling of them is one place for that order to be decided — a third
 *  collection is a line rather than a loop nobody re-reads. Structural in what
 *  it writes to, so it is the CHANGE it knows about and not the surface.
 *
 *  It takes the two fields it WRITES rather than a whole revision, which is
 *  what lets the chat's own frames come through the same door: a directory
 *  revision carries the set it settled on as well, and this has never read it. */
const apply = <T>(
  collection: {
    upsert: (key: string, value: T) => void
    remove: (key: string) => void
  } | undefined,
  change: Pick<CollectionChange<T>, "upserts" | "removes">,
): void => {
  for (const [key, entry] of change.upserts) collection?.upsert(key, entry)
  for (const key of change.removes) collection?.remove(key)
}


/**
 * THE PLUGIN RUNTIME, as this file is handed one — every service standing and
 * every enabled plugin already mounted.
 *
 * ## Why a RUNTIME and not a list
 *
 * A list is what a composition root reads when composition happens once. This
 * one does not: a plugin is a fiber, a registration is a finalizer on that
 * plugin's scope, and a plugin that is disposed unwinds its sibling surface, its
 * kinds, its wake declaration and its listeners without asking anybody. So what
 * this file holds is the thing those registries hang on, and it reads them at
 * the moment it needs them rather than copying them at boot.
 *
 * ## The three registries it reads
 *
 * `composed()` — the siblings to mount on the rooted bundle. `declared()` —
 * which plugins ring, and what each says when its doorbell stops watching.
 * `kinds()` is read one floor up, in `./serve.ts`, because the store validates
 * through it and the store opens first.
 *
 * ## ...and the three doors it drives
 *
 * `published(snapshot)` on every published revision, `quiet` when the store has
 * never published, and `saw(event)` for every conversation event. All three are
 * EFFECTS, and the first two are awaited where they are rung: the statements
 * after them write a world every plugin has already re-derived.
 *
 * They are DOORS rather than events for a reason an earlier header had
 * backwards: it said "both are EMITS, so a listener that throws is one
 * listener's problem — the dispatcher contains it", and Cordis's `emit` is a
 * bare `Reflect.apply` loop with no `try`, so it contained nothing. One plugin
 * throwing on a revision took every LATER plugin's reading of it down, and the
 * owned fiber that published it. The door wraps each handler once instead, so
 * the sentence that header always wanted to say is now true.
 *
 * Neither of the first two is a teardown hook (`@olai/plugin-api`'s `Vault`
 * argues why the second one's name matters).
 *
 * ## AND THIS FILE HAS NEVER HEARD OF CORDIS
 *
 * It held a `Context` and reached `ctx.surfaces`, `ctx.wakes`, `ctx.vault` and
 * `ctx.watching` off it — which meant the composition root was the second
 * package in the tree that knew what the plugin runtime is written on. What it
 * holds now is `Plugins`: olai's own doors, in Effect, and the engine under them
 * is `@olai/effect-cordis`'s business alone.
 */
export interface PluginRuntime {
  /** The doors every service hangs behind — `@olai/plugin-api`'s `Plugins`. */
  readonly plugins: Plugins
  /**
   * TOLD WHEN A SIBLING ARRIVES OR LEAVES — the re-compose, filled in by
   * {@link bind}.
   *
   * A mutable holder rather than a callback passed at construction, and the
   * ORDER is the reason: the services are constructed before the store opens
   * (a plugin teaches the vault its vocabulary, and the store validates through
   * it), and the thing that knows how to re-compose is the rooted bundle, which
   * does not exist until this runtime is built. So `./serve.ts` makes the
   * holder, hands it to `openPlugins` as its `changed` callback, and hands it
   * here; {@link bind} fills it in and every later register or dispose comes
   * through it.
   */
  readonly onChange: { run: () => void }
  /**
   * EVERY PLUGIN THIS BUILD HAS, in bundle order — not the ones that are
   * running.
   *
   * The roster carries a row per BUILT plugin and says of each whether it runs,
   * so the row that says `false` has to come from somewhere other than what was
   * composed. This is that list, read off the bundle's rows before anything was
   * mounted.
   */
  readonly built: ReadonlyArray<string>
  /**
   * ...and what `--plugins` was GIVEN, unexpanded — `null` for a flag nobody
   * typed.
   *
   * It travels unexpanded because the line under the preferences row names a
   * given flag and otherwise says the built-in default, and a value that had
   * already expanded `null` into the full list could not tell a reader which of
   * the two they were looking at. The git pin keeps the same distinction one
   * setting over.
   */
  readonly pinned: ReadonlyArray<string> | null
  /**
   * WHAT BECAME OF EACH ROW, as the loader left it — the word a preferences row
   * wears when `running` is `false`, and the plugin's own words when its start
   * threw.
   *
   * ## A BOOT SNAPSHOT, and that is a phase boundary rather than a shortcut
   *
   * `running` is read LIVE, off what has registered a sibling surface, and this
   * is not: it is taken once, after `mountBundle` settles, because a fiber's
   * error is private and reachable only by awaiting it, and the roster is
   * republished synchronously from a re-compose. The two cannot disagree
   * because {@link rosterOf} lets the live reading WIN — a name that is
   * composed says `running` whatever the snapshot remembers, and the snapshot
   * is spent only on the rows that are absent.
   *
   * Nothing in this phase mounts or fails a plugin after the boot: the bundle
   * is mounted before the store opens and nothing turns a row off afterwards.
   * The day something can (the preferences toggle, phase 6) this is the second
   * of the two places that has to learn to move — `./propKinds.ts` names the
   * first, and for the same reason.
   *
   * EMPTY IS LEGAL and is what every caller that does not care passes: a row it
   * has nothing to say about is `off`, which is what `running: false` has always
   * meant on its own.
   */
  readonly report: ReadonlyMap<string, RowReport>
}
export interface Wiring {
  /** THE SERVED word: the machine this process runs on, minted ONCE per
   *  serve by the composition root (`./hostname.ts` is the receptacle and
   *  says why the mint is the root's): `app.get` answers it, and the
   *  install manifest was made of it at listen, so a hostname that moved
   *  under a running server drifts neither. */
  readonly hostname: string
  /** WHEN this process started, as ISO-8601, minted with the hostname at
   *  the composition root so a later `app.get` cannot drift from the first.
   *  The client's uptime chip ticks from this; the wire never sends a
   *  duration. */
  readonly startedAt: string
  readonly store: Store
  /**
   * THE PLUGIN RUNTIME, or `null` for a runtime that is to have none.
   *
   * ## What this slot has been, in three shapes
   *
   * It held ONE NAMED FIELD PER APPLIANCE — an environment, a clock and an
   * injectable dial; an environment, the served directory and an injectable
   * dial. Two records with the nouns changed, on the interface of the package
   * that must not know either noun.
   *
   * It then held one LIST's worth of ingredients — what the process can see,
   * what time it is, which directory this is about, and a seam for a test —
   * which this file spent building a `PluginServices` blob per plugin and
   * pushing it into `SERVERS`, keyed by hand.
   *
   * It holds a mounted CONTEXT now ({@link PluginRuntime}). The ingredients
   * moved to `./serve.ts`, where they are constructed as SERVICES on that
   * context, and the plugins registered themselves into those services before
   * this runtime existed — because a plugin teaches the vault its vocabulary
   * and the store validates through it, so the fibers have to be up before the
   * directory opens. What is left for this file is to read three registries and
   * drive two events.
   *
   * ## What `null` means, which is stronger than what it used to
   *
   * `null` is the OFF setting and it is what `olai surface`, the headless faces
   * and every test in this package take: a one-shot CLI read has no use for a
   * standing socket to somebody's daemon, and dialing one would be a process
   * that touched an appliance on its way to printing a node.
   *
   * What it composes to is NOTHING — no sibling is mounted on the rooted
   * bundle, so no tag, no handler and no expose row is minted, and the wire
   * carries no `surface/<name>/` at all. A machine that simply is not running
   * the tool still gets the hollow arm, because that is what the appliance's
   * own half answers when its dial finds nothing.
   *
   * `--plugins` is not here at all any more, and its absence is the phase: it
   * is a `disabled` PATCH over the bundle's rows, applied where the rows are
   * read (`@olai/bundle`'s `bundle.ts`), so a plugin left out never mounts and
   * there is nothing here to filter. What travels on {@link PluginRuntime} is
   * only what a BROWSER has to be told: which plugins the build has, and
   * whether anybody typed the flag.
   */
  readonly plugins: PluginRuntime | null
  /** Absent when this serve has no ACP agent: the cell stays `off` and the
   *  procedures answer that they are. A directory is readable whether or not
   *  an agent is installed. */
  readonly chat: Chat | null
  /**
   * ...AND WHY, when {@link chat} is absent — `null` beside a chat that exists.
   *
   * Carried rather than re-derived, and that is the whole reason it is a field.
   * There are three ways to have no agent (`@olai/chat`'s `Roster`), a person
   * has a different thing to do about each, and only the composition root holds
   * both halves of the answer — the engine registry and what every probe said.
   * The panel drew its opening sentence by GUESSING between them until this
   * arrived, and one of its guesses named a launch path no documented way of
   * starting olai takes.
   */
  readonly noAgent: OffBecause | null
  /**
   * THE NODE AGENTS' CARRIER — the vault's half of the roster, which this
   * runtime WRITES on every published revision and reads back to fill the cell
   * ({@link ./agents.ts}).
   *
   * Handed in rather than built here because the CHAT is built before this
   * runtime is, and the chat asks it a question of its own: what a node agent
   * is, for the standing instruction it teaches a session. One carrier, two
   * readers, composed where both are in hand.
   *
   * Absent — like {@link Wiring.chat}, and usually with it — is a runtime that
   * publishes an empty roster: no vault reading is taken, so the cell says
   * there are no node agents, which is what a directory with none says.
   */
  readonly agents?: Roster | null
  /** The one writer. The edit procedures are the browser's door to it, and
   *  they hold nothing of their own: what a keystroke MEANT is resolved
   *  against this layer's own reading (`./edit.ts`) and run as one op. */
  readonly ops: Ops
  /** WHO this runtime's OWN face writes as, for the commit trailer — decided by
   *  whoever composed it, because a transport that named itself could name
   *  another. `web` in `../serve.ts`, which is the browser's; a face composed
   *  for an agent is served the same runtime under a different one
   *  ({@link writerAt}), which is what lets one store answer a tab and an
   *  `/mcp` client without either being recorded as the other. */
  readonly writer: Writer
  /**
   * The git half, taken from the ops layer rather than the layer itself: this
   * file publishes what somebody else decided, and "what is waiting to be
   * committed" is the whole of what it needs to know about writing.
   *
   * The two cells it feeds — what git is doing, and what is waiting — are
   * recomputed TOGETHER, on the same clocks, from the same survey. That is the
   * consistency rule made structural: two probes would be two answers, and a
   * page reading "no git here" beside a panel offering to commit four changes
   * is precisely the incoherence this arrangement forecloses. The header reads
   * both into ONE control (`one-git-indicator`), which is only safe because
   * they are published together.
   *
   * `state` is typed as the surface's own shape, which `@olai/ops` declares
   * structurally: the two drifting is a type error here rather than a mapping
   * to maintain.
   */
  readonly git: {
    /** BOTH cells, from ONE survey — see `@olai/ops`' `Ops.status`. Taking them
     *  separately meant two probes of the same repository per republish, and a
     *  window between them in which the two controls could disagree. */
    readonly status: Effect.Effect<Status>
    /** The one verb here, and it takes nothing: the current branch to the
     *  upstream it already has. What it changes is the unpushed count on
     *  `pending`. COMMIT is deliberately not its neighbour — it records WHO
     *  asked, so it is bound per face by {@link writing} rather than once
     *  here. */
    readonly push: Effect.Effect<PushResult>
    /** WHAT THIS DIRECTORY'S GIT POLICY IS (`../gitPolicy.ts`). Flags plus
     *  the built-in defaults, immutable after boot. There is no setter. */
    readonly policy: Policy
    /** The quiet-window loop, and the two things around it (`@olai/ops`):
     *  `observe` is handed every survey so the window re-arms on what actually
     *  moved, `loop` is the effect this file forks, and `resume` is what the
     *  Resume button calls. */
    readonly observe: Ops["observe"]
    readonly loop: Ops["loop"]
    readonly catchUp: Ops["catchUp"]
    readonly resume: Ops["resume"]
    /** Bumped by the ops layer whenever anything about git SETTLED — a commit
     *  by whichever door, a push, a refusal of either, or the loop stopping.
     *  None of them moves a served file, so this is the only thing that can say
     *  what a reader is owed has changed. */
    readonly settled: SubscriptionRef.SubscriptionRef<number>
  }
}

/**
 * The git half of {@link Wiring}, from the ops layer.
 *
 * ONE spelling, because there used to be two composition roots and the
 * consistency rule is that they must not diverge. Written out twice, the day one of them
 * grew a cell would be the day the two faces quietly stopped being the same
 * product. There is one root now (`./serve.ts`); this helper is still the
 * place the git half is assembled, so a second caller cannot drift.
 *
 * IT TAKES NO WRITER, and it used to. It carried a `commit` bound to one, which
 * was the right shape while a runtime served one face — and became a leftover
 * twin of {@link writing} the moment a runtime could serve several. Nothing read
 * it: `git.commit` is answered through `writing` so that `writerAt` can rebind
 * it, and a third writer-carrying member added HERE would have looked wired and
 * would not have moved with the face. Two lists of the same thing is precisely
 * what `runtime.test.ts` fences, so the second one is deleted rather than
 * fenced as well.
 */
export const gitWiring = (
  ops: Pick<Ops, "status" | "push" | "observe" | "loop" | "catchUp" | "resume">,
  policy: Policy,
  settled: SubscriptionRef.SubscriptionRef<number>,
): Wiring["git"] => ({
  status: ops.status,
  push: ops.push,
  policy,
  observe: ops.observe,
  loop: ops.loop,
  catchUp: ops.catchUp,
  resume: ops.resume,
  settled,
})

/** The chat, plus the two publishers the surface hands back once it exists.
 *  {@link bind} fills them in — the chat is built before the surface, because
 *  the surface's collection is seeded from the transcript, and the surface is
 *  what the chat publishes through. */
export interface Publishers {
  readonly state: (state: ChatState) => void
  readonly transcript: (change: Change) => void
  /** A background node scope changed without moving the foreground panel. */
  readonly live: () => void
}

/**
 * Every member whose answer RECORDS who asked, bound to one writer.
 *
 * Two of them, and the list is here rather than spelled at each face because
 * that is the whole point: {@link writerAt} rebuilds exactly these for a face
 * composed under a different writer, so "which members carry a writer" is one
 * declaration that both the binding and the rebinding walk. A third one added
 * here reaches every face without anybody remembering to say so.
 *
 * Why a face rather than a call. Git records the repository's own name and
 * email whoever asked, so the `X-Olai-Writer` trailer is the only thing that
 * can tell one agent's edits from a person's — and a transport that could name
 * itself could name another. Every caller of these is already identified by the
 * FACE it arrived on: the websocket is a tab (`web`), an owner-only socket is
 * an HTTP `/mcp` client, an in-process dispatch is whichever agent the
 * composition root built it for. So the writer is decided where the face is,
 * which is where every other fact about a face is decided.
 *
 * ...AND SO IS HOW FAR THE DOOR REACHES, which is the second half of the same
 * argument and arrives in the same record ({@link @olai/ops}'s `Caller`). A
 * subtree fence is one more fact about who is asking, and a caller could no more
 * name its own than it could name its own writer. `fence` is REQUIRED with no
 * default: `@olai/ops` reads an absent fence as "this door has no session" —
 * which is the honest reading of a keystroke, its derived undo, a plugin write
 * or a repeat roll, and the WRONG reading of an agent whose face forgot to say.
 * Every face in this tree is composed through this function or {@link writerAt}
 * below it, so a forgotten fence is a compile error and never a silently
 * unfenced agent.
 *
 * `git.commit` takes no fence and that is a named hole rather than an omission:
 * a commit moves no served byte and takes free-form paths, so a fenced agent can
 * still put another writer's pending work into history under its own trailer.
 * The fence's subject is the records the vault serves.
 */
const writing = (ops: Ops, caller: Caller) => ({
  ops: { run: (request: Request) => ops.run(request, caller.writer, caller.fence ?? undefined) },
  git: { commit: (request: CommitRequest) => ops.commit(request, caller.writer) },
})

/**
 * WHICH PLUGINS THIS BUILD HAS AND WHICH THIS SERVE RUNS, as the one value a
 * browser draws its read-only rows off ({@link Wiring.plugins} in, the
 * `plugins` cell out).
 *
 * NOT READ OFF WHAT WAS COMPOSED, and that is the whole feature rather than a
 * shortcut taken here: a composed list is the plugins that are ON, and the
 * preferences panel draws a row per plugin the BUILD has and says of each
 * whether it runs. A plugin left out is absent from every structure this
 * runtime holds — that is what `--plugins` means — so the row that says so has
 * to come from the BUNDLE'S ROWS rather than from anything this runtime can
 * see. {@link PluginRuntime.built} is that list, read before a thing was
 * mounted.
 *
 * `pinned` TRAVELS UNEXPANDED — `null` for a flag nobody gave, which means
 * the built-in default — because the line under the row names a given flag
 * and otherwise says the built-in default, and a value that had already
 * expanded could not tell those two apart. The git pin keeps the same
 * distinction one setting over, and `./pluginPolicy.ts` argues it where the
 * flag is read.
 *
 * NO PLUGIN SLOT ANSWERS {@link NO_ROSTER}: such a runtime composes no sibling
 * surface at all — `olai surface`, the headless faces, every test in this
 * package — so there is nothing for a roster to be about. Listing the build's
 * plugins as `running: false` there would be this file inventing a policy
 * nobody set, and asserting it is why this reading is exported rather than
 * inlined at its one call site.
 *
 * ## `running` IS THE FIBER'S STATE, and it took two wrong answers to get here
 *
 * It was `isEnabled(pin, name)` — a re-reading of the FLAG, exact only because
 * the filter ran once and nothing could move afterwards. Then it was WHAT A
 * PLUGIN HAD CONTRIBUTED: the sibling table, and later a union of that with the
 * engine registry. Both of those are proxies for the question, and each was
 * wrong for the first plugin that did not fit it — the flag says yes about a
 * fiber that is `PENDING` on a service, or `FAILED` in its own `apply`; the
 * union says no about a fiber that is running perfectly and happens to register
 * nothing this file thought to ask about. That second one is not hypothetical
 * and it is not behind us: the engines hit it (a picker row said `off` while its
 * agent answered), and a browser-only plugin — one whose server half registers
 * nothing at all — hits it again, invisibly, because the tab fetches a chunk
 * only for a row this says is running.
 *
 * So it is neither proxy now. `@olai/effect-cordis`'s `rowReport` asks the
 * FIBER, which is the thing the word is about, and this reads its answer.
 * `running` and {@link PluginRow.state} then come off ONE reading rather than
 * two clocks that could disagree — which is what the arm this deleted was
 * papering over (a row `running` in the report and absent from the live table
 * used to be reported `off`).
 *
 * WHAT IT COSTS is stated where it is owed: the report is a BOOT SNAPSHOT
 * (`@olai/bundle`'s `reportBundle` says so at its own door), so a fiber that
 * unloads mid-serve keeps its row until the next start. Nothing unloads a
 * server half mid-serve today, and the day something can — the preferences
 * toggle — that door and this reading move together, which is the arrangement
 * `reportBundle`'s header already names itself as one half of.
 */
export const rosterOf = (
  offered: Wiring["plugins"],
  /**
   * ...and what each of THOSE declared about a wake — the one thing a row
   * carries that a name cannot answer: what this plugin's doorbell WAKES ON, in
   * the plugin's own words (`@olai/plugin-api`'s `Wake`).
   *
   * ONLY ON A ROW THAT IS RUNNING, and that gate is the point rather than a
   * tidiness: this roster carries a row per BUILT plugin, running or not, so a
   * picker offered for a plugin this serve did not compose would store a pick
   * nothing will ever read. It falls out here for free, because a plugin that
   * is not mounted has no registration in this table either.
   */
  wakes: ReadonlyMap<string, Wake> = new Map(),
): PluginRoster =>
  offered === null ? NO_ROSTER : {
    built: offered.built.map((name) => {
      // A row the report has nothing to say about never loaded, and that
      // absence IS `off` rather than a missing case (`@olai/effect-cordis`'s
      // `rowReport`).
      const report = offered.report.get(name) ?? { state: "off" as const }
      const said = stateOf(offered, report)
      const live = said.state === "running"
      const wake = live ? wakes.get(name) : undefined
      return {
        name,
        running: live,
        // THE WORD, beside the boolean it refines — never instead of it. The
        // licences a browser reads its mounts out of ask the boolean; the panel
        // asks the word; and `@olai/surface`'s `pluginState` is what holds the
        // two together at the far end, including for a serve too old to send
        // one at all.
        state: said.state,
        // ...and the plugin's own sentence, on the one word that is a fault.
        // Core writes no clause of it, for the reason the wake's three strings
        // are the plugin's: a sentence with a hole in it would make core the
        // author of everything around the hole.
        ...(said.fault === undefined ? {} : { fault: said.fault }),
        // WHAT THE PICKER IS MADE OF, named one at a time rather than spread
        // whole — and the omission is the point. The three strings the strip
        // draws, plus the KINDS the picker may offer, because that is the one
        // fact core cannot work out for itself about which files a doorbell
        // could ever watch. What is left behind is `wake.faults`, a sentence per
        // way a doorbell can stop watching: those are DELIVERED rather than
        // drawn — they belong in the transcript, through the door below — and a
        // browser holding a copy of one would be a browser holding a message it
        // has no occasion to write.
        ...(wake === undefined ? {} : {
          wake: {
            subject: wake.subject,
            from: wake.from,
            waiting: wake.waiting,
            kinds: wake.kinds,
          },
        }),
      }
    }),
    pinned: offered.pinned,
  }

/**
 * WHICH OF THE FIVE WORDS ONE ROW IS IN — the live reading and the boot
 * snapshot, joined, and the one place `off` is told from `optIn`.
 *
 * ## The live reading wins
 *
 * A name that COMPOSED is `running`, whatever the snapshot remembers, and the
 * snapshot is spent only on the rows that are absent. That is what keeps the
 * word and the boolean from telling two stories about one plugin: `running` is
 * derived from the same reading, on the line above.
 *
 * ## And the one thing the loader cannot tell you
 *
 * The row's own `disabled` and the operator's flag are the SAME FIELD — that is
 * the whole of what makes `--plugins` a patch rather than a filter — so nothing
 * downstream of the patch can say which of them wrote it. What can is whether a
 * flag was given at all, which is `pinned`, which is here. So an absent row
 * under no flag is `optIn` (this build leaves it off until somebody asks) and
 * an absent row under a flag is `off` (somebody asked, and did not ask for
 * this). A person who went looking for a chip is owed that difference: one of
 * them names a flag they typed, and the other names one they have not.
 */
const stateOf = (
  offered: NonNullable<Wiring["plugins"]>,
  report: RowReport,
): { readonly state: PluginState; readonly fault?: string } => {
  switch (report.state) {
    case "failed":
      return report.fault === undefined
        ? { state: "failed" }
        : { state: "failed", fault: report.fault }
    case "waiting":
      return { state: "waiting" }
    case "off":
      // THE LOADER DECLINED TO LOAD IT, and `pinned` is the only thing left
      // that can say who wrote the `disabled` it declined on.
      return { state: offered.pinned === null ? "optIn" : "off" }
    case "running":
      return { state: "running" }
  }
  // NO `default` ARM, and that is the guard rather than an omission: the four
  // words are `@olai/effect-cordis`'s `RowState`, and a catch-all here would
  // absorb a fifth added upstream into `off` in silence — which is the exact
  // failure `@olai/surface`'s own `STATES` array is written to prevent one wall
  // over. Without one, a fifth word is a `tsc` error on this function.
}

/** One of those, as `implementSurface` wants it. A bound member is called with
 *  the bare input (`bind(ns, verb, (input) => handler({ input, ctx }))`), and
 *  the declaration below is called with `{ input, ctx }` — so the two shapes
 *  meet here, once, rather than {@link writing} having to be written twice in
 *  whichever one the reader is looking at. Neither of these two members wants
 *  `ctx`: what a write changes reaches every tab through the store. */
const impl =
  <I, A, E>(answer: (input: I) => Effect.Effect<A, E>) =>
  ({ input }: { input: I }): Effect.Effect<A, E> => answer(input)

/**
 * The same surface, served to a face that writes as somebody else.
 *
 * `bind` binds {@link writing}'s members once, under the writer the runtime was
 * composed with — `web` in `../serve.ts`. A face served to an AGENT wants the
 * identical runtime (one store, one set of cells, one revision) with those two
 * members recording that agent instead, and this is that: the same handler
 * record with exactly those tags replaced.
 *
 * A REBIND rather than a second `implementSurface`, which would be a second
 * runtime over the same store — two sets of connectors, two publishers, and two
 * answers to every question this file exists to make sure there is one of.
 *
 * The record is rebuilt with `emptyHandlers()` rather than spread into a
 * literal, because a handler record is null-prototype on purpose: a member
 * legitimately named `toString` must not collide with what an object literal
 * inherits (`@kolu/surface`'s `server.ts`). Every tag it produces is proved to
 * be one the group serves — by `restrictHandlers`, which every face applies —
 * so a mis-derived tag is a boot crash and not a hole.
 */
export const writerAt = (
  bound: Pick<Bound, "handlers">,
  ops: Ops,
  caller: Caller,
): SurfaceHandlers => {
  const handlers = emptyHandlers()
  for (const [tag, handler] of Object.entries(bound.handlers)) handlers[tag] = handler
  for (const [namespace, verbs] of Object.entries(writing(ops, caller))) {
    for (const [verb, handler] of Object.entries(verbs)) {
      handlers[surfaceTag(surface.tagPrefix, namespace, verb)] = handler as SurfaceHandler
    }
  }
  return handlers
}

export const bind = (
  wiring: Wiring,
): Effect.Effect<
  {
    readonly bound: Bound
    readonly publish: Publishers
    /**
     * THE TWO WIRE FACES, over exactly the surface this call composed.
     *
     * They come back from HERE rather than being read off `./faces.ts` at each
     * serving site, and the reason is a boot crash rather than a convenience:
     * `restrictHandlers` demands an exposure's universe EQUAL the served
     * group's tags, so a face built from a different reading of "which plugins
     * are on" refuses to bind, naming every tag it cannot account for. One
     * reading, one group, one face — the equality is then a proof rather than a
     * thing to keep true.
     */
    readonly faces: ReturnType<typeof facesOf>
  },
  never,
  Scope.Scope
> =>
  Effect.gen(function*() {
    // Seeded empty and filled by `connect`: `SubscriptionRef.changes` delivers
    // the current value before any update, so peeking at the ref here as well
    // would be the same read twice with a window between them.
    const errors = inMemoryStore<Verdict>(NOTHING_WRONG)
    const chat = wiring.chat
    /** This runtime's own log line, for the one place below that reports from
     *  outside an Effect — a stream's re-read, which the framework calls on a
     *  promise. What it SAYS is {@link ./report.ts}'s. */
    const say: Emit = yield* emitter
    /**
     * ... and A SECOND NAME FOR IT, for the one thing that is not a log line: a
     * doorbell's delivery ({@link doorFor}).
     *
     * `Emit` names its argument a line because logging is what every other
     * caller does with it, but what it IS is "run this Effect later, under the
     * services this fiber has" — and a delivery reaching core from a plugin's
     * watcher sink is in precisely the position `emit.ts`'s header describes:
     * a callback with no fiber under it. Its own name here, rather than
     * spelling `say` at the call site, because a reader who finds `say` around
     * a turn being started would be right to wonder what was being said.
     *
     * THE SAME CAPTURE, DELIBERATELY, and not a second `yield* emitter`.
     * Nothing runs between the two lines — no `annotateLogs`, no scope change —
     * so a second capture closes over an identical context: two variables that
     * must agree, with nothing making them, and a silent divergence waiting for
     * whoever adds an annotation above and reasonably assumes it reaches both.
     * With one capture and an alias it does.
     */
    const ring: Emit = say
    /**
     * WHO IS TOLD THE DIRECTORY MOVED — the pulse the two date streams re-read
     * on, published once per revision by the connector below.
     *
     * It carries NOTHING, and that is the design rather than an economy: a
     * pulse carrying the revision would be a second answer to what the
     * directory says, one a listener could act on WITHOUT reading the store and
     * therefore one free to disagree with it. Every listener goes back to the
     * ops layer's own gated read, which is the same read a keystroke is judged
     * against.
     *
     * The framework's channel and not a listener set of ours: `publish`, and a
     * `consume` that dispatches to a callback and hands back its own teardown,
     * which is exactly the pair a stream's poll shape asks for. Nothing is
     * coalesced here and nothing needs to be — the poll loop folds every tick
     * that arrives during a read into one re-read, and the pulse is
     * LEVEL-triggered ("go and look again"), so two in flight mean what one
     * does.
     */
    const revisions = inMemoryChannel<void>()

    /**
     * The revision the wire is holding — `null` until the store has published
     * one. Each collection's entries are that revision's own map, and `readAll`
     * hands one over as it is: a fresh subscription's snapshot and the deltas an
     * open one is watching are two readings of one map rather than two copies to
     * keep in step. Kept WHOLE rather than as its pieces, so the next revision
     * is derived from one thing (see {@link publishedOf}).
     *
     * IT IS THE SAME MAP most revisions, and that is the projection's own
     * arrangement rather than something to be read into: since
     * `perf-published-maps` a collection's entries are CARRIED from one revision
     * to the next and written into, so a revision costs the size of what moved
     * and not the size of the directory. What that requires of this file is one
     * line and it is the line below — `held` is REPLACED with what the
     * projection returns, on the same synchronous stack that writes the deltas,
     * and the value handed in is not read again. Nothing else here may keep a
     * previous revision, and nothing does.
     */
    let held: Published | null = null
    /** What a collection reads before the store has published anything. One
     *  value rather than a fresh map per call: `readAll` is asked on every
     *  subscribe, and nothing may write to what it hands back. */
    const NOTHING_YET = new Map<string, never>()
    /**
     * The bodies the set does NOT keep, read when a reader opens one — see
     * {@link ./bodies.ts}, which owns the whole arrangement.
     *
     * It publishes straight onto the collection, which for a member with no
     * `deltas` verb is exactly the sockets subscribed to that one key: the
     * reader who opened the file. The entry it replaces is the one the last
     * revision published, so the `rev` a body arrives under is the revision
     * that named the file rather than whatever moment the read finished — and
     * a file that left the set while it was being read publishes nothing.
     *
     * `held` is not touched. That is the memory claim in one line: the body
     * goes to the wire and the projection goes on holding a path.
     *
     * WHO IS STILL READING is not inferred here either. The documents
     * collection hands its `holders` to the framework beside `readOne` (below),
     * so every per-key `get` takes a hold that lives exactly as long as that
     * subscription — and this module re-reads a file for exactly the readers who
     * have it open at that moment and stops the instant the last one goes.
     */
    const bodies = yield* Bodies.make({
      read: wiring.store.body,
      publish: (path, body) => {
        const entry = held?.documents.entries.get(path)
        if (entry === undefined) return
        published?.collections.documents.upsert(
          path,
          "refused" in body
            ? { rev: entry.rev, text: null, refused: true }
            : { rev: entry.rev, text: body.text, refused: false },
        )
      },
    })

    /** The surface's own write face, once there is one to publish through —
     *  filled the moment `implementSurface` returns. The connector installs
     *  synchronously, so the FIRST revision is written before this exists; that
     *  is exactly the moment there is nobody subscribed to hear it, and `held`
     *  above has it. */
    let published: SurfaceRuntime<typeof surface.spec>["ctx"] | null = null

    /**
     * WHAT A GROWING ROW COSTS THE WIRE — the transcript's changes, turned
     * into frames on a clock ({@link @olai/chat}'s `cadence`, which argues the
     * whole thing).
     *
     * HERE rather than in `../serve.ts`, beside the two collections it writes,
     * because what it decides is a delivery question and this is the module
     * that owns every other one: which member a fact lands on, in what order,
     * and what a new subscriber is seeded with. The chat knows only that it
     * published a change.
     *
     * ROWS BEFORE PIECES, and that is the whole of what the ordering has to
     * promise: a row's upsert carries its text whole and supersedes every piece
     * of it, so the removes must not reach a reader first — the join is
     * idempotent either way, but only this order never shows a paragraph
     * getting shorter while somebody is reading it.
     */
    const saying: Cadence = cadence({
      onFrame: (frame) => {
        const collections = published?.collections
        apply(collections?.transcript, frame.rows)
        apply(collections?.saying, frame.pieces)
      },
    })
    // A window still open when this runtime closes is a piece nothing will ever
    // be published to. Registered here, beside the thing it stops, rather than
    // left to a timer that would fire into a closed surface.
    yield* Effect.addFinalizer(() => Effect.sync(() => saying.stop()))

    /** The two git cells, once their connectors have been handed them. Held
     *  rather than reached for through `ctx` because the commit procedure has to
     *  republish the moment it is done — a commit changes what is waiting
     *  without changing one byte on disk, so no revision will ever say so. */
    let pendingCell: { set: (value: Pending) => void } | null = null
    let gitCell: { set: (value: GitState) => void } | null = null
    /** The AGENTS cell, held for the same reason and one stronger: its second
     *  clock is the chat, which reaches this file as a callback rather than as
     *  a stream ({@link republishAgents}). */
    let agentsCell: { set: (value: Agents) => void } | null = null
    /** The PLUGINS cell, held for the agents cell's reason: its clock is a
     *  fiber arriving or leaving, which reaches this file as a callback off
     *  `openPlugins`'s `changed` rather than as a stream ({@link republishPlugins}). */
    let pluginsCell: { set: (value: PluginRoster) => void } | null = null

    /**
     * THE ROSTER, ASSEMBLED AND PUBLISHED — the one place the two halves are
     * put together, called from both of the clocks that move either
     * ({@link ./agents.ts}).
     *
     * Nothing at all before the cell's connector has run, and nothing at all
     * for a serve with no carrier: a chat frame arriving before the first
     * revision has no vault reading to join against, and publishing an empty
     * roster for it would be a sidebar that flickered empty on the first turn.
     */
    const republishAgents = (): void => {
      const cell = agentsCell
      const carrier = wiring.agents
      if (cell === null || carrier === undefined || carrier === null) return
      cell.set(carrier.rowsWith(
        chat === null ? [] : chat.overheard(),
        chat === null ? new Map() : chat.live(),
      ))
    }

    /**
     * ...AND THE PLUGIN ROSTER, on its own clock — a fiber arriving or leaving.
     *
     * Nothing before the cell's connector has run, which is the first
     * {@link recompose}: the runtime is built, the connectors start inside the
     * call that builds it, and the mounts follow. The seed carries the same
     * value, so a page that loads between the two reads the roster rather than
     * an empty one.
     *
     * A serve with no plugin runtime never calls this at all — there is no
     * `changed` for anything to move on — and its cell holds `NO_ROSTER`
     * for the life of the process, which is what a runtime that composes no
     * sibling has to say.
     */
    const republishPlugins = (): void => {
      pluginsCell?.set(roster())
    }

    /**
     * Both git cells, from one round of questions.
     *
     * ONE statement, so they cannot be recomputed on different clocks or from
     * different surveys — which is the whole of the coherence between the two
     * halves of what the header says about git. `Effect.all` because they are
     * independent asks of a layer that memoises the expensive half between them.
     */
    const republishGit = Effect.flatMap(
      wiring.git.status,
      ({ git, pending }) =>
        Effect.flatMap(
          Effect.sync(() => {
            pendingCell?.set(pending)
            gitCell?.set(git)
          }),
          // ... AND THE LOOP IS TOLD, off the same survey. The quiet window is
          // armed by the arrival of a reading rather than by a clock of its
          // own, so this is where it hears about a write, a commit, a policy a
          // browser moved, and the resume that follows a stop. Which of those
          // actually re-arms it is `@olai/ops`' rule (`armedOn`), not this
          // line's: the slow sweep over a quiet directory says nothing new and
          // must not push the window out.
          () => wiring.git.observe(pending),
        ),
    )

    /** A chat verb, when there may be no chat. The cell already reads `off`, so
     *  a browser has been told; a stray call is answered as a REFUSAL rather
     *  than as a runtime defect, because "chat is off" is a thing a caller can
     *  be told and the vocabulary already covers it. */
    const withChat = <A>(
      use: (chat: Chat) => Effect.Effect<A, OpFailure>,
    ): Effect.Effect<A, OpFailure> =>
      chat === null
        ? Effect.fail(
          new UsageFailure({
            reason: "chat is off: no ACP agent is configured for this directory",
          }),
        )
        : use(chat)

    /**
     * One keystroke, all the way through: read the set, work out which op the
     * intent names ({@link ./edit.ts}), run it — and say what would take it
     * back.
     *
     * The read is the ops layer's own — one answer to "there is nothing loaded
     * yet", shared with the tools — and the failure channel is the one every
     * writer already speaks, so a refusal reaches the browser as the
     * validator's rows rather than as a transport error the editor could only
     * shrug at.
     *
     * The inverse is derived from THAT read, which is the reading the request
     * was resolved against, and it rides back on the success — so an undo
     * stack is a list of things the server said, and never a browser's own
     * account of a tree it drew some frames ago.
     *
     * It answers the BROWSER's `Applied` rather than the ops layer's, which is
     * the whole of the narrowing: the node the write was about, the nudge if
     * the rollup had something to say, and what would take it back if anything
     * would. Absent rather than empty for a write nothing would reverse — the
     * field is what a stack is fed from, and an entry that undoes to nothing is
     * an entry ⌘Z would spend on nothing. One place decides that, here, rather
     * than a `[]` at one end and a test for it at the other.
     */
    const applyEdit = (edit: Edit): Effect.Effect<Applied, OpFailure> =>
      Effect.map(
        // The read, the resolve and the run are `./resolving.ts`'s, shared with
        // the `capture` tool's plan arm — and with them the second CHOICE for the two
        // verbs whose answer is one (`reresolves`): a `⌘K` `+` or a pin in one
        // tab used to be refused naming a file the OTHER tab had just minted,
        // which is the resolver's own answer going stale rather than anything
        // the person who pressed the key did.
        // A KEYSTROKE HAS NO SESSION, which is what `fence: null` says out loud.
        runResolved(
          wiring.ops,
          { writer: wiring.writer, fence: null },
          (at) => requestFor(at, edit),
          reresolves(edit),
        ),
        ({ at, request, done }) => {
          // AFTER the run, because an `add`'s inverse names the row the write
          // brought into being — and from the reading the winning request was
          // RESOLVED against, because everything else it needs the write is
          // about to change. That pairing is why `runResolved` hands both back:
          // when the arm was chosen a second time, the first reading is not the
          // one this request is about.
          const undo = inverseOf(at, edit, request, done.id)
          return {
            id: done.id,
            title: done.title,
            file: done.file,
            ...(done.nudge === undefined ? {} : { nudge: done.nudge }),
            ...(undo.length === 0 ? {} : { undo }),
          }
        },
      )

    /**
     * WHICH FILE the shelf is, and which one the inbox is — carried from one
     * published revision to the next rather than re-derived per one
     * (`@olai/format`'s `conventions.ts`, `perf-filename-conventions`).
     *
     * Both readings below are re-answered on every revision and both used to
     * start by walking every served file: the basename of each folded and
     * compared, the matches collected and sorted, for an answer that moves only
     * when a file is ADDED, REMOVED or RENAMED. A keystroke in one outline paid
     * for the whole directory to be told the shelf is still `Pins.olai`, and
     * the cell's `equals` then swallowed the frame having already bought the
     * work.
     *
     * TWO CARRIERS AND NOT ONE, because the two questions are asked of two
     * different lists and that difference is deliberate: the inbox is found
     * among the outlines the SET SERVES (an empty or torn `Inbox.olai` has no
     * records and so no entry in `byFile`, and the door and the count must
     * name the file a capture would land in), while the shelf is found among
     * the files the DERIVATION HOLDS RECORDS FOR, which is where its rows come
     * from. One carrier over one of the two lists would be one of the two
     * readings quietly answering about the other.
     *
     * A THIRD carrier stood here, for a file a PLUGIN owns by convention. It
     * is gone from this file and not from the product: which basename a plugin
     * claims is the plugin's, so the carry runs inside the plugin that owns it,
     * on the same `conventionServed` this file uses for its own two. A general
     * package holding one appliance's convention was the residue the plugin
     * wall absorbs.
     *
     * WHETHER THE PATH SET MOVED IS ASKED OF THE SNAPSHOT'S OWN DELTA — the
     * `changed` / `removed` the store publishes beside the value, which is
     * the same pair the projection below slices a revision by. A comparison of
     * the whole path set would be the walk under a different name; these two
     * lists are the size of the WRITE. What that rests on is spelled out where
     * the check is (`@olai/format`'s `conventions.ts`), including the count
     * that catches a departure a `resync` left unnamed — and, here, that a
     * connector sees EVERY published revision in order, since a delta names
     * only what moved since the last one. That is the store's own arrangement
     * (`SubscriptionRef` publishes to an unbounded `PubSub`) and it is
     * already load-bearing one member down: the projection below slices a
     * revision against the one it published last.
     *
     * ONE FIBER EACH, which is what makes a plain binding safe here: a
     * connector is one `runForEach` over the revision stream, so these are
     * read and written on that stream's own stack and never from two places at
     * once — the same arrangement `held` above keeps for the projection.
     */
    let shelfFile: Convention | undefined
    let inboxFile: Convention | undefined
    /**
     * THE MOUNTED PLUGIN RUNTIME, or `null` — and this file no longer builds
     * anything per plugin.
     *
     * ## What this replaces, and why the replacement is shorter than one of them
     *
     * There were two blocks here: a call to one appliance's own half-
     * constructor, naming three of that appliance's members, with two vault
     * walks imported from appliance-shaped filenames in this package and two
     * log channels; and beside it the same block for the second appliance with
     * the nouns changed. Those left when the plugins did, and what stood in
     * their place was a `.map` over `SERVERS` that built a `PluginServices` blob
     * per plugin — an environment, a clock, a served directory, two log
     * channels, a dial keyed by name and a delivery door keyed by name — and
     * pushed it in whole.
     *
     * Neither is here now. The services are constructed in `./serve.ts`, once,
     * on the context {@link PluginRuntime} carries; every plugin mounted itself
     * into them before this runtime existed; and the two KEYED fields — the
     * dial and the delivery door — are keyed by the CALLING FIBER rather than by
     * a name this file closed over. That was the one thing on the old blob this
     * file genuinely had to get right, and it is not this file's to get wrong
     * any more (`@olai/plugin-api`'s `DeliveryDoors` argues the move).
     *
     * ## What is left for a composition root
     *
     * Reading three registries and driving two events, which is what the rest of
     * this block is. Nothing here names a plugin, opens a `deps`, or calls a
     * constructor.
     */
    const offered = wiring.plugins
    /** The plugin context, or `null`. Named rather than reached through
     *  `offered` at each use, because the four readings below are one question
     *  asked at four moments and a reader should see that they are. */
    const plugins = offered?.plugins ?? null
    /**
     * EVERY SIBLING COMPOSED RIGHT NOW — read, never cached.
     *
     * A function and not a value, and the difference is the whole of what a
     * runtime buys over a registry: a plugin that unloads takes its sibling out
     * of this list at the moment it unloads, and every caller below that asks
     * again gets the answer that is true now. A `const` here would be the
     * spike's own defect — a roster copied at boot, read forever, and quietly
     * wrong the first time anything moved.
     */
    const siblings = (): ReadonlyArray<Registered> => plugins?.composed() ?? []
    /**
     * THE WATCHING BUS, as this file reaches it — conversation events, pushed to
     * every plugin that subscribed. Human messages are not among them.
     *
     * The SET of subscribers is not here any more. It was a `Set` and a
     * `subscribe` returning an unsubscribe the plugin had to remember to call;
     * it is the `Watching` door now, where a subscription is an effect on the
     * subscribing fiber and a plugin that unloads stops being told without
     * anybody remembering anything. What is left for a composition root is the
     * OTHER end: saying what happened, once, to whoever is listening.
     *
     * `null` on a serve with no plugin runtime, where there is nobody to tell.
     */
    const seen = (event: ConversationSeen): void => {
      if (plugins !== null) ring(plugins.saw(event))
    }
    const whoOf = (state: ChatState): { agent: string; session: string } | null =>
      state.session !== null && state.talking?.kind === "agent"
        ? { agent: state.talking.id, session: state.session.id }
        : null
    let lastStatus: ChatState["status"] | undefined
    /** Agent rows already in the transcript when the current turn started —
     *  `replied` is the row THIS turn produced, not the newest agent row in
     *  the whole conversation (a cancel / gone / failed turn has no prose). */
    let agentSeqAtTurn = -1
    /** Doorbell rows already pushed, so a later mark on the same entry
     *  (`transcript.refused`) is not a second digest. */
    const deliveredIds = new Set<string>()
    let deliveredFor: string | undefined
    /**
     * WHICH COMPOSED PLUGINS RING AT ALL, and what each says when its doorbell
     * stops watching — read the same way {@link siblings} is and for the same
     * reason.
     *
     * A scope written for anybody else would be a row nothing will ever read, so
     * the member that writes one refuses it. The declaration is carried WHOLE
     * rather than as three tables, because the two members are asked in one
     * breath: {@link faulted} judges a row by the kinds and then reaches for the
     * sentence that judgement names.
     *
     * ## One registry where there were two lists that had to agree
     *
     * The gate used to be built from `SERVERS` and the roster's rows from
     * `PLUGIN_NAMES` — two doors, held equal by a test, because routing the gate
     * through the roster would have made a doorbell depend on the plugin also
     * being on the wire door. Both are this registry now. A plugin that
     * registered a wake rings; one that did not, or that has since unloaded,
     * does not; and there is no second list for the two to disagree across.
     *
     * A TABLE OF WORDS THE PLUGIN WROTE, which is the only kind of table core is
     * allowed to keep about words: nothing here is composed, joined, abbreviated
     * or interpolated into. The whole of what this file does with a sentence out
     * of it is hand it back through {@link Chat.doorFor}'s `deliver`, and the
     * whole of what it does with the kinds is COMPARE them against `fileKind`'s
     * answer — a registry lookup, not a reading.
     *
     * A name with no entry gets nothing said — a pick stored against a plugin
     * this serve did not compose, which is a row the strip already declines to
     * draw (`@olai/web`'s `wake.ts`). There is no half here to ring it and no
     * words to ring it with, so the row is marked and nobody is told, which is
     * the honest arm rather than core reaching for a sentence of its own.
     */
    const rings = (): ReadonlyMap<string, Wake> => plugins?.declared() ?? new Map()
    /** ...and the same question asked about ONE name, which is what the member
     *  that writes a scope asks. */
    const composedWake = (name: string): boolean => rings().has(name)
    /**
     * A SCOPE ITS DOORBELL CANNOT WATCH — found here, said by the plugin, once.
     *
     * ## Why core is the one that detects
     *
     * Core owns every half of both questions and no plugin owns any: the SERVED
     * SET is this connector's own revision, the KINDS a doorbell can watch are
     * a declaration the plugin handed this file at composition, and the PICKS
     * are `@olai/chat`'s record. A doorbell asked to notice its own file had
     * gone would be a doorbell deriving from a file it cannot find, which is
     * precisely the state that produces no signal at all — that is the defect,
     * not a place to fix it ({@link Chat.faults} tells the whole story).
     *
     * ## TWO CAUSES, ONE WALK
     *
     * The file is not in the set at all — renamed, moved, deleted — or it is in
     * the set and `fileKind` says it is not one of the kinds that doorbell
     * declared. The second is the state the picker used to be able to produce:
     * every served file was offered, so a person could scope a conversation to
     * a `.md`, and a wake that derives its set from a file's NODES then watched
     * the empty set for ever while the heartbeat went on reporting a live
     * watcher. The picker offers only the declared kinds now (`@olai/web`'s
     * `chat/scopable.ts`); this arm is what answers for the picks that were
     * stored before it did, and for a stale tab or a hand-edited record.
     *
     * GONE IS ASKED FIRST, because a file that is not served has no kind and
     * "renamed" is the more actionable of the two things to be told.
     *
     * ## `documentAt`, and not `derived.byFile`
     *
     * "Still served" is asked of the SET, which is every file the directory
     * holds a place for. `byFile` groups PARSED RECORDS, so a file that is
     * present and EMPTY — or present and torn — has no entry in it, and a scope
     * pointed at one would read as gone: a person who emptied their lane file
     * for a minute would be told their doorbell had broken, and told again
     * never, because the flag is a once. The set is the honest source and it is
     * the same disagreement {@link conventionServed} and `conventionRecorded`
     * are two doors for one member above.
     *
     * A BINARY SEARCH PER PICK, and no walk. `documentAt` searches the set's
     * own path-ordered list, and the picks are a few dozen at most — so the
     * question costs the SCOPES rather than the DIRECTORY, which is what makes
     * it affordable on a hook that fires for every keystroke that lands in an
     * outline. Handing `@olai/chat` a set of missing paths instead would have
     * meant walking the directory here to build one. The kind question is
     * cheaper still and does not change that arithmetic: a lookup in a table
     * built once at composition, and `fileKind` over one name.
     *
     * ## ON ITS OWN FIBER, and what that costs
     *
     * The mark is a filesystem write and this connector is synchronous, so the
     * work is forked under this fiber's services ({@link ring}, for the reason
     * it exists). What that means is that the mark lands SHORTLY after the
     * revision that made it true, not during it — so a plugin deriving on this
     * same revision still sees the scope on its door for one pass. That costs
     * nothing under either cause, and for one reason: the derivation finds
     * nothing to say. A file that is gone is not in the revision at all, and a
     * file of a kind the doorbell cannot read is one it could never derive
     * anything from, which is the whole of why it is a fault. From the next
     * revision the row is off the door entirely ({@link Chat.doorFor}).
     */
    const faulted = chat === null ? (): void => {} : (snapshot: VaultRevision): void => {
      ring(Effect.flatMap(
        chat.faults(
          (plugin, file) => {
            if (documentAt(snapshot.value.set, file) === undefined) return "gone"
            // THE DECLARATION, ASKED THE WAY THE PICKER ASKS IT — `watchable` is
            // the wire member's own reading (`@olai/surface`'s `plugins.ts`),
            // and it is shared rather than spelled here because these two are
            // the ends that must agree: a serve judging by a rule of its own
            // would fault on a pick the browser had just offered. A plugin with
            // no entry is not judged at all — `sayable` has already left its
            // rows alone.
            const kinds = rings().get(plugin)?.kinds
            if (kinds === undefined) return null
            return watchable(kinds, file) ? null : "unwatchable"
          },
          // A ROW WHOSE TENANT CANNOT SPEAK IS NOT MARKED. `rings` holds a
          // declaration only for a plugin this serve COMPOSED and that made
          // one, so a serve run without a tenant leaves its rows alone rather
          // than burning their one signal unheard.
          (plugin) => rings().has(plugin),
        ),
        (fell) =>
          Effect.forEach(fell, (row) => {
            const wake = rings().get(row.plugin)
            if (wake === undefined) return Effect.void
            // WHICH SENTENCE, INDEXED BY THE CAUSE the walk recorded on the row
            // (`@olai/chat`'s `Scoped.fault`) — never chosen between arms here.
            // The declaration is keyed by the fault's own word, so this line
            // cannot answer for a cause nobody wrote a sentence for: a third one
            // is a type error in every plugin that rings, where a ternary would
            // have fallen through and told somebody their file was renamed while
            // it sat in front of them.
            const words = wake.faults[row.fault]
            // A THUNK, ASKED WHEN THE WORDS GO IN, which is the whole reason
            // `deliver` takes one: this body may wait out a running turn, or
            // wait for somebody to open the conversation at all, and by then
            // the file may be back. A scope that healed is on its plugin's door
            // again, so its absence from that list is what "still broken" means
            // — and answering `null` keeps the sentence out of the transcript
            // rather than telling a person their doorbell is broken over a
            // strip that is already drawing it fine.
            //
            // The other two ways this row can stop deserving the sentence —
            // somebody cleared the doorbell, or pointed it elsewhere — need
            // nothing here: every scope write takes back what that doorbell was
            // holding (`@olai/chat`'s `Holding.dropped`), so the body is gone
            // before it can be asked.
            const healed = (): boolean =>
              chat.doorFor(row.plugin).scopes().some((one) =>
                one.agent === row.agent && one.session === row.session && one.file === row.file
              )
            const still = (): string | null => healed() ? null : words
            // NO COALESCING KEY. A held body with one replaces the last body
            // under it, which is right for a digest that re-derives itself and
            // wrong for this: two faults on one conversation are two separate
            // things that happened, and the second must not swallow the first.
            // This is the arm `@olai/chat`'s `deliveries.ts` describes as a
            // sentence about a moment that cannot be re-derived.
            // THE PAIR AND NOT THE ROW. A delivery is addressed to a
            // conversation, and handing the whole scope over would put this
            // plugin's own `plugin` and `file` columns on an address — the
            // caller's question answered a second time, in the one place the
            // keying is the safety property.
            return chat.doorFor(row.plugin)
              .deliver({ agent: row.agent, session: row.session }, still)
          }, { discard: true }),
      ))
    }
    /**
     * ...and the same two facts as the value a browser draws its read-only rows
     * off — every plugin this binary HAS, which of them this serve is RUNNING,
     * and whether anybody typed the flag.
     *
     * A FUNCTION, because it moves. It used to be a `const`: the flag was read
     * once at the composition root, the cell was seeded with the answer, and
     * `plugins.ts` said in as many words that it "moves at most once per serve,
     * which is why it has no connector". That was true of a filter that ran
     * once; it is not true of a runtime. A fiber that fails, unloads or comes
     * back moves the row, so this is asked again on every register and dispose
     * and the cell is republished ({@link republishPlugins}).
     */
    const roster = (): PluginRoster =>
      rosterOf(offered, rings())

    /**
     * EVERY CONNECTOR BELOW READS `store.reads`, and every frame on it is a
     * pair: the set, and how old it is (`@olai/store`'s `Aged`). These take
     * the first and drop the second, which is right and is not the leak it
     * looks like — a frame HERE is a publish, so its age is nothing, and there
     * is nothing yet on this wire for a currency axis to be drawn on.
     *
     * The question a vintage answers is the one a frame cannot: not "how old
     * was this when it arrived" but "how old is what I am still looking at",
     * which is asked by whoever is holding it and is asked through
     * `Store.read`. The agent's face asks it on every read (`./mcp/tools.ts`);
     * the browser's does not ask it yet, and the day it does the answer is a
     * member of its own rather than a field smuggled onto one of these.
     */
    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      cells: {
        errors: {
          store: errors,
          connect: (cell) =>
            Stream.runForEach(
              SubscriptionRef.changes(wiring.store.errors),
              (next) => Effect.sync(() => cell.set(next ?? NOTHING_WRONG)),
            ),
        },
        chat: {
          // NO CHAT IS A STATE WITH A REASON, and the reason rides the same cell
          // rather than a second one: the panel draws this face out of one value
          // it already subscribes to, and a tab that has not heard yet holds
          // `CHAT_OFF` itself, whose `off` is `null` — "not told" rather than
          // any of the three ways of being off.
          store: inMemoryStore<ChatState>(
            chat === null ? { ...CHAT_OFF, off: wiring.noAgent } : chat.state(),
          ),
        },
        /**
         * THE AGENTS ROSTER, re-assembled whenever EITHER of its halves moves —
         * the one cell on this surface with two clocks.
         *
         * A published revision moves the vault's half: a node gains the `agent`
         * property, is renamed, or grows a child. A CHAT FRAME moves the
         * machine's half: a conversation opens, an agent's last line is written
         * down, a session is taught. Both go through {@link republishAgents},
         * which is the whole reason it is a named closure rather than two
         * bodies — two assemblers over one carrier would be two answers to what
         * the roster is, and the one that disagreed would be the one nobody was
         * looking at.
         *
         * The chat's clock is not a subscription: `publish.state` below is
         * already the one door every chat frame comes through, so the roster is
         * republished from there rather than by watching the cell this runtime
         * itself writes. A cell that watched its own sibling would be a loop
         * waiting to be closed by somebody adding a line to the wrong place.
         *
         * A revision that moved no node agent, and a chat frame that moved no
         * binding, write the same value — which the cell's `equals` swallows
         * (`@olai/surface`'s spec). The chat cell moves several times a turn, so
         * that equality is what makes hanging this off it affordable at all.
         *
         * NO CARRIER IS NO ROSTER, which is a serve with no ACP agent: nothing
         * reads the vault for a feature whose other half cannot exist, and the
         * sidebar draws no section — the same thing a directory with no `agent`
         * property anywhere draws.
         */
        agents: {
          store: inMemoryStore<Agents>(NO_AGENT_ROSTER),
          connect: (cell) =>
            Stream.runForEach(
              wiring.store.reads,
              ({ snapshot }) =>
                Effect.sync(() => {
                  agentsCell = cell
                  wiring.agents?.seen(snapshot === null ? null : snapshot.value.derived)
                  // THE CHAT'S OWN HALF OF THE SAME MOVE, and it is the second
                  // clock the ruling added: which node agent the OPEN
                  // conversation belongs to is now a PROPERTY, so a revision
                  // can change it — the `•••` verb writes one, and so does
                  // anybody editing a chip. Without this the panel would go on
                  // saying it belonged to nobody until the next time a session
                  // opened, and the row it had just bound would draw as asleep.
                  // It publishes only when the answer moved ({@link Chat.reread}).
                  chat?.reread()
                  republishAgents()
                }),
            ),
        },
        /**
         * WHICH PLUGINS THIS BUILD HAS AND WHICH THIS SERVE IS RUNNING —
         * seeded, and republished whenever a fiber arrives or leaves.
         *
         * ## It had no connector, and the reason it did not has expired
         *
         * "The flag is read once, at the composition root, before this runtime
         * exists. A connector here would be a subscription to a value that
         * cannot move, and the day one is added is the day something can turn a
         * plugin on without restarting." That was exactly right about a filter
         * that ran once. A plugin is a FIBER now, and a fiber moves without
         * anybody turning anything on: it can be `PENDING` on a service that has
         * not arrived, `FAILED` because its `apply` threw, or disposed because
         * its row went off. Every one of those is a row whose `running` changed
         * while the flag said the same thing, and a cell with no connector would
         * go on saying what the flag said.
         *
         * The connector holds the cell; {@link recompose} is what calls it, on
         * the one clock that can move this value. The flag is still CLI/nix only
         * — `../pluginPolicy.ts` is unchanged, and a browser toggle is phase 6's
         * — so what this republish reports is a fact about the runtime and never
         * a setting somebody changed here.
         */
        plugins: {
          store: inMemoryStore<PluginRoster>(roster()),
          connect: (cell) => Effect.sync(() => pluginsCell = cell),
        },
        /**
         * What git is doing for this directory at all — one half of what the
         * header's git indicator says, and what an agent in a terminal reads as
         * a resource.
         *
         * It has no `connect` of its own: it is republished by the PENDING
         * cell's connector below, from the same survey, so the two values that
         * indicator reads can never disagree about the directory they are both
         * describing. The seed is `off`, which is the setting face rather than
         * a fault, so a page cannot flash "git error" at a healthy repository
         * on its way to the truth.
         */
        git: {
          store: inMemoryStore<GitState>(GIT_OFF),
          connect: (cell) => Effect.sync(() => gitCell = cell),
        },
        /**
         * What is waiting to be committed, on THREE clocks — plus the quiet
         * window over them and the one push a boot owes.
         *
         * Every published revision is one — a write changes what is waiting, and
         * that is the ordinary case. A landed commit is the second, because a
         * commit moves no served file and so no revision would ever mention it.
         *
         * The slow sweep is the third, and it exists because NOTHING WATCHES
         * `.git`: a person who commits in a terminal changes what is pending
         * without touching an outline, and without this the panel would go on
         * offering to commit what is already committed until the next write. It
         * costs one `git status` on a clean directory — and on a dirty one,
         * nothing per waiting file: what a commit holds is read once per commit
         * (`@olai/ops`' `committed.ts`), so this sweep does not re-read the
         * dirty list every thirty seconds either.
         */
        pending: {
          store: inMemoryStore<Pending>(NOTHING_PENDING),
          connect: (cell) =>
            Effect.gen(function*() {
              pendingCell = cell
              yield* Effect.all([
                Stream.runForEach(
                  wiring.store.reads,
                  () => republishGit,
                ),
                Stream.runForEach(
                  SubscriptionRef.changes(wiring.git.settled),
                  () => republishGit,
                ),
                Effect.forever(Effect.andThen(Effect.sleep(SWEEP), republishGit)),
                // THE QUIET WINDOW ITSELF, forked here beside the three clocks
                // that feed it. It is a cell connector rather than a fiber of
                // its own because this is where the survey is: the loop watches
                // what `republishGit` just published, and a second place that
                // ran git would be a second answer to what is waiting.
                //
                // The connector starts when the surface BINDS, not when a
                // browser subscribes (`@kolu/surface`'s owned sources), which
                // is what makes a headless `olai web --commit=auto` commit at
                // all — the whole point of moving the loop off a tab.
                wiring.git.loop,
                // ONE PUSH AT BOOT, where the policy is `auto` and there is
                // anything to send (`@olai/ops`' `catchUp`). Nothing about a
                // refusal is remembered across a restart, and `olai.service` is
                // `Restart=always` — so without this a deploy would take the
                // words with it and leave the chip reading `✓ committed · N
                // unpushed` over a branch that has been refusing for hours.
                // The words are re-earned rather than written down.
                wiring.git.catchUp,
              ], { concurrency: 5 })
            }),
        },
        /**
         * THE PINNED SHELF, re-read per published revision — over a file this
         * connector already knows the name of (`shelfFile` beside the cells:
         * which outline the shelf IS moves only when the path set does).
         *
         * ITS OWN CONNECTOR rather than a line in the directory binding below,
         * and the difference is what it reads: that one PROJECTS a revision —
         * this file's per-file slices, written in one order for one reason —
         * where this one asks a QUESTION of the set (`@olai/format`'s
         * `shelfIn`) and publishes the answer. A tab tolerates the skew between
         * them the way it tolerates every other cross-member skew (the design
         * doc's cross-file consistency paragraph); what it would not tolerate is
         * the two being one statement whose order somebody has to reason about.
         *
         * A revision that moved no pin writes the same value, which the cell's
         * `equals` swallows (`@olai/surface`'s spec) — so the frames a tab gets
         * are the times its shelf actually changed, which includes a node it
         * pins being RETITLED in some other file. What the equality never
         * swallowed is the WORK, which is why the convention walk in front of
         * this reading is carried rather than re-run: a retitle moves the
         * shelf and must reach here, and it does not move which file the shelf
         * is.
         *
         * A store that has never published has no shelf rather than an unknown
         * one: an empty shelf draws nothing, which is what a directory with no
         * `Pins.olai` draws and what the column showed while the first frame was
         * arriving before any of this.
         */
        pins: {
          store: inMemoryStore<Shelf>(NO_PINS),
          connect: (cell) =>
            Stream.runForEach(
              wiring.store.reads,
              ({ snapshot }) =>
                Effect.sync(() => {
                  if (snapshot === null) return cell.set(NO_PINS)
                  const derived = snapshot.value.derived
                  shelfFile = conventionRecorded(pinsIn, derived, snapshot, shelfFile)
                  cell.set(shelfIn(derived, shelfFile.file))
                }),
            ),
        },
        /**
         * HOW FULL THE INBOX IS, re-read per published revision — the
         * shelf's twin, one integer over. The door that wears the number
         * already knows which file the inbox is (the paths); this is how
         * many rows of it are marked `todo` or `doing`, at any depth.
         *
         * Its own carrier (`inboxFile`) and not the shelf's, over the
         * outlines the SET SERVES rather than the files the derivation holds
         * records for: an empty or torn `Inbox.olai` has no entry in
         * `byFile`, and the count has to be about the file a capture would
         * actually land in (`@olai/format`'s `inbox.ts` argues it).
         *
         * A store that has never published has none rather than an unknown
         * count: the chip hides at zero, which is what a directory with no
         * inbox draws and what the column showed while the first frame was
         * arriving.
         */
        inbox: {
          store: inMemoryStore<InboxHeld>(NO_INBOX),
          connect: (cell) =>
            Stream.runForEach(
              wiring.store.reads,
              ({ snapshot }) =>
                Effect.sync(() => {
                  if (snapshot === null) return cell.set(NO_INBOX)
                  const { set, derived } = snapshot.value
                  inboxFile = conventionServed(inboxIn, set, snapshot, inboxFile)
                  cell.set(inboxHeldIn(derived, inboxFile.file))
                }),
            ),
        },
        /** The whole directory binding, because one revision is one write of
         *  everything it moved: for each collection the entries that changed
         *  and the keys that went, and then the facts that belong to no file.
         *  `null` reaches the wire verbatim — a store with no snapshot has
         *  never loaded, and empty collections on their own cannot say that. */
        manifest: {
          store: inMemoryStore<Manifest>(null),
          connect: (cell) =>
            Stream.runForEach(
              wiring.store.reads,
              ({ snapshot }) =>
                // AN `Effect.gen` AND NOT AN `Effect.sync`, because two of the
                // statements below are Effects: telling every plugin a revision
                // landed, and telling them the store has none. Both are AWAITED
                // here, and what the await buys is the statements that come
                // AFTER the ring — `faulted`, and the cell write that puts this
                // manifest on the wire — seeing a world every plugin has already
                // re-derived. The collections and the heads are written above
                // it, in the order master had them; nothing about that moved.
                Effect.gen(function*() {
                  if (snapshot === null) {
                    // No published set at all: every plugin's reading OF THE
                    // VAULT goes out with the canvas. What each of them makes
                    // of that is its own — a wrench onto the watch's config, a
                    // set of worktrees the next sweep acts on — and this
                    // file neither knows nor composes it; what it knows is that
                    // a claim derived from a directory the store can no longer
                    // see is a claim nobody may vouch for.
                    if (plugins !== null) yield* plugins.quiet
                    return cell.set(null)
                  }
                  // THE PROJECTION CONSUMES WHAT IT IS HANDED, so these two
                  // lines are one statement and the second may never be moved
                  // below the writes: `held` is what `readAll` reads, and after
                  // the call it is the value this returns and nothing else.
                  const revision = publishedOf(snapshot, held)
                  held = revision
                  const collections = published?.collections
                  apply(collections?.outlines, revision.outlines)
                  // A document's upsert reaches only the sockets that asked for
                  // THAT key (there is no `deltas` verb here) — which is a
                  // reader with the document open, and nobody else.
                  //
                  // …and the ones whose BODY is not in the revision go to the
                  // reader, which reads each file and publishes that same key
                  // with the bytes in it. Which those are is the projection's
                  // own answer ({@link publishedOf}) rather than a second walk
                  // over the entries here, for the reason every other line in
                  // this block is one statement: two answers to "what is this
                  // revision" is how they come to disagree.
                  apply(collections?.documents, revision.documents)
                  // …and the HEAD of every bodied file that moved reaches
                  // every tab, on the one batched stream this member has and
                  // `documents` deliberately does not. It carries no body, so
                  // there is nothing here to withhold and nobody to read a
                  // file for: this is how a `.html` under an open preview
                  // learns it changed (`@olai/surface`'s `Head`).
                  apply(collections?.heads, revision.heads)
                  // …and the bodies this revision withheld are read for the
                  // readers who are HOLDING those keys, and for nobody else
                  // ({@link ./bodies.ts}). A newborn key is in this list too,
                  // so a reader who subscribed before the file existed is
                  // handed the body the announce frame above could not carry.
                  bodies.unread(revision.unread)
                  // EVERY PLUGIN'S READING OF THE VAULT, re-derived on the same
                  // statement, and this file does not know what any of them
                  // reads. A revision is exactly when a reading of the SET can
                  // have moved — who claims which terminal, which nodes name a
                  // worktree, whatever the third one asks — and deriving one
                  // anywhere else would be a second answer to what the vault
                  // says.
                  //
                  // WHAT IS HANDED OVER IS THE WHOLE PUBLISHED SNAPSHOT, which
                  // is the richer of what the two tenants ask for and is not a
                  // convenience: one hands its own walk the node list and the
                  // served file its own convention names, the other hands its
                  // walk the whole derivation because the question it asks
                  // includes what the vault DECLARES. Each narrows the argument
                  // in its own signature — a claim that half makes about what
                  // this line rings and not one the compiler holds it to (the
                  // vault door's `revision` says why, and where the one `as`
                  // lives); a hook per plugin here would be this file knowing
                  // what each of them reads.
                  //
                  // IT COSTS ALMOST NOTHING ON ALMOST EVERY REVISION, and that
                  // is the plugins' own arrangement rather than a promise made
                  // here: each of these walks compares before it publishes, so
                  // a keystroke that landed in a note costs one walk per plugin
                  // and zero frames, and the sockets are the sweeps' business
                  // on their own clocks.
                  if (plugins !== null) yield* plugins.published(snapshot)
                  // ...AND THE PICKS THIS REVISION BROKE, which is core's own
                  // reading of the same snapshot and the one thing above that
                  // is not a plugin's. It is HERE, on the revision hook, for
                  // the reason every line in this block is: a revision is
                  // exactly when a file can have stopped being served, and a
                  // second clock asking the same question would be a second
                  // answer to what the directory says ({@link faulted}).
                  //
                  // NOT ON THE `null` ARM ABOVE. A store with no snapshot has
                  // never loaded, and marking every scope in the directory
                  // broken because this process cannot see the disk yet would
                  // be a fault storm at boot about files that are all still
                  // there. What that arm says is that nobody may vouch for a
                  // derived claim, and this is a derived claim.
                  faulted(snapshot)
                  // Written last, which is NOT the order they arrive in: a cell
                  // publishes on this stack while the collection's frame is
                  // coalesced into one delta on a microtask, so the manifest
                  // reaches a socket first. Nothing here may promise otherwise
                  // — a reader tolerates the skew either way, and that is the
                  // cross-file consistency paragraph in the design doc. What
                  // "either way" costs a reader that does NOT is
                  // `manifest-fold-skew`: a tab told `null` before this
                  // revision, reached by these heads before that cell frame,
                  // drew the error report over a directory it was holding. The
                  // browser resolves it where both halves are held
                  // (`@olai/web`'s `directory.ts` — heads are published only
                  // from here, so holding one is proof of a set); this line
                  // stays exactly as unpromising as it was. It is also the only
                  // write here that is usually a no-op: the cell says whether
                  // there is a set, and its `equals` keeps every revision after
                  // the first one quiet.
                  cell.set(LOADED)
                  // …and last of all, the readings that publish NOTHING are
                  // told to go and look again.
                  //
                  // This IS the store's own revision stream, folded once — so
                  // the pulse is a projection of the store's truth rather than
                  // a second source beside it, and there is no second owned
                  // subscription to supervise. (Which is also why the
                  // never-loaded arm at the top of this connector does not
                  // publish one: what this says is "a revision was published",
                  // and there is no revision. A reader in that state is refused
                  // by the ops layer's own gate and asks nothing —
                  // `@olai/web`'s `dates.ts`.)
                  //
                  // What a listener then reads is the STORE, not the projection
                  // above, so where this line sits inside the block is about
                  // keeping the order decided in one place rather than about
                  // the correctness of any reading.
                  revisions.publish(undefined)
                }),
            ),
        },
      },
      collections: {
        // Server-authored and read-only on the wire: a change to an outline is
        // a change to a FILE, and the only way to make one is the ops layer.
        // `readAll` is the projection above rather than a copy of it, so the
        // snapshot a late subscriber gets is the one the deltas have been
        // moving. The write seams are the surface's own requirement — a `ctx`
        // write needs somewhere to persist — and by the time one runs, the
        // projection it would persist has already been replaced whole.
        outlines: {
          readAll: () => held?.outlines.entries ?? NOTHING_YET,
          upsert: () => {},
          remove: () => {},
        },
        // The same arrangement, one collection over: server-authored, read-only
        // on the wire, and `readAll` is the projection rather than a copy — so
        // the body a fresh per-key subscription is snapshotted from is the one
        // the upserts above have been moving.
        documents: {
          readAll: () => held?.documents.entries ?? NOTHING_YET,
          /**
           * A per-key `get` is somebody OPENING this file, and it is the one
           * moment the server learns that — which is what makes it the place a
           * body the set does not keep is read. An entry that carries its text
           * is answered as it is, and nothing is read at all.
           *
           * An entry that does NOT is answered with NOTHING, and the read
           * starts: the framework holds such a subscription open and delivers
           * the key's first frame when one arrives, which is this read landing
           * ({@link ./bodies.ts}). So the first thing any reader sees is the
           * body — a browser draws the heading and then the file, exactly as it
           * did when the wait was a wire round trip, and a ONE-SHOT reader (an
           * agent's `resources/read`, which takes the first frame and leaves)
           * is handed the file rather than a `null` it would report as an empty
           * document.
           *
           * That is why the `null` this projection holds does not travel. It is
           * the SERVER's own word for "the path is here and the body is not",
           * and the wire's entry admits it because this map is typed by that
           * schema — but the one member that could publish every entry
           * (`deltas`) is deliberately absent from this collection, and this is
           * the only other way out.
           */
          readOne: (key) => {
            const entry = held?.documents.entries.get(key)
            // A KEY THE SET DOES NOT HOLD is nobody's to read. The framework
            // lets a reader subscribe to a key before it exists, and answering
            // that by reaching for the disk would be this server reading a path
            // because somebody named one — off a suffix test, since an entry
            // that is not there cannot say what kind of file it would be. The
            // entry IS the membership answer, and it is right here.
            if (entry === undefined) return undefined
            if (entry.text !== null) return entry
            // The body this reader is owed, asked for HERE and not where the
            // hold was taken: the ask has to land after the subscription is
            // attached, and this call is the framework's own snapshot step,
            // which runs after it (`subscribeBeforeSnapshot`). A read published
            // to a key nobody has subscribed to yet would be a body dropped for
            // the one reader who asked for it. What makes the ask reach the disk
            // is the hold that is already in place ({@link ./bodies.ts}).
            bodies.unread([key])
            return undefined
          },
          /**
           * WHO HOLDS THIS KEY, said by the framework rather than guessed at
           * here: the effect runs in the `get` stream's own scope, so a hold is
           * taken when a reader subscribes and released when that subscription
           * ends — a tab navigating, a socket dropping, the runtime tearing
           * down, or a one-shot reader taking its frame and leaving. Two readers
           * of one key are two holds and two releases.
           *
           * IT SITS BESIDE `readOne` BECAUSE THE PULL ORDER IS LOAD-BEARING:
           * the framework runs this first and only then builds the stream, so
           * the hold is in place before the channel subscribe and before the
           * `readOne` above — which is what lets that `readOne` ask for a body
           * that only a held path is read for. That order is the framework's
           * own pin now (`collectionHolders.test.ts`, "THE PULL ORDER"), where
           * it used to be a wrap of this repo's own and a test beside it.
           *
           * What a hold is WORTH stays here: {@link ./bodies.ts} owns the
           * count, the read-on-held, the one-at-a-time queue and the
           * drop-if-released-before-read. The framework reports lifetimes and
           * does not count.
           */
          holders: bodies.held,
          upsert: () => {},
          remove: () => {},
        },
        /**
         * The same keys, one revision each and no body — and the simplest
         * member in this block, which is the point of it existing.
         *
         * There is no `readOne` and nothing to read from a disk: a head is
         * already in the projection, so a subscription is answered out of the
         * map like an outline's is. What that buys is at the OTHER end — a tab
         * showing a `.html` watches this instead of the body it never draws,
         * so the file is not read, the bytes do not cross the wire, and nobody
         * holds the path at all ({@link ./bodies.ts}).
         */
        heads: {
          readAll: () => held?.heads.entries ?? NOTHING_YET,
          upsert: () => {},
          remove: () => {},
        },
        // Server-authored, one writer: `readAll` reads the transcript itself,
        // so a fresh subscription is seeded from the same object every later
        // upsert moves. There is no second copy to keep in step.
        transcript: {
          readAll: () => new Map(chat === null ? [] : chat.entries()),
          // The wire never calls these — the collection's write verbs are not
          // exposed — but the surface needs somewhere to persist a `ctx` write,
          // and the transcript has already recorded it by the time we publish.
          upsert: () => {},
          remove: () => {},
        },
        /**
         * The pieces of the row still being said — everything the cadence has
         * PUT on the wire and not taken off again ({@link @olai/chat}'s
         * `cadence`).
         *
         * IT OVERLAPS THE ROW ABOVE, and that is the point of it rather than
         * something it gets away with. The transcript hands a new subscriber
         * the row's text WHOLE, so most of what this hands them is characters
         * they already have — and the join drops those, because a piece that
         * ends inside its row's own text adds nothing (`@olai/surface`'s
         * `Saying`).
         *
         * What it is FOR is the gap between the two reads. A tab subscribes to
         * the two members one after the other, and a piece published in
         * between belongs to neither: it is past the text the row snapshot
         * carried, and it was on the wire before this member's stream opened.
         * Seeded empty, that piece is text nobody ever hands over, and the
         * paragraph is short a word until the row is published whole at the
         * end of it. Seeded with what is live, there is no gap to fall into —
         * which is why this is a read of the pieces that are OUT rather than
         * an empty map with a comment about idempotence over it.
         */
        saying: {
          readAll: () => new Map(saying.onWire()),
          upsert: () => {},
          remove: () => {},
        },
      },
      /**
       * A poll-shape stream is three things and the framework wires them into
       * one snapshot-then-deltas source: READ the answer, INSTALL a listener
       * for "something happened", and say when two answers are the SAME so a
       * tick that moved nothing sends nothing. That is the design doc's
       * mechanism paragraph exactly — recompute on every published revision,
       * send when it changed by value (`vault-in-browser.md` §2) — and it is
       * why the sidebar's two date readings are streams rather than a pair of
       * procedures a browser would have to know when to re-ask.
       *
       * THE READ IS THE OPS LAYER'S, which is the same gated read a keystroke's
       * write is judged against and the same one an agent's tool is answered
       * from: nothing is decided here, and there is no second walk of the set
       * on this side of the wire to disagree with the first. `runPromise`
       * because the framework's poll shape speaks promises; the effect it runs
       * needs no services, so there is no runtime to thread.
       *
       * ONE POLL LOOP PER SUBSCRIBER IS THE FRAMEWORK'S SHAPE and it is the
       * right one: a subscription's lifetime, its last value and whether it is
       * owed a frame are that subscriber's own. What it is NOT is a reason to
       * compute the same answer once per tab, and since `perf-streams-per-tab`
       * it is not: these five reads go through `@olai/ops`' `standing.ts`, which
       * answers one QUESTION at one revision once however many loops ask, and
       * which asks — before rebuilding — whether the revision could have moved
       * the answer at all. Nothing here had to learn about it, and that is the
       * point of where it went: this file still binds the same five reads to the
       * same pulse, and the sharing is a fact about the ops layer's answers
       * rather than a second cache on this side of the wire.
       *
       * THE INSTALL IS ONE PULSE for both, and it carries nothing
       * (`revisions`, above): a listener is told the directory moved and goes
       * back to the ops layer for what it now says.
       *
       * THE EQUIVALENCES ARE THE SCHEMAS' — `@olai/format`'s `sameDated` and
       * `sameOwed`, derived from the declarations rather than written out, so a
       * field added to either answer is compared without anybody remembering to
       * compare it. Getting that wrong in this direction is a frame that is
       * never sent: a browser holding a stale month under a healthy socket.
       * They are the SAME functions the standing layer compares with, which is
       * what makes handing back a previous answer safe: a value that layer
       * called unmoved is a value this comparison calls unmoved too, so there
       * is no frame it can decide about on this side's behalf.
       *
       * AN INITIAL read failure propagates — the subscriber has no snapshot, so
       * there is nothing honest to draw and the framework fails the stream,
       * which the browser's own readout names as a stopped subscription. A
       * LATER one is logged and the last good answer stands: a transient
       * refusal is not a reason to tear down a subscription somebody is
       * watching, and it is never silence.
       */
      streams: {
        dated: {
          read: (input) => Effect.runPromise(wiring.ops.dated(input)),
          install: (_input, onEvent) => revisions.consume({ onEvent, onError: NEVER }),
          isEqual: sameDated,
        },
        owed: {
          read: (input) => Effect.runPromise(wiring.ops.owed(input)),
          install: (_input, onEvent) => revisions.consume({ onEvent, onError: NEVER }),
          isEqual: sameOwed,
        },
        /**
         * ONE OPEN PAGE, re-read per revision — the member
         * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` was written for, and three
         * lines because everything above it was built to make it three.
         *
         * The read is the ops layer's gated one, the install is the same pulse
         * the two date readings use, and the equivalence is the schema's
         * (`@olai/format`'s `samePageReading`). Nothing is decided here: which
         * page an address names and what it draws is the format's, and a second
         * walk of the set on this side of the wire is exactly what the browser
         * has just stopped doing.
         */
        page: {
          read: (input) => Effect.runPromise(wiring.ops.page(input)),
          install: (_input, onEvent) => revisions.consume({ onEvent, onError: NEVER }),
          isEqual: samePageReading,
        },
        /**
         * WHICH OF THAT PAGE'S NODES THE QUERY SELECTS, on the same three legs
         * and beside the page it narrows — `filter-ask-carries-revision`,
         * landed (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/filter-rides-the-page.md).
         *
         * It was a PROCEDURE, and that is the whole of what was wrong with it:
         * a filter is a standing view, so the browser had to re-ask it on a
         * generation that moved once per page frame, and each ask was a walk of
         * the whole vault. Here the re-read is the pulse's, the walk is the
         * page's, and `sameNarrowing` is what keeps a bulk gesture that moved no
         * match off the wire entirely.
         */
        narrowing: {
          read: (input) => Effect.runPromise(wiring.ops.narrowing(input)),
          install: (_input, onEvent) => revisions.consume({ onEvent, onError: NEVER }),
          isEqual: sameNarrowing,
        },
        /** The move picker's preview, on the same three legs — standing rather
         *  than asked once, because a panel left open while an agent writes has
         *  to judge against where the row has actually got to. */
        moving: {
          read: (input) => Effect.runPromise(wiring.ops.moving(input)),
          install: (_input, onEvent) => revisions.consume({ onEvent, onError: NEVER }),
          isEqual: sameMoving,
        },
      },
      // What a re-read of a live stream failed with, in olai's own voice
      // ({@link ./report.ts}). Required by the framework at wiring time rather
      // than defaulted, which is the boot-time spelling of the error rule.
      onStreamReadError: (error, { stream }) => readFailed(stream, error, say),
      procedures: {
        chat: {
          // The ids the composer was armed with become NODES here, over the
          // same reading a keystroke's write is resolved against
          // ({@link ./context.ts}) — so what the agent is told is the set's
          // answer rather than the tab's, and an id nothing declares refuses
          // the send instead of quietly sending a message with no subject.
          send: ({ input }) =>
            withChat((open) =>
              Effect.flatMap(wiring.ops.read, (at) => {
                const context = contextFor(at, input.context ?? [])
                if (Result.isFailure(context)) return Effect.fail(context.failure)
                return open.send(
                  input.text,
                  input.attachments ?? [],
                  context.success,
                  // Straight through: whether this send interrupts the turn in
                  // flight is a gesture a person made, and this end has no
                  // second opinion about what they meant by it.
                  input.steer ?? false,
                )
              })
            ),
          // The chunk goes straight through, and so does the answer: what a
          // chunk MEANS — which file it continues, whether that file is this
          // conversation's, what the file ends up being called — belongs to
          // the chat, and re-deciding any of it here would be a second opinion
          // about the same bytes.
          attach: ({ input }) => withChat((open) => open.attach(input)),
          // Straight through, like the chunk above and for its reason: which
          // row is still undelivered, and what the prompt behind it was, is
          // the chat's own record — a second opinion here would be a second
          // answer to "what did that message actually say".
          resend: ({ input }) => withChat((open) => open.resend(input.id)),
          cancel: () => withChat((open) => open.cancel),
          // WITH the agent the browser named — every new chat asks which one,
          // and this end has no default to fall back on if it did not.
          newSession: ({ input }) => withChat((open) => open.newSession(input.agent)),
          /**
           * A NODE AGENT'S SESSION, STARTED — the one gesture that binds a node
           * to a conversation, and the only procedure here that is two verbs
           * rather than a pass-through.
           *
           * IT IS COMPOSED HERE because this is the only place both halves are
           * in hand: `newSession` is the chat's, writing a property is the ops
           * layer's, and neither package has ever seen the other. The same
           * arrangement the roster's own join is under ({@link ./agents.ts}).
           *
           * SESSION FIRST AND THE PROPERTY AFTER IT, which is the guarantee the
           * surface promises: `newSession` has RESOLVED by the time the state
           * is read, so the id written down is a conversation that exists. The
           * other order would leave a property naming a session nobody opened
           * every time the agent failed to start.
           *
           * THE STATE IS READ RATHER THAN ANSWERED, because the chat's verb
           * hands back nothing — a conversation is a thing the panel enters,
           * not a value a call returns, and every other reader learns which one
           * from the same cell. `null` there is an open that landed on no
           * conversation, which nothing has ever produced and which must not
           * become a property naming the empty string.
           *
           * NOT CONDITIONAL. `was` is omitted, so this overwrites whatever the
           * key holds: the property is what the person just pressed a menu
           * entry to set, and the value it held is the engine that press named
           * anyway.
           *
           * ... WHICH IS ALSO THE *FRESH SESSION* AFFORDANCE, and the only
           * thing that makes it one is the node already having a session: the
           * panel's header offers this verb on a bound node under a label
           * saying what it means, and the same two acts run. What the bound
           * case owes besides is the LINEAGE — the conversation being replaced
           * must not come back as a chat nobody claims — so the binding is read
           * BEFORE the open, and the session it named is written down as
           * superseded by the one that took its place (`@olai/chat`'s
           * `succession.ts`). Read before, because by the time the property has
           * been rewritten the roster's answer is the new session.
           */
          startAgentSession: ({ input }) =>
            withChat((open) =>
              Effect.gen(function*() {
                const was = wiring.agents?.nodeAt(input.node) ?? null
                yield* open.startAgentSession(input.node, input.agent)
                const now = open.state().session
                if (now === null) {
                  return yield* new UsageFailure({
                    reason: `${input.agent} opened no conversation to bind to this node`,
                  })
                }
                yield* applyEdit({
                  verb: "prop",
                  id: input.node,
                  key: AGENT_PROP,
                  value: sessionValue(input.agent, now.id),
                })
                // WHAT THIS ONE REPLACED, where it replaced anything: only a
                // node that WAS bound has a predecessor, and only to a
                // conversation that is not the one just opened — an agent that
                // answers `session/new` with an id it already had (the scripted
                // one does) must not supersede a session with itself.
                if (was?.session != null && was.session !== now.id) {
                  yield* open.replaced(
                    { agent: was.engine, session: was.session },
                    now.id,
                  )
                }
              })
            ),
          /**
           * A CONVERSATION THAT ALREADY EXISTS, GIVEN A NODE — the migration
           * gesture, and the other procedure here that is two verbs.
           *
           * COMPOSED HERE for its sibling's reason exactly: the property is the
           * ops layer's, the mark is the chat's record, and neither package has
           * seen the other. What differs is the ORDER and why it is that way
           * round. Nothing has to be opened, so both halves are about things
           * that already exist — and the durable one goes first, because the
           * assignment IS the property: a mark written before a write that then
           * failed would be a session believing it had been assigned to a node
           * that never claimed it.
           *
           * THE REFUSAL IS READ HERE and not taken from the browser, against
           * the roster's own reading rather than the tab's: a node already
           * talking through a conversation keeps it, and *one agent, one
           * current session* is the whole sentence. The list dims such a node
           * where somebody can see it before pressing, which is a courtesy; the
           * check that must not be racing is this one.
           *
           * THE VALUE IS WRITTEN WHOLE — engine and session, off the chat — so
           * a node that named another engine is re-pointed rather than left
           * naming one engine and another's conversation.
           */
          assignSession: ({ input }) =>
            withChat((open) =>
              Effect.gen(function*() {
                const held = wiring.agents?.nodeAt(input.node) ?? null
                if (held?.session != null) {
                  return yield* new UsageFailure({
                    reason: `“${held.title}” is already talking through a conversation — ` +
                      `one agent, one current session. Give it a fresh session from the ` +
                      `panel, or take the session off its \`${AGENT_PROP}\` property first.`,
                  })
                }
                yield* applyEdit({
                  verb: "prop",
                  id: input.node,
                  key: AGENT_PROP,
                  value: sessionValue(input.agent, input.session),
                })
                // ... AND THAT IT ARRIVED BY ASSIGNMENT, which is what the
                // session is taught on its next message (`@olai/chat`'s
                // `teaching.ts`). After the write and never refusing: the
                // assignment has landed, and a mark that could not be written
                // costs the migration contract rather than the binding.
                yield* open.assignedTo(input.node, {
                  agent: input.agent,
                  session: input.session,
                })
              })
            ),
          // ... and the answer to the panel's own question, which opens the
          // conversation that agent's boot would have adopted rather than a
          // fresh one. Two verbs because they mean two things — see the
          // surface's declaration.
          chooseAgent: ({ input }) => withChat((open) => open.chooseAgent(input.agent)),
          loadSession: ({ input }) =>
            withChat((open) => open.loadSession(input.agent, input.id)),
          // No input, for the reason the member says: which open was refused is
          // the chat's own record, and a browser naming one would be picking a
          // conversation nobody asked for.
          reopen: () => withChat((open) => open.reopen),
          sessions: () => withChat((open) => open.sessions),
          answer: ({ input }) => withChat((open) => open.answer(input.id, input.answers)),
          decline: ({ input }) => withChat((open) => open.answer(input.id, null)),
          // WHOSE doorbell is checked HERE and nowhere below, because this is
          // the only place that has the composed list: a name this serve did not
          // compose, or one whose half declares no wake, would store a pick
          // nothing will ever read. Refused in words, the same treatment
          // `chooseAgent` gives an agent id this machine does not have — a stale
          // tab is not a fault.
          //
          // The conversation goes straight through as the pair the chat's own
          // verb takes. What this end must NOT do is substitute "whichever
          // conversation is open": the panel's session can move under a picker
          // somebody left open, and the chat is where that race is answered.
          scope: ({ input }) =>
            withChat((open) =>
              composedWake(input.plugin)
                ? open.scope(
                  { agent: input.agent, session: input.session },
                  input.plugin,
                  input.file,
                )
                : Effect.fail(
                  new UsageFailure({
                    reason: `no plugin called \`${input.plugin}\` rings a conversation here`,
                  }),
                )
            ),
        },
        // One verb, over the union the wire declares — so a verb added there
        // is answered by `requestFor` or it does not compile, and there is no
        // binding here to forget. What the answer NARROWS the ops layer's to
        // is `applyEdit`'s decision, above, rather than a second one made here.
        edit: { apply: ({ input }) => applyEdit(input) },
        // The browser's search: the SAME call `search_nodes` makes for an
        // agent, over one reading of one snapshot — so the two faces answer
        // identically by construction rather than by two matchers that happen
        // to agree. Nothing is checked HERE and nothing needs to
        // be: what this returns and what the procedure declares are one
        // declaration, `@olai/format`'s, which is the only arrangement under
        // which this line could not be quietly returning more than the wire
        // carries.
        search: { nodes: ({ input }) => wiring.ops.search(input) },
        // The COMPLETION's door, and the same restraint a third time: the row
        // editor used to enumerate the tag vocabulary out of the browser's own
        // copy of the set, which is the copy `vault-in-browser` is taking away.
        // What a tag is, and what the trash does to its count, is
        // `@olai/format`'s `vocabulary.ts` — nothing is decided here.
        vocabulary: { tags: ({ input }) => wiring.ops.tags(input) },
        /**
         * The transcript's backticks, looked up in one question — which of
         * these ids the set declares, and what each one names.
         *
         * Its own namespace because it is not a search (`@olai/surface`'s spec
         * argues it): nothing here reads a grammar or ranks anything. The
         * browser answered this out of its own copy of the set until now, which
         * is the copy `vault-in-browser` is taking away.
         */
        nodes: {
          named: ({ input }) => wiring.ops.named(input),
          // ...and where the ids a reader REMEMBERS now live, beside whether
          // the set has anything from the files they were filed under. The
          // browser's fold memory walked its own id→file map for both until
          // now, per fold — the map `vault-in-browser` is taking away. What it
          // does with the answer stays where it was: the memory is a
          // preference of a browser, and nothing here has an opinion about one.
          homes: ({ input }) => wiring.ops.homes(input),
        },

        /**
         * The agent's door — the ops vocabulary itself
         * (`@olai/surface`'s `ops.ts`), and the ONE group no browser face
         * exposes (`./faces.ts`).
         *
         * Every member is one call onto the layer this runtime was handed, and
         * that is the whole of it: the ops layer stays wire-ignorant — an op
         * does not know it is being called over a wire — so nothing here
         * translates, re-plans or decides anything. It is the same gate the
         * keyboard's `edit.apply` lands through, reached with a different
         * vocabulary.
         *
         * The one member that records WHO asked comes from {@link writing}, so
         * a face can be served the same surface under a different writer — see
         * there, and {@link writerAt}.
         */
        ops: {
          run: impl(writing(wiring.ops, { writer: wiring.writer, fence: null }).ops.run),
          outlines: () => wiring.ops.outlines,
          // The plan arm's reading, and the one member here answering no tool:
          // which files the inbox convention is read off. It is a procedure of
          // its own rather than the listing narrowed for the reason
          // `@olai/surface`'s own declaration gives — a capture asking
          // `list_outlines` paid for every record in the directory to keep the
          // names.
          paths: () => wiring.ops.paths,
          node: ({ input }) => wiring.ops.node(input),
          subtree: ({ input }) => wiring.ops.subtree(input),
          documents: () => wiring.ops.documents,
          document: ({ input }) => wiring.ops.document(input),
        },
        git: {
          // The button's door, under the writer this runtime was composed with
          // — and under a different one on a face composed for an agent, which
          // is what {@link writing} is for. A procedure is a transport, and
          // which transport this one is is not a thing it should be able to
          // claim about itself. What republishes afterwards is NOT here: it is
          // the `settled` subscription above, so the agent's tool and the quiet
          // window get it too.
          commit: impl(writing(wiring.ops, { writer: wiring.writer, fence: null }).git.commit),
          // The Push button's door, and it takes no input at all — one verb,
          // the current branch, the upstream it already has. It republishes
          // through the same subscription for the same reason: pushing moves no
          // served file and changes what `pending` says.
          push: () => wiring.git.push,
          // The Resume button's. The ops layer republishes for itself here,
          // because clearing a stop is exactly a moment nothing else in the
          // process would mention.
          resume: () => Effect.as(wiring.git.resume, {}),
        },
        /**
         * Who is looking on THIS connection. The value is the per-connection
         * `CurrentWho` the listener's `services` layer provides from the
         * upgrade headers — so a tab that is already connected does not GET
         * `/olai/who`. The handler REQUIRES that service; the deps type has
         * no room for an unsatisfied requirement, so the cast erases the
         * REQUIREMENT and nothing else (kolu's own `Viewer` seam, same
         * shape).
         */
        who: {
          get: (() =>
            CurrentWho.use((who) => Effect.succeed(who))) as unknown as () => Effect.Effect<
              Who | null
            >,
        },
        /**
         * What this deployment is CALLED, and WHEN this process started —
         * both minted by whoever composed this runtime (`Wiring.hostname`
         * and `Wiring.startedAt` say why they are a mint and not a re-read:
         * the manifest was made of the same word at listen, the uptime
         * chip ticks from the same instant every tab is told, and neither
         * door may drift).
         *
         * Unlike its `who` twin there is nothing per-connection about it and
         * no service to require: the box's name and the start instant are
         * the same for everything that asks.
         */
        app: {
          get: () =>
            Effect.succeed({
              hostname: wiring.hostname,
              startedAt: wiring.startedAt,
            }),
        },
      },
    }

    /**
     * OLAI'S OWN SURFACE, AND EVERY PLUGIN'S BESIDE IT — one ROOTED BUNDLE,
     * built by the framework.
     *
     * `ctx` is the WRITE face and it stays here: the transport gets `Bound`,
     * which is the runtime with `ctx` taken off, so nothing that serves a socket
     * can also publish into the surface.
     *
     * CORE STAYS UNPREFIXED and its tags are byte-unchanged.
     * `implementRootedSurfaces` mints `surface/<member>/<verb>` for the root
     * exactly as `implementSurface` did — an MCP client's URIs, every tag
     * assertion in the suite and every accessor in the browser address the same
     * words after this phase as before it — and the plugins arrive BESIDE it
     * rather than around it, at `surface/<key>/<member>/<verb>`.
     *
     * ## What this one call replaced, and why the replacement is the phase
     *
     * Five hand-spelled steps stood here: `implementSurface` for the root,
     * `implementSurfaces` over a keyed map of every sibling, `mergeDisjointGroups`
     * to fuse the two groups, a `{...a, ...b}` spread of the two handler records
     * with `assertHandlersMatchGroup` after it, and `superviseTerminalSource` to
     * fold the two runtimes' supervision. Every one of them is inside this call
     * now (juspay/kolu#2223), and the spread is the one worth naming: a handler
     * record is keyed by nothing but tags, so `{...a, ...b}` is a last-writer-wins
     * merge with the same silence `RpcGroup.merge` has, and the assertion after
     * it proved the route SET rather than which side won a shared tag. The
     * framework counts both axes.
     *
     * ## And why the door had to be a NEW one rather than the old one live
     *
     * The bundle's roster MOVES: a plugin is a fiber, and a fiber that fails or
     * is disposed takes its sibling with it. `implementSurfaces` bakes its map
     * at the call, so the only way to change the roster over it is to re-call it
     * over the survivors — which the spike did, and which silently forks every
     * survivor's state: new handler values, new cell stores, new channels, new
     * sources, and an already-open connection answering out of the previous
     * copy. That finding is what this door was filed from, and `mount` is the
     * answer: the ARRIVING sibling is walked and nothing else is, so a survivor
     * keeps what it had.
     */
    const runtime = implementRootedSurfaces(surface, {}, deps)

    // From here on an entry write PUBLISHES as well as landing in the
    // projection. Before this line the connector had already run its first
    // revision into `entries`, which is what a subscription is snapshotted
    // from — and there can be no subscription yet, because the listener is
    // built from what this function returns.
    published = runtime.ctx

    /**
     * WHAT IS MOUNTED, BY KEY — the bookkeeping the re-compose diffs against.
     *
     * The VALUE is the framework's own {@link MountedSurface}, which carries its
     * own undo. That is what makes this table safe to hold: dropping a sibling
     * is calling `drop()` on the registration this runtime made, never a
     * `drop(key)` verb that could retract somebody else's — and a key that was
     * dropped and re-mounted is a different value, so a stale entry's `drop()`
     * is a no-op rather than a stranger's teardown.
     */
    const mounted = new Map<string, MountedSurface<SurfaceSpec>>()

    /**
     * THE RE-COMPOSE, and it lives HERE — which is the whole of the second
     * bullet of this phase.
     *
     * The spike put it inside the `surfaces` service, and its own review said
     * why that was wrong: a service that re-composed re-implemented every
     * SURVIVING sibling on every register, so a plugin that had been serving
     * since boot got a new runtime because a different plugin arrived. What a
     * service can honestly do is hold the table and say when it moved; deciding
     * what to do about it needs the rooted bundle, and the rooted bundle is the
     * composition root's.
     *
     * ## What it does, in the order it does it
     *
     * Mounts every sibling that is registered and not yet mounted, drops every
     * one that is mounted and no longer registered, and republishes the roster
     * cell. Mounting hands the sibling back its own write face
     * ({@link Registered.published}) — the seam the three `fleet: () =>
     * published?.collections.fleet` closures used to be, with core no longer in
     * the middle of it: what crosses is one opaque value that is already the
     * plugin's, addressed by the only word core knows about it.
     *
     * ## What a DROP reaches, and what a MOUNT does not
     *
     * A drop is live all the way down. Each of a sibling's tags is bound to a
     * handler that is stable for the mount's whole life and refuses the instant
     * it is dropped, so a connection accepted BEFORE the drop stops being served
     * those members — a new call gets a `SurfaceSiblingDropped` defect and an
     * in-flight subscription dies with the same defect rather than hanging on a
     * producer nobody drives any more.
     *
     * A MOUNT reaches this runtime's `group` and `handlers`, which are live
     * reads, and does NOT reach a listener that has already bound: `serveSurfaceApp`
     * takes the pair at the moment it listens and builds each accepted socket's
     * `RpcServer` over what it was handed. So the contract for a sibling
     * ARRIVING after the listener is up is RECONNECT — the roster cell moving is
     * what tells a browser to, and `SurfacesConnection.redial(surfaces)` is what
     * a browser that boots off that cell CALLS — `@olai/web`'s `client/wire.ts`,
     * which dials the root with no siblings at all, reads the `plugins` cell off
     * it, loads a chunk per plugin the roster names and redials with their
     * surfaces. That was written here as a later phase's work, on the grounds
     * that the tab's sibling map was compiled in; the map stopped being compiled
     * in when the browser's rows became a dynamic `import()` per row, and the
     * consumer landed with them. Nothing in
     * this phase mounts a plugin after the listener is up: the bundle is mounted
     * before the store opens.
     */
    const recompose = (): void => {
      const wanted = new Map(siblings().map((one) => [one.name, one] as const))
      for (const [key, one] of wanted) {
        if (mounted.has(key)) continue
        const mount = runtime.mount(
          key,
          // The two casts are the honest spelling rather than a gap, and they
          // are the pair `implementSurfaces` used to take. The framework's
          // `Surface` and `ImplementSurfaceDeps` are exact for a LITERAL — each
          // pinning its own spec — and what arrives here is a value read off a
          // registry at runtime. What the exactness buys is kept where it can
          // be: each plugin annotates its own deps against its OWN spec inside
          // its own package (`satisfies`, in that plugin's `apply`), so a member
          // it mis-shaped is a type error in that plugin's file, and the mount
          // proves the route set on arrival in both directions.
          one.surface as never,
          one.deps as never,
        )
        mounted.set(key, mount)
        // ...and the sibling is handed back its OWN write face, addressed by
        // the one word this file knows about it. The plugin narrows it to a
        // type this file could not spell.
        one.published?.(mount.ctx)
      }
      for (const [key, mount] of [...mounted]) {
        if (wanted.has(key)) continue
        mounted.delete(key)
        // `drop()` resolves when the sibling's sources have been finalized; the
        // ROSTER change is synchronous at the call, which is what the line below
        // is about to publish. So there is nothing here to AWAIT — a re-compose
        // that waited for a teardown would hold up the fiber that triggered it.
        //
        // There IS something to catch. The framework says a teardown fault
        // reaches `runtime.done`, the one owned-fault channel, exactly as a
        // finalizer faulting during `close()` does; what it does not say is that
        // the promise cannot reject, and a rejection nobody observes is an
        // unhandled rejection in somebody's server log with a stack that names
        // the framework rather than the plugin. So it is observed, and the one
        // thing this file can honestly do with it is say WHICH sibling failed to
        // leave — on the OWNER's channel, because a sibling still holding a
        // source after it has left the roster is a thing a person can act on.
        void mount.drop().catch((thrown: unknown) => {
          ring(
            Effect.logWarning(
              `plugins: "${key}" left the wire and its teardown failed — ${String(thrown)}`,
            ),
          )
        })
      }
      republishPlugins()
    }

    /**
     * THE FIRST COMPOSITION, and every one after it.
     *
     * The bundle was mounted before this runtime existed — `./serve.ts` puts the
     * fibers up before the store opens, because a plugin teaches the vault its
     * vocabulary and the store validates through it — so what this call does is
     * mount siblings that are ALREADY registered. From here on the same function
     * runs on every register and every dispose, through the holder
     * {@link PluginRuntime.onChange} carries.
     *
     * A HOLDER and not a callback passed at construction, and the order is the
     * reason: `openPlugins` needs to be told what to call before any plugin can
     * register, and the thing to call does not exist until here.
     */
    recompose()
    if (offered !== null) offered.onChange.run = recompose

    return {
      /**
       * OLAI'S OWN RUNTIME AND THE PLUGIN BUNDLE, as one thing to serve.
       *
       * "Who holds this key" used to be added HERE, by re-writing the documents
       * collection's `get` handler after the fact, because the framework had no
       * seam for it. It has one now (`holders`, in the deps above), so the fact
       * is inside the handler at the moment it is built: every face is a FILTER
       * over this record (`./faces.ts`) and `writerAt` rebuilds it by copying
       * the values, so every face inherits the hold BY CONSTRUCTION rather than
       * by this wrap having run before the filtering did.
       *
       * THE FUSION IS SAFE BY CONSTRUCTION and counted anyway, and neither is
       * this file's any more. A core tag has three segments and a sibling tag
       * has four, and the framework forbids a `/` inside any name, so the two
       * sets cannot intersect; `implementRootedSurfaces` claims every tag on
       * both axes before it commits, because `RpcGroup.merge` underneath is a
       * last-writer-wins `Map.set` and a silently dropped tag is a member that
       * answers nothing with nobody told. It is the same proof the BROWSER's
       * seam runs on the other side of the socket (`connectSurfaces`, one
       * function), which is what keeps the two ends from coming to disagree
       * about what "core plus the siblings" means.
       *
       * SUPERVISION HAS ONE TERMINAL SOURCE and it is olai's. `done` is what a
       * serving site treats as structural death (`./fault.ts`), and the
       * question this arrangement has to answer is which of two runtimes gets
       * to settle it. Core does: this process exists to serve a directory, so
       * its runtime ending is this process ending, and a sibling is PASSIVE —
       * only a genuine fault in a plugin's own source reaches `done` before
       * close, which is right, because a plugin whose connector died is
       * structural damage too. That fold used to be `superviseTerminalSource`
       * called here over two runtimes; it is inside the one runtime now.
       *
       * ## GETTERS, and this is the third bullet of the phase
       *
       * `group` and `handlers` are LIVE READS off the rooted runtime, not values
       * copied out of it. That is what "a live connection does not keep the old
       * fused group" comes to at THIS layer: there is one fused pair, and
       * everything downstream reads it rather than holding a copy — so a drop
       * cannot leave anybody serving a sibling that is gone.
       *
       * What a getter cannot reach is a TRANSPORT that has already baked the
       * pair. `serveSurfaceApp` takes `group` and `handlers` at the moment it
       * listens; a drop still reaches every open connection (the framework binds
       * each sibling's tags to handlers that refuse from the instant of the
       * drop), and a sibling ARRIVING after the listen is the reconnect half of
       * the contract — see {@link recompose}.
       */
      bound: {
        get group() {
          return runtime.group
        },
        get handlers() {
          return runtime.handlers
        },
        done: runtime.done,
        close: runtime.close,
      },
      /**
       * ...and the two face gates, over the SAME registry the composition reads.
       *
       * A getter for `bound`'s reason: a face is a default-deny allowlist
       * derived from the sibling set, so a roster that moved and a gate that did
       * not is a serve refusing members it composes or naming members it does
       * not. Whoever reads this after a change gets the gate for the roster that
       * is up.
       */
      get faces() {
        return facesOf(siblings())
      },
      publish: {
        live: republishAgents,
        state: (state) => {
          runtime.ctx.cells.chat.set(state)
          // ... AND THE ROSTER WITH IT, because this is the one door every chat
          // frame comes through and the bindings move behind exactly these
          // frames: a session opening, a contract taught, a line written down
          // at the end of a turn. The cell's `equals` is what makes it free on
          // the frames that moved nothing, which is nearly all of them
          // ({@link republishAgents}).
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
              seen({ kind: "turn", ...who, status: "working" })
            }
            if (lastStatus === "thinking" && state.status !== "thinking") {
              seen({ kind: "turn", ...who, status: "done" })
              const produced = [...(chat?.entries().values() ?? [])]
                .filter((entry): entry is Extract<ChatEntry, { kind: "agent" }> =>
                  entry.kind === "agent" && entry.seq > agentSeqAtTurn
                )
                .sort((a, b) => a.seq - b.seq)
                .at(-1)
              if (produced !== undefined && produced.text !== "") {
                seen({ kind: "replied", id: produced.id, ...who, text: produced.text })
              }
            }
          }
          lastStatus = state.status
        },
        // Through the CADENCE, never straight onto the collection: a row that
        // grows reaches the wire as pieces on a clock rather than as itself
        // once per token (`transcript-stream-quadratic`). What comes back out
        // is a frame, and {@link apply} writes it in the one order that
        // never shows a paragraph getting shorter.
        transcript: (change) => {
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
              seen({ kind: "delivered", id: entry.id, from: entry.rang, ...who, body: entry.text })
            }
          }
        },
      },
    }
  })

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
 * readings of one question (HACKING.md: MCP and Web ops must be consistent).
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
import { type Ops, type Policy, type Request, type Status, type Store } from "@olai/ops"
import type {
  CommitRequest,
  Pending,
  PushResult,
  Writer,
} from "@olai/format"
import {
  type Applied,
  CHAT_OFF,
  type ChatState,
  type Edit,
  GIT_OFF,
  type GitState,
  LOADED,
  type Manifest,
  NO_ROSTER,
  type OpFailure,
  type PluginRoster,
  surface,
  type Who,
} from "@olai/surface"
import { customText, isRegular, type Located, type Reading, UsageFailure } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { mergeDisjointGroups, surfaceTag } from "@kolu/surface/define"
import {
  assertHandlersMatchGroup,
  emptyHandlers,
  type ImplementSurfaceDeps,
  implementSurface,
  implementSurfaces,
  inMemoryChannel,
  inMemoryStore,
  type SurfaceHandler,
  type SurfaceHandlers,
  type SurfaceMap,
  superviseTerminalSource,
  type SurfaceRuntime,
} from "@kolu/surface/server"
import { Duration, Effect, Result, type Scope, Stream, SubscriptionRef } from "effect"

import { cadence } from "@olai/chat"
/**
 * THE ONLY PLACE THIS FILE MEETS AN APPLIANCE, and it meets none of them by
 * name. What arrives is a LIST — every plugin this binary was built with, each
 * carrying a sibling key, a whole surface of its own and a server half. Fusing
 * that bundle onto olai's own surface is the FRAMEWORK's, not this package's:
 * `mergeDisjointGroups` is the counted merge and it lives one import up.
 *
 * `@olai/plugins/server` and not `@olai/plugins`: the manifests carry a
 * plugin's CHROME and its DRESSINGS, which are SolidJS components and, behind
 * one of them, a terminal emulator — and this process renders nothing. The
 * three doors are three graphs; `@olai/plugins`' own manifest argues it and
 * its `fence.test.ts` walks each closure rather than trusting the argument.
 */
import {
  type PluginServer,
  type PluginServerHalf,
  type PluginServices,
  enabled,
  SERVERS,
} from "@olai/plugins/server"
import { isEnabled, PLUGIN_NAMES, surfacesOf } from "@olai/plugins/wire"

import type { Cadence, Change, Chat } from "@olai/chat"
import { type Emit, emitter } from "@olai/log"
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
 * Named here because this is where the two vocabularies meet: `@olai/plugins`
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
   * THE PLUGINS, all of them, or `null` for a runtime that is to have none.
   *
   * ## One field where there were two named ones
   *
   * This slot held ONE NAMED FIELD PER APPLIANCE — an environment, a clock and
   * an injectable dial; an environment, the served directory and an injectable
   * dial. Two records with the nouns changed, on the interface of the package
   * that must not know either noun, and each of them the reason an
   * appliance-named constructor was called forty lines further down. What both
   * were actually asking for is one list — what the process can see, what time
   * it is, which directory this is about, and a seam for a test — so that is
   * the list, and a third plugin is composed without a line of it moving. Each
   * half is assembled where the judgement about it lives, which is that
   * plugin's own `./server` door, and what this file does with the result is
   * ITERATE.
   *
   * ## What `null` means, which is stronger than what it used to
   *
   * `null` is the OFF setting and it is what `olai surface`, the headless
   * faces and every test in this package take: a one-shot CLI read has no use
   * for a standing socket to somebody's daemon, and dialing one would be a
   * process that touched an appliance on its way to printing a node.
   *
   * What it composes to is NOTHING — an empty sibling record, so
   * `implementSurfaces` mints no tag, no handler and no expose row, and the
   * wire carries no `surface/<name>/` at all. That is a change from what the
   * two named slots meant: they made every contributed member PRESENT and
   * hollow — a cell at its seed, an empty collection, a read that refused in
   * words — which is one code path for "this laptop is not running the tool"
   * and "this process has no business dialing", and was the right answer while
   * those members were part of core's own spec. They are a sibling surface
   * now, and absence is the sharper of the two answers: a member that is not
   * there cannot be read as a member that is there and empty, and the
   * framework's composition expresses it for free (`@olai/plugins`'
   * `composition.test.ts`). A machine that simply is not running the tool still gets
   * the hollow arm, because that is what the appliance's own half answers when
   * its dial finds nothing.
   *
   * A FILTER over the built-in set — the `--plugins` flag `@olai/plugins`'
   * `enabled` is written for — is the same shape one step in, and is
   * deliberately not invented here: it filters the record this field turns
   * into, and there is nowhere on this interface for it to be a second
   * mechanism.
   */
  readonly plugins: {
    /** WHAT THE PROCESS CAN SEE — the variables an appliance's rendezvous is
     *  decided from, whichever they are. Handed in rather than read for the
     *  reason every other seam here is: a test that asserts a rendezvous has
     *  to own it, and a composition root is where a process reaches for the
     *  real environment. */
    readonly env: Record<string, string | undefined>
    /** THE CLOCK, as ISO-8601 — what a plugin stamps a "since" from, so a test
     *  that asserts "connected · just now" owns the instant it rendered from.
     *  Deliberately not {@link Wiring.startedAt}'s twin: that one is a single
     *  mint for the whole serve, and this is read per stamp. */
    readonly now: () => string
    /** THE DIRECTORY THIS RUNTIME SERVES. Here rather than read from the store
     *  because it is half of where a relative path in a property resolves to —
     *  the whole rule is argued in the appliance package that resolves one —
     *  and because it is a fact about the SERVE rather than about any one
     *  revision. */
    readonly served: string
    /**
     * THE TEST SEAM — one injectable per plugin, keyed by the plugin's name.
     *
     * A fake daemon in a test, standing on a real unix socket: the thing a
     * scenario puts up so the suite does not depend on whichever daemons
     * happen to be running on the machine. Keyed and OPAQUE, which is
     * the whole of what core can honestly say about it — typing a plugin's own
     * double would mean knowing what that plugin talks to, and each narrows
     * its own at its own edge.
     *
     * A name with no entry gets none, which is the ordinary case: a real serve
     * passes nothing here at all.
     */
    readonly dials?: Readonly<Record<string, unknown>>
    /**
     * WHICH of the built-in plugins this serve runs — `null` for nobody
     * having said, which means all of them (`../pluginPolicy.ts`).
     *
     * A list rather than a flag per plugin, and `null` rather than the full
     * list, for the reason the git pin keeps the same distinction one setting
     * over: a browser draws the row read-only and has to say whether a person
     * TYPED this policy or got the built-in default, and a value that had
     * already expanded could not tell those apart.
     *
     * What a name left out of it comes to is total absence — no sibling
     * composed, no tag served, no expose row granted — which is the state this
     * runtime has always had for an appliance it could not reach.
     */
    readonly names?: ReadonlyArray<string> | null
  } | null
  /** Absent when no ACP agent is configured: the cell stays `off` and the
   *  procedures answer that they are. A directory is readable whether or not
   *  an agent is installed. */
  readonly chat: Chat | null
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
 * ONE spelling, because there used to be two composition roots and HACKING.md's
 * rule is that they must not diverge. Written out twice, the day one of them
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
 */
const writing = (ops: Ops, writer: Writer) => ({
  ops: { run: (request: Request) => ops.run(request, writer) },
  git: { commit: (request: CommitRequest) => ops.commit(request, writer) },
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
 * to come from the registry. `PLUGIN_NAMES` is that list and `isEnabled` is the
 * same question `enabled` answers as a filter, asked about one name
 * (`@olai/plugins`' `surfaces.ts`).
 *
 * `pinned` TRAVELS UNEXPANDED — `null` for a flag nobody gave, which means all
 * of them — because the line under the row names a given flag and otherwise
 * says the built-in default, and a value that had already expanded could not
 * tell those two apart. The git pin keeps the same distinction one setting
 * over, and `./pluginPolicy.ts` argues it where the flag is read.
 *
 * NO PLUGIN SLOT ANSWERS {@link NO_ROSTER}: such a runtime composes no sibling
 * surface at all — `olai surface`, the headless faces, every test in this
 * package — so there is nothing for a roster to be about. Listing the build's
 * plugins as `running: false` there would be this file inventing a policy
 * nobody set, and asserting it is why this reading is exported rather than
 * inlined at its one call site.
 *
 * Through `@olai/plugins/wire` and not the root, for the reason the import at
 * the top of this file gives: the manifests carry SolidJS components, and this
 * process renders nothing.
 */
export const rosterOf = (
  offered: Wiring["plugins"],
  /**
   * The BUILD's server halves, for the one thing a row carries that the
   * registry's names cannot answer: what this plugin's doorbell WAKES ON, in
   * the plugin's own words (`@olai/plugins`' `PluginServerHalf.wake`).
   *
   * OPTIONAL and empty by default, because the four callers that only ever
   * asked "which plugins does this build have" are asking a question the
   * sentence has nothing to do with — and because a required parameter here
   * would make every one of them name a list to get an answer they already had.
   *
   * ONLY ON A ROW THAT IS RUNNING, and that gate is the point rather than a
   * tidiness: this roster carries a row per BUILT plugin, running or not, so a
   * picker offered for a plugin this serve did not compose would store a pick
   * nothing will ever read.
   */
  halves: ReadonlyArray<Pick<PluginServerHalf<never>, "name" | "wake">> = [],
): PluginRoster =>
  offered === null ? NO_ROSTER : {
    built: PLUGIN_NAMES.map((name) => {
      const running = isEnabled(offered.names ?? null, name)
      const wake = running ? halves.find((one) => one.name === name)?.wake : undefined
      return { name, running, ...(wake === undefined ? {} : { wake }) }
    }),
    pinned: offered.names ?? null,
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
  writer: Writer,
): SurfaceHandlers => {
  const handlers = emptyHandlers()
  for (const [tag, handler] of Object.entries(bound.handlers)) handlers[tag] = handler
  for (const [namespace, verbs] of Object.entries(writing(ops, writer))) {
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
     * ... and the same capture for the one thing that is not a log line: a
     * doorbell's delivery ({@link doorFor}).
     *
     * `Emit` names its argument a line because logging is what every other
     * caller does with it, but what it IS is "run this Effect later, under the
     * services this fiber has" — and a delivery reaching core from a plugin's
     * watcher sink is in precisely the position `emit.ts`'s header describes:
     * a callback with no fiber under it. Its own name here, rather than
     * spelling `say` at the call site, because a reader who finds `say` around
     * a turn being started would be right to wonder what was being said.
     */
    const ring: Emit = yield* emitter
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
        runResolved(wiring.ops, wiring.writer, (at) => requestFor(at, edit), reresolves(edit)),
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
     * THE PLUGINS' SERVER HALVES, one per composed plugin, assembled by
     * ITERATING.
     *
     * ## What this replaces, and why the replacement is shorter than one of them
     *
     * There were two blocks here: a call to one appliance's own half-
     * constructor, naming three of that appliance's members, with two vault
     * walks imported from appliance-shaped filenames in this package and two
     * log channels; and beside it the same block for the second appliance with
     * the nouns changed. That the second was the first with the nouns changed
     * was this file's own complaint about itself, and it is not answered by
     * making the two differ — it is answered by neither of them being here.
     * Each plugin assembles its own half in its own package, out of the SAME
     * blob, and this file names no appliance, no member and no constructor.
     *
     * ## What crosses
     *
     * Everything a plugin gets is on that blob: the environment, the clock, the
     * served directory, two log channels, and — keyed by the plugin's own name,
     * which is the one word core knows about it — whatever a test injected.
     * What comes back is a `deps` this file hands `implementSurfaces` without
     * opening, an optional hand-back for the sibling's own write face, and two
     * hooks a revision drives.
     *
     * MADE EAGERLY, STARTED LAZILY, which is each half's own arrangement and is
     * unchanged by the move: making one is free and gives its members something
     * to answer with before anything has dialed, and STARTING it is a cell's
     * connector, which the framework runs when the surface BINDS. One dial per
     * process however many tabs are open — the git sweep's arrangement, applied
     * to a socket instead of a repository.
     *
     * ## The two log LEVELS are this file's, and the sentences are not
     *
     * `say` is the emitter this function already holds. Routine narration goes
     * at `debug`, because on a machine that is not running the tool it is a line
     * every few seconds and it is not news; what the OWNER must read goes at
     * `warning`, because the default console level is `info` and a malformed
     * value in somebody's vault sitting behind `OLAI_LOG_LEVEL=debug` is a
     * sentence nobody is told. WHICH of its own sentences go where is the
     * plugin's decision; which channel each level IS, is this file's.
     */
    const offered = wiring.plugins
    /**
     * THE DOOR A MACHINE WITH NO AGENT GETS — and it touches nothing.
     *
     * Named rather than inlined because what it says is a claim: a serve with
     * no chat has no scope store either (`@olai/chat` owns that table, so
     * `chat === null` means it was never constructed), which makes "a boot with
     * the agent merely off PATH cannot evict a person's picks" true by
     * construction rather than by care. `scopes()` answers the empty list
     * forever, which is the honest machine-without-the-tool state, and `deliver`
     * returns `void` because there is no failure channel on a verb that cannot
     * fail.
     */
    const NO_DOOR: PluginServices["deliveries"] = { scopes: () => [], deliver: () => {} }
    /**
     * ... and the real one, PER PLUGIN.
     *
     * Keyed by the only word this file knows about the plugin it is for, which
     * is `dial`'s arrangement one field over and the second of its kind. An
     * unkeyed door would hand one plugin the conversations a person scoped to
     * another — the ownership triple's middle column exists for exactly that.
     *
     * `deliver` bridges a SYNCHRONOUS plugin verb onto an Effect member with one
     * `runFork`, which is the bridge this file already makes for the two log
     * emitters above it: the caller is a watcher sink with nowhere to put a
     * failure, and a promise nobody has a reason to catch is an unhandled
     * rejection in somebody's server log.
     *
     * The plugin's NAME is stamped here and never taken from the caller. That is
     * what keeps the row's mark "data walked out of the registry" rather than a
     * word one plugin could sign another's row with.
     */
    const doorFor = chat === null
      ? (): PluginServices["deliveries"] => NO_DOOR
      : (who: string): PluginServices["deliveries"] => ({
        scopes: () =>
          chat.scopes()
            .filter((row) => row.plugin === who)
            .map(({ agent, session, file }) => ({ agent, session, file })),
        deliver: (to, body, options) => {
          // FORKED UNDER THIS FIBER'S SERVICES, and not with a bare
          // `Effect.runFork`. A doorbell's `deliver` is called from a watcher's
          // sink, which is a plain callback with no fiber under it — the exact
          // situation `@olai/log`'s `emit.ts` was written for, and its argument
          // carries here unchanged: an empty context is the DEFAULT logger at
          // the DEFAULT level, so every line the delivery's own turn emits
          // (`../../chat/src/agent.ts`'s `prompt sent`, `turn ended`) would
          // escape an `OLAI_LOG_LEVEL` the operator typed and arrive in a
          // different shape than the same line from a person's send. One
          // conversation would keep two journals, told apart by who started
          // the turn.
          ring(chat.deliverTo(to, body, who, options))
        },
      })
    const composed: ReadonlyArray<{
      readonly plugin: PluginServerHalf<VaultRevision>
      readonly half: PluginServer<VaultRevision>
    }> = offered === null ? [] : enabled<PluginServerHalf<VaultRevision>>(SERVERS, offered.names ?? null).map((plugin) => ({
      plugin,
      half: plugin.serve({
        env: offered.env,
        now: offered.now,
        served: offered.served,
        say: (line) => say(Effect.logDebug(line)),
        warn: (line) => say(Effect.logWarning(line)),
        // Opaque, and keyed by the only word this file knows about the plugin
        // it is for. A name with no entry gets none, which is every real serve.
        dial: offered.dials?.[plugin.name],
        // ... and the doorbell's door, keyed the same way and for a sharper
        // version of the same reason — see {@link doorFor}.
        deliveries: doorFor(plugin.name),
      }),
    }))
    /** WHICH COMPOSED PLUGINS RING AT ALL — the names whose halves declare a
     *  wake sentence. A scope written for anybody else would be a row nothing
     *  will ever read, so the member that writes one refuses it. Built off the
     *  same list the composition above walked. */
    const composedWake = new Set(
      composed.filter((one) => one.plugin.wake !== undefined).map((one) => one.plugin.name),
    )
    /** ...and the same two facts as the value a browser draws its read-only
     *  rows off — every plugin this binary HAS, which of them this serve RUNS,
     *  and whether anybody typed the flag. Read off the registry rather than
     *  off `composed` above, which is a list of the ones that are on;
     *  {@link rosterOf} argues why that difference is the feature.
     *
     *  The BUILD's halves go with it, because the doorbell's sentence is
     *  compiled in and the row that draws a picker has to carry it. */
    const roster = rosterOf(offered, SERVERS)
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
          store: inMemoryStore<ChatState>(chat === null ? CHAT_OFF : chat.state()),
        },
        /**
         * WHICH PLUGINS THIS BUILD HAS AND WHICH THIS SERVE RUNS — seeded, and
         * that is the whole connector.
         *
         * NO `connect`, and it is the one cell on this surface that will never
         * need one: the flag is read once, at the composition root, before this
         * runtime exists. A connector here would be a subscription to a value
         * that cannot move, and the day one is added is the day something can
         * turn a plugin on without restarting — which `../pluginPolicy.ts`
         * deliberately refuses to make possible.
         */
        plugins: {
          store: inMemoryStore<PluginRoster>(roster),
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
                Effect.sync(() => {
                  if (snapshot === null) {
                    // No published set at all: every plugin's reading OF THE
                    // VAULT goes out with the canvas. What each of them makes
                    // of that is its own — a wrench onto the watch's config, a
                    // set of worktrees the next sweep acts on — and this
                    // file neither knows nor composes it; what it knows is that
                    // a claim derived from a directory the store can no longer
                    // see is a claim nobody may vouch for.
                    for (const { half } of composed) half.unloaded()
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
                  // in its own signature, which is a claim the compiler checks;
                  // a hook per plugin here would be this file knowing what each
                  // of them reads.
                  //
                  // IT COSTS ALMOST NOTHING ON ALMOST EVERY REVISION, and that
                  // is the plugins' own arrangement rather than a promise made
                  // here: each of these walks compares before it publishes, so
                  // a keystroke that landed in a note costs one walk per plugin
                  // and zero frames, and the sockets are the sweeps' business
                  // on their own clocks.
                  for (const { half } of composed) half.revision(snapshot)
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
      // than defaulted, which is the boot-time spelling of HACKING.md's rule.
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
              composedWake.has(input.plugin)
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
        // to agree (HACKING.md). Nothing is checked HERE and nothing needs to
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
          run: impl(writing(wiring.ops, wiring.writer).ops.run),
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
          commit: impl(writing(wiring.ops, wiring.writer).git.commit),
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

    // `ctx` is the WRITE face and it stays here: the transport gets `Bound`,
    // which is the runtime with `ctx` taken off, so nothing that serves a
    // socket can also publish into the surface.
    //
    // CORE STAYS STANDALONE and this line is byte-unchanged, which is the
    // whole shape of the composition below. `implementSurface` mints
    // `surface/<member>/<verb>` exactly as it always did — an MCP client's
    // URIs, every tag assertion in the suite and every accessor in the browser
    // address the same words after this phase as before it — and the plugins
    // arrive BESIDE it rather than around it.
    const runtime = implementSurface(surface, deps)

    // From here on an entry write PUBLISHES as well as landing in the
    // projection. Before this line the connector had already run its first
    // revision into `entries`, which is what a subscription is snapshotted
    // from — and there can be no subscription yet, because the listener is
    // built from what this function returns.
    published = runtime.ctx

    /**
     * ...AND EVERY PLUGIN'S SURFACE, COMPOSED AS SIBLINGS over the same
     * transport.
     *
     * `implementSurfaces` takes a keyed map of STANDALONE surfaces and re-walks
     * each one at `surface/<key>/`, so a member a plugin declared `fleet`
     * reaches the wire as `surface/<that plugin's name>/fleet/get` — computed
     * by the framework, out of the plugin's own name, with no name arithmetic
     * anywhere in olai.
     * The SIBLING KEY is the plugin's name and it has one spelling: the surface
     * and the deps are keyed off the same word (`@olai/plugins`' `server.ts`),
     * so the two cannot be filed apart.
     *
     * THE RECORD IS BUILT BY WALKING, which is why the two casts are here and
     * why they are the honest spelling rather than a gap. The framework's
     * `SurfaceMap` and `SurfaceDepsFor` are exact for a LITERAL map — each
     * value pinning its own spec, each key's deps checked against it — and this
     * record's keys are runtime data read off a registry. What the exactness
     * buys is kept where it can be: each plugin annotates its own deps against
     * its OWN spec inside its own package, so a member it mis-shaped is a type
     * error in that plugin's file, and `assertHandlersMatchGroup` inside
     * `implementSurfaces` proves the route set at boot in both directions.
     *
     * THE EMPTY RECORD IS A REAL CASE and it is the one every headless face
     * takes: `{}` composes to a group with no requests and a handler record
     * with none, which the fusion below then adds to olai's own surface and
     * changes nothing about it. That is what "this process runs no plugins"
     * means, and it costs no mechanism — it is data the composition already
     * takes (`@olai/plugins`' `composition.test.ts` holds it).
     */
    const bundle = implementSurfaces(
      surfacesOf(composed.map((one) => one.plugin)) as unknown as SurfaceMap,
      {},
      Object.fromEntries(
        composed.map((one) => [one.plugin.name, one.half.deps]),
      ) as never,
    )

    // ...and each half is handed back its OWN write face, addressed by the one
    // word this file knows about it. This is not the read-back the three
    // `fleet: () => published?.collections.fleet` closures were: those were
    // core reaching into ITS OWN ctx for another package's members, by name,
    // three times. `implementSurfaces` returns a ctx PER SIBLING, so what
    // crosses here is one opaque value that is already the plugin's, and the
    // plugin narrows it to a type this file could not spell.
    for (const { plugin, half } of composed) {
      half.published?.(bundle.ctx[plugin.name])
    }

    /** OLAI'S TAGS AND EVERY SIBLING'S, in one group — the framework's own
     *  COUNTED merge, labelled by the two halves so a collision names which of
     *  them claimed the tag rather than only the loser. See the return below
     *  for why the count matters at all. */
    const fused = mergeDisjointGroups({ core: runtime.group, plugins: bundle.group })

    /**
     * ...and the two handler records as one, proved against that group.
     *
     * A spread, because the merge above has just established that the two tag
     * sets are disjoint and a handler record is keyed by nothing but tags. What
     * the spread is not trusted about is the RESULT: `assertHandlersMatchGroup`
     * is the framework's own door and it names both directions — a tag with no
     * handler, and a handler at a tag the group never minted — so a route set
     * that drifted is a boot refusal naming the tags rather than a member that
     * answers nothing with nobody told.
     */
    const handlers: SurfaceHandlers = { ...runtime.handlers, ...bundle.handlers }
    assertHandlersMatchGroup(fused, handlers, "plugins")

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
       * THE FUSION IS SAFE BY CONSTRUCTION and proved anyway. A core tag has
       * three segments and a sibling tag has four, and the framework forbids a
       * `/` inside any name, so the two sets cannot intersect —
       * `mergeDisjointGroups` claims every tag before merging and says so
       * anyway, because `RpcGroup.merge` underneath is a last-writer-wins
       * `Map.set` and a silently dropped tag is a member that answers nothing
       * with nobody told. It is the same proof the BROWSER's seam runs on the
       * other side of the socket (`connectSurfaces`, one function), which is
       * what keeps the two ends from coming to disagree about what "core plus
       * the siblings" means.
       *
       * SUPERVISION HAS ONE TERMINAL SOURCE and it is olai's. `done` is what a
       * serving site treats as structural death (`./fault.ts`), and the
       * question this arrangement has to answer is which of two runtimes gets
       * to settle it. Core does: this process exists to serve a directory, so
       * its runtime ending is this process ending, and the bundle is PASSIVE —
       * only a genuine fault in a plugin's own source reaches `done` before
       * close, which is right, because a plugin whose connector died is
       * structural damage too. `close` tears the terminal source down fully
       * first and then releases the passive one, which is the framework's own
       * combinator and not a done/close fold written here.
       */
      bound: {
        group: fused,
        handlers,
        ...superviseTerminalSource(bundle, runtime),
      },
      // Built from the SAME list the composition above walked, which is the
      // whole of why they are here — see the field's own note.
      faces: facesOf(composed.map((one) => one.plugin)),
      publish: {
        state: (state) => runtime.ctx.cells.chat.set(state),
        // Through the CADENCE, never straight onto the collection: a row that
        // grows reaches the wire as pieces on a clock rather than as itself
        // once per token (`transcript-stream-quadratic`). What comes back out
        // is a frame, and {@link apply} writes it in the one order that
        // never shows a paragraph getting shorter.
        transcript: (change) => saying.publish(change),
      },
    }
  })

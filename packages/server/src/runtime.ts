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
 * Git's cells and verbs left this file: they live on the git plugin's sibling
 * surface. MCP `commit` / `push` call `ops.commit` / `ops.push` through the
 * ledger door with the face's writer; the sibling's own browser `git.commit`
 * binds `"web"` itself.
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
  NOTHING_WRONG,
  pinsIn,
  sameMoving,
  sameNarrowing,
  samePageReading,
  type Shelf,
  shelfIn,
  type Verdict,
} from "@olai/format"
import { type Caller, type Ops, type Request, type Store } from "@olai/ops"
import type { Writer } from "@olai/format"
import { type Applied, type BuiltPlugin, type CorePageReading, type Edit, LOADED, type Manifest, NO_ROSTER, type PluginRoster, type PluginState, surface, watchable, type Who } from "@olai/surface"
import { type OpFailure } from "@olai/format"
import {
  customText,
  isRegular,
  type Located,
  NotFoundFailure,
  type Reading,
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
import { Effect, Result, type Scope, Stream, SubscriptionRef } from "effect"

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
// THE TWO CATALOGS `plugins.inspect` ANSWERS WITH, read off the tables that
// enforce them rather than described here — see `@olai/plugin-api`'s `SERVICES`
// on why a second copy in this file would be the worst kind of wrong list.
import { SERVICE_KEYS, SLOTS } from "@olai/plugin-api/services"
// ...and the third, which is the compiler's: the bare module names a plugin's
// source may import.
import { WRITABLE_MODULES } from "@olai/plugin-build"
import type { RowReport } from "@olai/bundle/bundle"


import { type Emit, emitter } from "@olai/log"
import * as Bodies from "./bodies.ts"
import type { DynamicRuntime } from "./dynamic/runtime.ts"
import {
  ALWAYS,
  APPROVED_KEY,
  BROWSER_NODE,
  isApproved,
  PLUGIN_KEY,
  SERVER_NODE,
} from "./dynamic/source.ts"
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
   * WHAT BECAME OF EACH ROW — the word a panel row wears, and the plugin's own
   * words when its start threw.
   *
   * ## A THUNK, and it used to be a value
   *
   * The paragraph here said it was a BOOT SNAPSHOT, and named the day that
   * would have to change: *nothing in this phase mounts or fails a plugin after
   * the boot… the day something can (the preferences toggle) this is the second
   * of the two places that has to learn to move — `./propKinds.ts` names the
   * first.* Both places moved in the same lane, and this is the second.
   *
   * It is a THUNK rather than a live call because the reading is asynchronous —
   * a failed fiber's error is private and reachable only by awaiting it — and
   * the roster is republished SYNCHRONOUSLY, from inside a re-compose that a
   * Cordis registry change drove. So the composition root re-reads after every
   * flip and this answers what it last read. The two cannot drift, because a
   * flip is the only thing that moves a row and the flip is what re-reads.
   *
   * WHAT THE THUNK IS NOT is a live read that this file could take itself:
   * `running` and the word come off ONE reading here (`{@link rosterOf}`), and
   * a second clock for the boolean is exactly the arrangement that used to
   * report a row `off` while it was serving.
   *
   * EMPTY IS LEGAL and is what every caller that does not care passes: a row it
   * has nothing to say about is `off`, which is what `running: false` has always
   * meant on its own.
   */
  readonly report: () => ReadonlyMap<string, RowReport>
  /**
   * WHICH DOORS EACH ROW NAMES — the live `inject` of every row that has a
   * fiber, read off the registry.
   *
   * Half of the join {@link BuiltPlugin.carrying} is: this says who NAMES what,
   * `offers()` on the doors service says who STANDS BEHIND what, and neither is
   * a list anybody keeps. The composition root is the one place both are in
   * hand, which is what makes it the one place the join can be made — the same
   * sentence `./propKinds.ts` opens with, one registry over.
   */
  readonly names: () => ReadonlyMap<string, ReadonlyArray<string>>
  /**
   * EACH ROW'S CONFIG, as the loader is holding it — `olai.yml` plus the CLI
   * patch, before the plugin's schema folds defaults in.
   *
   * Travels onto the roster as data so the plugins panel can draw the values
   * with no knowledge of any plugin's words. A row with no `config:` is
   * absent rather than present-and-empty.
   */
  readonly configs: () => ReadonlyMap<string, Readonly<Record<string, unknown>>>
  /**
   * TURN ONE ROW ON OR OFF while this serve runs — the loader surface's verb,
   * as this file spends it.
   *
   * Answers whether there WAS such a row. It RETURNS ONCE THE BUNDLE HAS
   * STOPPED MOVING — the flip, and then the settle over every row, because what
   * a flip is for is the rows around it — and it re-reads {@link report} on the
   * way out, so the roster this file publishes next is about the bundle the
   * press produced rather than the one it started from.
   *
   * It is here rather than built from `@olai/bundle` at the call site for the
   * reason every other field on this interface is: this file has never heard of
   * Cordis, a loader, or a row's module. What crosses is a verb.
   */
  readonly set: (id: string, enabled: boolean) => Effect.Effect<boolean>
  /**
   * TAKE {@link report} AGAIN — for the movements {@link set} is not.
   *
   * A row moves when a flip moves it, and {@link set} re-reads on its way out.
   * It also moves when a plugin the VAULT defines mounts, is disposed, or is
   * replaced by an edited version — none of which is a flip, and all of which
   * put a fiber on this same host. So the holder is re-read there too, and this
   * is the verb that does it.
   *
   * ONE READING FOR EVERY ROW ON THE HOST, which is why this is a re-read rather
   * than a second report: a definition's fiber and a bundle row's are the same
   * kind of thing in the same registry, and two readings of one registry is the
   * arrangement that used to report a row `off` while it was serving.
   */
  readonly reread: Effect.Effect<void>
  /**
   * WHICH ROWS A PERSON HAS TURNED OFF HERE, and not turned back on.
   *
   * ## The third author of "absent"
   *
   * A row that is not running is absent for one of a small number of reasons,
   * and until the switch there were two: the operator's flag left it out, or
   * this build ships it off until somebody asks. {@link Wiring.plugins.pinned}
   * tells those apart, because the row's own `disabled` and the flag's patch are
   * the same field and only *whether a flag was given* survives downstream of it.
   *
   * The switch writes that same field, which is what makes a flip and a flag one
   * mechanism — and it is why nothing downstream could tell a press from the
   * built-in default. So under no flag, a person who had just switched kolu off
   * was told by the panel that *this build ships it off by default*, and given a
   * flag to type. The composition root is the only place that knows better,
   * because it is the place the press arrived.
   *
   * KEPT AS THE SET OF ROWS TURNED OFF rather than a log of presses: what a row
   * needs to say is about its state now, and a row somebody switched off and
   * then on again is simply running. It is per PROCESS, like the flip itself.
   */
  readonly switched: () => ReadonlySet<string>
  /**
   * THE PLUGINS THIS VAULT DEFINES — phase 12, and the one field on this
   * interface that is about rows nobody compiled in.
   *
   * `null` is a runtime with no vault behind it, which is every headless face:
   * a definition is a node, so a process that serves no directory has none to
   * read. It is a whole door rather than four fields for the reason every other
   * field here is one verb: what crosses is a runtime this file drives and does
   * not look inside (`./dynamic/runtime.ts`).
   */
  readonly dynamic?: DynamicRuntime | null
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
 * `surface/git/git/commit` takes no fence and that is a named hole rather than an omission:
 * a commit moves no served byte and takes free-form paths, so a fenced agent can
 * still put another writer's pending work into history under its own trailer.
 * The fence's subject is the records the vault serves.
 */
const writing = (ops: Ops, caller: Caller): Record<string, SurfaceHandler> => ({
  [surfaceTag(surface.tagPrefix, "ops", "run")]: (request: Request) =>
    ops.run(request, caller.writer, caller.fence ?? undefined),
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
 * WHAT IT COSTS was stated where it was owed: *the report is a boot snapshot, so
 * a fiber that unloads mid-serve keeps its row until the next start — and the
 * day something can unload one, that door and this reading move together.* They
 * did. {@link PluginRuntime.report} is a thunk the flip re-reads, and the flip
 * settles the whole bundle before it does, so what this reads is never a bundle
 * in motion.
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
  /**
   * ...and WHO STANDS BEHIND WHICH DOOR — the offers table, keyed by the service
   * tag. Joined here with {@link PluginRuntime.names} to answer the one thing a
   * switch owes a person before it is pressed: which rows stop if this one does.
   *
   * A DEFAULT OF NOTHING, like the wakes beside it, because every caller that
   * only wants the roster's shape has no doors to be about — and because a row
   * carrying nobody is the state every plugin in this build but one is in.
   */
  offers: ReadonlyMap<string, string> = new Map(),
  /**
   * ...AND THE ROWS THE VAULT DEFINES, already shaped — phase 12's whole
   * addition to this reading.
   *
   * They arrive SHAPED rather than as definitions this function reads, because
   * nothing about them is a join over the two tables above: a dynamic row's
   * word, state and fault are decided where its fiber is (`./dynamic/runtime.ts`
   * says why four of its five absences are not fiber states at all), and this
   * function's job is the built rows.
   *
   * AFTER the built ones, always, which is the same argument the bundle's own
   * order makes: a person reads this list, the built rows are the ones that are
   * the same on every machine, and a row that appeared because somebody wrote it
   * into this directory belongs under them rather than shuffled among them.
   *
   * A DEFAULT OF NOTHING, like its two neighbours: every caller that only wants
   * the roster's shape has no vault to be about.
   */
  defined: ReadonlyArray<BuiltPlugin> = [],
): PluginRoster =>
  offered === null ? NO_ROSTER : ((
    // ONE REGISTRY WALK for the whole roster rather than one per row: every
    // row's `carrying` is a join over the SAME two tables, and asking `names()`
    // inside the map would walk the Cordis registry once per plugin on every
    // re-compose — which is every register and every dispose.
    names: ReadonlyMap<string, ReadonlyArray<string>>,
  ) => ({
    built: [...offered.built.map((name) => {
      // A row the report has nothing to say about never loaded, and that
      // absence IS `off` rather than a missing case (`@olai/effect-cordis`'s
      // `rowReport`).
      const report = offered.report().get(name) ?? { state: "off" as const }
      const said = stateOf(offered, name, report)
      const live = said.state === "running"
      const wake = live ? wakes.get(name) : undefined
      const carrying = live ? carriedBy(name, offered.built, names, offers) : []
      const config = offered.configs().get(name)
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
        // ...and, on the one word that is a WAIT, the services it is short of.
        // Core names these because they are core's own vocabulary — a tag is a
        // key in this tree's table, not a plugin's prose — and naming them is
        // what turns "waiting for something" into a sentence somebody can act
        // on.
        ...(said.missing === undefined ? {} : { missing: said.missing }),
        // ...and, on a row that is RUNNING, which rows stop if it does. The
        // other end of `missing` exactly: that one is a row saying what it is
        // short of after the fact, and this is the row that HAS it saying so
        // while there is still a decision to make. ABSENT rather than empty,
        // which is the ordinary case — every row in this build but the chat row
        // carries nobody, and an empty list would be each of them claiming to
        // carry no one.
        ...(carrying.length === 0 ? {} : { carrying }),
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
        // THE ROW'S CONFIG, as data. Core draws the values and knows none of
        // the plugin's words — a given `--commit=auto` is `commit: auto` on
        // the git row, and a row with no config sends nothing.
        ...(config === undefined ? {} : { config }),
      }
    }), ...defined],
    pinned: offered.pinned,
  }))(offered.names())

/**
 * WHICH ROWS WOULD GO `waiting` IF `name` WERE TURNED OFF — the join, and the
 * one thing on the roster that is about a press nobody has made yet.
 *
 * ## Two live readings and no list
 *
 * `offers` is who stands behind which door; `names()` is which doors each
 * running row is standing on. Neither is written down anywhere — the first is
 * taken by a plugin's own `offer` and released by its scope, the second is the
 * `inject` the runtime derived from that plugin's `needs` — so a row added to
 * this build reaches this sentence with nothing here moving, and the answer
 * cannot disagree with the fibers because it IS the fibers.
 *
 * The alternative, and the reason it was not taken: a `carries` declaration
 * beside `needs`. That is the same list `RowReport.missing` refuses to carry,
 * for the same reason — a second declaration is free to be wrong, and the one it
 * would be wrong about is the sentence a person reads before turning something
 * off.
 *
 * ## The row itself is not in its own answer
 *
 * A plugin may name a door it also offers (nothing forbids it, and the chat row
 * is one blip from being one). It does not stop when it stops, so it is dropped
 * — otherwise every offering row would name itself among its own casualties.
 *
 * IN BUNDLE ORDER, because a person reads it — and it is the bundle's order for
 * free rather than by sorting: this walks {@link PluginRuntime.built}, which IS
 * the row list, where walking `names()` would take the Cordis registry's order,
 * which is the order two dynamic imports came back in. A list that reshuffles
 * between boots is a list nobody can read twice, and there is an e2e failure
 * behind that sentence (`@olai/bundle`'s `inBundleOrder`).
 */
const carriedBy = (
  name: string,
  built: ReadonlyArray<string>,
  names: ReadonlyMap<string, ReadonlyArray<string>>,
  offers: ReadonlyMap<string, string>,
): ReadonlyArray<string> => {
  const held = new Set(
    [...offers].flatMap(([door, by]) => by === name ? [door] : []),
  )
  if (held.size === 0) return []
  return built.filter((row) =>
    row !== name && (names.get(row) ?? []).some((door) => held.has(door))
  )
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
/**
 * WHO AUTHORED THIS ROW'S ABSENCE — the one question with three answers, and
 * the only thing `off`, `optIn` and `switched` differ by.
 *
 * The loader declined to load the row and the `disabled` it declined on is ONE
 * FIELD with three possible authors, which is exactly what makes a flip and a
 * flag one mechanism and exactly why nothing downstream of the patch can tell
 * them apart. What can is whether the press came through this process
 * ({@link PluginRuntime.switched}) and whether a flag was given at all
 * (`pinned`), both of which the composition root holds.
 *
 * ## The order is the answer, not an accident
 *
 * A person who switched a row off a moment ago is owed a sentence about THAT,
 * not about the flag they typed an hour ago or the default the build ships —
 * both of which are still true and neither of which is why this row is absent
 * now. So the press wins, and the flag beats the build for the same reason one
 * step down.
 *
 * ITS OWN FUNCTION rather than a ternary in the arm it serves, because it is a
 * different question from the one {@link stateOf} is answering. That one asks
 * which of six words a row is in; this asks who put it there, and only for the
 * rows that are absent. Written inline the two read as one nested condition,
 * and a reader has to hold both to check either.
 */
const whoTurnedItOff = (
  offered: NonNullable<Wiring["plugins"]>,
  name: string,
): PluginState => {
  if (offered.switched().has(name)) return "switched"
  return offered.pinned === null ? "optIn" : "off"
}

const stateOf = (
  offered: NonNullable<Wiring["plugins"]>,
  name: string,
  report: RowReport,
): {
  readonly state: PluginState
  readonly fault?: string
  readonly missing?: ReadonlyArray<string>
} => {
  switch (report.state) {
    case "failed":
      return report.fault === undefined
        ? { state: "failed" }
        : { state: "failed", fault: report.fault }
    case "waiting":
      // ...AND WHAT IT IS SHORT OF, which the reading has and this arm used to
      // drop. A row is `waiting` because a service it named has nobody behind
      // it, and the one sentence a person needs is WHICH — under
      // `--plugins=kolu` the answer is `deliveries`, and the answer to that is
      // "compose the chat row". Empty is not absent: a fiber PENDING with
      // nothing named is a settle still in flight, and a row claiming to wait
      // on nothing would be worse than one that says only that it is waiting.
      return report.missing === undefined || report.missing.length === 0
        ? { state: "waiting" }
        : { state: "waiting", missing: report.missing }
    case "off":
      // THE LOADER DECLINED TO LOAD IT, and the `disabled` it declined on has
      // three possible authors: a person at the panel, the operator's flag, and
      // the build. They are ONE FIELD by design, so nothing downstream of the
      // patch can tell them apart — what can is whether the press came through
      // this process ({@link PluginRuntime.switched}) and whether a flag was
      // given at all (`pinned`), both of which are here.
      //
      return { state: whoTurnedItOff(offered, name) }
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
  for (const [tag, handler] of Object.entries(writing(ops, caller))) {
    if (handlers[tag] !== undefined) handlers[tag] = handler
  }
  return handlers
}

export const bind = (
  wiring: Wiring,
): Effect.Effect<
  {
    readonly bound: Bound
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

    /** The PLUGINS cell, held for the reason a commit used to republish: its clock is a
     *  fiber arriving or leaving, which reaches this file as a callback off
     *  `openPlugins`'s `changed` rather than as a stream ({@link republishPlugins}). */
    let pluginsCell: { set: (value: PluginRoster) => void } | null = null

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
     * WHICH COMPOSED PLUGINS RING AT ALL, and what each says when its doorbell
     * stops watching — read the same way {@link siblings} is and for the same
     * reason.
     *
     * ## What this is still FOR, now that the doorbell's picks are a row's
     *
     * ONE READER, and it is the preferences panel: {@link roster} draws each
     * row's watchability out of the declaration, so a plugin that rings and one
     * that does not are two different rows on a screen. Everything else this
     * table used to answer — whether a scope may be written for a name, and
     * which sentence a broken scope says — went with the picks, which are
     * `olai-plugin-chat`'s record. That half asks the SAME registry through
     * `@olai/plugin-api`'s `Wakes.declared`, so there is one table and no second
     * list for the two to disagree across.
     *
     * A TABLE OF WORDS THE PLUGIN WROTE, which is the only kind of table core is
     * allowed to keep about words: nothing here is composed, joined, abbreviated
     * or interpolated into.
     */
    const rings = (): ReadonlyMap<string, Wake> => plugins?.declared() ?? new Map()
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
      rosterOf(
        offered,
        rings(),
        plugins?.offers() ?? new Map(),
        // THE SAME REPORT the built rows are drawn from, one line up inside
        // `rosterOf` — a definition's fiber is on the same host under its own
        // word, so one reading answers for both and neither can be stale while
        // the other is fresh.
        dynamic?.rows(offered?.report() ?? new Map()) ?? [],
      )

    /** THE PLUGINS THIS VAULT DEFINES, or `null` for a runtime that has none —
     *  every headless face, and every test that composes no plugin slot. */
    const dynamic = offered?.dynamic ?? null

    /**
     * FOLLOW THE VAULT'S OWN PLUGINS, and re-compose if anything moved.
     *
     * ONE HELPER for the three moments that can move a definition — a revision
     * landed, a person approved, a switch was pressed — because all three end
     * the same way and the ending is not obvious: a dynamic plugin that mounts
     * may register a SIBLING SURFACE, which reaches the wire only through the
     * re-compose, and its row reaches an open tab only through the roster the
     * re-compose republishes.
     *
     * `moving` is held for the same reason the flip holds it: mounting a plugin
     * fans out into several registry changes, and each of them would otherwise
     * publish a roster about a bundle that is halfway there.
     *
     * IT REACHES BOTH THROUGH A HOLDER, and that is not shyness about a forward
     * reference — it is a TDZ, and it was measured: the manifest connector runs
     * INSIDE `implementRootedSurfaces`, on a store that already has a snapshot,
     * which is long before `moving` and `recompose` are declared. Naming either
     * directly here is `ReferenceError: Cannot access 'moving' before
     * initialization`, taking the whole surface runtime down at boot.
     *
     * THE NO-OP DEFAULT IS THE HONEST BOOT ARM rather than a hole. Before the
     * re-compose exists nothing has been composed, so there is nothing to
     * suppress and nothing to re-compose: a definition that mounts on that first
     * revision registers its sibling into the same tables every plugin's `apply`
     * registers into, and the `recompose()` that runs at the end of this
     * function picks it up with the rest of the bundle.
     */
    const followed = (read: Reading | null): Effect.Effect<void> =>
      dynamic === null || read === null
        ? Effect.void
        : Effect.asVoid(settling(dynamic.follow(read.derived)))

    /** ...and the holder itself, filled in the moment {@link recompose} exists —
     *  see above for what the default arm is. It ANSWERS what it was told, so a
     *  caller that has to know whether the word was one of its own still does. */
    let settling: (run: Effect.Effect<boolean>) => Effect.Effect<boolean> = (run) => run

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
         * the one clock that can move this value. `--plugins` is still what a
         * serve comes up with; {@link Deps.plugins.set} is the panel's switch
         * while it runs, and this republish is how the cell follows either.
         */
        plugins: {
          store: inMemoryStore<PluginRoster>(roster()),
          connect: (cell) => Effect.sync(() => pluginsCell = cell),
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
                  // ...AND THE PLUGINS THE VAULT ITSELF DEFINES, on the same
                  // statement and for the same reason: a revision is exactly
                  // when a definition can have arrived, changed, been approved
                  // or gone away. Phase 12's whole loop is this line — an agent
                  // writes two notes through the ordinary write door, the write
                  // publishes a revision, and the definition is read here.
                  yield* followed(snapshot.value)
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
      },
      /**
       * A poll-shape stream is three things and the framework wires them into
       * one snapshot-then-deltas source: READ the answer, INSTALL a listener
       * for "something happened", and say when two answers are the SAME so a
       * tick that moved nothing sends nothing. That is the design doc's
       * mechanism paragraph exactly — recompute on every published revision,
       * send when it changed by value (`vault-in-browser.md` §2) — and it is
       * why the page, its filter and the move preview are streams rather than
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
       * it is not: these three reads go through `@olai/ops`' `standing.ts`, which
       * answers one QUESTION at one revision once however many loops ask, and
       * which asks — before rebuilding — whether the revision could have moved
       * the answer at all. Nothing here had to learn about it, and that is the
       * point of where it went: this file still binds the same three reads to the
       * same pulse, and the sharing is a fact about the ops layer's answers
       * rather than a second cache on this side of the wire.
       *
       * THE INSTALL IS ONE PULSE for all three, and it carries nothing
       * (`revisions`, above): a listener is told the directory moved and goes
       * back to the ops layer for what it now says.
       *
       * THE EQUIVALENCES ARE THE SCHEMAS', derived from the declarations rather
       * than written out, so a field added to an answer is compared without
       * anybody remembering to compare it. They are the SAME functions the
       * standing layer compares with, which is what makes handing back a
       * previous answer safe: a value that layer called unmoved is a value this
       * comparison calls unmoved too.
       *
       * AN INITIAL read failure propagates — the subscriber has no snapshot, so
       * there is nothing honest to draw and the framework fails the stream,
       * which the browser's own readout names as a stopped subscription. A
       * LATER one is logged and the last good answer stands: a transient
       * refusal is not a reason to tear down a subscription somebody is
       * watching, and it is never silence.
       */
      streams: {
        /**
         * ONE OPEN PAGE, re-read per revision — the member
         * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` was written for, and three
         * lines because everything above it was built to make it three.
         *
         * The read is the ops layer's gated one, the install is the same pulse
         * the other standing readings use, and the equivalence is the schema's
         * (`@olai/format`'s `samePageReading`). Nothing is decided here: which
         * page an address names and what it draws is the format's, and a second
         * walk of the set on this side of the wire is exactly what the browser
         * has just stopped doing.
         */
        page: {
          read: (input) => Effect.runPromise(
            Effect.map(wiring.ops.page(input), (reading) => reading as CorePageReading),
          ),
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
          run: impl((request) => wiring.ops.run(request, wiring.writer)),
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
        /**
         * THE FIVE VERBS ABOUT PLUGINS — the loader surface's switch, and phase
         * 12's four: one a person presses in the panel (`approve`) and three an
         * agent calls (`run`, `stop`, `inspect`), which between them can define
         * nothing and approve nothing.
         *
         * FOUR OF THEM MOVE A FIBER, and none of them spells out what that
         * takes: hold the roster still, do the thing, let it go, re-read the
         * report, re-compose, re-judge the vault. That is {@link settling}, and
         * it is one sequence there rather than five here for the reason it
         * became one — the day each of these spelled it out was the day each of
         * them got a slightly different four of the six.
         */
        plugins: {
          /**
           * A PERSON SAYS YES TO CODE — phase 12's one browser verb, and the
           * only place in this product where that sentence is true.
           *
           * ## The version in the input is the whole of the safety
           *
           * The panel drew the source the roster carried and sends back the
           * version it drew. If the definition has moved since — the agent wrote
           * another line while the panel was open — this refuses naming the
           * change, rather than approving code nobody read. An approval that
           * named only the plugin could not tell the two apart.
           *
           * ## The write is the ORDINARY one
           *
           * `{op: "prop"}` through the same gate a keystroke goes through, under
           * the writer this runtime was composed with and NO fence: this is a
           * person's decision, arriving on the browser face, and the subtree
           * fence is about what an agent may reach. So the approval is a
           * property on the plugin's own node, planned, validated and committed
           * like any other write — which is the ruling: it travels with the
           * vault and is versioned by the ledger like the source it is about.
           *
           * WHAT MOUNTS IT is not this call: the write publishes a revision, the
           * revision is followed, and the definition mounts there
           * ({@link followed}). One path, whether an approval or an edit is what
           * moved.
           */
          approve: ({ input }) =>
            Effect.gen(function*() {
              const one = dynamic?.defined(input.name) ?? null
              if (one === null) {
                return yield* Effect.fail(
                  new NotFoundFailure({
                    reason: `this vault defines no plugin called "${input.name}"`,
                    named: input.name,
                  }),
                )
              }
              if (one.version !== input.version) {
                return yield* Effect.fail(
                  new NotFoundFailure({
                    reason:
                      `"${input.name}" has been edited since this page drew it, so approving `
                      + `it now would approve source nobody has read. Look again, read what `
                      + `it says, and approve that.`,
                    named: input.name,
                  }),
                )
              }
              // THE ORDINARY WRITE DOOR, under this runtime's own writer and
              // fenced by NOTHING — the same two facts `Ops.prop`'s provision
              // one file over states for a keystroke, and for the same reason:
              // the gesture is a person's, in the panel, and the subtree fence
              // is about how far an agent's session may reach.
              yield* Effect.asVoid(wiring.ops.run(
                {
                  op: "prop",
                  id: one.node,
                  key: APPROVED_KEY,
                  value: input.forever ? ALWAYS : one.version,
                },
                wiring.writer,
              ))
              return {}
            }),
          /**
           * ...AND THE AGENT'S THREE, which between them can define nothing and
           * approve nothing.
           *
           * `run` asks olai to look at a definition and answers what became of
           * it — `pending` where nobody has approved this version, which is the
           * whole of the boundary said back to the caller that wrote the code.
           * It re-reads rather than trusting the last revision, so an agent that
           * has just written its two notes is answered about what it wrote.
           */
          run: ({ input }) =>
            Effect.gen(function*() {
              yield* followed(
                yield* Effect.catch(wiring.ops.read, () => Effect.succeed(null)),
              )
              const one = dynamic?.defined(input.name) ?? null
              if (one === null) {
                return yield* Effect.fail(
                  new NotFoundFailure({
                    reason: `this vault defines no plugin called "${input.name}". A definition `
                      + `is a node with a \`${PLUGIN_KEY}\` property naming the word, and a child `
                      + `titled \`${SERVER_NODE}\` whose note is the half.`,
                    named: input.name,
                  }),
                )
              }
              // OFF THE ROSTER rather than off the runtime, so an agent asking
              // what became of what it wrote is answered from exactly the row a
              // person is looking at — one reading, both faces.
              const row = roster().built.find((one) => one.name === input.name)
              return {
                name: one.name,
                version: one.version,
                state: row?.state ?? "off",
                approved: isApproved(one),
                ...(row?.fault === undefined ? {} : { fault: row.fault }),
              }
            }),
          /** ...and stopping one, which is the panel's switch narrowed to the
           *  rows an agent is allowed to touch: `dynamic.set` knows only about
           *  definitions, so a name that is a BUILT row is simply not found
           *  here. That narrowing is the reason this is a second verb rather
           *  than `plugins.set` on a second face. */
          stop: ({ input }) =>
            Effect.gen(function*() {
              const stopped = dynamic === null
                ? false
                : yield* settling(dynamic.set(input.name, false))
              if (!stopped) {
                return yield* Effect.fail(
                  new NotFoundFailure({
                    reason: `this vault defines no plugin called "${input.name}", and a plugin `
                      + `this build compiled in is not an agent's to stop`,
                    named: input.name,
                  }),
                )
              }
              return {}
            }),
          /** WHAT A PLUGIN MAY NAME, read off the tables that enforce it —
           *  `@olai/plugin-build`'s module list, `@olai/plugin-api`'s services
           *  and slots, and this serve's own roster. Nothing here is described
           *  beside the thing it describes. */
          inspect: () =>
            Effect.sync(() => ({
              modules: WRITABLE_MODULES,
              services: SERVICE_KEYS,
              slots: Object.entries(SLOTS).map(([name, one]) => ({
                name,
                keyedBy: one.keyedBy,
              })),
              layout: {
                property: PLUGIN_KEY,
                approved: APPROVED_KEY,
                server: SERVER_NODE,
                browser: BROWSER_NODE,
              },
              taken: roster().built.map((row) => row.name),
            })),
          /**
           * THE PANEL'S SWITCH, and what is left of it once {@link settling}
           * holds the sequence: the CHOICE OF FIBER, which is this verb's alone.
           *
           * A DEFINITION IS A ROW TOO, and the switch reaches it — the panel
           * draws one strip per row and does not know which kind it is looking
           * at. So the name is offered to the vault's definitions and then to
           * the bundle, and each answers whether the word was one of its own.
           *
           * THE REFUSAL IS A NAME NEITHER HALF HAS. The panel walks the roster,
           * so it can only name a row this build is serving — which leaves a tab
           * that outlived the build it was drawn from, and a runtime with no
           * plugin slot at all (`olai surface`, the headless faces), where the
           * honest answer is the same: there is no such plugin here.
           */
          set: ({ input }) =>
            Effect.gen(function*() {
              if (dynamic !== null && (yield* settling(dynamic.set(input.name, input.enabled)))) {
                return {}
              }
              if (offered !== null && (yield* settling(offered.set(input.name, input.enabled)))) {
                return {}
              }
              return yield* Effect.fail(
                new NotFoundFailure({
                  reason: `this build has no plugin named "${input.name}"`,
                  named: input.name,
                }),
              )
            }),
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
     * reads. What it reaches on the WIRE is a question about the listener, and
     * the answer this paragraph used to give was wrong.
     *
     * ## THE RECONNECT CONTRACT, WITHDRAWN
     *
     * It said: *a mount does not reach a listener that has already bound, so the
     * contract for a sibling ARRIVING after the listener is up is RECONNECT — the
     * roster cell moving is what tells a browser to.* The first clause was exact
     * and the conclusion did not follow. `serveSurfaceApp` snapshotted the served
     * pair when it bound and served that ONE generation for its whole life, so a
     * RECONNECTING browser was handed the same superseded table: a re-mounted
     * sibling's tags still resolved to the retired mount's refusing handler, and
     * a page RELOAD did not help either, because the stale table was the
     * server's. Reconnect was the escape and there was no escape.
     *
     * Measured rather than reasoned, on a flip of the kolu row: the fiber
     * re-applied, its sibling re-registered, its connectors re-ran and its
     * appliance link reported connected a second time — while the tab's own
     * liveness readout named five of its members as silent, and went on naming
     * them across a reload. Flipping the CHAT row took a neighbour's members
     * down the same way, because the rows that name its doors unload with it and
     * re-mount after it.
     *
     * THE FIX IS UPSTREAM and is sub-phase 8a: `serveSurfaceApp` takes the
     * served set as accessors read at each accept, so a socket accepted after a
     * flip is built over the current generation. The ruling took that over both
     * alternatives — a façade over the handlers reaches neither the group a
     * per-connection `RpcServer` is built from nor the face gate, and restricting
     * the switch to rows that were running at boot is the boot-time snapshot this
     * phase exists to remove, moved one layer down and written into a rule.
     *
     * ## WHAT IS TRUE ONCE IT LANDS
     *
     * A connection accepted BEFORE a flip is served the old generation until it
     * redials, and the roster cell moving is what makes it redial — which is
     * `@olai/web`'s `client/wire.ts`, dialing the root with no siblings, reading
     * the `plugins` cell off it, loading a chunk per plugin the roster names and
     * redialing with their surfaces. No server-side close of the old sockets is
     * needed or wanted: the drop has already bound their tags to refusing
     * handlers, and the tab's redial is the CLIENT half of the same revert.
     *
     * ## AND A PLUGIN IS MOUNTED AFTER THE LISTENER IS UP NOW
     *
     * An earlier sentence here ended "nothing in this phase mounts a plugin
     * after the listener is up", and {@link Deps.plugins.set} is what ended it.
     * An arriving sibling is mounted, a departing one is dropped live, and the
     * flip is that path taken deliberately rather than at boot.
     *
     * What it did need is {@link moving}, one wall down, and {@link leaving} —
     * because a key can now be mounted a SECOND time, and the framework refuses
     * that over a generation that has not finished coming down.
     */
    const recompose = (): void => {
      const wanted = new Map(siblings().map((one) => [one.name, one] as const))
      for (const [key, one] of wanted) {
        if (mounted.has(key)) continue
        /**
         * A KEY WHOSE PREVIOUS GENERATION IS STILL LEAVING waits for it, and
         * the wait is a CONTINUATION rather than a block.
         *
         * `implementRootedSurfaces` refuses a mount over an unsettled drop, and
         * says why in the refusal: the old generation's sources are still
         * supervised, so its teardown fault is still this runtime's, and nothing
         * in the roster would say why. It also names the fix — *`await drop()`
         * is the whole fix at the call site* — which this file declined to take,
         * with an argument that was exact until this phase: a re-compose that
         * waited for a teardown would hold up the fiber that triggered it, and
         * nothing could ever mount a key twice.
         *
         * The switch mounts a key twice. So the drop is remembered, and a mount
         * that lands on one is deferred behind it rather than thrown into the
         * registry callback that asked for it. Nothing blocks: the arriving
         * sibling is mounted from the drop's own continuation, and the roster is
         * republished then — which is a frame later than the rest of the
         * re-compose and is the honest one, because until that mount the wire
         * genuinely does not carry this sibling.
         */
        const settling = leaving.get(key)
        if (settling !== undefined) {
          void settling.then(() => {
            // ...AND NOTHING IF THE WORLD MOVED AGAIN. A row switched off, on
            // and off again while a teardown was in flight arrives here wanting
            // the middle state; asking the registry afresh is what makes the
            // last press the one that stands.
            if (!mounted.has(key)) recompose()
          })
          continue
        }
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
        // WHAT IS REMEMBERED INSTEAD is the promise, because a key can now be
        // mounted a second time and the framework refuses that until this has
        // settled (the arrival path above says what it refuses with, and why).
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
        //
        // A FAILED TEARDOWN STILL CLEARS THE WAIT, which is why the catch is
        // inside the promise this remembers rather than beside it: the mount
        // that is queued behind it would otherwise wait for ever on a drop that
        // has already finished going wrong, and the framework's own refusal —
        // said at the mount, naming the key — is a better place for that to be
        // decided than a queue nobody can see.
        const settling = mount.drop().catch((thrown: unknown) => {
          ring(
            Effect.logWarning(
              `plugins: "${key}" left the wire and its teardown failed — ${String(thrown)}`,
            ),
          )
        })
        leaving.set(key, settling)
        void settling.then(() => {
          // ...and the key stops being one that is leaving, unless a LATER drop
          // has already claimed it — which is a row switched off, on and off
          // again faster than a teardown settles.
          if (leaving.get(key) === settling) leaving.delete(key)
        })
      }
      // THE GATE, RE-DERIVED WITH THE GENERATION IT GATES — before the roster
      // moves, because the roster moving is what sends every tab back to accept
      // a socket against it.
      gates = gatesFor()
      if (!moving) republishPlugins()
    }

    /** Reconcile an explicit change or an initializer settling. The report
     * must precede composition because the roster reads it synchronously.
     */
    const refreshPlugins = Effect.gen(function*() {
      pendingStatus = false
      yield* offered?.reread ?? Effect.void
      recompose()
      // Kinds are live, but published validation and ops views are cached.
      // Revalidate even when no file moved: a switch can remove vocabulary,
      // and an initializer can register it after its mount already returned.
      // The store reports failed reads on its own errors channel; a read failure
      // must not turn a successful plugin change into a refused switch.
      yield* Effect.ignore(wiring.store.refresh("verified"))
    })

    /**
     * ...AND THE HOLDER THE DYNAMIC HALF REACHES IT THROUGH, filled here
     * because this is the first statement at which there is something to fill it
     * with — see {@link followed} for why the reference cannot be direct.
     *
     * IT IS EVERYTHING A MOVED FIBER COSTS, spelled once — and there are four
     * things that move one now: a revision landing on a definition, a person
     * approving, a person pressing the switch, an agent calling `plugins.stop`.
     * Hold the roster still, do the thing, let it go, and if something actually
     * moved: re-read the report, re-compose, re-judge the vault. Each of those
     * three is argued at the line that does it.
     *
     * `moving` first, so the several registry changes a dispose fans out into do
     * not each publish a roster about a bundle that is halfway there. `ensuring`
     * and not a `finally`, because the flag has to be cleared on an interrupt
     * too: a caller that walked away would otherwise leave this runtime silently
     * never publishing a roster again.
     *
     * IT ANSWERS WHAT IT WAS TOLD, so a caller that has to know whether the word
     * was one of its own still does — which is what makes the switch's two-arm
     * choice of fiber a pair of calls to this and nothing else.
     */
    settling = (run) =>
      Effect.gen(function*() {
        const changed = yield* Effect.ensuring(
          Effect.andThen(Effect.sync(() => { moving = true }), run),
          Effect.sync(() => { moving = false }),
        )
        if (changed || pendingStatus) yield* refreshPlugins
        return changed
      })

    /**
     * THE TWO FACE GATES, AS ONE VALUE PER GENERATION — held rather than
     * computed per read, and derived from what is SERVED rather than from what
     * is REGISTERED.
     *
     * ## The two tables are not the same table, and they used to be
     *
     * `siblings()` is the sibling REGISTRY: a plugin's `apply` registered, so it
     * is in there. `runtime.roster` is what this bundle is SERVING: mounted, and
     * not a generation still coming down. Before the listener read the served set
     * per accept those two were equal wherever anybody looked, because the gate
     * and the group were read together once at bind, when nothing could have
     * moved between them.
     *
     * They are not equal in the window {@link leaving} creates. A row switched
     * off and on again before the previous generation's drop has settled is
     * REGISTERED — its `apply` ran — and its mount is deferred behind that drop.
     * A gate read off the registry then names `surface/<row>/…` tags the group
     * does not carry, and `restrictHandlers` runs at every accept now and throws
     * on exactly that set inequality: the socket is terminated and a
     * `SocketError` reported, on the one gesture a person makes on purpose, until
     * the deferred mount lands and the tab reconnects. Self-healing and still
     * wrong, and the deferral it rides on is this file's own.
     *
     * Derived from `runtime.roster` there is no window: a deferred row is on
     * neither side, so the gate and the group are one generation BY
     * CONSTRUCTION rather than by two readings happening to agree.
     *
     * ## HELD FOR CORRECTNESS, and the cost of an accept is not this file's
     *
     * The value is held per generation because ONE GATE BELONGS TO ONE GROUP,
     * which is the paragraph above — not to save work. `restrictServedGeneration`
     * walks every tag at every accept, unconditionally, so what an accept costs
     * is upstream's and there is nothing this consumer can do about it from
     * here.
     *
     * That is worth stating because it was briefly otherwise. The revision this
     * lane was proved against memoized the restricted record by the identity of
     * the triple it was handed, and a getter that minted a fresh exposure per
     * read defeated that silently — which made "hold one value per re-compose"
     * look like a performance fix as well as a correctness one. The upstream
     * refactor that landed folded the three options into one
     * `ServedGenerationSource` and dropped the memo with them. Only the
     * correctness half survives, and it was always the half that mattered.
     *
     * IF THAT WALK EVER SHOWS UP IN A PROFILE it is a one-line ask upstream,
     * keyed on `ServedGeneration` — and this holder is already what would make
     * such a memo hit, which is the one thing worth remembering about it.
     */
    let gates = facesOf([])
    /** ...and the derivation, spelled once. `roster` is the framework's own
     *  answer to what is served, which is what makes this the gate for the group
     *  rather than a second opinion about it. */
    const gatesFor = (): ReturnType<typeof facesOf> => {
      const served = new Set(runtime.roster)
      return facesOf(siblings().filter((one) => served.has(one.name)))
    }

    /**
     * WHICH KEYS ARE STILL COMING DOWN, and the promise that says when each one
     * has — the bookkeeping a key that can be mounted TWICE needs.
     *
     * `implementRootedSurfaces` keys a mount's channels by GENERATION rather
     * than by name precisely because a key can be recycled, and refuses a mount
     * over a generation whose teardown has not settled. Until the switch,
     * nothing in this tree could recycle one: the bundle mounted once, before
     * the store opened, and a sibling that left never came back. So the drop was
     * floated and the refusal was unreachable.
     *
     * It is reachable now, and reachable in the one shape a person makes on
     * purpose — off, then on. What that cost, before this: the row came back as
     * a FIBER (its kinds, its wake, its browser chunk all returned) and its
     * SIBLING did not, so the tab dialled a plugin whose members were not on the
     * wire and a collection nothing fills read empty for the life of the process.
     * Nothing said so anywhere.
     */
    const leaving = new Map<string, Promise<void>>()

    /**
     * IS THE BUNDLE MID-FLIP — the one thing that holds a republish back, and
     * the only state this file keeps about the loader surface.
     *
     * ## The frame it exists to not draw
     *
     * A flip is one press and several movements. Disposing the chat row runs its
     * finalizers, and each of them is a registry change that calls this
     * re-compose — so between the press and the settle there are frames in which
     * the sibling has left the wire and the ROW has not been re-read yet, and a
     * roster published there says a plugin is `running` whose surface is already
     * gone. The tab acts on that: a roster change is a redial, and it would
     * redial asking for `surface/chat/` on a wire that no longer has it, then
     * redial again a beat later when the truth arrived.
     *
     * ## Why suppressing is honest and not a hack
     *
     * Because the roster is a description of a SETTLED bundle, and always has
     * been. `mountBundle` makes exactly this promise at the boot — it returns
     * once every row that is going to load has loaded and applied — and nobody
     * reads a roster during it. A flip is the same movement with the process
     * already serving, so it gets the same answer: the siblings are mounted and
     * dropped as they move, which is live and must be, and the SENTENCE about
     * them is said once, when there is a true one to say.
     *
     * ## What it is not
     *
     * Not a lock. The re-compose still runs on every registry change while it is
     * set, so the wire is exactly as live as it was; what is deferred is one
     * cell's publish. And it is set and cleared inside one Effect on one fiber
     * ({@link Deps.plugins.set}), so there is no second flip to interleave with —
     * two tabs pressing at once are two calls the surface runs in turn.
     */
    let moving = false
    // An unrelated initializer can finish during a batch that changes nothing.
    // Remember its notification until the batch releases the publication gate.
    let pendingStatus = false

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
    if (offered !== null) {
      offered.onChange.run = recompose
      // A dynamic mount returns while apply is still LOADING. Read eventual
      // readiness or failure even when the plugin registers no sibling surface.
      // Explicit changes already reconcile after their batch; their intermediate
      // status notifications must not publish or refresh a half-settled bundle.
      yield* Stream.runForEach(offered.plugins.changes, () =>
        Effect.suspend(() => {
          if (!moving) return refreshPlugins
          pendingStatus = true
          return Effect.void
        }),
      ).pipe(Effect.forkScoped)
    }

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
       * ...and the two face gates, over the generation this runtime is SERVING.
       *
       * A getter for `bound`'s reason: a face is a default-deny allowlist
       * derived from the sibling set, so a roster that moved and a gate that did
       * not is a serve refusing members it composes or naming members it does
       * not. Whoever reads this after a change gets the gate for the set that is
       * up. What it is derived FROM is {@link gates}, and reading that paragraph
       * is the difference between the two tables this used to conflate.
       */
      get faces() {
        return gates
      },
    }
  })

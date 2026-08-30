/**
 * KOLU'S SERVER HALF — everything kolu-shaped that a composition root used to
 * have to spell for itself.
 *
 * ## What this module is, in one sentence
 *
 * `@olai/server`'s `runtime.ts` held a `const kolu = koluHalf({…})` — a
 * fourteen-line call naming this appliance's constructor, three of its members
 * by name, two vault walks under kolu-shaped filenames, and two log channels —
 * and beside it a `wiring.kolu` slot on the composition's own interface. Every
 * line of that was olai's judgement ABOUT kolu written into a package that must
 * not know the word. It is here now, whole, and what core does instead is
 * iterate: it hands every enabled plugin the same {@link Services} blob and
 * composes whatever comes back under that plugin's own name.
 *
 * ## Why the SERVER half is its own door
 *
 * Three doors on this package and they are disjoint by GRAPH rather than by
 * taste. `./wire` is what every listener statically pulls in and may carry no
 * UI runtime and no padi. The ROOT is the manifest, and the manifest is where
 * this plugin's browser faces hang — the Dock row, the live pane, the header
 * readout, all of them `@olai/kolu-ui` and all of them SolidJS. A server that
 * reached the runtime half through the manifest would pull a UI runtime and an
 * emulator onto the graph of a process that renders nothing, which is the exact
 * hazard `@olai/kolu-client/wire`'s own fence was written for one floor down.
 * So the runtime half is reached HERE, and `@olai/plugins`' own `./server` door
 * is what a composition root opens (`packages/plugins/src/fence.test.ts` walks
 * that closure and asserts the claim rather than trusting this paragraph).
 *
 * ## What did NOT move, and why the wall is where it is
 *
 * `koluHalf` stays in `@olai/kolu-client`, which is still the only package that
 * speaks padi: the dial, the standing mirror, the projection into olai's own
 * shapes, and the watcher are its, and the sixth sitting's ruling that put them
 * behind a package wall is not reopened here. What moved is the CALL — who
 * assembles the deps, and out of what. That division is the whole of the
 * plugin/appliance split: the appliance knows how to reach the tool, and the
 * plugin knows what olai wants to make of it.
 *
 * The two vault walks are the sharpest instance of it and they came with the
 * call: {@link ./claimants.ts} reads who OWNS a terminal and {@link ./config.ts}
 * reads what `_olai/Kolu.olai` says, both over outline records, which is a thing
 * the package that dials padi must not learn (its interfaces are PARAMETRIC in
 * the node type so a compiler can hold it to that). They were in `@olai/server`
 * under kolu-shaped filenames. They are behind the plugin wall now, and what
 * still crosses into the appliance is four strings per claim and one reading per
 * revision.
 */

import type { ImplementSurfaceDeps, SurfaceCtx } from "@kolu/surface/server"
import {
  type Convention,
  conventionServed,
  declarationsOf,
  type Derived,
  type Located,
  NO_TYPING,
  type OutlineSet,
  type PropDeclarations,
} from "@olai/format"
import { type Dial, koluHalf } from "@olai/kolu-client"

import { claimantsIn } from "./claimants.ts"
import { koluFileIn, watchConfigIn } from "./config.ts"
import { surface } from "./wire.ts"

/** The kinds this plugin teaches a vault, reached on this door — see
 *  {@link ./kinds.ts} for the word, and `@olai/plugins`' `server.ts` for why
 *  the table is assembled here rather than off the manifest. */
export { kinds } from "./kinds.ts"

/** The wire half, re-exported so a composition root reads ONE entry per plugin
 *  — and so the sibling key the surface is composed under and the key its deps
 *  are filed under are the same word by construction rather than by two lists
 *  agreeing ({@link ./wire.ts} is where it is spelled). */
export { faces, name, surface } from "./wire.ts"

/**
 * WHETHER THIS HOST IS RUNNING KOLU, on the same door and for the same graph
 * reason ({@link ./probe.ts}).
 *
 * It is not part of {@link serve}, and the two are asked at different moments by
 * different callers: the runtime half is made ONCE when the surface binds and
 * keeps a socket for the life of the process, while this is asked FRESH per
 * conversation, on the session-open path, so a padi started after olai is picked
 * up by the next session instead of the next restart. Folding the probe into
 * `serve`'s return would tie a per-session question to a per-process value and
 * would make the answer a session was opened on the answer some earlier session
 * got.
 */
export { probe } from "./probe.ts"

/**
 * WHAT THIS HALF ASKS CORE FOR — a subset of what core offers every plugin, and
 * the subset IS the documentation.
 *
 * Core's blob (`@olai/plugins`' `PluginServices`) carries five fields and an
 * injectable; this signature names the four kolu reads and leaves `served` off,
 * because where a relative path resolves is odu's question and not this one's.
 * That is not a courtesy: a parameter is CONTRAVARIANT, so a half that asked for
 * something core does not offer would be a type error at the registry, and a
 * half that stopped needing a field says so by deleting a line here.
 *
 * `dial` arrives as `unknown` and is narrowed BELOW, once. Core cannot type a
 * plugin's own test double without learning what the plugin talks to, which is
 * the one thing the wall exists to prevent — so the narrowing is this package's,
 * at this package's edge, where `Dial` is a word that means something.
 */
export interface Services {
  readonly env: Record<string, string | undefined>
  readonly now: () => string
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
  readonly dial?: unknown
}

/**
 * ONE REVISION OF THE VAULT, as much of it as this half reads.
 *
 * Core passes the whole published snapshot; this type is the part of it kolu
 * touches, and writing it as a structural subset rather than importing the
 * store's `Snapshot<Reading>` is what makes "each plugin takes what it needs" a
 * claim the compiler checks instead of a sentence in a header.
 *
 * THREE PIECES, and each is here for a reason the other two do not share. The
 * NODES are what the claims and the watch knobs are read off. The SET is what
 * the owned file is found among — served paths, not recorded ones, because a
 * config that parses to nothing contributes no records and the drawer's wrench
 * onto it must not fall away with them ({@link ./config.ts}'s `koluFileIn`).
 * And `changed`/`removed` are what makes that finding cheap: `conventionServed`
 * hands back the SAME object while nothing it describes has moved, so the walk
 * over every served path runs on the revisions that could have changed its
 * answer and on no others.
 */
export interface VaultRevision {
  readonly value: {
    readonly set: OutlineSet
    readonly derived: Derived
  }
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

/** This surface's own write face, which is what `implementSurfaces` hands back
 *  under this plugin's key. Named here because it is this package's spec that
 *  decides what is on it — core carries the value as `unknown` and could not
 *  spell `collections.fleet` if it wanted to, which is the point. */
type Ctx = SurfaceCtx<typeof surface.spec>

/**
 * THE KOLU HALF, assembled — the padi link, the fleet it keeps, the events ring,
 * the watcher's pulse and the one screen read.
 *
 * MADE EAGERLY, STARTED LAZILY, and that is unchanged by the move. Making it is
 * free and gives the collection and the procedure something to read before
 * anything has dialed, so a page that loads while the link is still coming up
 * draws an empty fleet and a hollow chip rather than crashing on a null.
 * STARTING it is the `link` cell's connector, which the framework runs when the
 * surface BINDS — the same place the git sweep is forked, for the same reason: a
 * standing fact about this machine is the runtime's to keep, not the first
 * subscriber's to pay for. That is the whole of the one-connection claim, and
 * sibling composition does not touch it: `implementSurfaces` starts a sibling's
 * connectors exactly as `implementSurface` starts a standalone surface's.
 *
 * THERE IS NO `null` ARM ANY MORE, and its absence is the composition rather
 * than a capability lost. `KoluDeps.options` still takes one — a face with no
 * business holding a socket open passed `null` and every member answered the way
 * an unreachable padi does — but a face that wants none of this now composes
 * none of this: `@olai/server`'s wiring turns the plugins OFF as a set, so this
 * function is not called at all and there is no `surface/kolu/` on the wire to
 * answer hollowly. The state a reader sees is the stronger of the two: a member
 * that is absent rather than a member that is present and empty.
 */
export const serve = (services: Services): {
  readonly deps: ImplementSurfaceDeps<typeof surface.spec>
  readonly published: (ctx: unknown) => void
  readonly revision: (revision: VaultRevision) => void
  readonly unloaded: () => void
} => {
  /** This sibling's own write face, filled the moment it is implemented. A
   *  FUNCTION reads it below rather than a captured value, because the surface
   *  does not exist while this is being built and the mirror's first row can
   *  move before it does — the arrangement the three read-back closures in
   *  `runtime.ts` were, with core no longer in the middle of it. */
  let ctx: Ctx | undefined

  const half = koluHalf<Located>({
    options: {
      env: services.env,
      now: services.now,
      // THE ONE NARROWING, and the only cast in this package. Core carries a
      // plugin's test double opaquely because typing it would mean knowing what
      // this plugin dials; `Dial` is that word, and this is the edge that owns
      // it. A test that hands a fake padi through is checked against `Dial` by
      // `makeMirror` on the next line down, so a wrong value is a type error at
      // the harness rather than a silent no-op here.
      dial: services.dial as Dial | undefined,
    },
    fleet: () => ctx?.collections.fleet,
    events: () => ctx?.collections.events,
    pulse: () => ctx?.cells.pulse,
    // THE VAULT WALKS, passed in — the appliance's own ruling, and this package
    // is now where both sides of it live. `claimants.ts` reads outline records,
    // which is a thing the package that dials padi must not learn; what crosses
    // is four strings per claim. `config.ts` is the second of the kind, for the
    // watcher's knobs: what crosses is the derived intervals, the mute VALUES
    // verbatim, the malformed lines to say, and — the events drawer's foot —
    // the mutes' TITLES beside the file that was read.
    // ...LICENSED BY WHAT THE VAULT DECLARED, which is why the reading is
    // handed over rather than looked up: this walk finds its key by declared
    // KIND now, and `KoluDeps` takes `(nodes) => …` because that package must
    // not learn what a `Derived` is. So the plugin holds the reading beside
    // the convention below — the same `let`, set on the same revision, and read
    // synchronously inside the very call that set it.
    claimants: (nodes) => claimantsIn(declaring, nodes),
    config: watchConfigIn,
    // Chatter, at debug: on a machine with no kolu this is a line every few
    // seconds and it is not news. What IS news — a connect, a skew, a link that
    // dropped — is the same channel, because the alternative is this module
    // deciding which of padi's sentences matter.
    say: services.say,
    // What the OWNER must read: a malformed `_olai/Kolu.olai` value, an
    // ambiguous mute — the sentences whose promise lives in this package's `docs.md`.
    // Rare by latch (one line per new shape or value), and the default console
    // level is `info`, so the channel is `warning`, not `debug`.
    warn: services.warn,
  })

  /** WHICH SERVED OUTLINE IS `_olai/Kolu.olai`, carried across revisions.
   *  `conventionServed` hands the same object back while nothing it describes
   *  has moved, so this is a walk over the served paths on the revisions that
   *  could have changed the answer and a pointer comparison on the rest. It is
   *  the plugin's `let` now: core used to hold it beside the inbox's and the
   *  shelf's, which meant a general package holding one plugin's convention. */
  let file: Convention | undefined

  /** ...AND WHAT THAT REVISION DECLARES, for {@link ./claimants.ts}'s licence.
   *  `declarationsOf` is memoised per view one package down, so this is a
   *  pointer read on every revision the declarations file did not move on.
   *  `NO_TYPING` before the first revision is the truth about it: nothing has
   *  been read, so nothing is declared, so nothing claims a terminal. */
  let declaring: PropDeclarations = NO_TYPING

  return {
    /**
     * THE FIVE MEMBER HANDLERS, straight through — and the annotation on this
     * function's return type is where the agreement between this plugin and the
     * framework is actually proved. `ImplementSurfaceDeps<typeof surface.spec>`
     * is written against THIS package's own surface, so a member the appliance
     * renamed, dropped or re-shaped is a type error in this file with this
     * plugin's name on it. Core carries the value as `unknown` and never opens
     * it, which is why the check has to be here.
     */
    deps: half.handlers,
    /** This sibling's ctx, the moment `implementSurfaces` has minted it. The
     *  cast is this package narrowing an opaque value to its OWN surface's write
     *  face — the mirror image of the `dial` narrowing above, and safe for the
     *  same reason: core addresses it by the only word it knows about this
     *  plugin, which is the key it composed the surface under. */
    published: (bound) => {
      ctx = bound as Ctx
    },
    /**
     * A VAULT REVISION LANDED — re-derive who claims which terminal, and what
     * the watcher's knobs now say.
     *
     * It walks every node and publishes almost nothing: the mirror compares each
     * row's owner before it upserts, so a keystroke that landed in a note costs
     * one walk and zero frames. What it costs on the revision a `terminal`
     * property is actually written is one frame for that terminal's row.
     *
     * The FILE is asked of the SERVED outlines rather than of the records
     * (`served`, not `recorded`): a file the codec tore apart still names itself,
     * and the foot's wrench over it must not fall away WITH the nodes.
     */
    revision: (revision) => {
      file = conventionServed(koluFileIn, revision.value.set, revision, file)
      declaring = declarationsOf(revision.value.derived)
      half.revision(revision.value.derived.nodes, file.file ?? null)
    },
    /** The store has NEVER published — the vault's kolu verdict goes out with
     *  the canvas: yesterday's mutes line and the wrench's door beside it are
     *  claims the store can no longer vouch for. The watch knobs are NOT touched
     *  — their timers hold their last hand-off while the mirror, equally starved,
     *  has nothing new for them to gate. */
    unloaded: () => half.unloaded(),
  }
}

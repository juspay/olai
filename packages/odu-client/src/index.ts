/**
 * @olai/odu-client — HOW OLAI REACHES ODU, and the only place that knows how.
 *
 * One package holds the probe, the dial, the hold, and the projection into
 * olai's own vocabulary. What leaves is `./wire`'s shapes — a `CiRun`, a
 * `RunCell` — so a change to odu's contract is a change HERE and stops.
 *
 * ## Why a PACKAGE, which is a question already answered next door
 *
 * `@olai/kolu-client`'s header argues it in full and every word transfers: a
 * directory can import its parent, so a boundary drawn with a directory is a
 * comment somebody has to keep believing, and A PACKAGE WALL MAKES THE
 * DIRECTION PHYSICS. What is worth adding is the sentence specific to THIS
 * appliance, because odu's client half is unusually easy to smuggle: it is
 * BROWSER-SAFE. `@odu/run-client/surface` imports nothing native, and a face
 * that wanted `STATUS_META`'s glyph table could reach for it and compile.
 * `scripts/check-odu-deps.sh`'s second assertion is what stops that, and the
 * reason it must is the one the kolu slice gives about padi's schema: the
 * moment a component imports odu, every skew in odu's contract is a skew in
 * olai's browser bundle and this package has stopped being the only thing that
 * knows odu exists.
 *
 * ## The live-properties seam's SECOND TENANT, and nothing more special
 *
 * The board stores decision-shaped names — a terminal id, a worktree path —
 * and the UI gives them living faces. The terminal door was the first; this is
 * the second, and the whole point of the phase is that it needed no new
 * mechanism: a named spread into `@olai/surface` (the kolu slice's own),
 * a cell with a connector (the `kolu` cell's own), an injected vault walk (the
 * `claimants` arrangement, one key over), and a dressing in `@olai/web`'s
 * live-properties table. A third living thing later — a deploy, a session — is
 * a new dressing and zero new mechanism.
 *
 * ## `null` is a setting, and it is most of the faces
 *
 * `olai web` probes. Every other face — `/mcp`, `olai surface`, a test — passes
 * `null`, and {@link oduHalf} answers the way a machine with no CI running
 * does: the cell stays at `NO_RUNS` and every chip draws nothing. ONE code
 * path rather than two, which is the point — "this process has no business
 * dialing sockets in other people's checkouts" and "nothing is running CI"
 * are the same thing to a reader, so they are the same thing to the code.
 *
 * ## What is DELIBERATELY not here, and the one that is a judgement call
 *
 * WRITING. No launch, no rerun, no cancel, no classification, and no board
 * write of any kind. That is the phase boundary (the odu-in-olai plan's phases
 * 3 and 4), and the members say so on the wire rather than in a comment: the
 * `ci` cell declares `verbs: ["get"]`.
 *
 * ODU'S ON-DISK LEDGER. The plan says a settled run's chip shows "the last
 * verdict from the on-disk record, or nothing", and this package takes the
 * second road on purpose. `@odu/run-client`'s README names `runRecord.ts` as
 * something that STAYED in odu — "a different wire: a file read by path, not a
 * socket contract, and the layout under it is the ledger's… It moves the day a
 * consumer wants a settled run's verdict without odu's ledger" — so reading
 * `.ci/<sha7>/…` from here would be olai spelling odu's on-disk layout a
 * second time, in the one direction the package boundary was drawn to prevent,
 * and the drift would be silent (a ledger that changed shape reads as a run
 * that never happened).
 *
 * So the last verdict here is WHAT OLAI WATCHED: the final projection of a run
 * this server held, kept with `live: false`. It is honest about its
 * provenance and it has one honest limit — a server that was not running when
 * the run was has nothing to show, and shows nothing, which the plan's own
 * sentence allows for. The durable read is phase 4's, where the record is
 * already being parsed for classification and the boundary is moved once,
 * upstream, rather than guessed at here.
 */

import { inMemoryStore } from "@kolu/surface/server"
import { Effect } from "effect"

import { reposRootIn } from "./resolve.ts"
import { makeWatch, type Watch, type WatchDeps, type WorktreeNode } from "./runs.ts"
import { type CiRuns, NO_RUNS } from "./wire/index.ts"

/** TWO NAMES leave this package, and they are the two the server actually
 *  holds: what one worktree-naming node looks like on the way in ({@link
 *  WorktreeNode}), and the dial
 *  a test substitutes ({@link DialRun}). The resolution rule's own symbols
 *  are NOT re-exported — `./resolve.ts` is where they are argued and where
 *  its bench imports them from, and a door onto a module nothing outside
 *  opens is a public API with no caller. */
export { type DialRun, type WorktreeNode } from "./runs.ts"

/**
 * What this half is handed.
 *
 * `worktrees` is THE VAULT WALK, injected — the `claimants` arrangement one
 * appliance over, and the same boundary for the same reason. Which nodes carry
 * a `worktree` is a reading of outline records, so it belongs to whoever holds
 * the vault (`@olai/server`'s `worktrees.ts`), and what crosses is four strings
 * per node ({@link WorktreeNode}). The interfaces here are PARAMETRIC in the
 * node type,
 * which is the same claim the compiler can check: a package generic in `N`
 * cannot read an `N`.
 */
export interface OduDeps<N> {
  /**
   * The probe's environment and clock, or `null` for a face that is not to
   * have one (see the header).
   *
   * `env` and `served` are what the repos root is decided from
   * (`./resolve.ts`'s `reposRootIn`) — a test that asserts the resolution
   * needs to own them, and a composition root is where a process reaches for
   * the real environment.
   */
  readonly options: {
    readonly env: Record<string, string | undefined>
    /** The directory this server SERVES — the vault. */
    readonly served: string
    readonly dial?: WatchDeps["dial"]
  } | null
  /** THE VAULT WALK, injected. See above. */
  readonly worktrees: (vault: N) => Iterable<WorktreeNode>
  /** Routine narration, at debug. */
  readonly say: (line: string) => void
  /** The sentences the OWNER must read — a dial that failed for a reason that
   *  is not absence. Wired to a level the default console turns on. */
  readonly warn: (line: string) => void
}

/** The one member handler, plus the hook a revision pulls. */
export interface OduHalf<N> {
  /**
   * THE MEMBER HANDLER, as `@olai/server` spreads it.
   *
   * One cell, so the server names no odu verb at all — the arrangement
   * `@olai/kolu-client`'s `handlers` established, kept at the smaller scale
   * this slice actually needs. The store answers a fresh subscriber's snapshot
   * off the watcher's own rows; `connect` is where the sweep is forked, ONCE,
   * when the surface binds.
   */
  readonly handlers: OduHandlers
  /**
   * A VAULT REVISION LANDED. The server drives it and hands over ONE OPAQUE
   * READING; the WALK is this package's to run through the one it was given.
   *
   * One value rather than the node LIST `@olai/kolu-client` takes, because the
   * walk it feeds reads two things off one reading — the records, and what the
   * vault DECLARES about the key (`@olai/server`'s `worktrees.ts` argues why the
   * second one gates the probe). Both are the server's to hold and neither is
   * this package's to look at, which the type says: `N` is never read here.
   *
   * Cheap and idempotent — it stores the worktree set, and the next sweep acts on
   * it, so a keystroke in an outline never dials anything.
   */
  readonly revision: (vault: N) => void
  /** The store has NEVER published — the directory's read failed outright. A
   *  set of runs derived from a vault the server can no longer see would be
   *  yesterday's reading, so the worktrees reset to none; the sockets follow on
   *  the next sweep. */
  readonly unloaded: () => void
}

/** The cell, in the shape `defineSurface`'s sections take. */
export interface OduHandlers {
  readonly cells: {
    readonly ci: {
      readonly store: { get: () => CiRuns; set: (value: CiRuns) => void }
      readonly connect: (cell: { set: (value: CiRuns) => void }) => Effect.Effect<void>
    }
  }
}

/** ONE VAULT NODE, as this package needs to see it — which is not at all.
 *  `@olai/kolu-client`'s `VaultNode`, for its reason: a structural shape here
 *  would be this package learning what an outline record is, written down. */
export type VaultNode = unknown

export const oduHalf = <N,>(deps: OduDeps<N>): OduHalf<N> => {
  /** The cell's standing value, and the ONE writer of it is the framework's
   *  own write-through. The `knobs` cell one package over argues this shape at
   *  length and the argument is the same here: the cell declares `equals`, and
   *  the framework gates a publish on `equals(store.get(), next)` — so a store
   *  that read a value this half had already written would compare the new
   *  against the new and eat every publish as a no-op. */
  const store = inMemoryStore<CiRuns>(NO_RUNS)
  /** The cell's own handle, captured at `connect`. It may not ride `deps` onto
   *  the surface-wide ctx for the `kolu` cell's reason: a cell's first reading
   *  lands INSIDE `implementSurface`, while that ctx is still being minted, and
   *  a publish into it there is silently dropped. */
  let cell: { set: (value: CiRuns) => void } | undefined

  if (deps.options === null) {
    return {
      revision: () => {},
      unloaded: () => {},
      handlers: {
        cells: {
          ci: {
            store,
            // A connector that PARKS rather than returns, for the linkless
            // kolu half's reason: a connector that returns has FINISHED, and a
            // finished connector is a member the framework may consider
            // settled. Parking is what "this cell has one value and will never
            // move" looks like from inside the contract.
            connect: () => Effect.never,
          },
        },
      },
    }
  }

  const { env, served, dial } = deps.options
  const watch: Watch = makeWatch({
    publish: (runs) => cell?.set({ runs }),
    say: deps.say,
    warn: deps.warn,
    reposRoot: reposRootIn(env, served),
    dial,
  })

  return {
    revision: (vault) => watch.reclaim(deps.worktrees(vault)),
    unloaded: () => watch.reclaim([]),
    handlers: {
      cells: {
        ci: {
          store,
          connect: (handle) =>
            Effect.suspend(() => {
              cell = handle
              // SETTLE FIRST, then sweep. A surface that binds after a
              // revision has already landed holds rows nothing has published
              // yet — the `knobs` cell's own first-boot edge, and the
              // framework's `equals` gate is what makes an unconditional
              // settle free: a boot with nothing watched publishes nothing.
              handle.set({ runs: watch.rows() })
              return watch.run
            }),
        },
      },
    },
  }
}

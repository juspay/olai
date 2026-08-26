/**
 * THE FLEET, as this tab holds it — ONE subscription, however many chips.
 *
 * A lanes outline has a `terminal` property on a dozen rows, and every one of
 * them wants a dot. The economy of rung 1 is that this costs one subscription
 * per TAB and one padi connection per SERVER — so a chip must not subscribe,
 * and this context is what it reads instead. It is `../served.tsx`'s
 * arrangement exactly: subscribe once at the shell, fold the frames into a map,
 * hand every leaf an accessor over it.
 *
 * TWO MEMBERS, read together and by one reader, for `../directory.ts`'s reason:
 * the link cell and the fleet collection arrive on two channels, either can
 * come first, and only something holding both can say which to believe. A chip
 * that read them separately would flash `gone` on every reconnect, when the
 * fleet's re-seed and the cell's `connected` land a frame apart.
 *
 * ## The snapshot verb rides here too
 *
 * Rung 2's `read` is on the CONTEXT rather than threaded as a prop, and that is
 * `../served.tsx`'s argument about the file list applied to a callback:
 * threading it would put `onRead` in the signature of `NodeBody`, `NodeLine`,
 * `Tree` and both pages, every one of them carrying a function for a leaf five
 * levels down that one chip in a hundred ever calls.
 *
 * ## The map is MUTATED and a counter is what moves
 *
 * The fold keeps one map and writes into it, publishing a counter beside it.
 * Copying a fleet of thirty rows per frame would be a walk per terminal per
 * change, which on a busy machine is a change a second — and the readers are
 * leaves drawn per row, which is the exact shape `../served.tsx` refuses to pay
 * for. What a reader depends on is the counter, so a frame that moved one row
 * re-runs every chip's memo once and none of them rebuilds anything.
 */

import { type Accessor, createContext, createMemo, type JSX, useContext } from "solid-js"
import type { CollectionDelta } from "@kolu/surface/define"
import type { CollectionFold } from "@kolu/surface/solid"
import { Effect, Result } from "effect"

import type { FleetTerminal, KoluLink, Snapshot } from "@olai/surface"
import { after, type Held, seeded } from "./held.ts"
import { KOLU_UNDIALED, SnapshotRefused } from "@olai/surface"

/** Take a snapshot of one terminal. The answer is the text or the refusal —
 *  never a throw, because both are things the pane draws. */
export type ReadScreen = (terminal: string) => Promise<Snapshot | SnapshotRefused>

/** What a chip asks: the link, the rows it resolves against, and the one verb. */
export interface Fleet {
  readonly link: Accessor<KoluLink>
  /** THE ROWS, as a map keyed by padi's full id — handed over whole rather
   *  than as a lookup, because a chip does not look its value UP: it RESOLVES
   *  it (`@olai/surface`'s `resolveTerminal`), and a prefix needs the key set
   *  to resolve against. A lookup was what drew a working terminal as retired
   *  for every one of the board's eight-character values. */
  readonly terminals: () => ReadonlyMap<string, FleetTerminal>
  /**
   * See the header. `undefined` where there is no wire — a test that mounts a
   * run, a document page drawn statically — and then the dot is a status glyph
   * and nothing more, which is the honest degradation: rung 1 is a reading of
   * the fleet this tab already holds, and it does not need rung 2 to be true.
   */
  readonly read?: ReadScreen
}

const FleetContext = createContext<Fleet>()

/**
 * The three things this provider is handed — narrowed at the parameter for the
 * reason every seam in this client is (`../directory.ts`'s note): what a module
 * is handed should be what it reads, and a suite can then stand one up out of a
 * hand-driven frame source instead of a wire socket.
 */
export interface FleetSources {
  readonly link: Accessor<KoluLink | undefined>
  readonly fold: CollectionFold<string, FleetTerminal>
  readonly read?: ReadScreen
}

export function FleetProvider(props: {
  readonly sources: FleetSources
  readonly children: JSX.Element
}) {
  const held = props.sources.fold<Held>({
    // A SNAPSHOT REPLACES, and a re-seed after a link flap must not leave a row
    // padi dropped while the socket was down. The map is fresh here and mutated
    // only by `step`, which is the framework's own contract for the two arms:
    // `init` answers a full set, `step` answers a coalesced delta.
    init: seeded,
    step: (previous, delta: CollectionDelta<string, FleetTerminal>) =>
      after(previous, delta.upserts, delta.removes),
  })
  const fleet: Fleet = {
    // The SEED is `absent` and not `undefined`, which is `@olai/surface`'s own
    // decision one wire back: a server that has not finished dialing has not
    // found padi absent, but what a reader would draw during that window is the
    // hollow chip it would draw a moment later anyway, and a fourth state would
    // reach every renderer for the sake of it.
    link: createMemo(() => props.sources.link() ?? KOLU_UNDIALED),
    terminals: () => held()?.rows ?? NO_ROWS,
    read: props.sources.read,
  }
  return <FleetContext.Provider value={fleet}>{props.children}</FleetContext.Provider>
}

/**
 * The fleet, or a standing HOLLOW.
 *
 * It does NOT throw outside the provider, and that is the one place this
 * departs from `../served.tsx`'s rule. A property run is drawn in more places
 * than the app shell — a document's frontmatter, a row in a pane, and every
 * test that mounts one of them — and the honest answer for a chip with no fleet
 * behind it is the same hollow a chip on a laptop without kolu gets. A throw
 * would make the door a thing every host has to provide for, when the whole
 * design is that the door hangs off a property and costs its host nothing.
 */
export const useFleet = (): Fleet =>
  useContext(FleetContext) ?? {
    link: () => KOLU_UNDIALED,
    terminals: () => NO_ROWS,
  }

/** The empty fleet, minted once: what a providerless host reads, and what a
 *  provider reads before its first frame. */
const NO_ROWS: ReadonlyMap<string, FleetTerminal> = new Map()

/**
 * The surface procedure, as a {@link ReadScreen}.
 *
 * Two things happen here and both are about the promise the pane makes. The
 * effect's DECLARED failure is a refusal and is handed through as data — that
 * is the whole reason it is declared. Anything else is a transport that did not
 * land, and it is re-said as the refusal a reader can act on rather than
 * surfaced as a stack: the pane's only move either way is the refetch button,
 * so a sentence is the honest whole of it.
 */
export const readingScreen = <E,>(
  call: (input: { terminal: string }) => Effect.Effect<Snapshot, E>,
): ReadScreen =>
(terminal) =>
  // THIS PROMISE NEVER REJECTS, and that is the whole contract rather than a
  // nicety. Its caller is a `createResource` read during RENDER, and a
  // resource whose fetcher rejected THROWS when it is read — which took the
  // whole page down ("This page broke", nothing updates again) the first time
  // a chip sent a value the wire would not encode. A click may not break a
  // page, so every outcome below is a value.
  //
  // `Effect.result` catches the DECLARED failure. It does not catch a defect,
  // and the one that mattered was a defect: an input the procedure's schema
  // refuses (`Expected a UUID at [id]`) fails at ENCODE, before the call is
  // anything the error channel knows about. `.catch` is the arm for that, and
  // for anything else the runtime can do.
  Effect.runPromise(Effect.result(call({ terminal }))).then(
    (outcome) => (Result.isSuccess(outcome) ? outcome.success : asRefusal(outcome.failure)),
    (thrown: unknown) => asRefusal(thrown),
  )

/**
 * A declared refusal, passed through; anything else re-said as one.
 *
 * Recognised by its `_tag` rather than by `instanceof`, which is
 * `@olai/format`'s own rule for a failure that crossed a wire: the tag is what
 * survives decoding.
 *
 * WHAT ANYTHING ELSE SAYS is deliberately about the page rather than about the
 * terminal. A schema refusal, a dead socket and a bug in this code are all,
 * to the person looking at the pane, "olai could not do that" — and inventing
 * a sentence about padi for a failure that never reached padi would be the
 * pane guessing. The detail goes to the console, which is where a defect
 * belongs and where it stopped going when this stopped throwing.
 */
const asRefusal = (failure: unknown): SnapshotRefused => {
  if (
    typeof failure === "object" && failure !== null
    && (failure as { _tag?: unknown })._tag === "SnapshotRefused"
  ) {
    return failure as SnapshotRefused
  }
  console.warn("olai: a snapshot read failed in a way the pane does not model", failure)
  return new SnapshotRefused({
    reason: "no-padi",
    says: "olai could not read that screen — the detail is in the console.",
  })
}

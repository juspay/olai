/**
 * THE PADI LINK — one connection, one mirror, however many readers.
 *
 * This is the module `docs/brainstorming/orchestrator.md` means by "the padi
 * link in one module": everything olai knows about reaching kolu is here, and
 * what leaves is a reading (`@olai/surface`'s own shapes) rather than padi's
 * contract.
 *
 * ## The one-connection claim, and what actually keeps it
 *
 * Ten tabs open on a lanes outline are ten subscriptions to olai's `fleet`
 * collection and ONE connection to padi. That is not a discipline anybody has
 * to remember: this module is started ONCE by the runtime, on the runtime's own
 * scope, exactly like the thirty-second git sweep beside it — a `connect` fiber
 * on a cell, which the framework starts when the surface BINDS and not when a
 * browser subscribes. A tab arriving finds the mirror already running and reads
 * the map it has been keeping; a tab leaving takes nothing with it.
 *
 * So there is no refcount here and no per-reader anything, and the count is a
 * TEST rather than a promise (`./mirror.test.ts` stands N readers up against one
 * fake padi and asserts the dial ran once). The day a reader does need its own
 * subscription is phase 6's stream, and that one is refcounted BECAUSE it is
 * per-terminal — which is a different arrangement for a different reason, and
 * the contrast is the argument for keeping this one dumb.
 *
 * ## Absent is a state, not a failure
 *
 * A machine with no kolu running is the ordinary case and every page must draw
 * on it. So the dial's failure is folded into {@link KoluLink}'s `absent` arm
 * and the fleet is emptied — no exception escapes to the runtime, nothing logs
 * at error level, and the retry keeps running quietly. `skew` is the other arm
 * and is kept separate for the reason the schema gives: the two have opposite
 * fixes.
 *
 * ## What is mirrored, and what deliberately is not
 *
 * THREE MEMBERS, and they are three because the row draws three. `terminals`
 * is the records; `urgency` is padi's own attention partition, computed once
 * on the host and shipped as id lists; `activity` is the set of terminals
 * moving bytes right now. The second and third are what the row's violet
 * "blocked on you" emphasis is painted from, and they are SEPARATE FEEDS from
 * the records on purpose — padi computes the class once and every kolu surface
 * reads that answer, rather than each re-deriving it from the metadata. The
 * fold from the two feeds to `TerminalAttention` is kolu's too
 * (`@kolu/padi-client/attention`), so olai computes exactly what the Dock
 * computes instead of a restatement of it.
 *
 * The two arrive on INDEPENDENT subscriptions at wildly different cadences —
 * an agent transition against kaval's byte edge, roughly a second — which is
 * why they are held apart here and joined per row rather than merged into one
 * value on arrival. Merging them would invalidate every class-only reader on
 * every byte tick.
 *
 * `watchStates` (the hold-and-nag engine) is still not mirrored: phase 2 wants
 * it, and a mirror of a member nobody reads is a subscription paid for
 * nothing. The mirror grows when a reader does.
 */

import { mirrorRemoteSurface } from "@kolu/surface/mirror"
import { connectPadi } from "@kolu/padi-client/dial"
import {
  PADI_SURFACE_VERSION,
  padiSurface,
  type PadiTerminal,
  type PadiUrgency,
} from "@kolu/padi-client/surface"
import {
  type DaemonContractSkewError,
  isContractSkewError,
} from "@kolu/surface-daemon-supervisor"
import { KOLU_UNDIALED, type KoluLink } from "@olai/surface"
import { Cause, Duration, Effect, Schedule, type Stream } from "effect"

import { rendezvousIn } from "./socket.ts"

/** How long between a dial that found nothing and the next one. Long enough
 *  that a laptop with no kolu is not opening a socket every second; short
 *  enough that starting kolu lights the dots up while you are still looking at
 *  the window. */
const REDIAL = Duration.seconds(5)

/**
 * What the runtime hands this module: somewhere to put the two things it
 * learns.
 *
 * Callbacks rather than a returned value, because both facts are PUSHED — the
 * mirror moves a record when padi says so, and nothing here knows when that
 * will be. `@olai/server`'s runtime wires them to the cell and the collection;
 * a test wires them to arrays.
 */

/** ONE FRAME AS PADI SENDS IT — the shape `terminalAttach` yields, named here
 *  so the seam above can be typed without this module re-exporting padi's whole
 *  contract. The projection into olai's own `TerminalFrame` is `./mirror.ts`'s,
 *  at the same seam every other record is projected at. */
export type PadiAttachFrame =
  | { readonly kind: "delta"; readonly data: string }
  | { readonly kind: "snapshot"; readonly data: string; readonly topLine: number }

export interface Sink {
  /** The link's state moved. Called on every dial outcome, including one that
   *  found what the last found — the CELL's own `equals` is what makes a
   *  repeat publish nothing, so this end does not need to remember. */
  readonly link: (state: KoluLink) => void
  /** A terminal arrived or changed. The record is padi's, raw: the projection
   *  into olai's shape is `./fleet.ts`'s, and it is done at the sink rather
   *  than here because it needs the vault reading, which this module has no
   *  business holding. */
  readonly upsert: (id: string, record: PadiTerminal) => void
  /** A terminal left the fleet. */
  readonly remove: (id: string) => void
  /** EVERY terminal left, because the link did. Separate from `remove` because
   *  it is not news about any terminal — it is the fleet becoming unknown, and
   *  a reader that folded it into a stream of removes would draw an empty
   *  fleet as if padi had reported one. */
  readonly cleared: () => void
  /** Routine narration, wired to the server's own log. */
  readonly say: (line: string) => void
  /** THE LIVE FACE, handed over on every connect and taken back (`null`) on
   *  every drop. It is what turns the snapshot verb from a read into a
   *  refusal, and it is pushed rather than pulled for the same reason the
   *  records are: nothing here knows when the link will move.
   *
   *  Typed as padi's `screen.text` call and nothing wider, so what leaves this
   *  module is one verb rather than a whole daemon client — a caller that
   *  could reach `lifecycle.kill` through a field named `reader` is a caller
   *  that can, one refactor later. */
  readonly reader: (
    face:
      | null
      | ((input: { id: string; startLine?: number; endLine?: number }) => Effect.Effect<string, unknown>),
  ) => void
  /**
   * PADI'S ATTENTION PARTITION MOVED — the `urgency` cell, whole.
   *
   * Four id lists, computed once on the host. It arrives RAW, like a record
   * does, because what it means is `@kolu/padi-client/attention`'s to say and
   * this module's only job is to carry it: the translation from the cell's
   * positional `awaitingIds` to the class name `asking` happens in exactly one
   * place upstream, and a second spelling here is how two consumers come to
   * disagree about the same partition.
   */
  readonly urgency: (value: PadiUrgency) => void
  /**
   * ...and the set of terminals moving bytes RIGHT NOW — the `activity`
   * stream, whose every frame is the whole current set rather than a delta.
   *
   * A separate callback from {@link Sink.urgency} because they are separate
   * subscriptions at separate cadences (see the header): this one pulses on
   * kaval's byte edge, roughly a second, and a reader that only cares which
   * class a terminal is in must not be woken by it.
   */
  readonly live: (ids: ReadonlyArray<string>) => void
  /** THE ATTACH FACE, handed over and taken back on the same edges as
   *  {@link Sink.reader} and for the same reason — a live pane's subscription
   *  is only meaningful while there is a link under it.
   *
   *  Typed as padi's `terminalAttach` stream and nothing wider, so what leaves
   *  this module is one member rather than a whole daemon client. The frames
   *  are padi's own shape; the projection into olai's is `./mirror.ts`'s, at
   *  the same seam the records are projected. */
  readonly attacher: (
    face:
      | null
      | ((input: { id: string }) => Stream.Stream<PadiAttachFrame, unknown>),
  ) => void
  /** A dial ATTEMPT was made. Counted by the caller; see `./mirror.ts`'s
   *  header for why the count is worth a callback. */
  readonly dialed: () => void
}

/** What this build of olai speaks — padi's own constant, from the contract
 *  this package compiled against. A literal here would be a second answer to
 *  padi's version, free to disagree with the schemas actually in hand. */
export const SPEAKS: string = PADI_SURFACE_VERSION

/**
 * HOW A PADI IS REACHED — `connectPadi`'s own shape, named so it can be
 * replaced in a test.
 *
 * Injectable for two reasons and neither is mocking for its own sake: a fake
 * padi over a loopback link is how the mirror is exercised without a daemon on
 * the machine running the suite, and a counting wrapper is how the
 * one-connection claim becomes an assertion instead of a sentence.
 */
export type Dial = typeof connectPadi

/** The link state for a dial that found nothing there. */
const absent = (socket: string, told: boolean, since: string): KoluLink => ({
  ...KOLU_UNDIALED,
  status: "absent",
  socket,
  told,
  speaks: SPEAKS,
  since,
})

/**
 * Run the link, forever, on the caller's scope.
 *
 * It never fails: every outcome is a `link` call and a wait. The effect ends
 * only when its scope closes, which is the server shutting down — and closing
 * the scope is what disposes the dial, so a restart does not leak a socket.
 *
 * `now` is a parameter for the reason `rendezvousIn`'s env is: a test that
 * asserts `since` needs a clock it owns.
 */
export const runLink = (
  sink: Sink,
  env: Record<string, string | undefined>,
  now: () => string,
  dial: Dial = connectPadi,
): Effect.Effect<never> =>
  Effect.gen(function*() {
    const where = rendezvousIn(env)
    yield* Effect.repeat(
      dialOnce(sink, where.path, where.told, now, dial),
      // A plain fixed spacing, not a backoff. What is being retried is "has
      // somebody started kolu yet", which does not get less likely the longer
      // it has been false — an exponential backoff would mean a machine that
      // has been up for a day takes minutes to notice, which is the opposite
      // of what a person starting kolu expects.
      Schedule.spaced(REDIAL),
    )
  }) as Effect.Effect<never>

/**
 * Does this error mean "that padi and this build cannot speak to each other"?
 *
 * KOLU'S OWN PREDICATE, not a hand-read of the brand field. `isContractSkewError`
 * is exported for exactly this question, and it is brand-checked rather than
 * `instanceof` so it narrows across module-instance boundaries — which is what
 * a hydrated copy of the supervisor is.
 *
 * This module read the field itself for one commit, and that was a second
 * spelling of a check kolu already ships: it tested `isContractSkew` alone,
 * where the real predicate also requires `subject`, `daemonVersion` and
 * `requiredVersion` — so a half-built object would have been called a skew and
 * reported to a reader as "upgrade one of these".
 */
const skewOf = (err: unknown): DaemonContractSkewError | null =>
  isContractSkewError(err) ? err : null

/**
 * ONE dial, held open until it drops.
 *
 * Three outcomes and each is a `link` call: connected (and then held), skewed,
 * or absent. Nothing here fails — the caller repeats it on a timer, and an
 * effect that failed would end that repeat on the ordinary case of a laptop
 * with no kolu on it.
 *
 * The HOLD is the interesting part. Two things can end a healthy connection:
 * the socket closing (padi exited, someone restarted kolu) and the mirror's own
 * `done` rejecting (a member's subscription died and the framework unwound the
 * rest). Both have to wake this effect, or a dead link would sit there with the
 * dots frozen at their last good value — which is the mute-freeze failure the
 * framework's own `onFault` note describes, seen from the consumer's side. So
 * the two are raced onto one promise and whichever arrives first tears the
 * other down.
 */
const dialOnce = (
  sink: Sink,
  socket: string,
  told: boolean,
  now: () => string,
  dial: Dial,
): Effect.Effect<void> =>
  Effect.gen(function*() {
    sink.dialed()
    const connection = yield* dial(socket)
    sink.link({
      status: "connected",
      socket,
      told,
      stateRoot: connection.identity.stateRoot,
      surfaceVersion: connection.identity.surfaceVersion,
      speaks: SPEAKS,
      since: now(),
    })
    sink.reader(connection.client.padi.surface.screen.text)
    sink.attacher(connection.client.padi.surface.terminalAttach.get)
    sink.say(`olai: padi connected at ${socket}`)

    const abort = new AbortController()
    const mirrored = mirrorRemoteSurface(
      padiSurface,
      connection.client.padi,
      {
        cells: {
          // The partition goes to the sink RAW, for the record's own reason:
          // what these four lists MEAN is `@kolu/padi-client/attention`'s to
          // say, and a translation here would be a second one.
          urgency: (value) => sink.urgency(value as PadiUrgency),
        },
        streams: {
          // EVERY FRAME IS THE WHOLE SET, not a delta — padi's own contract for
          // this member — so the sink replaces rather than merges. `{}` is the
          // stream's argument: it takes none.
          activity: {
            input: {},
            onFrame: (ids) => sink.live(ids as ReadonlyArray<string>),
          },
        },
        collections: {
          terminals: {
            // The record goes to the sink RAW. Projecting it into olai's shape
            // needs the vault reading (who owns this terminal), which this
            // module has no business holding — see `./fleet.ts`.
            upsert: (id, record) => sink.upsert(id as string, record as PadiTerminal),
            remove: (id) => sink.remove(id as string),
          },
        },
      },
      {
        signal: abort.signal,
        log: sink.say,
        // A dead subscription is not chatter and must not share chatter's
        // level — the framework says so, having been burned by a mirror that
        // froze silently. Here it also ends the hold, through `done`.
        onFault: (fault) =>
          sink.say(`olai: padi mirror fault on ${fault.label}: ${String(fault.err)}`),
      },
    )

    yield* Effect.callback<void>((resume) => {
      let settled = false
      const done = (why: string): void => {
        if (settled) return
        settled = true
        sink.say(`olai: padi link ended (${why})`)
        resume(Effect.void)
      }
      connection.onClose(() => done("socket closed"))
      mirrored.done.then(
        () => done("mirror finished"),
        (err: unknown) => done(`mirror failed: ${String(err)}`),
      )
      // The interrupt path: the runtime's scope closing while the link is
      // healthy. Tearing the mirror down here as well as in the finalizer
      // below is not a duplicate — this is the one that runs when the FIBER is
      // interrupted rather than when the scope unwinds.
      return Effect.sync(() => abort.abort())
    })

    // Whichever way the hold ended, the fleet is no longer a reading of
    // anything. Said before the link state moves, so a reader never sees
    // `absent` beside rows it would still draw dots for.
    sink.reader(null)
    sink.attacher(null)
    sink.cleared()
    sink.link(absent(socket, told, now()))
  }).pipe(
    // The dial's own resources — the socket and the link's protocol fibers —
    // are the framework's to release, and `Effect.scoped` is what releases them
    // at the end of each attempt rather than at the end of the process. Without
    // it, a machine that has been retrying for an hour has seven hundred dead
    // links held on the runtime's scope.
    Effect.scoped,
    // EVERY WAY A DIAL CAN END, and `catchCause` rather than `catch` is the
    // load-bearing word.
    //
    // `connectPadi`'s compatibility gate THROWS (`assertPadiSurfaceCompatible`
    // is a plain `throw` inside an `Effect.suspend`), so a padi one major ahead
    // arrives as a DEFECT and not as a typed failure. Caught only on the error
    // channel, that defect escaped this handler, killed the connector's fiber
    // and faulted the whole surface runtime — a skewed kolu took olai's server
    // down, on a machine where every page would otherwise have opened fine.
    // That is the exact opposite of what the three-arm cell is for, and it is
    // the reason this reads the CAUSE: everything a dial can do to us is news
    // for a reader, and nothing it can do may be fatal.
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        // The failure or the defect, whichever this was — `Cause.squash` is
        // how this repo already reads one (`@olai/log`'s `cause.ts`).
        const err: unknown = Cause.squash(cause)
        sink.reader(null)
        sink.cleared()
        const skew = skewOf(err)
        if (skew !== null) {
          sink.link({
            status: "skew",
            socket,
            told,
            stateRoot: null,
            surfaceVersion: skew.daemonVersion,
            speaks: SPEAKS,
            since: now(),
          })
          sink.say(
            `olai: padi at ${socket} speaks ${skew.daemonVersion}, this build speaks ${SPEAKS}`,
          )
          return
        }
        sink.link(absent(socket, told, now()))
        // DEBUG-shaped, not an error: a machine with no kolu on it produces
        // this line every five seconds and it is not news. What IS news — a
        // connect, a skew, a link that dropped — is said above.
        sink.say(`olai: no padi at ${socket} (${String(err)})`)
      })
    ),
  )

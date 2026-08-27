/**
 * THE MIRROR — the link, the fleet it keeps, and the one screen read, composed.
 *
 * This is what `@olai/server` holds: one object, made once, started once on the
 * runtime's own scope. Everything padi-shaped stays inside it — the server
 * never names a `PadiTerminal`, never imports the dial, and never learns what a
 * terminal record looks like. What crosses is `@olai/surface`'s own vocabulary,
 * which is the volatility boundary this package exists to be.
 *
 * ## The state, and why there is any
 *
 * Two facts arrive on two different clocks and a fleet row is the join of them:
 * padi pushes a RECORD when a terminal moves, and the vault publishes a
 * REVISION when somebody edits an outline — and a row's `owner` is a reading of
 * the second. So the raw records are kept (a map, keyed by id) and rows are
 * rebuilt from whichever half moved:
 *
 *   - a record arrives → rebuild that row, publish it;
 *   - a revision lands → rebuild the claims, publish the rows whose owner
 *     actually changed and no others.
 *
 * The second is why `reclaim` compares before it publishes. A vault publishes a
 * revision on every keystroke that lands; a fleet of thirty rows re-upserted on
 * each one is thirty frames per keystroke to every open tab, for a fact that
 * moves when somebody writes a `terminal` property — which is approximately
 * never.
 *
 * ## The dial count is a field, and that is on purpose
 *
 * `dials()` exists for one test (`./mirror.test.ts`) and is worth the line. The
 * one-connection claim — ten tabs, one padi connection — is the whole economy
 * of rung 1, and it is the kind of claim that stays true right up until
 * somebody moves the link's start into a per-subscriber path and nothing
 * anywhere notices. A counter the test reads is how that becomes a failure
 * instead of a slow leak.
 */

import { isSnapshotFrame, snapshotGrid } from "@kolu/padi-client/attach"
import { type TerminalMetadata, tileTerminalOf } from "@kolu/padi-client/surface"
import type { TerminalGrid } from "@kolu/terminal-vocab/schema"
import type { FleetOwner, FleetTerminal, KoluLink, Snapshot, TerminalFrame } from "@olai/surface"
import { KOLU_UNDIALED, resolveTerminal, SnapshotRefused, UNOWNED } from "@olai/surface"
import { Effect, Queue, Stream } from "effect"

import {
  EMPTY_FRAME,
  emptyByClass,
  frameByClass,
  frameClassOf,
  type HostAttentionFrame,
  type TerminalAttention,
} from "@kolu/padi-client/attention"

import { type Claimant, claimsIn, rowOf } from "./fleet.ts"
import { type Dial, type PadiAttachFrame, runLink, type Sink } from "./link.ts"
import { screenText } from "./screen.ts"

export interface MirrorSink {
  /** The link's state moved — wired to the `kolu` cell. */
  readonly link: (state: KoluLink) => void
  /** A row arrived or changed — wired to the `fleet` collection. */
  readonly upsert: (id: string, row: FleetTerminal) => void
  /** A row left — wired to the same collection's `remove`. */
  readonly remove: (id: string) => void
  /** Routine narration, wired to the server's log. */
  readonly say: (line: string) => void
}

export interface Mirror {
  /** THE STANDING LINK. Forked once, on the runtime's scope, by the `kolu`
   *  cell's connector — never per subscriber. It never ends and never fails;
   *  closing the scope is what stops it. */
  readonly run: Effect.Effect<never>
  /** A vault revision landed: here is every node it holds. Recomputes the
   *  ownership overlay and publishes only the rows it actually moved. */
  readonly reclaim: (nodes: Iterable<Claimant>) => void
  /** Every row as it stands — what a fresh subscription is snapshotted from.
   *  The live map, handed over as it is: the collection's `readAll` is this
   *  projection rather than a copy of it, exactly as the two directory
   *  collections' are, so a late subscriber's snapshot and the deltas an open
   *
   *  TYPED MUTABLE, and handed over as it is, for that same reason: the
   *  framework's `readAll` takes the map it will snapshot from, and a copy
   *  would be a second value free to drift from the one the deltas move. The
   *  contract is the projection's, not the type's — nothing downstream writes
   *  it, exactly as nothing downstream writes the outlines' entries. */
  readonly rows: () => Map<string, FleetTerminal>
  /** One screen read, or the refusal that says why not. */
  readonly screen: (
    terminal: string,
    lines: number | undefined,
    now: () => string,
  ) => Effect.Effect<Snapshot, SnapshotRefused>
  /**
   * ONE OPEN PANE'S TERMINAL, live — a stream that ends when the subscriber
   * drops it, and never when padi is merely quiet.
   *
   * The frames are olai's ({@link TerminalFrame}), projected at this seam the
   * way records are. A terminal this mirror cannot resolve produces a stream
   * that FAILS with the same refusal `screen` gives, because a pane that
   * opened on a value naming three terminals wants the same sentence whichever
   * rung it is on.
   */
  readonly attach: (
    terminal: string,
    grid: { readonly cols: number; readonly rows: number } | undefined,
  ) => Stream.Stream<TerminalFrame>
  /** How many times the dial has been run. The one-connection claim's witness
   *  — see the header. */
  readonly dials: () => number
}

export interface MirrorOptions {
  readonly env: Record<string, string | undefined>
  readonly now: () => string
  /** The dial, injectable so a test can stand a fake padi up without a daemon
   *  — and so the COUNT is observable. Defaults to `connectPadi`. */
  readonly dial?: Dial
}

export const makeMirror = (sink: MirrorSink, options: MirrorOptions): Mirror => {
  /** padi's records, raw, exactly as the mirror delivers them. Kept because a
   *  row is a join and the vault half moves on its own clock. */
  const records = new Map<string, TerminalMetadata>()
  /** The rows, as published. The collection reads this map directly. */
  const rows = new Map<string, FleetTerminal>()
  /** Who claims what — keyed by the RESOLVED full id, rebuilt whenever either
   *  side of the resolution moves. Empty until a revision lands. */
  let claims: ReadonlyMap<string, FleetOwner> = new Map()
  /** The last revision's claims, unresolved. Kept because the resolution
   *  depends on the fleet's ID SET as well: a prefix that was ambiguous while
   *  three terminals were open resolves the moment two of them close, and the
   *  claim itself never changed. */
  let claimants: ReadonlyArray<Claimant> = []
  /** The live padi face, or `null` — what makes `screen` a read or a refusal. */
  let reader: Parameters<typeof screenText>[0] = null
  /** The live-attach face, or `null` — what makes a pane a window or a
   *  refusal. Pushed on the same edges the reader is, because a subscription
   *  is only meaningful while there is a link under it. */
  let attacher: Parameters<Sink["attacher"]>[0] = null
  /**
   * WHO IS WATCHING A TERMINAL'S GRID — the foreign-resize channel, and the
   * whole of finding 8's answer on this side.
   *
   * Attaching is a WRITE on a shared pty and the policy is last-attach-wins, so
   * a second viewer's terminal is reflowed under it with no event in the byte
   * stream: a snapshot rides the initial attach and an overflow re-attach,
   * never a foreign resize, so the loser goes on receiving deltas laid out for
   * a grid no frame ever named. Its screen garbles and nothing tells it to
   * re-attach.
   *
   * kolu's amendment puts the pty's CURRENT grid on the terminals RECORD rather
   * than on a frame, "because that is the channel a mirror already watches" —
   * this one. So the collection's own reactivity is the detector: a record
   * arrives with a different grid, and every open attach on that terminal is
   * re-opened.
   */
  const watchers = new Map<string, Set<(now: TerminalGrid | undefined) => void>>()

  /**
   * WATCH ONE TERMINAL'S PTY GRID for a move somebody ELSE made.
   *
   * `asked` is the grid this watcher's own attach requested, and it is what
   * makes the detector honest rather than merely reactive. The first shape
   * compared record-before against record-after, which fires on the WATCHER'S
   * OWN attach: a pane opening at 100x30 over an 80x24 pty moves the record
   * itself, and the pane then re-attached in answer to its own write. kolu
   * states the property this restores — "Your OWN resize is not this case and
   * needs no special-casing ... the two agree and nothing fires."
   *
   * So the question is not "did the record change" but "is the pty at a size
   * this pane did not ask for". A pane that asked for nothing (`asked`
   * undefined) is watching a terminal it never sized, and any grid the record
   * names is news to it.
   */
  const watchGrid = (
    id: string,
    asked: TerminalGrid | undefined,
    onMoved: () => void,
  ): (() => void) => {
    const fire = (now: TerminalGrid | undefined): void => {
      if (now === undefined) return
      if (asked !== undefined && asked.cols === now.cols && asked.rows === now.rows) return
      onMoved()
    }
    const set = watchers.get(id) ?? new Set()
    set.add(fire)
    watchers.set(id, set)
    return () => {
      set.delete(fire)
      if (set.size === 0) watchers.delete(id)
    }
  }
  /** The pty's grid as the RECORD carries it — `optionalKey` on the snapshot
   *  half (kolu 5.6), so a padi predating it simply omits the key and every
   *  reader here behaves as it did before the field existed. Read through the
   *  arms rather than off the union, because an optional key is absent from the
   *  union's own shape. */
  const gridOf = (record: TerminalMetadata): TerminalGrid | undefined =>
    "grid" in record ? record.grid : undefined

  /** The pty grid this mirror currently holds for one terminal, or `undefined`
   *  where it holds no record for it — the fallback a snapshot that names no
   *  grid is read against. */
  const recordGrid = (id: string): TerminalGrid | undefined => {
    const record = records.get(id)
    return record === undefined ? undefined : gridOf(record)
  }

  /** Did the pty's grid MOVE? Absent on either side is a padi too old to say,
   *  and that is not a change — a consumer that never sees one behaves exactly
   *  as it did before the field existed. */
  const gridMoved = (
    before: TerminalGrid | undefined,
    after: TerminalGrid | undefined,
  ): boolean =>
    before !== undefined && after !== undefined
    && (before.cols !== after.cols || before.rows !== after.rows)


  let dials = 0
  /**
   * PADI'S ATTENTION PARTITION, as this mirror holds it — the two feeds joined
   * into the one frame every reader of them speaks
   * (`@kolu/padi-client/attention`).
   *
   * Held rather than folded into the records, because it moves on its own
   * clock and on two of them: the class list changes when an agent transitions,
   * the live set changes on kaval's byte edge about once a second. A row is the
   * JOIN of a record, an owner and this — three clocks, one publish, which is
   * the same arrangement the ownership overlay already has.
   */
  let frame: HostAttentionFrame = EMPTY_FRAME

  /**
   * One terminal's attention, which is what `bindStatePip` is painted from.
   *
   * `includes` per row per frame rather than an index: both lists are the size
   * of a FLEET — tens, and the id lists are only the terminals that are in some
   * class at all — so the index would be a map rebuilt per frame to save a walk
   * measured in nanoseconds. If a host ever holds thousands of terminals this
   * is the line to change, and it is one line.
   */
  const attentionOf = (id: string): TerminalAttention => ({
    klass: frameClassOf(frame, id as never),
    live: frame.liveIds.includes(id as never),
  })

  /**
   * A FEED MOVED: publish the rows whose ATTENTION actually moved, and no more.
   *
   * The naive answer is to republish every row on every frame, and it is wrong
   * by a factor of the fleet: the live set pulses about once a second on a busy
   * machine, and a fleet of thirty would be thirty collection deltas a second
   * to every open tab for a fact that changed on one of them. So the frame is
   * swapped, then the rows are compared against what they were painted from —
   * the same before/after discipline `rejoin` uses, for the same reason.
   */
  const refeed = (next: HostAttentionFrame): void => {
    const before = frame
    frame = next
    for (const id of rows.keys()) {
      const was = { klass: frameClassOf(before, id as never), live: before.liveIds.includes(id as never) }
      const now = attentionOf(id)
      if (was.klass !== now.klass || was.live !== now.live) republish(id)
    }
  }


  /** Rebuild one row and publish it. Called from both clocks. */
  const republish = (id: string): void => {
    const record = records.get(id)
    if (record === undefined) return
    const row = rowOf(id, record, claims.get(id) ?? UNOWNED, attentionOf(id))
    rows.set(id, row)
    sink.upsert(id, row)
  }


  /**
   * RE-RESOLVE THE OVERLAY and publish the rows whose owner actually moved.
   *
   * Called from BOTH clocks, because the join has two sides: a revision brings
   * new claims, and a terminal opening or closing changes what a prefix
   * resolves to. The second is the one a per-revision rebuild would miss — a
   * value that named three terminals becomes an address the moment two of them
   * close, and nothing about the vault changed.
   *
   * It compares before publishing, which is what keeps it cheap enough to run
   * on both: a fleet of thirty rows against four hundred claims is a walk
   * measured in microseconds, and it publishes only the rows that moved. A
   * vault publishes a revision on every keystroke that lands.
   */
  const rejoin = (): void => {
    const next = claimsIn(claimants, records.keys())
    const moved: string[] = []
    for (const id of rows.keys()) {
      const before = claims.get(id)
      const after = next.get(id)
      if (before?.kind !== after?.kind) {
        moved.push(id)
        continue
      }
      if (before?.kind === "node" && after?.kind === "node" && before.id !== after.id) {
        moved.push(id)
      }
    }
    claims = next
    for (const id of moved) republish(id)
  }

  const linkSink: Sink = {
    link: sink.link,
    say: sink.say,
    attacher: (face) => {
      attacher = face
    },
    reader: (face) => {
      reader = face
    },
    dialed: () => {
      dials += 1
    },
    upsert: (id, record) => {
      // A PARKED RECORD IS NOT A ROW. padi's parked arm is a terminal that is
      // GONE with its record persisted — "not a tile, a row on a restore card"
      // in padi's own words — so it has no live arm, no `sleptAt`, and no
      // answer from any fold the row draws. `tileTerminalOf` is padi's own
      // narrowing of its own union (kolu#2217, this consumer's finding 1), and
      // it is asked HERE rather than in `./fleet.ts` so that a row is a total
      // function of a tile rather than a partial one over the whole union.
      //
      // Dropping it is the honest publish: the chip's reading already has the
      // right sentence for a terminal the fleet does not hold — closed or
      // retired — and a parked record is exactly that. Drawing a live row for
      // one would be a lit dot beside a terminal nobody can attach to.
      const tile = tileTerminalOf(record)
      if (tile === undefined) {
        if (!records.delete(id)) return
        rows.delete(id)
        sink.remove(id)
        rejoin()
        return
      }
      // A NEW KEY changes what every prefix resolves to, so the overlay is
      // re-joined; an UPDATE to a record already held cannot, so it is not.
      // That distinction is the whole reason this is not simply `rejoin()` on
      // every frame: padi pushes a record whenever anything about a terminal
      // moves, and the id set moves when a terminal opens or closes.
      const born = !records.has(id)
      const before = records.get(id)
      const gridBefore = before === undefined ? undefined : gridOf(before)
      records.set(id, tile)
      if (born) rejoin()
      republish(id)
      // A FOREIGN RESIZE REACHES ITS VIEWERS HERE. The record is the channel
      // kolu chose for it (see `watchers` above), and this is the one line that
      // reads it: every open attach on this terminal re-opens, and the fresh
      // snapshot carries its own grid to size against.
      // Every watcher is handed the pty's CURRENT grid and decides for itself
      // whether that is news: the one that asked for this size is looking at its
      // own write, and the ones that did not are the viewers 2c is about.
      if (gridMoved(gridBefore, gridOf(tile))) {
        for (const moved of watchers.get(id) ?? []) moved(gridOf(tile))
      }
    },
    remove: (id) => {
      records.delete(id)
      rows.delete(id)
      sink.remove(id)
      // ...and the id set just shrank, which can turn an ambiguous prefix into
      // an address.
      rejoin()
    },
    urgency: (value) => {
      // The class lists moved; the live set did not. Carried over rather than
      // re-read, which is the whole reason the two feeds are held apart.
      refeed({ byClass: frameByClass(value), liveIds: frame.liveIds })
    },
    live: (ids) => {
      // ...and the mirror image: bytes moved, the partition did not.
      refeed({ byClass: frame.byClass, liveIds: [...ids] as never })
    },
    cleared: () => {
      // EVERY row goes, one remove each, because that is what the collection's
      // wire can say. It is not the same event as thirty terminals closing and
      // a reader should not have to tell them apart from the frames — which is
      // why the `kolu` cell moves to `absent` in the same breath, and why a
      // chip reads THAT for its hollow rather than reading an empty fleet.
      for (const id of [...rows.keys()]) {
        rows.delete(id)
        sink.remove(id)
      }
      records.clear()
      reader = null
      attacher = null
      // THE PARTITION GOES WITH THEM, and it has to be said rather than left:
      // a frame is a fact about a padi, and the padi is gone. Keeping the last
      // one would mean the next connect painted its first rows from a partition
      // computed by a host that is no longer there — one frame of a fleet
      // wearing the previous session's attention. `emptyByClass` mints fresh
      // lists rather than sharing a constant's, for the reason it exists.
      frame = { byClass: emptyByClass(), liveIds: [] }
    },
  }

  return {
    run: runLink(linkSink, options.env, options.now, options.dial),
    reclaim: (nodes) => {
      claimants = [...nodes]
      rejoin()
    },
    rows: () => rows,
    /**
     * RESOLVED BEFORE IT REACHES PADI, which is the second half of the
     * production defect.
     *
     * The chip sends what the property holds, and the property holds an
     * eight-character prefix. padi's `screen.text` declares its id a UUID, so
     * the prefix failed at ENCODE — a schema refusal that never became a
     * declared failure, went down the wire as a defect, and took the page with
     * it. Resolving here means the wire only ever sees a whole id.
     *
     * The two other answers are refusals in words, for the reason every
     * refusal in this package is: a reader can act on a sentence.
     */
    screen: (terminal, lines, now) => {
      // THE LINK IS ASKED FIRST, which is the same order the chip's own
      // reading uses and for the same reason: an empty fleet is what a healthy
      // kolu with nothing open also has, so resolving first would answer "no
      // such terminal" for every click on a laptop that is not running kolu.
      // `screenText`'s own no-padi arm is the one spelling of that sentence.
      if (reader === null) return screenText(null, terminal, lines, now)
      const found = resolveTerminal(terminal, records.keys())
      if (found.kind === "many") {
        return Effect.fail(
          new SnapshotRefused({
            reason: "ambiguous",
            says:
              `this names ${found.count} terminals — write more of the id to say which one to read.`,
          }),
        )
      }
      if (found.kind === "none") {
        return Effect.fail(
          new SnapshotRefused({
            reason: "no-terminal",
            says:
              "padi has no terminal by that name — it has been closed, or the property names something else.",
          }),
        )
      }
      return screenText(reader, found.id, lines, now)
    },
    /**
     * THE LIVE ATTACH — the same three refusals as `screen`, then padi's own
     * stream projected frame by frame.
     *
     * The refusals are a FAILING STREAM rather than an empty one, which is the
     * distinction a pane draws on: a stream that ended is a terminal that
     * closed, and a stream that failed is a sentence to put on screen. An empty
     * one would be a window on a terminal that is simply quiet — the same
     * confusion the hollow dot was retired for, one rung up.
     */
    attach: (terminal, grid) => {
      if (attacher === null) {
        return refused("olai is not connected to a padi, so there is no terminal to watch.")
      }
      const found = resolveTerminal(terminal, records.keys())
      if (found.kind === "many") {
        return refused(
          `this names ${found.count} terminals — write more of the id to say which one to watch.`,
        )
      }
      if (found.kind === "none") {
        return refused(
          "padi has no terminal by that name — it has been closed, or the property names something else.",
        )
      }
      // RESOLVED BEFORE IT REACHES PADI, for the reason `screen` is: the
      // property holds a prefix and padi's input schema declares a uuid, so an
      // unresolved value fails at ENCODE — a defect rather than a refusal.
      // THE GRID RIDES THE REQUEST. An attach that carries one resizes the pty
      // before serializing — last-attach-wins on a shared terminal, and that IS
      // what attaching means here: every client sees the same size, which is
      // what makes this a window on the terminal rather than a picture of it.
      // SUSPENDED, so a stub that throws SYNCHRONOUSLY becomes a stream failure
      // this can catch rather than an exception thrown out of `attach` itself.
      // padi's client validates its input when it is CALLED, so an id or a grid
      // it refuses escaped past the `catchCause` below — and the pane, which
      // has no arm for an exception coming out of a constructor, sat open and
      // empty. The e2e found it on the refusal scenario.
      const face = attacher
      const id = found.id
      /**
       * ONE ATTACH PER EPOCH, and an epoch is a foreign resize.
       *
       * Epoch zero is the pane opening, and it carries the grid the pane asked
       * for — attaching is a write, and the ruled semantic is that every client
       * sees the same size. Every epoch after it is somebody ELSE having won
       * last-attach-wins, and carries NO grid: re-asserting ours would be a
       * resize war between two viewers of one terminal, each answering the
       * other. The loser adopts, and the fresh snapshot names the size it
       * adopted (contract 5.5).
       *
       * `switchMap` is the whole of the re-attach: a new epoch interrupts the
       * subscription the old one opened. There is no teardown to write and none
       * to forget.
       */
      const epochs = Stream.concat(
        Stream.make(0),
        Stream.callback<number>((queue) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              let epoch = 0
              const moved = (): void => {
                epoch += 1
                Queue.offerUnsafe(queue, epoch)
              }
              return watchGrid(id, grid, moved)
            }),
            (unwatch) => Effect.sync(unwatch),
          )
        ),
      )
      return Stream.switchMap(epochs, (epoch) =>
        Stream.map(
          face(epoch === 0 && grid !== undefined ? { id, resizeTo: grid } : { id }),
          // THE RECORD'S GRID IS THE FALLBACK, read at frame time rather than
          // captured: after a foreign resize the fresh snapshot is the pane's
          // only chance to learn its new size, and two reachable padis send a
          // snapshot that names none (a kaval predating 5.5, and an
          // abort-before-snapshot open). Detecting the move and then handing
          // the pane nothing to adopt is a correct detector with no recovery
          // behind it — the pane paints 80-column bytes at 100 columns and
          // nothing fires again.
          (frame) => frameOf(frame, recordGrid(id)),
        )
      ).pipe(
        // A DROPPED LINK IS NOT A PANE'S FAULT AND NOT ITS PROBLEM TO NAME.
        // padi's stream dies when the socket does; what a reader wants then is
        // the sentence, not a stack. The link's own re-dial is what brings it
        // back, and a re-attach begins with a fresh `snapshot` frame — which is
        // why a recovering pane needs nothing of its own.
        Stream.catchCause(() =>
          refused(
            "olai lost the window on this terminal — it may have closed, or the link dropped.",
          )
        ),
      )
    },
    dials: () => dials,
  }
}

/** The link state a runtime publishes before anything has been dialed — see
 *  `@olai/surface`'s `KOLU_UNDIALED`, which argues why it is spelled `absent`
 *  rather than given a fourth arm. Re-exported so the server's seed and this
 *  package's own default are one value. */
export const UNDIALED: KoluLink = KOLU_UNDIALED

/**
 * PADI'S FRAME → OLAI'S — the projection, and it is deliberately three fields.
 *
 * THE TWO PREDICATES ARE KOLU'S, imported rather than restated. They were
 * open-coded here, and the reason was one type: this module read a hand-written
 * copy of padi's frame union, and kolu's helpers are typed on padi's own. With
 * the copy gone (`./link.ts`) the helpers apply, and the rules are now held by
 * an import edge instead of by a comment that agrees with a fold.
 *
 * `isSnapshotFrame` also does the arm test, which is the fence this projection
 * did not have: it WAS a bare ternary, so a third arm added upstream would have
 * projected as a delta — bytes written to a terminal that never asked for them.
 * Now an arm kolu adds is not a snapshot, is not silently a delta, and the
 * compiler has padi's real union to check the claim against.
 *
 * padi's snapshot arm also carries a reflow epoch for a scrollback-backfill
 * cursor olai does not keep: this pane is a window on the live screen, not a
 * scrollback reader, and a field nothing draws does not cross (`./fleet.ts`'s
 * law, one member over).
 */
export const frameOf = (
  frame: PadiAttachFrame,
  /** The pty's grid as the terminal's RECORD carries it, where the frame does
   *  not name one. Kolu's two channels for the same fact are independently
   *  optional (`attach.ts`'s 5.5 field, `servePadi`'s 5.6 record), so a pane
   *  that reads only the frame can detect a foreign resize and still have
   *  nothing to size against. */
  ptyGrid?: TerminalGrid,
): TerminalFrame =>
  isSnapshotFrame(frame)
    ? {
      kind: "snapshot",
      data: frame.data,
      topLine: frame.topLine,
      // ABSENT BECOMES `null` HERE, which is the projection's job: padi says
      // nothing when it is too old to know, and olai's wire has one spelling
      // for "no grid" so no reader asks the question twice.
      grid: snapshotGrid(frame) ?? ptyGrid ?? null,
    }
    : { kind: "delta", data: frame.data }

/** A window that cannot open, as ONE frame and then the end.
 *
 *  `Stream.make` rather than a failing stream, because the member has no error
 *  channel and that is the right shape: these three sentences are things a
 *  reader ACTS on, so they are content. The stream ends after it, which is
 *  honest — there is nothing more coming — and a pane that has drawn a refusal
 *  is not waiting for anything. */
const refused = (says: string): Stream.Stream<TerminalFrame> =>
  Stream.make({ kind: "refused", says } as TerminalFrame)

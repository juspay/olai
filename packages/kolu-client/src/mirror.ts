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

import type { PadiTerminal } from "@kolu/padi-client/surface"
import type { FleetOwner, FleetTerminal, KoluLink, Snapshot } from "@olai/surface"
import { KOLU_UNDIALED, resolveTerminal, SnapshotRefused, UNOWNED } from "@olai/surface"
import { Effect } from "effect"

import {
  EMPTY_FRAME,
  emptyByClass,
  frameByClass,
  frameClassOf,
  type HostAttentionFrame,
  type TerminalAttention,
} from "@kolu/padi-client/attention"

import { type Claimant, claimsIn, rowOf } from "./fleet.ts"
import { type Dial, runLink, type Sink } from "./link.ts"
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
  const records = new Map<string, PadiTerminal>()
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
    reader: (face) => {
      reader = face
    },
    dialed: () => {
      dials += 1
    },
    upsert: (id, record) => {
      // A NEW KEY changes what every prefix resolves to, so the overlay is
      // re-joined; an UPDATE to a record already held cannot, so it is not.
      // That distinction is the whole reason this is not simply `rejoin()` on
      // every frame: padi pushes a record whenever anything about a terminal
      // moves, and the id set moves when a terminal opens or closes.
      const born = !records.has(id)
      records.set(id, record)
      if (born) rejoin()
      republish(id)
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
    dials: () => dials,
  }
}

/** The link state a runtime publishes before anything has been dialed — see
 *  `@olai/surface`'s `KOLU_UNDIALED`, which argues why it is spelled `absent`
 *  rather than given a fourth arm. Re-exported so the server's seed and this
 *  package's own default are one value. */
export const UNDIALED: KoluLink = KOLU_UNDIALED

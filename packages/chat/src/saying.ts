/**
 * The CADENCE a growing row reaches the wire at — the other half of
 * {@link ./transcript.ts}'s appends, and the second half of the fix for
 * `transcript-stream-quadratic`.
 *
 * The transcript says WHAT changed: this text belongs at that offset of that
 * row ({@link Change.appends}). It says nothing about frames, keys or clocks,
 * because none of those is a fact about a conversation. This module is where
 * all three are decided, and it decides them once:
 *
 *   - A PIECE IS FILED under the row it names and the offset it starts at
 *     (`@olai/surface`'s `sayingKey`), so a piece's key is a function of the
 *     piece and two of them can never collide. That is not a nicety: the
 *     framework's own per-tick coalescer is LAST-OP-WINS PER KEY, so two
 *     pieces sharing a key inside one tick would be one piece and a hole in
 *     somebody's paragraph.
 *
 *   - PIECES OF ONE ROW ARE MERGED while they wait, because they are
 *     contiguous by construction: a piece that starts exactly where the held
 *     one ends is the held one, longer. What leaves is therefore one piece per
 *     window rather than one per token — which is the whole of the frame
 *     saving, and why the wire's overhead per piece stops mattering.
 *
 *   - A WINDOW is `SAYING_MS` long and TRAILING: the first chunk of a
 *     paragraph arms the clock, everything inside the window joins it, and the
 *     frame goes at the end. It bounds latency and never content.
 *
 *   - A ROW SUPERSEDES ITS OWN PIECES. Every upsert the transcript publishes
 *     carries the row's text WHOLE — the transcript keeps the true text, and
 *     the pieces are an acceleration of it — so a change that names a row is
 *     the last word about it: what was waiting for that row is dropped
 *     unsent, and what is already out is removed in the same frame. That is
 *     what makes the end of a paragraph, a cancel and a new conversation all
 *     one rule instead of three.
 *
 * WHY THE ROWS COME OUT OF HERE TOO, rather than going straight past it. A
 * frame carries both halves so that the ONE ordering that matters is decided
 * where both are in hand: a row's whole upsert must reach a reader before the
 * removal of the pieces it supersedes. Either order converges — the join is
 * idempotent (`@olai/surface`'s `Saying`) — but only one of them never shows
 * a paragraph briefly getting SHORTER, and a reader is watching that
 * paragraph.
 *
 * It holds no reference to a transcript, an agent or a socket: a change goes
 * in, frames come out, and the clock is a parameter. That is what lets its
 * whole subject — what is coalesced with what, and what supersedes what — be
 * asserted without a server.
 */

import { SAYING_MS, sayingKey } from "@olai/surface"

import type { Saying } from "@olai/surface"

import type { Change } from "./transcript.ts"

/** The pieces half of a frame: what to write into the `saying` collection and
 *  what to take out of it. Keyed here, because keys are this module's. */
export interface Pieces {
  readonly upserts: ReadonlyArray<readonly [string, Saying]>
  readonly removes: ReadonlyArray<string>
}

/** One publication: the rows exactly as the transcript said them, and the
 *  pieces this module decided go with them. Rows first — see the header. */
export interface Frame {
  readonly rows: Change
  readonly pieces: Pieces
}

const NOTHING: Pieces = { upserts: [], removes: [] }

/** A change with no rows in it — what a window's own frame carries. */
const NO_ROWS: Change = { upserts: [], removes: [], appends: [] }

/**
 * How a window is waited out.
 *
 * HANDED IN, with the real clock as the default, for {@link Transcript}'s own
 * reason: this module is a data structure with no server under it, and a
 * window read off `setTimeout` directly would be the one thing here that could
 * only be asserted by waiting for it. A test hands in a hand-turned one and
 * the whole subject becomes synchronous.
 *
 * It answers with how to CANCEL — the shape both `setTimeout` and any test
 * scheduler can honestly offer, and the one this module needs when a row is
 * superseded with a window still open.
 */
export type After = (millis: number, run: () => void) => () => void

const afterReally: After = (millis, run) => {
  const timer = setTimeout(run, millis)
  // A window is a tenth of a second and always fires, so this is not about
  // shutdown taking longer. It is about a pending window never being the
  // reason a process that has nothing else to do stays up — which is what an
  // olai spawned to answer one question would otherwise wait out.
  ;(timer as { unref?: () => void }).unref?.()
  return () => clearTimeout(timer)
}

export interface Cadence {
  /** One change from the transcript, turned into frames — none, one, or (when
   *  a held piece is displaced) one carrying both. */
  readonly publish: (change: Change) => void
  /** Every piece currently ON the wire, by key — what a new subscriber's
   *  snapshot of the `saying` collection is. Never what is still waiting: a
   *  reader is handed what was published, and the row it belongs to carries
   *  the rest already. */
  readonly onWire: () => ReadonlyMap<string, Saying>
  /** Drop a window that is still open. For a server shutting down: nothing is
   *  published afterwards, and the piece that was waiting is text the row
   *  itself already has. */
  readonly stop: () => void
}

export const cadence = (options: {
  readonly onFrame: (frame: Frame) => void
  /** The window, in milliseconds. The surface's own number by default, which
   *  is also the cadence the panel re-renders at — one clock, two ends. */
  readonly window?: number
  readonly after?: After
}): Cadence => {
  const window = options.window ?? SAYING_MS
  const after = options.after ?? afterReally
  /** What is on the wire, by key — {@link Cadence.onWire}. */
  const live = new Map<string, Saying>()
  /**
   * The piece waiting for its window to close, and how to cancel that window.
   *
   * ONE SLOT holding BOTH, because they are one fact and were two: a window is
   * open exactly while something is held, and keeping the piece in one binding
   * and its timer in another is an invariant a reader has to be told about
   * instead of one the shape holds — "held with no window" is a chunk that
   * never goes out, and "a window with nothing held" is a frame that publishes
   * nothing. Neither is spellable now.
   *
   * At most ONE, because pieces of one row merge and a piece of another row
   * displaces this one: a second slot would be a second row growing, which the
   * transcript's single open entry makes unrepresentable.
   */
  let waiting: { readonly piece: Saying; readonly close: () => void } | null = null

  /** Nothing is waiting, and no window is open — however it got that way. */
  const drop = (): void => {
    waiting?.close()
    waiting = null
  }

  /** Hold a piece, opening a window if one is not already open. The DEADLINE
   *  belongs to the first piece of a run rather than to the newest, which is
   *  what bounds the wait: a row that never stops growing would otherwise
   *  never be published. */
  const hold = (piece: Saying): void => {
    waiting = {
      piece,
      close: waiting?.close ?? after(window, () => {
        const held = waiting
        waiting = null
        if (held === null) return
        options.onFrame({ rows: NO_ROWS, pieces: { upserts: [sent(held.piece)], removes: [] } })
      }),
    }
  }

  /** A piece, onto the wire: filed under its own key and remembered as live,
   *  so a later subscriber is seeded with it and the row that supersedes it
   *  knows what to take off. */
  const sent = (piece: Saying): readonly [string, Saying] => {
    const key = sayingKey(piece)
    live.set(key, piece)
    return [key, piece]
  }

  const publish = (change: Change): void => {
    // The pieces this call sends AHEAD of their window: one per row displaced
    // by a piece of another row. Ordinarily empty — one row grows at a time —
    // and collected rather than dropped, because a displaced piece is text
    // somebody is reading.
    const upserts: Array<readonly [string, Saying]> = []
    for (const piece of change.appends) {
      const held = waiting?.piece
      if (held !== undefined && held.of === piece.of && held.at + held.text.length === piece.at) {
        // CONTIGUOUS, so it is the same piece, longer. This is the coalescing:
        // six hundred chunks become a couple of dozen pieces, and the wire
        // carries the answer's own bytes plus a piece's worth of overhead per
        // window rather than per token.
        hold({ ...held, text: `${held.text}${piece.text}` })
        continue
      }
      if (held !== undefined) upserts.push(sent(held))
      hold(piece)
    }

    // WHICH ROWS THIS CHANGE SPEAKS FOR. A row on the wire is whole, so
    // anything this module is holding or has sent about it is superseded —
    // said once here, for upserts and removes together, because a row that is
    // GONE supersedes its pieces exactly as hard as one that was rewritten.
    const rows = new Set<string>([
      ...change.upserts.map(([key]) => key),
      ...change.removes,
    ])
    const removes: Array<string> = []
    if (waiting !== null && rows.has(waiting.piece.of)) drop()
    // Everything that WAS on the wire for one of those rows comes off it —
    // including a piece this very call put there a few lines up, which then
    // rides out as an upsert and a remove of one key in one frame. That is
    // correct rather than merely harmless: the consumer writes the upserts and
    // then the removes, and the framework's own tick coalescer resolves an
    // upsert-then-remove inside a tick to a bare remove. Filtering it out here
    // would be this module doing a second time what both ends already do.
    for (const [key, piece] of live) {
      if (!rows.has(piece.of)) continue
      live.delete(key)
      removes.push(key)
    }

    const moved = change.upserts.length > 0 || change.removes.length > 0
    if (!moved && upserts.length === 0 && removes.length === 0) return
    options.onFrame({
      rows: moved ? change : NO_ROWS,
      pieces: upserts.length === 0 && removes.length === 0 ? NOTHING : { upserts, removes },
    })
  }

  return { publish, onWire: () => live, stop: drop }
}

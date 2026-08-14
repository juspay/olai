/**
 * THE PAGE MOVING UNDER A GESTURE that has run out of screen.
 *
 * Two gestures in this client aim at rows (`./drag/dragging.ts` carries one to
 * a place, `./drag/sweeping.ts` sweeps a run of them) and both are over an
 * OUTLINE, which is longer than the window nearly always. Without this, the
 * reach of either is "what happens to be on screen when the press landed" — a
 * row cannot be dragged to a parent above the fold, and a sweep cannot pick
 * past the last visible line — and the way out a person tries is to keep
 * pushing at the edge. So that is what the gesture answers to.
 *
 * **The pointer is read in CLIENT coordinates and reported in DOCUMENT ones**,
 * and that split is the whole of why this is a module rather than three lines
 * in each caller. Whether the page should move is a question about the WINDOW
 * (how near the edge the pointer is), and it is asked of a pointer that may not
 * have moved at all; where the gesture is now is a question about the PAGE,
 * because both callers measured their rows once in document coordinates and
 * would otherwise be answering a scrolled question with an unscrolled point.
 * A finger or a mouse held still in the zone therefore keeps producing new
 * answers, frame by frame, with no `pointermove` behind them — which is exactly
 * the behaviour, and exactly what a caller that only re-planned on
 * `pointermove` would get wrong.
 *
 * VERTICAL ONLY. The document is what scrolls in this app (`./scroll.ts`), and
 * an outline is a column: the horizontal overflow that exists at all is
 * `main`'s, for a long title, and nudging that sideways during a drag would
 * move the rows out from under the line promising where they land.
 *
 * Nothing here is armed unless a gesture asks for it: the frame loop starts on
 * the first report inside a zone and stops the moment the pointer leaves one,
 * so a page nobody is dragging over schedules nothing.
 */

/** How deep the zone at each edge of the window is. About two rows' worth —
 *  wide enough that a hand aiming at the last visible line finds it without
 *  meaning to, narrow enough that ordinary work near the bottom of the screen
 *  is not inside it. */
const ZONE_PX = 72

/** How fast the page moves when the pointer is at the very edge, in pixels per
 *  frame — a shade over 800px a second at 60Hz, which is about a screen and a
 *  half. Frames rather than seconds because that is the clock this runs on, and
 *  converting would be a number nobody can check against what they see. */
const FASTEST_PX = 14

/**
 * How fast the page should move for a pointer this far down the window, and
 * which way: negative is up, positive is down, `0` is "not near an edge".
 *
 * The speed RAMPS with how deep into the zone the pointer is, rather than being
 * one number the moment it crosses: a constant speed makes the page bolt the
 * instant a hand strays near the edge, and the only control a person has over
 * a scroll they did not ask to start is to move away from it.
 *
 * Pure, so the two things that are easy to get subtly wrong — the sign, and
 * what happens PAST the edge (a pointer dragged off the window entirely, which
 * is a real gesture and where a naive ratio goes above 1) — are a unit test
 * rather than something to try with a mouse.
 */
export const edgeSpeed = (
  y: number,
  height: number,
  zone: number = ZONE_PX,
  fastest: number = FASTEST_PX,
): number => {
  const above = zone - y
  const below = y - (height - zone)
  if (above <= 0 && below <= 0) return 0
  // A window shorter than two zones has them overlapping, and then the pointer
  // is in both: the NEARER edge is the one it means. Clamped at the edge itself
  // so a pointer dragged off the window is at full speed rather than past it.
  const into = Math.min(1, Math.max(above, below) / zone)
  return (above > below ? -1 : 1) * fastest * into
}

/** Where a gesture is, in the coordinates its rows were measured in. */
export type Report = (x: number, y: number) => void

export interface EdgeScroll {
  /** The pointer is HERE, in client coordinates. Reports it in document ones
   *  straight away, and keeps reporting — with the page moving under it — for
   *  as long as it stays near an edge. */
  readonly at: (client: { readonly x: number; readonly y: number }) => void
  /** The gesture is over. Safe to call more than once, and on a gesture that
   *  never reached an edge. */
  readonly stop: () => void
}

/**
 * Follow a live gesture: where it is, and the page moving to keep up with it.
 *
 * One of these per gesture rather than one per page — it holds where that
 * gesture's pointer is, and two live at once would be two gestures, which is
 * not a thing either caller allows.
 */
export const edgeScrolling = (report: Report): EdgeScroll => {
  /** Where the pointer was last seen, in CLIENT coordinates — the frame loop
   *  re-reads it against a page that has moved, which is the whole trick. */
  let where: { readonly x: number; readonly y: number } | null = null
  /** The frame in flight, or `0` for "the loop is not running". `0` is never a
   *  real handle, which is what lets one field say both things. */
  let frame = 0

  const tell = (): void => {
    if (where !== null) report(where.x + window.scrollX, where.y + window.scrollY)
  }

  const step = (): void => {
    frame = 0
    if (where === null) return
    // The LAYOUT viewport's height, which is the box the pointer's client
    // coordinates are in — `innerHeight` counts a horizontal scrollbar as room
    // the pointer can be in, and it cannot.
    const speed = edgeSpeed(where.y, document.documentElement.clientHeight)
    if (speed === 0) return
    const before = window.scrollY
    // `instant` whatever the page's own scroll behaviour is: this is a gesture
    // being followed, not a place being gone to (`./scroll.ts` makes the same
    // call for the same reason).
    window.scrollBy({ top: speed, behavior: "instant" })
    // Only when the page actually MOVED. At the top or the bottom there is
    // nothing left to give, and re-reporting an unchanged point would be a
    // plan recomputed every frame for an answer that cannot have changed.
    if (window.scrollY !== before) tell()
    frame = requestAnimationFrame(step)
  }

  return {
    at: (client) => {
      where = { x: client.x, y: client.y }
      tell()
      if (frame === 0) frame = requestAnimationFrame(step)
    },
    stop: () => {
      where = null
      cancelAnimationFrame(frame)
      frame = 0
    },
  }
}

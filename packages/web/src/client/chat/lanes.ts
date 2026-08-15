/**
 * Which rows were somebody else's, and where to say so.
 *
 * A turn can spawn agents, and their tool calls come back on the same feed as
 * the main agent's — one flat column of frames, all in one voice. That is the
 * one thing the panel was saying that is not true: three agents grepping at
 * once looked exactly like one agent grepping three times, and there was
 * nothing on screen to suggest a subagent had ever been started.
 *
 * A row that names the `Agent` call it was made inside (`ChatEntry.parent`) is
 * drawn in a LANE — indented behind a rail, under the frame it belongs to.
 * Which rows those are is the transcript's answer and not this file's; what is
 * decided here is the other half, the one only the LIST can answer:
 *
 *   **when the lane has to name itself.** A rail is enough while it is
 *   obvious whose it is — the `Agent` frame is right above it, or the row
 *   above is another call by the same agent — and it stops being obvious the
 *   moment two agents are running at once, which is exactly what people spawn
 *   agents for. Their calls then interleave, and a rail with nothing written
 *   on it is a rail that says "somebody else did this" and refuses to say who.
 *
 * So the label is drawn on the row that OPENS a run and on no other: once per
 * stretch of one agent's work rather than once per call, which is what keeps a
 * subagent's ten `Read`s from being ten copies of its name down the panel.
 *
 * It is a pure function over two rows rather than a pass over the list,
 * because the list is drawn one row at a time from stable keys
 * ({@link ./state.ts}) and this may not be the thing that changes that: a row
 * that re-renders is a row whose fold, selection and scroll are still where
 * the reader left them.
 */

import type { ChatEntry } from "@olai/surface"

/** A row drawn in a lane: whose it is, and whether this is the row that has to
 *  say so. */
export interface Lane {
  /** The `Agent` frame this row belongs to, by its transcript key. */
  readonly parent: string
  /** Whether the lane OPENS here and must name itself — false while the row
   *  above already established whose lane this is. */
  readonly labelled: boolean
}

/**
 * The lane a row is drawn in, or `null` for a row the main agent is
 * responsible for — which is most of them, and every row in a conversation
 * that never spawned anything.
 *
 * THE ROWS THEMSELVES, not facts read off them. This took the row above as a
 * key and that key's parent, side by side — two arguments whose joint validity
 * nothing enforced, since the second is only true of the first. Each read
 * honest alone and the pair could lie: a caller that fetched one row's key and
 * another row's parent got a confident, wrong answer, and no type said no. One
 * row is one value, so the precondition is structural and there is no way left
 * to spell the mistake.
 *
 * @param row the row being drawn
 * @param above the row drawn directly above it, if any
 */
export const laneOf = (
  row: ChatEntry | undefined,
  above: ChatEntry | undefined,
): Lane | null => {
  const parent = row?.parent
  if (parent === undefined) return null
  // Two ways for the lane to be established already, and they are the two
  // shapes a reader actually sees: the `Agent` frame itself is the row above
  // (the ordinary case — a subagent's first call lands directly under the call
  // that spawned it), or the row above is another call by the same agent.
  return { parent, labelled: above?.id !== parent && above?.parent !== parent }
}

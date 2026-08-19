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
 * Which rows those are is the transcript's answer and not this file's, and it
 * is not only tool calls: a subagent can stop and ASK, and its form belongs in
 * its lane for the same reason its greps do. What is decided here is the other
 * half, the one only the LIST can answer:
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
 * ... AND ON EVERY QUESTION, which is the one exception and is about what a
 * row IS rather than about where it sits. A form blocks the turn and is
 * pointed at from outside the list, so a reader meets it without having read
 * the row above; and a permission form answered in the wrong agent's name is
 * the one row here where being misread changes a decision. See
 * {@link railSaysIt}.
 *
 * WHAT CHANGES BEHIND THIS, and the reason it is a module rather than an
 * expression in the row that draws it: **how much a lane has to say to be
 * read.** Every part of that has already moved once — whether a rail alone
 * carries it, where a name is owed, what the name is drawn from — and each
 * time the answer was a guess about what somebody scanning a 26rem drawer can
 * follow, which is the kind of question that is settled by looking rather than
 * by reasoning. A rule you expect to re-decide is one worth being able to
 * re-decide in one place, and to assert without a browser: the panel's own
 * precedent ({@link ./folds.ts}, {@link ./when.ts}) is that such a rule is a
 * function with unit tests rather than a branch reachable only by starting an
 * agent. What comes OUT does not move when the rule does — a lane still says
 * whose it is and still says what to write — so the row that draws one is not
 * a place any of that re-deciding lands.
 *
 * It is a pure function over two rows rather than a pass over the list,
 * because the list is drawn one row at a time from stable keys
 * ({@link ./state.ts}) and this may not be the thing that changes that: a row
 * that re-renders is a row whose fold, selection and scroll are still where
 * the reader left them.
 */

import type { ChatEntry } from "@olai/surface"

/** A row drawn in a lane: whose it is, and what the lane says here. */
export interface Lane {
  /** The `Agent` frame this row belongs to, by its transcript key. */
  readonly parent: string
  /**
   * What to write at the head of the lane, or `null` for a row where the rail
   * says it already.
   *
   * THE NAME, not a flag saying a name is owed. It was a `labelled` boolean,
   * and the text was fetched beside it by the row that drew one and thrown
   * away whenever the flag was false — one thing in two places, held together
   * by nothing but the caller remembering to ask the second question only when
   * the first said yes. Answering with the words closes that: there is one
   * value, it is either there or it is not, and no caller can compute a name
   * for a lane that did not want one.
   */
  readonly label: string | null
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
 * `nameOf` is the transcript's own lookup, handed in rather than reached for:
 * naming an agent means reading another row, and a rule that read rows would
 * stop being a function of its arguments. The panel hands its passes their
 * lookups the same way ({@link ./Entry.tsx} and `markNodeRefs`).
 *
 * @param row the row being drawn
 * @param above the row drawn directly above it, if any
 * @param nameOf what the transcript calls the row under a key, if it has one
 */
export const laneOf = (
  row: ChatEntry | undefined,
  above: ChatEntry | undefined,
  nameOf: (key: string) => string | undefined,
): Lane | null => {
  if (row === undefined) return null
  const parent = row.parent
  if (parent === undefined) return null
  // An `Agent` frame the panel was never sent still gets a lane and still gets
  // a name — the bare fact, because "a subagent did this" is the half of the
  // sentence worth saying even when the other half is missing.
  return { parent, label: railSaysIt(row, above) ? null : nameOf(parent) ?? SOMEBODY }
}

/**
 * Whether the rail alone already says whose row this is.
 *
 * OVER THE TWO ROWS, like {@link laneOf} itself and for its reason: "the lane
 * is established" is a fact about this pair and about no single value in it,
 * so taking it as a computed boolean beside the row would be a pair nothing
 * enforces — each argument honest alone, and the two able to describe
 * different places in the list.
 *
 * Two ways for the lane to be established already, and they are the two shapes
 * a reader actually sees: the `Agent` frame itself is the row above (the
 * ordinary case — a subagent's first call lands directly under the call that
 * spawned it), or the row above is another call by the same agent.
 *
 * That is the rule for WORK, and it is enough for work because a reader who
 * wants to know whose grep this was reads upwards and finds out. A QUESTION is
 * not work: it is a control, it blocks the turn, and the panel sends people to
 * it from somewhere else entirely — the composer, the header and the app's
 * agent toggle all say a question is waiting
 * ({@link ../../../../chat/README.md}) — so a reader ARRIVES at a form rather
 * than scrolling down to it, and has no row above to have read.
 *
 * So an ask names its lane wherever it is drawn. It costs one line under a
 * form that is already several, and what it buys is that a question a subagent
 * asked cannot be answered in the belief that the main agent asked it. The
 * stretch itself is unaffected — the row below the form is still one of the
 * same agent's, so the lane does not open again underneath it.
 */
const railSaysIt = (row: ChatEntry, above: ChatEntry | undefined): boolean =>
  row.kind !== "ask" &&
  (above?.id === row.parent || above?.parent === row.parent)

/** What a lane is called when the frame that spawned it is not on screen. */
const SOMEBODY = "a subagent"

/**
 * THE RAIL: the line down the left of a lane, and the inset it holds its rows
 * at.
 *
 * Here rather than in the component that draws one, because two things draw it
 * and the whole claim of the second is that it is the SAME line. A row a
 * subagent made hangs a rail off the frame above it; a spawn that has not been
 * reported on yet hangs one off itself ({@link ./spawn.ts}), directly above
 * that first row — so the two segments meet, and what makes them meet is that
 * the border weight, the colour and the inset agree. Spelled twice they agreed
 * by coincidence, and the first tweak to either would have shown a reader one
 * line drawn as two.
 */
export const RAIL = "border-l-2 border-muted/70 pl-2"

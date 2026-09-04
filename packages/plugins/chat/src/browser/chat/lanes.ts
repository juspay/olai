/**
 * Which rows are somebody else's — and, for the one kind that stays, where to
 * say so.
 *
 * A turn can spawn agents, and their tool calls come back on the same feed as
 * the main agent's — one flat column of frames, all in one voice. This file has
 * answered two versions of that problem and the second is the one it is on now.
 *
 * IT USED TO BE ABOUT INDENTING THEM. Three agents grepping at once looked
 * exactly like one agent grepping three times, so a row that named the `Agent`
 * call it was made inside was drawn in a LANE — behind a rail, under the frame
 * it belongs to — and this file decided when a lane had to write its own name
 * on itself. That was true and it was not enough: five agents out is five
 * agents' work in the column whatever it is indented behind, and the main
 * agent's own words go off the top of the screen. Being able to tell whose wall
 * of text you are drowning in is not the same as not drowning.
 *
 * SO IT IS ABOUT MEMBERSHIP NOW ({@link filedUnder}): a subagent's tool calls
 * leave the conversation entirely and are drawn where that agent is drawn
 * (`./Preview.tsx`), and the column is the main agent's. What is left of the
 * older rule is the row that is DELIBERATELY EXEMPT — a question — and the
 * older rule is exactly what that row still needs.
 *
 *   **When the lane has to name itself.** A rail is enough while it is obvious
 *   whose it is — the `Agent` frame is right above it, or the row above is
 *   another call by the same agent — and it stops being obvious the moment the
 *   rows around it are somebody else's. So the label is drawn on the row that
 *   OPENS a run and on no other: once per stretch rather than once per call.
 *
 * ... AND ON EVERY QUESTION, which is the exception that now carries the whole
 * rule. A form blocks the turn and is pointed at from outside the list, so a
 * reader meets it without having read the row above; and a permission form
 * answered in the wrong agent's name is the one row here where being misread
 * changes a decision. See {@link namesItself}.
 *
 * WHY THE TWO ARE STILL ONE FILE. They are one question asked at two moments —
 * *whose row is this* — and answering them apart is how the panel would end up
 * drawing a form in a lane it had already filed away, or filing away a row it
 * had drawn a name on. They are two FUNCTIONS because their inputs differ:
 * membership is a fact about a row alone, and a name is a fact about a row and
 * the one above it.
 *
 * WHAT CHANGES BEHIND THIS, and the reason it is a module rather than an
 * expression in the row that draws it: **how much a lane has to say to be
 * read.** Every part of that has already moved twice — whether a rail alone
 * carries it, where a name is owed, what the name is drawn from, and now
 * whether the row is in this list at all — and each time the answer was a guess
 * about what somebody scanning a 26rem drawer can follow, which is the kind of
 * question that is settled by looking rather than by reasoning. A rule you
 * expect to re-decide is one worth being able to re-decide in one place, and to
 * assert without a browser: the panel's own precedent ({@link ./folds.ts},
 * {@link ./when.ts}) is that such a rule is a function with unit tests rather
 * than a branch reachable only by starting an agent. What comes OUT does not
 * move when the rule does — a lane still says whose it is and still says what
 * to write — so the row that draws one is not a place any of that re-deciding
 * lands.
 *
 * {@link laneOf} is a pure function over two rows rather than a pass over the
 * list, because the list is drawn one row at a time from stable keys
 * ({@link ./state.ts}) and this may not be the thing that changes that: a row
 * that re-renders is a row whose fold, selection and scroll are still where the
 * reader left them. {@link filedUnder} is a pure function over ONE row for the
 * sharper version of the same reason — it is asked inside the fold that puts
 * the conversation in order ({@link ./order.ts}), on every upsert of every
 * streaming row, which is the busiest path in the panel.
 */

import type { ChatEntry } from "olai-plugin-chat/wire"
/**
 * WHOSE RECORD THIS ROW IS — the key of the `Agent` frame whose own list draws
 * it, or `null` for a row the conversation's column draws itself.
 *
 * THE MEMBERSHIP RULE, and the one this file gained when subagents left the
 * transcript. Everything else here is about how a row that is drawn in a lane
 * is LABELLED; this is the prior question of whether the column draws it at
 * all, and it is a different question with a different answer for one kind of
 * row.
 *
 * **A subagent's tool calls are its own.** Five agents out is five agents'
 * `cd … && grep …` interleaved in one column, in one voice, under a main agent
 * whose own words are pushed off the screen — which is the panel telling you
 * about work you did not ask to watch instead of the work you did. So they are
 * filed under the agent that made them and drawn where that agent is drawn.
 *
 * **A subagent's QUESTION is not.** A permission form or an elicitation is not
 * the subagent talking: it is a question TO THE READER, it blocks the turn, and
 * it hangs until somebody presses something. Filing one under an agent would
 * put it behind a click, and a form behind a click is a turn that hangs
 * forever — so an `ask` stays in the column whoever asked it, and keeps the
 * rail and the name that say which agent is asking ({@link namesItself}, which
 * exists for exactly that row and is now the only reason a lane is drawn in the
 * column at all). The losing case is not made unlikely here; it is made
 * unrepresentable, because a form was never subject to the rule.
 *
 * `undefined` for the row is answered `null` too, for {@link laneOf}'s reason:
 * the list holds keys and reads their values a frame behind, so "which row" is
 * a question that can be asked about nothing.
 *
 * WHETHER THE PANEL HAS THAT FRAME is deliberately NOT asked here. It is a fact
 * about the whole list rather than about this row, and the list is what answers
 * it ({@link ./order.ts}): a row whose `Agent` frame never arrived has no door
 * anywhere to reach it through, so it is kept in the column behind the rail it
 * has always had, named *a subagent*.
 */
export const filedUnder = (entry: ChatEntry | undefined): string | null =>
  entry?.kind === "tool" ? entry.parent ?? null : null

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
 * WHAT IT MUST ANSWER WITH is the agent's own description and not the frame's
 * title ({@link ./Transcript.tsx}'s `titleOf`, over
 * {@link @olai/surface}'s `sentToDo`). Under the adapter olai ships with, an
 * `Agent` call's title is the TOOL's name — four agents of one fan-out are four
 * rows reading `Task` — and this rule's whole subject is telling one agent from
 * another. It is said here rather than left to the caller because the caller
 * cannot see what this label is FOR.
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
  if (row.kind !== "tool" && row.kind !== "ask") return null
  const parent = row.parent
  if (parent === undefined) return null
  // An `Agent` frame the panel was never sent still gets a lane and still gets
  // a name — the bare fact, because "a subagent did this" is the half of the
  // sentence worth saying even when the other half is missing.
  return { parent, label: owedAName(row, above) ? nameOf(parent) ?? SOMEBODY : null }
}

/** Whether the lane this row sits in has to say whose it is.
 *
 *  TWO RULES, kept apart because they are answered by different things and
 *  each has already been re-decided on its own: WHERE the row sits, and WHAT
 *  it is. Spelled as one predicate they would share a name that is true of
 *  one of them — a form directly under its own `Agent` frame IS established,
 *  and still owes its name. */
const owedAName = (row: ChatEntry, above: ChatEntry | undefined): boolean =>
  namesItself(row) || !established(row, above)

/**
 * Whether the row above already put the reader in this lane.
 *
 * OVER THE TWO ROWS, like {@link laneOf} itself and for its reason: this is a
 * fact about the PAIR and about no single value in it, so taking it as a
 * computed boolean beside a row would be a pair nothing enforces — each
 * argument honest alone, and the two able to describe different places in the
 * list.
 *
 * Two ways to be established, and they are the two shapes a reader actually
 * sees: the `Agent` frame itself is the row above (the ordinary case — a
 * subagent's first call lands directly under the call that spawned it), or the
 * row above is another call by the same agent.
 */
const parentOf = (row: ChatEntry | undefined): string | undefined =>
  row?.kind === "tool" || row?.kind === "ask" ? row.parent : undefined

const established = (row: ChatEntry, above: ChatEntry | undefined): boolean =>
  above?.id === parentOf(row) || parentOf(above) === parentOf(row)

/**
 * ... and whether this KIND of row names its lane regardless of where it sits.
 *
 * Position is enough for WORK, because a reader who wants to know whose grep
 * this was reads upwards and finds out. A QUESTION is not work: it is a
 * control, it blocks the turn, and a reader is told one is waiting from
 * outside the list entirely — the composer, the header and the app's agent
 * toggle all say so ({@link ../../../../chat/README.md}) — so the form they
 * then go looking for may be anywhere, including scrolled off the top of a
 * long transcript with nothing above it they have read.
 *
 * The load-bearing half is simpler and stands alone: a permission form
 * answered in the wrong agent's name is a decision made on a false premise,
 * and this is the one row in the panel where that is possible. It costs one
 * line above a form that is already several.
 *
 * AND IT IS NOW THE ONLY EVIDENCE THERE IS. Before a subagent's calls left the
 * conversation, a reader who doubted the name had the stretch of that agent's
 * work under the form to read and the frame that spawned it directly above; the
 * label was the fastest answer rather than the whole of it. The calls are drawn
 * elsewhere now, so what is left on the row is this line — which is why what it
 * is drawn FROM had to stop being the frame's pinned title and start being what
 * the agent was sent to do (see `nameOf` above).
 *
 * The stretch is unaffected either way — the row below a form is still one of
 * the same agent's, so the lane does not open again underneath it.
 */
const namesItself = (row: ChatEntry): boolean => row.kind === "ask"

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

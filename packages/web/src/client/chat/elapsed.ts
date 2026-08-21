/**
 * HOW LONG a call has been going, on the line of the call.
 *
 * A tool frame is one line and a status mark, and until this was drawn the
 * mark was the whole of what it said about time: `·` for a call announced a
 * quarter of a second ago and `·` for one that had been grepping for four
 * minutes. Those are not the same row to a person watching — the first is the
 * panel working and the second is the question "is this stuck?", which had no
 * answer anywhere on screen. So a call the wire still calls running grows a
 * number, and the number ticks.
 *
 * AGENT-AGNOSTIC BY CONSTRUCTION, which is the half worth stating: what is
 * read here is ACP's own tool-call status and the instant olai first heard of
 * the row. No `_meta`, no tool name, no adapter. A `Bash`, a `Monitor`, a grep,
 * a build, and whatever some other ACP agent calls its own tools all get the
 * same readout for the same reason — the wire said the call had not come back
 * — and nothing here has to recognise any of them.
 *
 * THE HONEST LIMIT, said out loud because a face that overstates itself is
 * what {@link ./spawn.ts} exists about: this shows what the WIRE calls running,
 * which is not the same as what is running. A call the adapter completes at
 * launch and lets carry on in the background is `completed` on the frame olai
 * sees, so it has no duration here and should not have one — inventing one
 * would mean guessing at the far side of somebody else's process.
 *
 * TWO THINGS HAVE TO BE TRUE, and they are `doingOf`'s two: the ROW has to be
 * running, and the CONVERSATION has to be live. The second is the one a row
 * cannot see. Statuses are sticky and the rows a dead agent left are
 * deliberately still on screen to read, so an agent that died mid-call leaves
 * that call `pending` for as long as the panel is open — and a clock asked of
 * the row alone would count up, all afternoon, under a process that stopped at
 * lunchtime. A stopwatch on a dead conversation is a worse lie than no
 * stopwatch at all, because it is a lie that keeps getting bigger.
 *
 * TWO CLOCKS, and the assumption is declared rather than hidden: the instant is
 * the SERVER's (`ChatEntry.since`) and `now` is the reader's, so a duration is
 * only as true as the two machines agree. That is the same bargain
 * `../commit/ago.ts` strikes with a stamp out of a git repository, and it is
 * struck for the same reason — the alternative, timing from when this tab began
 * looking, is not a smaller error but a systematic one, and it gets the answer
 * wrong even when every clock is perfect. What skew CANNOT do is produce
 * nonsense: a stamp ahead of the reader reads as a call that has only just
 * started, never as a negative.
 *
 * A PURE FUNCTION over a row, a boolean and a clock, exactly as `doingOf` is a
 * pure function over a row and a boolean — so the whole rule is a table in a
 * unit test rather than something you have to start an agent and wait a minute
 * to see. Only {@link createNow} touches a clock, and it is the same split
 * `../commit/ago.ts` makes for the same reason.
 */

import type { ChatEntry } from "@olai/surface"
import type { Accessor } from "solid-js"

import { createTicking, HOUR, instantOf, MINUTE, SECOND } from "../clock.ts"
import { isRunning } from "./running.ts"

/**
 * How long this call has been going, as words — or `null` when there is
 * nothing to say, which is the cue to draw no readout at all.
 *
 * `null` covers four different silences and deliberately answers them the same
 * way, because the drawing is the same in all four: the conversation has
 * stopped, the call has, the row is not a call at all, or the call is younger
 * than {@link QUIET_MS}.
 *
 * BOTH THE CLOCK AND THE LIVENESS ARE THUNKS, and that is a reactivity
 * decision rather than a stylistic one: whatever computation asks this becomes
 * an observer of whatever it reads, and every row of the transcript asks. Read
 * as values, a four-hundred-row conversation would wake four hundred times a
 * second for the clock and four hundred times a turn for the liveness, to
 * answer `null` nearly every time. So the gates go cheapest-and-most-local
 * first — is this row a running call at all, which needs nothing but the row —
 * and the two shared signals are read afterwards, by exactly the rows that
 * could have a number to draw. `doingOf` has the same shape for the same
 * reason, which is what keeps the two faces on one row symmetrical.
 *
 * @param entry the row being drawn
 * @param live whether a turn is in flight in this conversation at all
 * @param now the reader's clock, in epoch milliseconds
 */
export const elapsedOf = (
  entry: ChatEntry,
  live: () => boolean,
  now: () => number,
): string | null => {
  // THE ROW, not its status — which is what makes this safe to ask of any row
  // in the transcript. `status` is a tool row's field, and a predicate over the
  // bare field would have to guess about the rows that carry none
  // ({@link ./running.ts}). It NARROWS, so the stamp below is read off a row
  // this line has already established is a call.
  if (!isRunning(entry)) return null
  if (!live()) return null
  const started = instantOf(entry.since)
  // A stamp that is not a time. It cannot be a MISSING one — the wire requires
  // it — so this means exactly what it says: somebody else's string, and a
  // readout of `NaN` is worse than a row with no readout.
  if (started === null) return null
  const running = now() - started
  // Under the threshold — including a NEGATIVE, which is a browser whose clock
  // sits behind the server's. That is not a call from the future; it is a call
  // that has just started, and it is drawn as one.
  if (running < QUIET_MS) return null
  return saidOf(running)
}

/**
 * A duration in the coarsest words that still answer the question, which gets
 * coarser as it gets longer — the rule `../commit/ago.ts` follows, arrived at
 * from the other end.
 *
 * Seconds are the whole point below a minute: "is this stuck" is a question
 * about 5s against 50s. Above one they stop being the point and stop being
 * readable — a number whose last digit changes every second is a number the eye
 * cannot rest on — but they do not stop MATTERING, because a minute and a half
 * is still a stretch somebody is deciding whether to wait out. So a minute
 * keeps its seconds and an hour does not: past an hour the difference a reader
 * cares about is minutes, and by then nobody is watching the last digit.
 */
const saidOf = (running: number): string => {
  if (running < MINUTE) return `${Math.floor(running / SECOND)}s`
  if (running < HOUR) {
    return `${Math.floor(running / MINUTE)}m ${Math.floor((running % MINUTE) / SECOND)}s`
  }
  return `${Math.floor(running / HOUR)}h ${Math.floor((running % HOUR) / MINUTE)}m`
}

/**
 * How long a call may run before it is worth saying so.
 *
 * Most calls are a `Read` that lands in a quarter of a second, and a panel that
 * flashed `0s` on every one of them would be a panel that flickers — the
 * readout would become furniture, and furniture is the thing a reader stops
 * seeing. Three seconds is the point where a call has stopped being instant and
 * a person has started wondering, which is the moment the number is worth the
 * space it takes.
 */
const QUIET_MS = 3 * SECOND

/** How often the number is re-read. A second, because seconds are the finest
 *  distinction {@link saidOf} draws. */
const TICK_MS = SECOND

/**
 * The clock this readout is drawn against — and it runs only while there is
 * something to time.
 *
 * The machinery is `../clock.ts`'s ({@link createTicking}); what is decided
 * here is the two things about it that belong to this readout — how often, and
 * WHEN. The gate is the same `live` the words are gated on, which is the rule
 * this file argues for made true of the machinery as well: a dead conversation
 * does not merely draw no number, it does not keep a clock either. An idle
 * panel would otherwise be waking the tab once a second to recompute nothing.
 */
export const createNow = (live: Accessor<boolean>): Accessor<number> =>
  createTicking(TICK_MS, live)

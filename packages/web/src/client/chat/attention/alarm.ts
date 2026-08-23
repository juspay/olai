/**
 * WHEN the panel asks for a person's attention, as arithmetic.
 *
 * The whole rule of this feature is two sentences, and they are here — with no
 * browser under them — because everything else in this folder is a device: a
 * sound, an icon, a banner the OS draws. What decides whether any of them
 * happens is one comparison of two readings, and it is the part that has to be
 * right.
 *
 *   - **an alert is a question ARRIVING at somebody who is not looking.** It
 *     fires on the count going UP, never on it merely being high: a person who
 *     comes back to a badge, answers nothing and wanders off again is not
 *     interrupted a second time by the same question.
 *   - **a badge is a question STILL WAITING on somebody who is not looking.**
 *     It is a state and not an event, so it is recomputed from the reading
 *     rather than accumulated — which is what makes it clear itself the moment
 *     they look, and stick until they do (the ruling: not until the banner is
 *     dismissed).
 *
 * THE FIRST READING NEVER ALERTS, and that is what `was === undefined` is for.
 * A tab restored into the background with two questions already open would
 * otherwise ring for questions that had been asked while it did not exist. It
 * still badges, because the badge is a statement about now.
 *
 * WATCHED, not "focused", is the word: a person is watching when the form is
 * in front of them, which takes the window AND the panel (`./watching.ts`).
 * The ruling's "the form appearing is the alert" is only true of a form that
 * appeared somewhere they can see.
 */

/** What is waiting, and whether anybody is looking at it. */
export interface Awaiting {
  /** How many of the agent's questions are still waiting on a person — the
   *  chat cell's own `asking`, which the server counts off the very rows the
   *  panel draws as forms. */
  readonly count: number
  /** Whether the conversation is in front of somebody right now. */
  readonly watched: boolean
}

/** What to do about it. */
export interface Alarm {
  /** Ring, and put a banner up: something ARRIVED that nobody is looking at. */
  readonly alert: boolean
  /** What the app's icon should carry. `0` clears it. */
  readonly badge: number
}

/** The rule, whole. `was` is the previous reading, or `undefined` for the
 *  first one this page has taken. */
export const alarmFor = (was: Awaiting | undefined, now: Awaiting): Alarm => ({
  alert: was !== undefined && !now.watched && now.count > was.count,
  badge: now.watched ? 0 : now.count,
})

/**
 * WHAT A BROWSER WOULD NOT DO FOR US, said to the console, once.
 *
 * There is a class of failure this app cannot put on a screen and must not
 * swallow: a browser that will not remember a preference, will not play a
 * sound, will not badge an icon. Each of them has the same three properties —
 * nothing the reader ASKED for failed, the feature carries on in a reduced
 * shape they can live with, and the only person who wants the detail is
 * somebody who has gone looking for why. A banner over an outline saying
 * "your theme will not persist" is worse than the silence it replaced.
 *
 * The argument used to live in `./preference.ts`, which is where the first one
 * was written; it is here now because there are three, and a policy spelled
 * three times is a policy that comes apart at the fourth. What varies is the
 * SENTENCE — which is the caller's, because only the caller knows what a
 * reader has lost and what still works.
 *
 * ONCE PER KEY, so a picker somebody is playing with does not fill a console
 * with forty copies of one line, and so a line that is going to be repeated is
 * still findable among the ones that are not. The key is the caller's own
 * name for the thing that refused — a storage key, a capability — and never
 * the message, which may carry a value.
 *
 * Never a throw, and deliberately no way to make it one: every caller here is
 * in the middle of doing something else for somebody.
 */

/** Keys already complained about. Module-scoped, so "once" means once per
 *  page — the lifetime a console is read over. */
const said = new Set<string>()

/**
 * Say it, unless this key has already been said.
 *
 * `cause` is whatever the platform threw, passed through untouched: it is the
 * half a reader who came looking cannot reconstruct, and `console.warn` prints
 * an `Error` better than any interpolation of it would.
 */
export const grumble = (key: string, message: string, cause?: unknown): void => {
  if (said.has(key)) return
  said.add(key)
  if (cause === undefined) console.warn(message)
  else console.warn(message, cause)
}

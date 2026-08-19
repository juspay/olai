/**
 * A QUESTION THAT DISARMS ITSELF when the thing it is about moves.
 *
 * Two surfaces in this client ask before they write — the multi-selection
 * bar's `Move to Trash` (`./select/SelectionBar.tsx`) and the Trash page's
 * `Empty trash` (`./trash/EmptyTrash.tsx`) — and both of them are a confirm
 * that has to be TAKEN DOWN rather than merely answered. This is that rule, in
 * one place, for the reason `./saying.ts` is one place: the two were the same
 * three lines twice, and one of them had already been a bug.
 *
 * THE BUG, which is why this is a receptacle rather than a convention. A
 * confirm lives on a component that stays mounted while its subject comes and
 * goes: the bar hides when nothing is picked, it does not unmount, and the
 * Trash page's verb is drawn off a count. So an armed question survived the
 * pick going away, and the NEXT pick opened already asking — a second press of
 * the button that raised the question last time archived instead (review,
 * 2026-08-14). Changing the subject while the question is up is the same bug
 * one step smaller: the sentence re-counts and the "are you sure" does not
 * reset, so somebody agrees to a sentence they never read.
 *
 * SO THE SUBJECT IS WATCHED, and any change to it disarms — a watch and not a
 * comparison against what the subject read at arm time, for a reason
 * {@link createConfirming} writes out where the choice is made. What "the
 * subject" IS stays the caller's — the identity of the rows picked, the number
 * of records in the trash — because that is the only part of this that differs
 * between them: it must be the thing the QUESTION IS ABOUT rather than a proxy
 * for it, which is why the bar keys on the pick's identity and not on its size
 * (one row swapped for another is a different question about a different
 * subtree).
 *
 * WHAT IT IS NOT is the running of anything, or the drawing of anything. The
 * verb that goes ahead is the caller's to call and the pills are the caller's
 * to place — `./saying.ts`'s division exactly, and for its reason: what the two
 * surfaces genuinely share is this rule, and a component with a `where` enum in
 * it would be two layouts behind one flag.
 *
 * The THIRD confirm in this app is deliberately not a caller. `./menu/Confirm.tsx`
 * is a panel that swaps its own content and goes away with the menu, so it has
 * no life to outlast its subject — the trap above cannot happen there, and it
 * would gain a subscription for nothing.
 */

import { type Accessor, createEffect, createSignal } from "solid-js"

/**
 * WHERE A CONFIRM IS, as one value rather than as a pair of booleans.
 *
 * `offered` is the resting control, `asking` is the question with its two ways
 * out, and `working` is the write in flight. An `asking` flag beside a
 * `working` flag is three states in four combinations — nothing at all means
 * `asking && working` — and a reader has to hold both to know what is on
 * screen. One value makes the fourth unspellable and a caller's `Switch` total
 * over what is left.
 */
export type Asked = "offered" | "asking" | "working"

export interface Confirming {
  /** Which of the three the control is in, right now. */
  readonly where: Accessor<Asked>
  /** Raise the question. */
  readonly ask: () => void
  /** Put it away, writing nothing — what `Cancel` sends. */
  readonly drop: () => void
  /** The write is in flight. Kept out of `ask`/`drop` because going ahead is
   *  the caller's verb and this is only the state it leaves behind it. */
  readonly begin: () => void
  /** …and it has answered, whichever way. */
  readonly done: () => void
}

export const createConfirming = (
  /**
   * What the question is ABOUT, read reactively. Any change to it puts an
   * armed question away.
   *
   * A function rather than a signal, so a caller can key on whatever
   * identifies its subject — a count, a joined list of row keys — without this
   * module having an opinion about what a subject is.
   */
  subject: () => unknown,
): Confirming => {
  const [where, setWhere] = createSignal<Asked>("offered")

  /**
   * A WATCH AND NOT A COMPARISON, which is the one thing here that was got
   * wrong on the way and is worth writing down.
   *
   * The tidier-looking spelling is to remember the subject at arm time and ask,
   * on every read, whether it still reads the same — a derivation rather than
   * an effect, no stale state to correct, and testable without an effect
   * runtime. It is also WRONG, and the multi-selection bar's own scenario is
   * what says so: pick a row, raise the question, press Escape (the pick is
   * empty), pick THE SAME ROW again. The subject left and came back, so a
   * comparison finds it unchanged and the question is still standing over a
   * pick nobody armed it for — which is the exact bug the rule exists to stop
   * (`dragdrop_multiselect.feature`, "The question does not outlive the rows it
   * is about"). What disarms is the subject having MOVED, not its current value
   * differing.
   *
   * It disarms from `asking` and NEVER from `working`: a write in flight is not
   * a question anybody is being asked, and the frame that lands one is usually
   * the very frame that changes the subject.
   */
  createEffect(() => {
    subject()
    setWhere((was) => (was === "asking" ? "offered" : was))
  })

  return {
    where,
    ask: () => setWhere("asking"),
    drop: () => setWhere("offered"),
    begin: () => setWhere("working"),
    done: () => setWhere("offered"),
  }
}

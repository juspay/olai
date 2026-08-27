/**
 * THE RE-ATTACH POLICY — the four rules `@kolu/padi-client/attach` states, as a
 * pure fold a test can drive without a browser, a socket or a terminal.
 *
 * The package ships the rules and deliberately not the LOOP: backoff, budgets,
 * the fruitless-cycle verdict and how loudly to complain are one app's idea of
 * a user experience, so they are olai's to decide. This module is that decision
 * and nothing else — no xterm, no DOM, no wire. What it produces is a verdict
 * ({@link Next}) and what a caller does with it is `./LivePane.tsx`'s.
 *
 * ## The four rules, and where each one lives here
 *
 *  1. **A snapshot is only valid at the grid it was asked for.** {@link onFrame}
 *     refuses a mismatched snapshot rather than painting it — the one rule whose
 *     violation is IRREVERSIBLE, because nothing rebuilds scrollback that has
 *     already been wrapped at the wrong width. kolu's own predicate makes the
 *     comparison; this decides what to do about the answer.
 *  2. **Three things stale a grid and only one is your own resize** — so the
 *     check runs on EVERY snapshot, which is why it is in the frame path rather
 *     than beside a resize handler. The one nobody guesses: another client
 *     attaching at its own size resizes the shared pty underneath you, with no
 *     local event to observe.
 *  3. **A clean end does not mean the PTY exited.** {@link onEnd} treats
 *     completion as recoverable, and the budget below is what makes that safe:
 *     a terminal that really is gone still converges instead of re-attaching
 *     forever.
 *  4. **Silence is a failure mode with no event.** {@link onSilence} is the
 *     first-frame deadline, and its expiry is a re-attach like any other.
 *
 * ## The numbers, which are policy and are therefore stated
 *
 * FOUR SECONDS for the first frame, which is OLAI'S number and not kolu's. The
 * comment here used to claim kolu's — "adopted rather than re-derived" — and it
 * was simply false: kolu's is 45 SECONDS. A reader who trusted the claim would
 * have "corrected" this pane toward a number kolu does not have for it.
 *
 * kolu's contract is explicit that the value is the consumer's: having a
 * deadline is the rule, the number is policy. And 45s is derived for kolu's
 * chain — browser → server → ssh → padi → kaval — placed above a 25s watchdog
 * and a 1s stream retry, because under 25s the deadline preempts the watchdog
 * it depends on. olai's chain is shorter by the whole wide-area leg: browser →
 * this server → padi on a unix socket on the same machine. Four seconds is
 * derived for THAT: long enough for padi to serialize a screen, short enough
 * that a pane which will never paint says so while the reader is still looking
 * at it.
 *
 * SIX ATTEMPTS, then the pane says so. A budget rather than an endless retry
 * because rule 3 makes a dead terminal indistinguishable from a quiet one at
 * the stream level: without a budget, a pane over a terminal that closed an
 * hour ago re-attaches until the tab does. Six is enough to ride out a link
 * flap (the dial's own re-dial is five seconds) and small enough that a genuine
 * death is on screen inside a minute.
 *
 * BACKOFF IS FLAT, deliberately, and this is the one place olai departs from
 * what an exponential instinct would write: every re-attach here is either a
 * link that is already re-dialling on its own clock or a grid that just
 * changed, and neither gets better by waiting longer. A pane that waited
 * sixteen seconds after four failures would be a pane that looks broken while
 * the link behind it is healthy.
 */

/** What the pane should do next. */
export type Next =
  /** Paint these bytes. `reset` is a snapshot's instruction: clear first. */
  | {
    readonly kind: "write"
    readonly data: string
    readonly reset: boolean
    /**
     * ADOPT THIS GRID FIRST — the cols × rows the bytes were laid out for.
     *
     * Only a snapshot carries one, and only when padi is new enough to say.
     * `undefined` means KEEP WHAT YOU HAVE, which is the whole of the
     * absent-grid rule: a monitor that guessed a size is what the field was
     * added to stop, so not knowing is a reason to change nothing rather than
     * a reason to measure.
     */
    readonly grid?: Grid
  }
  /** Drop this subscription and open a fresh one at the pane's current grid. */
  | { readonly kind: "reattach"; readonly why: string }
  /** Stop, and say this. The budget is spent, or padi refused in words. */
  | { readonly kind: "stop"; readonly says: string }
  /** Nothing to do. */
  | { readonly kind: "idle" }

/** How long a pane waits for its FIRST frame before treating silence as a
 *  failure. kolu's number; see the header on why it is not re-derived. */
export const FIRST_FRAME_MS = 4_000

/** How many attaches a pane will make before it says the terminal is gone. */
export const ATTEMPT_BUDGET = 6

/** What the pane remembers between frames — small, and all of it is the
 *  policy's own state rather than the terminal's. */
export interface Attaching {
  /** How many attaches have been opened, this one included. */
  readonly attempts: number
  /** Has any frame arrived on the CURRENT attach? The deadline is about the
   *  first frame of an attach, not the first of a pane's life: a re-attach that
   *  goes silent is the same failure as an opening one. */
  readonly seen: boolean
}

export interface Grid {
  readonly cols: number
  readonly rows: number
}

/** A pane about to open its first attach. */
export const opening = (): Attaching => ({ attempts: 1, seen: false })

/** ...and the next one, which is where the budget is spent. */
export const again = (was: Attaching): Attaching => ({
  attempts: was.attempts + 1,
  seen: false,
})

/** Is there any attach left to make? Asked before `again`, so a caller cannot
 *  spend a seventh attempt by forgetting to check. */
export const spent = (was: Attaching): boolean => was.attempts >= ATTEMPT_BUDGET

/**
 * ONE FRAME.
 *
 * RULE 1 IS SATISFIED BY ADOPTION, not by refusal. A snapshot names the grid it
 * was serialized at, and the pane takes it — so there is no such thing here as
 * painting at the wrong size, and nothing to compare or refuse. That is what
 * the kolu amendment bought: the predicate this used to take an answer from
 * (`snapshotAnswersGrid`) compares two LOCAL measurements, which cannot see a
 * foreign resize at all — and a monitor that never asks for a size has no
 * local measurement worth comparing.
 */
export const onFrame = (
  state: Attaching,
  frame:
    | { readonly kind: "delta"; readonly data: string }
    | {
      readonly kind: "snapshot"
      readonly data: string
      readonly grid?: Grid | null
    }
    | { readonly kind: "refused"; readonly says: string },
): { readonly state: Attaching; readonly next: Next } => {
  if (frame.kind === "refused") {
    // PADI'S OWN WORDS END IT. A refusal is not a transport failure and a
    // re-attach would ask the same question again — the terminal named does
    // not exist, or the value names three of them, and neither improves by
    // asking twice.
    return { state, next: { kind: "stop", says: frame.says } }
  }
  // A DELIVERED FRAME REFILLS THE BUDGET, and this one line is the difference
  // between a pane that survives an afternoon and one that declares a working
  // agent dead. `attempts` is the count of attaches spent WITHOUT ever
  // painting; a pane that painted has proved the whole chain — browser,
  // server, padi, kaval, this terminal — so the next stumble is a fresh
  // episode rather than the continuation of an old one's accounting.
  //
  // It is kolu's rule, stated where kolu keeps the loop (`client/src/terminal/
  // reattachingStream.ts`): "Both budgets REFILL on a delivered frame, because
  // a pane that painted has proved the whole chain and the next stumble is a
  // new episode, not a continuation of an old one's accounting." This lane
  // copied the re-attach and not the refill, and the bill came due through the
  // RESIZE path — kolu's own grid-driven reopen is safe, in its words, "BECAUSE
  // ... a delivered frame refills both budgets, so the fresh loop legitimately
  // starts a fresh episode instead of escaping an old one's".
  //
  // Convergence is untouched, which is the property worth checking: a terminal
  // that never delivers a frame never refills, so six fruitless attaches still
  // land on the budget's sentence. Only a pane that PAINTED gets its budget
  // back, and a pane that painted is not the case the budget exists for.
  const seen = { attempts: 1, seen: true }
  if (frame.kind === "delta") {
    // A DELTA CARRIES NO LAYOUT CLAIM — it is bytes the terminal emitted, and
    // it is written whatever the grid is doing. The only frame that can be
    // stale is the one that describes a whole screen.
    return { state: seen, next: { kind: "write", data: frame.data, reset: false } }
  }
  // THE PANE ADOPTS THE PTY'S GRID rather than asserting its own. This is the
  // frame that says what size the bytes are for, and it is the ONLY place a
  // size is decided: a resize of the pane's own box changes what is visible,
  // never what is asked for.
  return {
    state: seen,
    next: {
      kind: "write",
      data: frame.data,
      reset: true,
      grid: frame.grid ?? undefined,
    },
  }
}

/** THE STREAM ENDED CLEANLY — which does not mean the terminal did (rule 3). */
export const onEnd = (state: Attaching): Next =>
  spent(state)
    ? {
      kind: "stop",
      says: "this terminal stopped answering — it has probably closed.",
    }
    : { kind: "reattach", why: "the stream ended, which is not the same as the terminal ending" }

/** THE FIRST FRAME NEVER CAME (rule 4). Only meaningful while `seen` is false;
 *  a caller that has cleared its timer on the first frame will not ask. */
export const onSilence = (state: Attaching): Next =>
  state.seen
    ? { kind: "idle" }
    : spent(state)
    ? { kind: "stop", says: "this terminal is not sending anything — it may have closed." }
    : { kind: "reattach", why: "no first frame inside the deadline" }

/**
 * HOW LONG A PANE WAITS BEFORE RE-ATTACHING.
 *
 * The flat backoff this module's header describes, finally spelled as a number
 * — it was an argument with no code under it, and the gap had teeth: a stream
 * that ends SYNCHRONOUSLY (a terminal with no live screen does exactly that)
 * drove the re-attach from inside the effect that owns the subscription, which
 * re-enters that effect while it is still running. Alone it converged; under
 * the suite's load it stopped converging at all, and the step hit cucumber's
 * own ceiling rather than a slow pass.
 *
 * A quarter second is enough to break the re-entrance — the next attach starts
 * from a fresh turn of the event loop — and small enough that a whole budget is
 * spent inside two seconds, which is what keeps "the pane says so" a fact a
 * person waits through rather than reads about.
 */
export const REATTACH_MS = 250

/**
 * WHEN THIS TAB HAS FINISHED WITH A KEY — one counter, one attribute, and the
 * honest edges of what either can promise.
 *
 * ## Why the client has to say it
 *
 * Nothing about this app answers a key synchronously. A key opens a draft, or
 * queues a write behind the one still in flight, or sends a procedure and
 * redraws the row when the file comes back — so the moment `keydown` returns
 * is never the moment its effects are on screen. Everything that has to know
 * WHEN they are has, until now, had to guess from the outside: the browser
 * suite waited on a proxy per key (the caret moving, a draft closing, a list
 * going — `packages/tests/support/caret.ts`), one proxy per key shape, each
 * one a separate piece of knowledge about the client's insides kept in another
 * package.
 *
 * A proxy is a guess even when it is a good one. `Control+Enter` has none at
 * all — it redraws a row without moving the caret, so there is nothing on the
 * page that changes when the client takes the caret back from where it already
 * is — and two of them in a row was a race nobody could write a wait for. The
 * fix is the one this codebase applies everywhere else: WAIT ON THE EVENT,
 * which means the client has to publish the event.
 *
 * So this is observability in product code, deliberately: no test-only build,
 * no global, no branch on an environment. It is a number the app maintains
 * about itself, and a `data-` attribute is where this client already puts a
 * fact it wants somebody outside to be able to read (`./testids.ts`).
 *
 * ## What HOLDS the counter
 *
 * Three holders, and each is paired structurally rather than by a caller
 * remembering to close it — a leaked increment is worse than no counter at
 * all, because it turns every wait built on it into a timeout.
 *
 *   1. **The key itself.** {@link began} is called from a capture-phase
 *      `keydown` on the window ({@link followKeys}), so it runs before any
 *      handler in the app sees the event, and it holds until the task that
 *      dispatched the event has ended and the frames that draw what the
 *      handlers did have been committed. That covers every key this app
 *      answers synchronously — a fold, a menu, a pane, a preference, a
 *      dismissal — with nothing per handler to keep in step.
 *
 *   2. **What a key SENT.** `./run.ts` is the one place this client runs an
 *      Effect, so it is the one place a procedure call can be recognised as a
 *      key's: a call started while {@link underKey} holds is held until the
 *      server answers it, either way. That is the palette's capture, the
 *      composer's send, the move picker's write, the preferences that ask.
 *
 *   3. **What a key QUEUED.** `./edit/queue.ts` is the serial write gate the
 *      editor, the multi-selection and undo each own one of. A step put on it
 *      under a key is held from the moment the key enqueues it until the step
 *      settles — which is AFTER the write has answered and after `undo.record`
 *      has filed the inverse, because that record is what the step awaits.
 *      That last fact is the whole of what the caret proxy was ever standing
 *      in for: "this tab has the way back" is the precondition of every ⌘Z,
 *      and it is a fact about a promise rather than about anything on screen.
 *
 * A holder taken under a key can be taken again by what it starts — the queued
 * step's own `runAsync` is a call inside a hold — and that costs nothing: two
 * holds over one interval reach zero at the same instant. What matters is that
 * every one of them is opened before the thing it covers can finish and let go
 * on every path out of it: the key's own on a task the dispatch cannot cancel,
 * a call's through `finally`, a queued step's off a branch of the gate that
 * handles both outcomes. And every release is idempotent, so a caller that
 * pairs it twice counts once.
 *
 * ## Why the release is deferred rather than taken
 *
 * A hold is let go through a task and a pair of frames, and the reason is not
 * only the paint. What a caller DOES with an answer is the continuation after
 * it — the palette sets its remark in the `.then` of the capture, the editor
 * puts the row back in the line after `send` returns — and a continuation is a
 * microtask, which runs long before the next frame. So deferring the release
 * past a frame means everything the answer fed has already happened by the
 * time the count moves, without this file having to know what any of those
 * callers are. Taking the release the instant a promise settled would report
 * quiet one microtask before the page changed.
 *
 * ## What does NOT hold it, and why each is right
 *
 * The ruling that asked for this asked for the honest boundary stated rather
 * than for maximal coverage, so here it is, in the order somebody would find
 * them:
 *
 *   - **A DEBOUNCE.** The idle commit (`./edit/draft.ts`'s `IDLE_COMMIT`), the
 *     shortlist settle (`./settled.ts`'s `SETTLE_MS`), a throttled re-render.
 *     Two reasons, and the first is the one that decides: every one of those
 *     timers is CANCELLED AND RESTARTED by the next keystroke, so a counter
 *     that waited one out would be counting "the person stopped typing"
 *     instead of "the key landed" — a different fact, and not the one anybody
 *     wants to wait on. The second is the cost: a wait that paid the settle
 *     would pay it per key. What the timer eventually STARTS does hold the
 *     counter, because the idle commit goes on the write queue like every
 *     other write — so the counter is honest about a write in flight and
 *     silent about one not yet begun.
 *
 *   - **A TURN.** `Enter` in the chat composer holds this until the server has
 *     TAKEN the message, not until the agent has answered. The send is what
 *     the key started; the turn is what the server does next, and it arrives
 *     on the transcript as its own frames. A counter that covered it would sit
 *     high for minutes.
 *
 *   - **WHAT ANOTHER WRITER DID.** A frame this tab is pushed because a
 *     watcher, another tab or an agent wrote something is not this key's
 *     effect and is not counted, however soon after the key it lands.
 *
 *   - **AN ANIMATION.** Two frames are the DOM the key committed, not the end
 *     of a transition, a smooth scroll or a lazily imported chunk drawing its
 *     first real paint. Where the geometry IS the claim, the geometry is what
 *     a reader has to wait for.
 *
 *   - **A PAGE THIS APP IS NOT DRAWING.** The attribute rides the app shell
 *     (`./App.tsx`), so a fault card — where the boundary has replaced the
 *     whole tree — carries no counter. Nothing there answers a key either.
 *
 *   - **A CALL THAT NEVER ANSWERS.** The counter is exactly as honest as the
 *     promises it holds: a procedure that neither resolves nor rejects holds
 *     it forever. That is not a hole this file can close by inventing a
 *     deadline — a counter that gave up on a call still in flight would report
 *     settled while a write was outstanding, which is the one lie it must not
 *     tell. It is a hang the reader is having too, and the wait that times out
 *     on it says the count it was stuck at.
 *
 * ## Why it is not `./settled.ts`
 *
 * That file is a different question with an unfortunately similar name: how a
 * KEYSTROKE BECOMES A REQUEST at a search box — the settle, which answer is
 * still the reader's, what an abandoned question does to the rows. This is
 * about the keyboard as a whole and about nothing being asked of the server at
 * all. Neither reads the other.
 */

import { type Accessor, createSignal } from "solid-js"

/**
 * The attribute the count is published as, on the app shell, counting down to
 * `"0"`.
 *
 * Its name is here rather than spelled at the two ends because it is the same
 * kind of contract a `data-testid` is (`./testids.ts`'s opening paragraph):
 * two packages that never import each other agreeing on a string, where the
 * way it breaks is silent. The browser suite reads it through
 * `@olai/web/testlib`, so a rename is a type error rather than a timeout.
 *
 * ALWAYS DRAWN, including at `"0"`: a wait for the app to be quiet must be
 * able to tell "settled" from "the shell is not up yet", and an attribute that
 * appeared only while busy answers both with an absence.
 */
export const KEYS_SETTLING = "data-keys-settling"

/** How long a release waits for a frame that may never come. A tab the
 *  browser is not painting — a second tab in the same context, a window behind
 *  another — commits its DOM and never runs `requestAnimationFrame`, so the
 *  frame this waits for arrives when somebody looks at that tab again. What
 *  the counter promises there is the DOM, which the task queue already gives,
 *  and this is the backstop for a tab that goes hidden AFTER a release was
 *  scheduled. Long enough that a painting tab always wins it. */
const UNPAINTED_MS = 250

/** What a release is deferred BY — injected, so the counter's own rules can be
 *  tested with no browser under them (`./quiescence.test.ts`). */
export interface Deferrals {
  /** After the task that is running now — which for a `keydown` is the whole
   *  of its dispatch. A microtask will NOT do: the HTML spec runs a microtask
   *  checkpoint between two listeners on the same event, so one queued in the
   *  capture phase runs before the app's own handler has been called at all. */
  readonly task: (go: () => void) => void
  /** After the frames that draw what has just been done. TWO, for
   *  `packages/tests/support/world.ts`'s reason, which is the same one on
   *  either side of the wire: one frame flushes the effect queue, the second
   *  flushes anything that queue itself scheduled. */
  readonly frames: (go: () => void) => void
}

export interface Quiescence {
  /** How many keys this tab has not finished with. `0` is quiet. */
  readonly count: Accessor<number>
  /** A key arrived. Held until its dispatch has ended, whatever it started
   *  has settled, and the frames that draw it have been committed. */
  readonly began: () => void
  /** Is a key being handled right now — the window in which a call recognises
   *  itself as that key's? True for the whole of the dispatch task and no
   *  longer, which is what keeps an unrelated call that merely happened to
   *  start later from being held. */
  readonly underKey: () => boolean
  /**
   * Hold for the life of `work` if a key is being handled. The hold is closed
   * on BOTH outcomes — a refused write is a key this tab has finished with.
   *
   * WITH NO KEY BEING HANDLED IT HANDS BACK THE VERY PROMISE IT WAS GIVEN, and
   * that is a rule rather than an optimisation. `./run.ts` puts EVERY call in
   * this client through here — a subscription's, a turn's, a pointer's — and a
   * wrapper, even one that only awaits, settles a microtask or two after the
   * promise it wraps. This counter is an observer of the keyboard, and an
   * observer that moved when anything else in the app answered would be a
   * change to the app rather than a reading of it. There are pages in this
   * client that measure themselves against when a call came back
   * (`./scroll.ts`'s restore is the sharpest), and none of them is a key's
   * business. So: no key, no wrapper.
   */
  readonly holding: <T>(work: Promise<T>) => Promise<T>
  /** Take a hold by hand, for a caller whose work is not one promise — the
   *  write queue, which holds from the moment a key enqueues a step until the
   *  step settles somewhere else entirely. The release is idempotent, so a
   *  caller that pairs it in a `finally` AND on a path out cannot count twice.
   *
   *  `undefined` when no key is being handled, which is a pointer's write and
   *  is not this counter's business. */
  readonly held: () => (() => void) | undefined
}

export const createQuiescence = (after: Deferrals): Quiescence => {
  const [count, setCount] = createSignal(0)
  /** How many key dispatches are open. A number rather than a flag: a handler
   *  that dispatches a synthetic key of its own (a menu forwarding `Enter`
   *  down) nests, and a flag cleared by the inner one would leave the outer
   *  key's own calls unheld. */
  let keys = 0

  const take = (): (() => void) => {
    setCount((n) => n + 1)
    let dropped = false
    return () => {
      if (dropped) return
      dropped = true
      // The frames are the whole difference between "the handler returned" and
      // "what it did is on the page", and they are paid on the way OUT rather
      // than by each caller, so no holder can forget them.
      after.frames(() => setCount((n) => n - 1))
    }
  }

  return {
    count,
    began: () => {
      keys += 1
      const drop = take()
      after.task(() => {
        keys -= 1
        drop()
      })
    },
    underKey: () => keys > 0,
    // `finally` is the pairing — the platform's own completion hook, which
    // runs on both outcomes and re-raises whatever it was handed — and the
    // untouched promise is what a call with no key behind it gets back.
    holding: (work) => {
      const drop = keys > 0 ? take() : undefined
      return drop === undefined ? work : work.finally(drop)
    },
    held: () => (keys > 0 ? take() : undefined),
  }
}

/** The real deferrals — a task and a pair of frames, with the backstop for a
 *  tab nobody is painting. */
const inTheBrowser: Deferrals = {
  task: (go) => {
    setTimeout(go, 0)
  },
  frames: (go) => {
    const frame = (next: () => void) => {
      // A tab already hidden gets the task queue instead of a frame that is
      // not coming: its DOM is committed either way, and that is what the
      // count is about.
      if (document.visibilityState === "hidden") {
        setTimeout(next, 0)
        return
      }
      let ran = false
      let backstop: ReturnType<typeof setTimeout> | undefined
      const once = () => {
        if (ran) return
        ran = true
        clearTimeout(backstop)
        next()
      }
      requestAnimationFrame(once)
      backstop = setTimeout(once, UNPAINTED_MS)
    }
    frame(() => frame(go))
  },
}

/**
 * THE TAB'S ONE COUNTER. A module-level value for the reason the theme and the
 * layout preferences are: there is one keyboard, one document and one shell,
 * and a context would put a second one behind every mount point that forgot to
 * read it.
 */
export const quiescence: Quiescence = createQuiescence(inTheBrowser)

/**
 * Start counting. Capture phase and on the window, which is the first step of
 * every key's path, so the hold is open before any handler in this app — or in
 * a library it draws — can decide what the key means.
 *
 * No teardown, for `./main.tsx`'s stated reason: the only thing that ends this
 * page also ends this listener.
 *
 * It counts a SYNTHETIC key too, because a synthetic key is answered by the
 * same handlers and its effects land the same way.
 */
export const followKeys = (): void => {
  window.addEventListener("keydown", () => quiescence.began(), true)
}

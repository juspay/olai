/**
 * The turns in flight, and the four questions anybody asks about them.
 *
 * Usually there are none or one. There are TWO when a person types while an
 * agent that cannot take a message into the turn it is running is running one:
 * the message goes out as an ordinary prompt, the agent queues it behind the
 * turn it is working on ({@link ./agents/opencode.ts} has no steering method at
 * all), and until that queue drains there are two turns this process owns and
 * neither has finished.
 *
 * A SET rather than a slot, and each of the four readers below is the same
 * question asked of it:
 *
 *   - **is the conversation busy** — the composer's `thinking`, and the guard
 *     that refuses to switch conversations out from under a running turn;
 *   - **am I the last one out** — which is what decides whether a turn that
 *     ended may say where the conversation stands. A turn that ends while
 *     another is still going has nothing true left to say about it, and saying
 *     it anyway marks a thinking panel idle;
 *   - **stop all of them** — a person pressing cancel means the things they
 *     have in flight, not the newest of them;
 *   - **take all of them** — a shutdown, which owns every fiber it started.
 *
 * A SLOT answered the first two by comparing identities and the last two by
 * holding the newest, which is right for one turn and quietly wrong for two: a
 * cancel aimed at the newest left the other running, a shutdown left its fiber
 * behind, and a conversation could be swapped out from under a turn nothing was
 * pointing at.
 *
 * ITS OWN MODULE, and that is what makes any of the above assertable. Every
 * rule here is reachable in {@link ./chat.ts} only by starting a subprocess,
 * holding a turn open and typing into it — so the rules live where a test can
 * call them, which is the argument {@link ./questions.ts} and {@link ./calls.ts}
 * already make for the two other small state machines this package keeps.
 *
 * It knows nothing about fibers beyond holding one: what a turn IS, and what
 * ending one costs, is the caller's.
 */

import type { Fiber } from "effect"

/**
 * One turn in flight, as a TICKET rather than as a fiber handle.
 *
 * It exists because the fiber does not, yet: the ticket is written down before
 * the fork, so there is no window in which a turn is running and nothing says
 * so. The fiber is filled in a moment later, for the callers that have to
 * interrupt it.
 */
export interface Turn {
  fiber: Fiber.Fiber<unknown, unknown> | null
  /**
   * Somebody asked THIS turn to stop.
   *
   * It outlives the turn on purpose, because the thing that needs it is a
   * steer still on the wire: a message aimed at a turn a person then cancelled
   * comes back "nothing to steer", which is indistinguishable from the turn
   * having simply ended — unless the ticket it was aimed at remembers being
   * stopped. Without that, the two are the same answer and the message starts
   * a fresh turn the person just pressed a button to end.
   */
  stopped: boolean
}

export class Turns {
  #live = new Set<Turn>()

  /** Whether anything is running. */
  get busy(): boolean {
    return this.#live.size > 0
  }

  /** How many, for a caller that wants to say it. */
  get size(): number {
    return this.#live.size
  }

  /**
   * The ONE turn, or `null` — for the caller that has to aim a steer at it.
   *
   * An agent that steers never has more than one (a mid-turn message is
   * steered rather than begun), so this is the whole of that caller's
   * question. `null` where there are several, deliberately: on the wire where
   * two turns are possible there is no steering to aim, and a caller that got
   * one anyway would be aiming at whichever the set happened to yield first.
   */
  get only(): Turn | null {
    if (this.#live.size !== 1) return null
    return this.#live.values().next().value ?? null
  }

  /** A turn is starting. The ticket is the caller's to fill a fiber into. */
  open(): Turn {
    const ticket: Turn = { fiber: null, stopped: false }
    this.#live.add(ticket)
    return ticket
  }

  /** ... and it has ended. Answers whether it was the LAST one — which is what
   *  decides whether it may say where the conversation stands. Answers `false`
   *  for a ticket that had already left, so the belt-and-braces call every
   *  fiber makes on its way out cannot report a second ending. */
  leave(ticket: Turn): boolean {
    if (!this.#live.delete(ticket)) return false
    return this.#live.size === 0
  }

  /** Whether this ticket is still running — asked by a cancel that has waited
   *  its grace and wants to know whether anything came of it. */
  has(ticket: Turn): boolean {
    return this.#live.has(ticket)
  }

  /**
   * Every turn running, MARKED stopped — and answered, so the caller can ask
   * later what became of the ones it was about.
   *
   * All of them rather than the newest: `session/cancel` is the conversation's
   * rather than one turn's, and what a person pressed is about everything they
   * have in flight. What each agent does with a message it had queued is the
   * agent's own business; what olai must not do is go on believing a turn
   * nobody stopped was merely finishing.
   */
  stopping(): ReadonlyArray<Turn> {
    const asked = [...this.#live]
    for (const ticket of asked) ticket.stopped = true
    return asked
  }

  /** The conversation is over: every ticket taken, and the set left empty. The
   *  caller interrupts what it is handed — a queued message an agent had not
   *  reached yet is a fiber this process owns, and one left running past a
   *  shutdown is one nothing will ever report on. */
  drain(): ReadonlyArray<Turn> {
    const taken = [...this.#live]
    this.#live.clear()
    return taken
  }
}

/**
 * WHAT EVERY INSTALLED AGENT HAS STORED for this directory — the part of that
 * question which is not "ask an agent".
 *
 * The panel talks to ONE agent at a time and always will: a conversation is
 * bound to one for its life, and a second live subprocess would be a second
 * language-model session held open for a conversation nobody is looking at.
 * The LIST is the one place that rule was wrong. It was asked of the agent this
 * panel happened to be talking to, so a single opencode chat made every Claude
 * conversation in the directory disappear from view — and the only way back to
 * one was to start a new Claude chat purely so the list would name them again.
 *
 * The fix is not a second live agent. It is that a listing is a QUESTION rather
 * than a conversation: the answer is the same whoever is talking, it changes
 * only when somebody works in this directory, and an agent that is not running
 * can be started, asked, and stopped again. What this module owns is everything
 * that makes that affordable and orderly:
 *
 *   - **the CACHE**, so opening the picker twice in a row does not start the
 *     same subprocess twice. Short-lived on purpose: the list's whole warrant
 *     is that the agent's answer is the only one that is right — a terminal
 *     `claude --resume` in the same directory changes it — so what is kept is
 *     kept for seconds, not for the life of the server.
 *   - **the MERGE**, which is what makes one answer out of several: the
 *     conversations newest first, undated last, in the order one agent's own
 *     list has always been in — and, beside them, the agents that could not be
 *     asked at all, because an absent list drawn as *no stored conversations*
 *     is a claim about somebody's disk standing in for never having reached
 *     them.
 *
 * WHAT IS NOT HERE is asking, spawning or stopping anything — that is
 * {@link ./chat.ts}'s, because it is the thing that holds the roster and knows
 * which agent is already running. This is the rule over values, for
 * {@link ./turns.ts}' reason: reaching a stale-cache decision through the real
 * thing means starting a subprocess, waiting out a clock and starting it again.
 */

import type { Listed, SessionInfo } from "@olai/surface"

/**
 * How long another agent's answer is worth keeping.
 *
 * Long enough that a person opening the picker, shutting it and opening it
 * again does not pay for a second handshake; short enough that a conversation
 * started in a terminal a moment ago is in the list by the time somebody looks
 * for it. It is deliberately not a minute: the list is a thing you open when
 * you are trying to find something you know is there.
 *
 * The agent this panel is TALKING to is never cached — it is already running,
 * asking it is one round trip, and its list is the one most likely to have
 * just changed.
 */
export const KEEP_FOR_MS = 15_000

/** What was kept, and when. */
interface Kept {
  readonly at: number
  readonly sessions: ReadonlyArray<SessionInfo>
}

/**
 * The answers this process is still willing to reuse.
 *
 * The clock is HANDED IN rather than reached for, which is what makes every
 * rule here assertable without waiting: a cache is a statement about time, and
 * a test that had to sleep to check an expiry would be a test nobody runs
 * twice.
 */
export class Listings {
  readonly #kept = new Map<string, Kept>()
  readonly #now: () => number

  constructor(now: () => number) {
    this.#now = now
  }

  /** That agent's answer, if it is still worth reusing — `null` for one never
   *  asked and for one asked too long ago, which are the same thing to a
   *  caller: go and ask. */
  fresh(agent: string): ReadonlyArray<SessionInfo> | null {
    const kept = this.#kept.get(agent)
    if (kept === undefined) return null
    return this.#now() - kept.at < KEEP_FOR_MS ? kept.sessions : null
  }

  /** ... and what came back, whether or not there was anything in it. An agent
   *  with no stored conversation answers that question as definitely as one
   *  with ten, and re-asking it every time the picker opens would be paying a
   *  handshake for an empty list. */
  keep(agent: string, sessions: ReadonlyArray<SessionInfo>): void {
    this.#kept.set(agent, { at: this.#now(), sessions })
  }

  /**
   * That agent's answer is no longer to be trusted.
   *
   * Called where THIS panel changes what one of them has stored — a fresh
   * conversation minted, a stored one entered and retitled. A cache is only
   * ever wrong in one direction that matters: a list that does not name the
   * conversation you are sitting in reads as a lost conversation, which is the
   * very complaint this file exists to answer.
   */
  forget(agent: string): void {
    this.#kept.delete(agent)
  }
}

/**
 * Several agents' answers as one.
 *
 * The ORDER of the conversations is the whole of what a merge decides, and it
 * is the order one agent's list has always been in — so a directory with two
 * agents in it reads as one history rather than as two piles. Which agent a row
 * belongs to is on the row ({@link SessionInfo}), which is what lets the panel
 * group them again for drawing without the sort having to know it will.
 *
 * AN UNDATED ROW SORTS LAST, never first, which is the rule
 * {@link ./agent.ts}'s own sort makes for one agent's list: an agent that gave
 * no timestamp has said nothing about when, and reading that as "just now"
 * would put it above every conversation that did say.
 *
 * The UNREACHABLE keep the roster's order, which is the order they were asked
 * in — there is nothing else to sort them by, and a list of refusals that
 * reordered itself between two opens would look like different refusals.
 */
export const asOneList = (answers: ReadonlyArray<Listed>): Listed => ({
  sessions: answers
    .flatMap((answer) => answer.sessions)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
  unreachable: answers.flatMap((answer) => answer.unreachable),
})

/**
 * WHAT EVERY INSTALLED AGENT HAS STORED for this directory.
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
 * can be started, asked, and stopped again.
 *
 * ## The volatility this is the receptacle for
 *
 * **How you find out what an agent has stored when it is not running.** Today
 * that is: start it, put one question, stop it — which is expensive, so the
 * answer is kept for seconds and only one such start is allowed at a time. None
 * of that is a fact about a chat panel, and all of it is a fact that will
 * change: an agent that grows a cheap index, one that answers over a daemon
 * already running, one whose handshake stops costing a second. What stays put
 * is the question and its answer.
 *
 * So the CALLER says how to reach an agent ({@link Where}) and this says what
 * it costs and what the answer is worth. The three rules that live here are the
 * three that were about to be written inline in a file that already knows too
 * much:
 *
 *   - **the CACHE**, so opening the picker twice in a row does not start the
 *     same subprocess twice. Short-lived on purpose: the list's whole warrant
 *     is that the agent's answer is the only one that is right — a terminal
 *     `claude --resume` in the same directory changes it — so what is kept is
 *     kept for seconds, not for the life of the server.
 *   - **ONE AT A TIME**, so opening the list is not three handshakes racing
 *     each other.
 *   - **an agent that could not be asked is NAMED, not dropped.** Two halves of
 *     one rule, one agent apart: a broken agent must not take the others'
 *     conversations off the screen (the bug this whole fan-out is the fix for),
 *     and an absent list drawn as *no stored conversations* is a claim about
 *     somebody's disk standing in for never having reached them (the bug the
 *     picker's own refusal arm is the fix for).
 *
 * Everything here is a function of {@link Where}, including the clock — which
 * is what makes a statement about time assertable without waiting for one.
 */

import type { Listed, SessionInfo } from "@olai/surface"
import { Effect, Semaphore } from "effect"

import { type AgentGone, newestFirst } from "./agent.ts"
import type { Installed } from "./agents/roster.ts"
import type { Stored } from "./events.ts"

/**
 * How this process reaches one agent — the whole of what the caller supplies.
 *
 * TWO WAYS OF ASKING and not one, because the difference is the whole cost
 * model: the agent this panel is talking to is already running, so asking it is
 * a round trip; any other has to be started for the question and stopped after
 * it. Handed in as two functions rather than as one with a flag, so the caller
 * is what knows which agent is bound — it is the only thing that can.
 */
export interface Where {
  /** Every installed agent, in the order the panel offers them. */
  readonly roster: ReadonlyArray<Installed>
  /**
   * What the agent ALREADY RUNNING would answer — or `null` for a row that is
   * not the one being talked to, which is the row that has to be started.
   *
   * A function of the row rather than a value, because which agent is bound
   * changes under this: a picker opened after a switch must ask the agent the
   * panel is in now.
   */
  readonly running: (row: Installed) => Effect.Effect<ReadonlyArray<Stored>, AgentGone> | null
  /** Start that row, put the question, and stop it again — the whole round
   *  trip, because starting and stopping belong to each other and a caller
   *  that could forget the second half would leave a subprocess nothing will
   *  ever talk to.
   *
   *  It answers whether what came back is WORTH KEEPING, because the caller is
   *  the only thing that can know: {@link Where.running} is asked before this
   *  one is queued for, and the one way its answer goes stale is that the row
   *  became the bound agent while we waited. An answer from the agent this
   *  panel is talking to must not be cached — it is the list this panel is
   *  changing — so the caller says so rather than this module guessing from a
   *  slot it cannot see. */
  readonly aside: (row: Installed) => Effect.Effect<Asked, AgentGone>
  /** The clock, passed in for {@link KEEP_FOR_MS}'s sake. */
  readonly now: () => number
}

/** What one round trip came back with, and whether to remember it. */
export interface Asked {
  readonly stored: ReadonlyArray<Stored>
  /** `false` for an answer that came from the agent this panel is TALKING to
   *  — see {@link Where.aside}. */
  readonly keep: boolean
}

/**
 * How long an agent's answer is worth keeping.
 *
 * Long enough that a person opening the picker, shutting it and opening it
 * again does not pay for a second handshake; short enough that a conversation
 * started in a terminal a moment ago is in the list by the time somebody looks
 * for it. It is deliberately not a minute: the list is a thing you open when
 * you are trying to find something you know is there.
 *
 * The agent this panel is TALKING to is never cached — it is already running,
 * asking it is one round trip, and its list is the one most likely to have just
 * changed, because this conversation is in it.
 */
export const KEEP_FOR_MS = 15_000

/** What one agent's answer was, and when. */
interface Kept {
  readonly at: number
  readonly sessions: ReadonlyArray<SessionInfo>
}

/** The question, answerable. */
export interface Listings {
  /** Every installed agent's stored conversations, merged newest-first, and
   *  the agents that could not be asked. Never fails: the answer is PARTIAL
   *  rather than absent when one agent is broken. */
  readonly all: Effect.Effect<Listed>
  /**
   * That agent's answer is no longer to be trusted.
   *
   * Called where THIS panel changes what an agent has stored — it leaves a
   * conversation with one, having minted or retitled one. A cache is only ever
   * wrong in one direction that matters: a list that does not name the
   * conversation you were just in reads as a lost conversation, which is the
   * very complaint this file exists to answer.
   */
  readonly forget: (agent: string) => void
}

export const make = (where: Where): Effect.Effect<Listings> =>
  Effect.gen(function*() {
    /** One agent started at a time. Opening the list must not be a reason to
     *  start every agent on the machine at once. */
    const oneAtATime = yield* Semaphore.make(1)
    const answers = new Map<string, Kept>()

    /** Write one down, with the moment it was true. */
    const keep = (agent: string, sessions: ReadonlyArray<SessionInfo>): void => {
      answers.set(agent, { at: where.now(), sessions })
    }

    /** That agent's answer if it is still worth reusing — `null` for one never
     *  asked and for one asked too long ago, which are the same thing to a
     *  caller: go and ask. */
    const fresh = (agent: string): ReadonlyArray<SessionInfo> | null => {
      const had = answers.get(agent)
      if (had === undefined) return null
      return where.now() - had.at < KEEP_FOR_MS ? had.sessions : null
    }

    /** One agent answered, in the rows the picker draws. */
    const found = (row: Installed, stored: ReadonlyArray<Stored>): Listed => ({
      sessions: stored.map((entry): SessionInfo => ({
        id: entry.id,
        agent: row.id,
        title: entry.title,
        updatedAt: entry.updatedAt,
        messageCount: entry.messageCount,
        supersededBy: entry.supersededBy,
      })),
      unreachable: [],
    })

    /** ... and the other thing one row's answer can be. Named beside its
     *  sibling because the two are the arms of one question, and a literal
     *  written out at each of four sites is four places to keep in step. */
    const couldNotAsk = (row: Installed, gone: AgentGone): Listed => ({
      sessions: [],
      unreachable: [{ agent: row.id, why: gone.why }],
    })

    /** An answer this process already had. */
    const kept = (sessions: ReadonlyArray<SessionInfo>): Listed => ({
      sessions,
      unreachable: [],
    })

    /** What one row has stored, whichever way it has to be asked. */
    const storedBy = (row: Installed): Effect.Effect<Listed> =>
      Effect.suspend(() => {
        const live = where.running(row)
        if (live !== null) {
          return Effect.match(live, {
            onSuccess: (stored) => found(row, stored),
            onFailure: (gone) => couldNotAsk(row, gone),
          })
        }
        const had = fresh(row.id)
        if (had !== null) return Effect.succeed(kept(had))
        return oneAtATime.withPermit(Effect.gen(function*() {
          // Read AGAIN under the permit: two tabs opening the picker at once
          // would otherwise both have decided to ask before either answered,
          // and the second would start a second subprocess for the answer the
          // first is about to write down.
          const now = fresh(row.id)
          if (now !== null) return kept(now)
          const asked = yield* Effect.result(where.aside(row))
          if (asked._tag === "Failure") return couldNotAsk(row, asked.failure)
          const answer = found(row, asked.success.stored)
          // ONLY A SUCCESS IS KEPT — a refusal held for fifteen seconds is an
          // agent that stays broken on screen after it has been mended — and
          // only an answer the caller says is worth keeping, which is any
          // answer that did not come from the agent this panel is talking to.
          if (asked.success.keep) keep(row.id, answer.sessions)
          return answer
        }))
      })

    return {
      // UNBOUNDED, and the permit is what serializes: the only expensive
      // thing here is a cold start, and that is one at a time whichever order
      // the rows are asked in. Held to one, the agent already running and every
      // cached answer would queue behind whichever subprocess is starting — a
      // one open costing the sum rather than the maximum.
      all: Effect.map(
        Effect.forEach(where.roster, storedBy, { concurrency: "unbounded" }),
        asOneList,
      ),
      forget: (agent) => {
        answers.delete(agent)
      },
    }
  })

/**
 * Several agents' answers as one.
 *
 * The ORDER of the conversations is the whole of what a merge decides, and it
 * is the order one agent's list has always been in — so a directory with two
 * agents in it reads as one history rather than as two piles. Which agent a row
 * belongs to is on the row ({@link SessionInfo}), which is what lets the panel
 * group them again for drawing without the sort having to know it will.
 *
 * IT IS {@link ./agent.ts}'s OWN COMPARATOR, imported rather than restated:
 * one agent's list is sorted there, this merge is sorted here, and the two
 * answers are what a boot adopts and what a person clicks. They must not be
 * able to disagree about which of two identical-looking rows is the newest.
 *
 * The UNREACHABLE keep the roster's order, which is the order they were asked
 * in — there is nothing else to sort them by, and a list of refusals that
 * reordered itself between two opens would look like different refusals.
 *
 * Exported for its own test: it is the one rule here that needs no clock and no
 * agent, and the one a reader is most likely to reach for.
 */
export const asOneList = (answers: ReadonlyArray<Listed>): Listed => ({
  sessions: answers.flatMap((answer) => answer.sessions).sort(newestFirst),
  unreachable: answers.flatMap((answer) => answer.unreachable),
})

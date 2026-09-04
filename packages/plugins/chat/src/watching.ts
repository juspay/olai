/**
 * WHAT THIS CONVERSATION STILL HAS OUT — the strip's list, and whether it has
 * moved.
 *
 * Lifted out of {@link ./chat.ts}'s closure, where it was the one thing that
 * needed nothing from it: it reads rows and answers a list, and every rule it
 * keeps is a rule about rows. Inside the closure the only way to ask it
 * anything was to start a subprocess, hand-shake with it, talk it into a
 * fan-out and read the published cell — which is a great deal of machinery
 * between a reader and *is a stranded spawn on the strip?*, and that question
 * is worth more than the machinery. Here it is a function over values, asked
 * the way {@link ./turns.ts}'s and {@link ./calls.ts}' rules are.
 *
 * BOTH HALVES LIVE HERE because they are one thing said twice: WHAT the strip
 * says, and whether that is news. The second exists only to keep the first off
 * every open socket once per tool frame — so a field added to the list and
 * forgotten by the comparison is a cell that silently stops republishing, which
 * is a strip that goes on drawing something that has stopped being true.
 */

import { type ChatEntry, isAgentOut, isTaskOut, outSince, sentToDo, type Watching } from "olai-plugin-chat/wire"
/**
 * The background tasks this conversation armed and the agents it sent, read off
 * the ROWS rather than tallied beside them — {@link ./chat.ts}'s `asking` makes
 * the argument for that, and it is the same one: the fact is already written
 * down, and a counter kept alongside stays right only for as long as every
 * future writer remembers both.
 *
 * WHICH ROWS COUNT is `isAgentOut`'s and `isTaskOut`'s and not this file's —
 * the same rules the transcript's own stranding asks and the panel's rail asks,
 * in the surface beside the status vocabulary. Written out here the first
 * version was already wrong in one direction the others were not (it forgot the
 * status), which is a count that stays above zero after the last rail has gone
 * out — and a count above zero is a clock ticking in every open tab.
 *
 * THE AGENT WINS when a row is both, which an asynchronous `Agent` launch is:
 * it arms a harness task as well as sending somebody out. The precedence is the
 * surface's ({@link Watched}) and is spelled here as an ORDER OF TESTS rather
 * than as two pushes — a row can only be on this strip once, and the strip is
 * the door to a subagent's calls, which a task has nothing behind.
 */
export const watching = (
  entries: ReadonlyMap<string, ChatEntry>,
): ReadonlyArray<Watching> => {
  const out: Array<Watching> = []
  for (const [key, entry] of entries) {
    if (entry.kind !== "tool") continue
    // WHAT TO CALL IT is decided here because the fallback is a field of a row:
    // the description the task was armed with, and the call's own title when it
    // was armed with none (a `Monitor` reads better on a strip than nothing at
    // all does). A spawn's title IS the description it was sent with, so an
    // agent needs no fallback and is given the row's own name — the SAME string
    // the transcript draws on the spawning row, so the strip and the record
    // cannot come out reading as two things.
    //
    // ... and WHEN IT WENT OUT, which is the row's birth for a call on its first
    // outing and is not that for an agent somebody sent MORE WORK: the call
    // reopened for a resumed subagent is the one that spawned it, hours ago
    // ({@link @olai/surface}'s `outSince`, which the readout on the row's own
    // line asks too). A strip counting from the birth would meet a person
    // watching a minute-old resume with *running for 3h 12m*, which is the
    // shape of wrongness this strip exists to not have.
    if (isAgentOut(entry)) {
      out.push({
        row: key,
        kind: "agent",
        name: sentToDo(entry.spawned, entry.text),
        since: outSince(entry),
      })
    }
    else if (isTaskOut(entry)) {
      out.push({
        row: key,
        kind: "task",
        name: entry.armed?.description ?? entry.text,
        since: outSince(entry),
      })
    }
  }
  return out
}

/** Whether two answers to "what is still out" say the same thing — the guard on
 *  republishing the cell, and the reason that reading can be taken on every
 *  frame which could have moved it.
 *
 *  Field by field rather than by reference: the list is a PROJECTION of the
 *  rows, built fresh each time it is read (deliberately — that is what stops it
 *  drifting from the rows a person is reading), so a reference test would
 *  answer "moved" every time and put the whole cell on every open socket once
 *  per tool frame. */
export const sameWatching = (
  now: ReadonlyArray<Watching>,
  before: ReadonlyArray<Watching>,
): boolean =>
  now.length === before.length
  && now.every((task, at) =>
    task.row === before[at]?.row
    && task.kind === before[at]?.kind
    && task.name === before[at]?.name
    && task.since === before[at]?.since
  )

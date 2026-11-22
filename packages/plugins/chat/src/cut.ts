/**
 * TURNS A STOP CUT SHORT — the conversations whose agent was answering when
 * chat's activation stopped, so the next activation that opens one can say so.
 *
 * Chat stops its activation for reasons a person may not connect to the
 * conversation in front of them: a chat setting changed, chat switched off and
 * on, olai itself restarting. Each takes the agent with it, a turn in flight
 * included, and nothing the stopped turn would have said is published after the
 * stop ({@link ./chat.ts}'s `stopWithReason`). The panel that reopens the
 * conversation is a new one with no memory of the old, so without this record
 * a person reads their own message with no answer under it and no account of
 * why — the one state a panel here must never show in silence.
 *
 * ## What is in it
 *
 * An ENGINE and a SESSION, the pair a conversation is opened by, and nothing
 * about the turn itself: what the agent had said is the engine's to replay, and
 * the record only has to say that it stopped. An entry is TAKEN by the open
 * that reports it, so it is said once.
 *
 * ## Where it lives
 *
 * In chat's own machine-local document ({@link ./local.ts}), beside the live
 * set a restart reads to reopen these same conversations ({@link ./live.ts}).
 * Capped like it, newest first: a conversation nobody reopens loses its place
 * rather than growing the file.
 */

import { type ChatLocalState, word } from "./local.ts"
import { RECORDED } from "./live.ts"
import { MemoryFailure } from "@kolu/acp-client"
import { Effect } from "effect"

/** This record's section in chat's one machine-local document. */
const CUT = "cut"

/** The most cut turns kept: the live set's bound, so the two records that
 *  outlive a stop are capped alike. */
const KEPT = RECORDED

/** One conversation whose turn a stop cut short. */
export interface CutTurn {
  readonly agent: string
  readonly session: string
}

/** Note a cut turn, ask whether a conversation had one, and forget it once said. */
export interface CutRecord {
  readonly note: (turn: CutTurn) => Effect.Effect<void, MemoryFailure>
  readonly cutShort: (turn: CutTurn) => boolean
  readonly forget: (turn: CutTurn) => Effect.Effect<void, MemoryFailure>
}

const same = (one: CutTurn, other: CutTurn): boolean =>
  one.agent === other.agent && one.session === other.session

/** A legible entry, or nothing: a row without both halves names no conversation. */
const read = (held: Record<string, unknown> | null): ReadonlyArray<CutTurn> => {
  const rows = held?.["cut"]
  if (!Array.isArray(rows)) return []
  return rows.flatMap((one) => {
    if (one === null || typeof one !== "object") return []
    const row = one as Record<string, unknown>
    const agent = word(row["agent"])
    const session = word(row["session"])
    return agent === null || session === null ? [] : [{ agent, session }]
  })
}

/** The record over one activation's local document. */
export const forLocalState = (local: ChatLocalState): CutRecord => {
  let rows = read(local.load(CUT))
  const save = (next: ReadonlyArray<CutTurn>) =>
    Effect.gen(function*() {
      yield* local.save(CUT, { cut: next.map((row) => ({ agent: row.agent, session: row.session })) })
      rows = next
    })
  return {
    note: (turn) => save([turn, ...rows.filter((row) => !same(row, turn))].slice(0, KEPT)),
    cutShort: (turn) => rows.some((row) => same(row, turn)),
    forget: (turn) =>
      rows.some((row) => same(row, turn)) ? save(rows.filter((row) => !same(row, turn))) : Effect.void,
  }
}

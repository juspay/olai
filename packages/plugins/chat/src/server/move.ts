import {
  addressAt,
  declarationsOf,
  isPutAway,
  isRegular,
  type OpFailure,
  OPENS_ALONE,
  notesClaimed,
  notesIn,
  type PropDeclarations,
  type Reading,
  seatableNote,
  sessionIn,
  sessionValue,
  textDeclaredAs,
  titleAddress,
} from "@olai/format"
import { Effect } from "effect"

import { matterWritten, type Binding } from "./binding.ts"
import { OPENS_TYPE, ownKinds, SESSION_TYPE } from "../kinds.ts"

export interface Move {
  readonly row: string
  readonly path: string
  readonly value: string
  readonly untieOnly: boolean
}

export const movesIn = (
  reading: Pick<Reading, "set" | "claims" | "derived">,
  declarations: PropDeclarations,
): ReadonlyArray<Move> => {
  const ties = new Map(
    notesIn(reading.set, reading.claims, declarations, SESSION_TYPE, OPENS_TYPE)
      .map((note) => [note.file, sessionValue(note.engine, note.session)] as const),
  )
  const moves: Array<Move> = []
  const taken = new Set<string>()
  for (const located of reading.derived.nodes) {
    if (!isRegular(located) || isPutAway(reading.claims, located.file)) continue
    const held = textDeclaredAs(declarations, located.node, SESSION_TYPE)
    const said = held === undefined ? null : sessionIn(held)
    if (said === null) continue
    const written = titleAddress(located.node.title)
    if (written === undefined) continue
    const address = addressAt(reading.claims, written)
    if (address === null || (address.kind !== "document" && address.kind !== "heading")) continue
    const path = address.path
    if (taken.has(path)) continue
    if (!seatableNote(reading.set, reading.claims, path)) continue
    taken.add(path)
    const value = sessionValue(said.engine, said.session)
    const tie = ties.get(path) ?? null
    if (tie !== null && tie !== value) continue
    moves.push({ row: located.node.id, path, value, untieOnly: tie !== null })
  }
  return moves
}

export interface Mover extends Pick<Binding, "text" | "doc" | "remove" | "key" | "opensKey"> {
  readonly served: () => boolean
  readonly read: Effect.Effect<Reading, OpFailure>
  readonly log: (line: string) => Effect.Effect<void>
}

const namesNotes = (reading: Pick<Reading, "claims">): boolean =>
  notesClaimed(reading.claims.byKind.values())

/**
 * THE NOTE IS WRITTEN FIRST and the row untied second, which is the order that
 * makes a half-done run recoverable: a serve that stops between the two leaves
 * the note holding the same tie the row does, which is {@link movesIn}'s
 * second case and untied on the next boot. The other order would lose the
 * binding altogether.
 */
export const applyMoves = (mover: Mover): Effect.Effect<boolean, OpFailure> =>
  Effect.gen(function*() {
    if (!mover.served()) return false
    const reading = yield* mover.read
    if (!namesNotes(reading)) return false
    const moves = movesIn(reading, declarationsOf(reading.derived, ownKinds))
    for (const move of moves) {
      const done = yield* Effect.result(Effect.gen(function*() {
        if (!move.untieOnly) {
          yield* matterWritten(mover, move.path, [
            [mover.key(), move.value],
            [mover.opensKey(), OPENS_ALONE],
          ])
        }
        yield* mover.remove(move.row)
      }))
      yield* done._tag === "Success"
        ? mover.log(
          move.untieOnly
            ? `chat: \`${move.path}\` already held the chat of the row \`${move.row}\`; untied the row`
            : `chat: moved the chat of the row \`${move.row}\` onto \`${move.path}\``,
        )
        : mover.log(
          `chat: could not move the chat of the row \`${move.row}\` onto \`${move.path}\`: `
            + `${done.failure.message}`,
        )
    }
    return true
  })

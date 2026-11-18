/**
 * THE ONE-TIME MOVE — every chat that was a ROW standing in for a note, put on
 * the note itself.
 *
 * ## What it is about
 *
 * There was a window in which the chat about a page was an outline row whose
 * TITLE was a link to that page: `[plan](/notes/plan.md)` under Inbox › Chats,
 * carrying the tie and standing in for the file. A chat belongs to the thing it
 * is about now — a node or a note, one each — so those rows name a binding that
 * lives somewhere else, and nothing reads them any more. Left alone they would
 * be chats nobody could find: on the roster twice (once as the row, never as
 * the note), and a person opening the note would be offered a second one.
 *
 * So the server moves them, once, on the first reading of an activation: the
 * row's value is written into the note's front matter, and the property comes
 * off the row. The row itself stays exactly where it is — it is somebody's
 * outline, not olai's bookkeeping — and keeps its title; what it loses is a tie
 * that pointed at another file's conversation.
 *
 * ## THE RULE IS A PURE FUNCTION, and that is the whole of the design
 *
 * {@link movesIn} answers what to do about a reading, with nothing in hand but
 * that reading and the vault's declarations: which rows are candidates, which
 * note each one is about, and whether the note already carries the tie. A
 * one-time migration is the last place to find out in production that the
 * second run was not a no-op, so the question is asked where a test can ask it
 * fifty times about a set it built in four lines.
 *
 * ## The three cases, and why the third does nothing
 *
 * A note with NO tie takes the row's, plus `chat-opens: alone` — the switch the
 * person has not chosen yet, written out so the file says what it does rather
 * than relying on an absence. A note that ALREADY carries the same tie is a
 * move that was half done (olai wrote the note, then the serve stopped before
 * the row was untied): the note is right, so only the row is untied. A note
 * carrying a DIFFERENT tie has its own chat, and a migration that overwrote it
 * would throw away the conversation a person has been having with the note in
 * favour of one they stopped using — so both are left exactly as they are, and
 * the stray row keeps a tie somebody can close by hand.
 *
 * FIRST CANDIDATE PER NOTE WINS, in corpus order, for the reason the set's own
 * id index keeps the same rule: two rows titled for one note are one chat and a
 * copy of it, and the second would otherwise overwrite the first's work with
 * its own.
 */

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

/** ONE MOVE: the row to untie, the note to tie, the value they share, and
 *  whether the note already says it (in which case only the row moves). */
export interface Move {
  readonly row: string
  readonly path: string
  readonly value: string
  readonly untieOnly: boolean
}

/**
 * WHAT THIS READING ASKS FOR — in corpus order, at most one move per note and
 * at most one per row.
 *
 * A CANDIDATE is a regular, not-put-away node carrying a tie that names an
 * engine, whose TITLE is an address (`titleAddress`, then the grammar's own
 * `addressAt`) naming a document or a heading whose path is a note the
 * directory still holds and has not put away. Everything else keeps its agent
 * and is not touched: a row for a picture, for a whole outline, for a plugin's
 * page, and every ordinary row with a chat of its own.
 */
export const movesIn = (
  reading: Pick<Reading, "set" | "claims" | "derived">,
  declarations: PropDeclarations,
): ReadonlyArray<Move> => {
  // WHAT THE NOTES ALREADY SAY, through the format's own reading of them
  // rather than through a second walk of YAML blocks here: a note's tie is
  // `notesIn`'s answer, canonically spelled, and the comparison below is then
  // between two values written by one rule.
  const ties = new Map(
    notesIn(reading.set, reading.claims, declarations, SESSION_TYPE, OPENS_TYPE)
      .map((note) => [note.file, sessionValue(note.engine, note.session)] as const),
  )
  const moves: Array<Move> = []
  /** The notes already spoken for — by a move this walk made, or by a
   *  candidate it decided to leave alone. FIRST WINS, either way. */
  const taken = new Set<string>()
  for (const located of reading.derived.nodes) {
    if (!isRegular(located) || isPutAway(reading.claims, located.file)) continue
    const held = textDeclaredAs(declarations, located.node, SESSION_TYPE)
    const said = held === undefined ? null : sessionIn(held)
    if (said === null) continue
    const written = titleAddress(located.node.title)
    if (written === undefined) continue
    const address = addressAt(reading.claims, written)
    // A HEADING COUNTS AS ITS DOCUMENT, which is the coarseness a chat has
    // always had about a place: a conversation about `/notes/plan.md#dates` is
    // a conversation about the plan.
    if (address === null || (address.kind !== "document" && address.kind !== "heading")) continue
    const path = address.path
    if (taken.has(path)) continue
    if (!seatableNote(reading.set, reading.claims, path)) continue
    taken.add(path)
    const value = sessionValue(said.engine, said.session)
    const tie = ties.get(path) ?? null
    // THE NOTE'S OWN CHAT WINS. Nothing is written and nothing is untied: the
    // row goes on naming a conversation a person can close from the sidebar.
    if (tie !== null && tie !== value) continue
    moves.push({ row: located.node.id, path, value, untieOnly: tie !== null })
  }
  return moves
}

/** WHAT THE APPLIER REACHES: the two note doors and the row's property
 *  removal, which are the binding's own ({@link ./binding.ts}), plus the
 *  reading to judge, the one fact that says whether a reading is worth asking
 *  for at all, and somewhere to say what happened. */
export interface Mover extends Pick<Binding, "text" | "doc" | "remove" | "key" | "opensKey"> {
  /**
   * WHETHER THIS BUILD SERVES NOTES — the file-kind registry's own answer
   * (`@olai/format`'s `notesClaimed` over `FileKinds`), asked BEFORE the
   * directory is read.
   *
   * A chat moves onto a NOTE, so a serve with the markdown row switched off
   * has nothing this migration could ever do — and until this was asked, the
   * applier found that out by reading the whole vault, on every revision, for
   * the life of the process ({@link namesNotes} can only ever say *not yet*
   * there, so the one-shot never spends itself). A THUNK, because a row may
   * claim its kind after this activation started.
   */
  readonly served: () => boolean
  readonly read: Effect.Effect<Reading, OpFailure>
  readonly log: (line: string) => Effect.Effect<void>
}

/**
 * WHETHER THIS READING COULD HOLD A NOTE AT ALL — the one question that has to
 * be asked BEFORE a one-shot migration decides there is nothing to do.
 *
 * A serve's first readings are not the directory. The store opens on the
 * built-in vocabulary — outlines, and nothing else — and the kinds the plugins
 * teach (the markdown row's, which is what a note is written in) land a moment
 * later, on a revision of their own. On that earlier reading `demo.md` is not
 * a served file, its path names no address, and every chat row titled for a
 * note looks exactly like a chat row titled for nothing: `movesIn` answers the
 * empty list, truthfully, about a vault it is not yet being shown.
 *
 * A ONE-SHOT THAT RAN THERE WOULD BE SPENT, and the link-titled chat rows it
 * exists to move would stay rows for good, after a boot that logged nothing.
 * So the applier asks this first and says *not yet* rather than *nothing to do*.
 *
 * IT IS THE SECOND HALF OF A GUARD, not the whole of one. *Not yet* is only
 * an answer worth giving while a note's kind is still ON ITS WAY, and this
 * reading cannot tell that from a build serving no notes at all — so the
 * CALLER arms this on the registry saying the kind is claimed, and what is
 * left here is the window between that registration and the reading the gate
 * holds catching up (`../server.ts`'s `moveOnce`, `@olai/format`'s
 * `notesClaimed`, which is this same question asked of the registry).
 *
 * NO SUFFIX IS SPELLED, here or there: which file a note is written in is the
 * DIRECTORY's claim to make, and this asks the claim table exactly what
 * `isNotePath` asks it of one path.
 */
const namesNotes = (reading: Pick<Reading, "claims">): boolean =>
  notesClaimed(reading.claims.byKind.values())

/**
 * THE MOVE, APPLIED — once per activation, on the first reading that is the
 * whole directory, under the binding permit and before anything else writes a
 * tie.
 *
 * IT ANSWERS WHETHER IT RAN, which is {@link namesNotes}'s whole purpose: a
 * reading that cannot name a `.md` is a serve still coming up, and `false`
 * tells the caller to ask again rather than to stop asking.
 *
 * THE NOTE IS WRITTEN FIRST and the row untied second, which is the order that
 * makes a half-done run recoverable: a serve that stops between the two leaves
 * the note holding the same tie the row does, which is {@link movesIn}'s
 * second case and untied on the next boot. The other order would lose the
 * binding altogether.
 *
 * ONE FAILURE IS ONE MOVE'S. A note nothing can write — a document somebody is
 * holding open, a door refusing — is said in the log and the walk goes on: a
 * boot must not stop because one file of a vault would not take a key, and the
 * next activation tries that one again.
 */
export const applyMoves = (mover: Mover): Effect.Effect<boolean, OpFailure> =>
  Effect.gen(function*() {
    // THE REGISTRY FIRST, THE DIRECTORY SECOND: nobody serving notes pays a
    // vault walk for a migration about notes ({@link Mover.served}).
    if (!mover.served()) return false
    const reading = yield* mover.read
    if (!namesNotes(reading)) return false
    const moves = movesIn(reading, declarationsOf(reading.derived, ownKinds))
    for (const move of moves) {
      const done = yield* Effect.result(Effect.gen(function*() {
        if (!move.untieOnly) {
          yield* matterWritten(mover, move.path, [
            [mover.key(), move.value],
            // The note's chat opens on its own until somebody says otherwise
            // (`../kinds.ts`'s `chat-opens`, `@olai/format`'s own word).
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

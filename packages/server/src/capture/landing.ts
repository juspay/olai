/**
 * Where a capture lands — the inbox convention, read once for both doors.
 *
 * Two things capture into this directory and neither of them names a file: the
 * palette's `⌘K` `+` sends a line ({@link ../edit.ts}), and `POST /capture`
 * sends one from a share sheet, a script or another machine on the tailnet
 * ({@link ./route.ts}). Which outline the inbox IS, and whether there is one
 * yet, is the same question both times and the answer has to be the same —
 * which is why the resolution is here rather than in either of them.
 *
 * It answers with ONE request, and the choice between the two is the whole of
 * what this function does: `create` is refused for a file that exists and
 * `add` is refused for one that does not, so they are not interchangeable and
 * a caller cannot pick between them off a file list it happens to hold. Either
 * way it is one plan, one validation and one atomic write, so a capture that is
 * refused leaves nothing behind — not a half-filled inbox, and not an empty
 * file.
 *
 * WHICH file the inbox is is `@olai/format`'s ({@link inboxIn}) and not this
 * module's: it is a statement about what a served file IS by its name, the same
 * kind of thing `TRASH` is, and an agent capturing by hand has to be able to
 * read the same sentence rather than guess at a door's.
 *
 * WHERE ONE IS MINTED is `_olai/Inbox.olai` and not the root (`mintedInto`,
 * human 2026-08-20, reversing the ruling of the day before): the shelf's
 * argument read one convention over — a file olai made because somebody
 * pressed something is not one of the reader's own. The READING is untouched,
 * so a directory that already keeps an `Inbox.olai` at its root, or a
 * `notes/inbox.olai`, goes on capturing into the file it has and nothing
 * migrates.
 *
 * PURE, over a {@link Reading}, for the reason the keystroke resolver is: it is
 * a question about the set, answerable with a value and testable without a
 * server.
 */

import {
  type Capture,
  INBOX,
  inboxIn,
  mintedInto,
  outlinePaths,
  type Reading,
} from "@olai/format"
import type { Request } from "@olai/ops"

/**
 * A capture as one of OLAI'S OWN doors composes it: `@olai/format`'s
 * {@link Capture} without the one field that exists only to be refused.
 *
 * `after` is declared on a capture so that an agent writing the edge list
 * under the name `set_after` gives it is turned away by name rather than
 * having its dependency silently dropped (`@olai/format`'s `writing.ts`) — and
 * at the TOP of an `add` that same word means the sibling anchor, which is a
 * string. So the two spellings genuinely collide, and a door of ours spreading
 * a whole capture into an `add` is where the collision shows up. It is not a
 * problem to solve: nothing here writes the bent word, so the type says so.
 */
export type Capturing = Omit<Capture, "after">

/**
 * The one op a capture is.
 *
 * It takes a whole {@link Capture} rather than a title, and that is what lets
 * the HTTP door carry a note, a date and properties through the identical
 * resolution the palette's bare line goes through: the two ops that bring a
 * node into being take exactly the same fields (`@olai/format`'s `writing.ts`),
 * so a seed and an `add` are one value and this function never has to know
 * which fields a particular door fills in.
 *
 * NOTHING IS VALIDATED HERE. A blank title, a date that is not a date, a
 * property spelled like a field the format already has — each is refused by
 * the ops layer in its own words, which is the same sentence an agent's
 * `add_node` gets. A second rule here would be a door refusing something in
 * words no tool uses.
 */
export const captureInto = (at: Reading, capture: Capturing): Request => {
  const inbox = inboxIn(outlinePaths(at.set))
  return inbox === undefined
    ? { op: "create", file: mintedInto(INBOX), seed: capture }
    : { op: "add", file: inbox, ...capture }
}

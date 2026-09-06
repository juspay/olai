/**
 * THE CAPTURE ROW'S ONE AGENT VERB — a line into this directory's inbox, and
 * the only PLAN arm there is.
 *
 * It was an entry in `@olai/ops`' one closed `TOOLS` table, which meant a
 * general package named this row's vocabulary and a serve without this row
 * still offered an agent a `capture` nothing stood behind. A tool leaves with
 * the row that owns it now (juspay/olai#546).
 *
 * WHY IT IS A PLAN AND NOT A WRITE: every other write is aimed by its
 * arguments; a capture is aimed by a CONVENTION — the inbox this directory
 * happens to keep, or the one that gets minted holding it — so the request
 * cannot be known until the directory has been looked at. The resolver is PURE
 * over the outline PATHS, which is a reading every face can get, including one
 * on the far end of a socket with no store of its own.
 *
 * It was `POST /capture`, ~550 lines re-deriving for one verb what a tool table
 * gives every verb: a body schema, an identity rule, a status table and its own
 * writer. As one entry here it is instead the SAME verb an agent calls and the
 * same one `olai surface capture` calls, under one name, with one schema and one
 * attribution rule — which is what makes the CLI a client of this row rather
 * than a second door onto the directory.
 */

import { CaptureRequest, captureInto, capturingOf } from "@olai/format"
import { plan, type Tool } from "@olai/ops"
import { Result } from "effect"

export const tools: ReadonlyArray<Tool> = [
  plan(
    "capture",
    "Capture a thought",
    "Capture one line into this directory's inbox — the fastest way to get something out of your head and into the vault, from an agent or from a terminal. `title` is the row and `text` becomes its note; there is nothing else to say, which is the point. THERE IS NO WAY TO SAY WHERE: a capture lands at the top level of the inbox the directory has — `_olai/Inbox.olai` is minted when there is none — and where it really belongs is a decision made afterwards, in the app, which is what an inbox is for. It ARRIVES DATED, so it is on the day's journal page as well as in the inbox, which is the half a capture made while nobody was looking actually needs. And it is BORN `todo`: the Inbox door's badge counts the rows marked `todo` or `doing`, at any depth, and nothing else — an unmarked capture would be invisible to it. Date AND mark compose into DUE WORK, which is deliberate (ruled 2026-08-29): an away capture ticks that day's agenda, and shows overdue from the next morning until it is done or the date is struck. `captured-by` is written from the identity this door already has and there is no argument for it: a capture cannot say who made it.",
    CaptureRequest,
    (at, args) =>
      Result.succeed(captureInto(at.paths, capturingOf(args, at.login, at.now()))),
  ),
]

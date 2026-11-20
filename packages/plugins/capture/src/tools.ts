import { CaptureRequest, captureInto, capturingOf } from "@olai/format"
import { plan, type Tool } from "@olai/ops"
import { Result } from "effect"

export const tools: ReadonlyArray<Tool> = [
  plan(
    "add",
    "Capture a thought",
    "Capture one line into this directory's inbox — the fastest way to get something out of your head and into the vault, from an agent or from a terminal. `title` is the row and `text` becomes its note; there is nothing else to say, which is the point. THERE IS NO WAY TO SAY WHERE: a capture lands at the top level of the inbox the directory has — `_olai/Inbox.olai` is minted when there is none — and where it really belongs is a decision made afterwards, in the app, which is what an inbox is for. It ARRIVES DATED, so it is on the day's journal page as well as in the inbox, which is the half a capture made while nobody was looking actually needs. And it is BORN `todo`: the Inbox door's badge counts the rows marked `todo` or `doing`, at any depth, and nothing else — an unmarked capture would be invisible to it. Date AND mark compose into DUE WORK, which is deliberate (ruled 2026-08-29): an away capture ticks that day's agenda, and shows overdue from the next morning until it is done or the date is struck. `captured-by` is written from the identity this door already has and there is no argument for it: a capture cannot say who made it.",
    CaptureRequest,
    (at, args) =>
      captureInto(at.claims, at.outlineRow, at.paths, capturingOf(args, at.login, at.now())),
  ),
]

/**
 * THE TRASH ROW'S AGENT VERBS — the way back out of the pile, and the way to
 * end it.
 *
 * They were entries in `@olai/ops`' one closed `TOOLS` table, which meant a
 * general package named this row's vocabulary and a serve without this row
 * still offered an agent an `trash_empty` nothing stood behind. A tool leaves
 * with the row that owns it now (juspay/olai#546).
 *
 * THE UNIT IS THE WHOLE PILE, and that is the rule rather than an exception to
 * it: `trash_empty` names the `_olai/Trash.olai` the set already serves and
 * empties it whole — every record in it or none, and nothing that could name
 * part of one. `trash_restore` is the other half, and the only undo a RECORD
 * has; a file deleted has git's and nothing else's.
 */

import { EmptyRequest, UntrashRequest } from "@olai/format"
import { type Tool, write } from "@olai/ops"

export const tools: ReadonlyArray<Tool> = [
  write(
    "restore",
    "Put a subtree back",
    "Take a node and everything under it back OUT of `_olai/Trash.olai` — the inverse of `outlines_trash`. The subtree comes back intact with its ids, and it lands LAST among its new siblings (the trash does not record where in a row a node sat). Where it lands: by default the outermost scaffold title is the outline it came from, and the rest of the ancestor-title chain is matched inside that outline; the call is refused — naming what it found — when that file is gone or the chain matches nowhere or more than one place; give `parent` (it goes under that node) or `file` (top level of that outline) to decide instead. An ancestor the removal leaves empty in the trash is tidied away, provided it is the bare title scaffold `outlines_trash` wrote and nothing still names it. Work in the trash is over, so nothing in it is unfinished — and that exemption ends HERE, in both directions. A subtree holding a `todo` or `doing` that comes back under a `done` ancestor takes that ancestor's mark off; and any `done` INSIDE what comes back, standing over unfinished work in it, comes off too — those marks were true while the branch was over and are false the moment it is live again. The answer's `nudge` names every one of them. Nothing is refused: the trash is not a place you can edit a mark, so a refusal would strand the subtree there.",
    UntrashRequest,
    { op: "untrash" },
  ),
  write(
    "empty",
    "Empty the trash",
    "PERMANENTLY DELETE every record in `_olai/Trash.olai`. This is one of the two writes in this whole surface that destroys rather than moves — `files_delete` destroys FILES; this one destroys RECORDS — and the record's node-and-all story is the pile's: `outlines_trash` puts a node away, `trash_restore` is the way out of it, and this is what stops carrying the pile. What survives is whatever git had already recorded — the file is rewritten with no records in it, through the same gate and the same commit door as every other write — so a directory with no history, or one whose trash was never committed, keeps nothing.\n\nIT NAMES THE TRASH AND NEVER A NODE. There is no way here to delete ONE row out of the trash; the unit is the pile, exactly as a bin is emptied rather than picked through. Name `_olai/Trash.olai` (`outlines_map` says the files the set holds). A leftover `Archive.olai` is not the trash and is refused.\n\nREFUSED four ways, and the fourth is the one to plan around: an outline the set does not hold, an outline that is not the trash (nothing here deletes out of a live outline — `outlines_trash` is how a node leaves one), a trash that holds nothing, and — the important one — a record OUTSIDE the trash still pointing into it. Ids move with a node when it is put away, so a mirror, a `see` or an `after` written in a live outline goes on resolving at what was put away; deleting those records would leave it naming ids nothing declares. A PROPERTY COUNTS TOO where the vault declared its key `ref` or `node` in `_olai/Properties.olai` — such a value is a reference, and the refusal names it with the key as the field. The refusal names each such record with its `file:line` and the field it points with. Re-point or retire them, or `trash_restore` what they name back out, and call again. The `.md` a `doc` field named is a FILE and is never touched.\n\n`was` IS THE COUNT YOU EXPECT — optional, and worth sending whenever a number was shown to somebody. A write is re-planned against a newer snapshot when the store moves under it, and a re-plan of this one silently widens: a node put away in between goes too. With `was`, that is a refusal naming both counts instead.",
    EmptyRequest,
    { op: "empty" },
  ),
]

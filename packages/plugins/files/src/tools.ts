/**
 * THE FILE ROW'S AGENT VERBS — one FILE made, one FILE gone, and nothing
 * between them that names a byte.
 *
 * They were entries in `@olai/ops`' one closed `TOOLS` table, which meant a
 * general package named this row's vocabulary and a serve without this row
 * still offered an agent a `files_delete` nothing stood behind. A tool leaves
 * with the row that owns it now (juspay/olai#546) — and these two are here
 * rather than beside the outline verbs because `create` and `delete` are cases
 * of THIS row's dispatch ({@link ./surface.ts}), which is what actually answers
 * them.
 *
 * THE UNIT IS A FILE, which is the fourth unit this surface admits and the one
 * that cost the most to say honestly: its undo story is GIT's rather than the
 * set's. `trash_restore` puts a record back; nothing spells a file back. What a
 * `files_delete` call can refuse YOU against is as long as what it can do, which
 * is argued where the request is declared (`@olai/format`'s `DeleteRequest`)
 * and said again in the tool's own description, because the description is the
 * agent's only manual.
 */

import { CreateRequest, DeleteRequest } from "@olai/format"
import { type Tool, write } from "@olai/ops"

export const tools: ReadonlyArray<Tool> = [
  write(
    "create",
    "Create an outline",
    "Start a new outline file under the served directory. `file` is a relative `.olai` path (no absolute paths, no `..`); refused if that file already exists. This is how a brand-new outline is born: `outlines_add` only writes into outlines that are already loaded.\n\nSEED IT WITH EVERYTHING YOU ALREADY KNOW. `seed` is a whole capture — the same fields and the same nested `children` `outlines_add` takes — so a new outline and the dozen nodes in it are ONE call: one validation, one atomic write, one commit. A seed that is refused anywhere in its tree leaves NO file behind, which is why this beats creating an empty outline and filling it afterwards (that way, a refused second call leaves an empty outline nobody asked for). Create without a `seed` only when you genuinely do not know yet what goes in it; `outlines_add` fills it later, and takes the same `children`. A seed meets the same refusals a capture does, including the one that matters here: a node born `done` with an unfinished task born under it in the same call is refused, and no file is created.\n\nTWO FILENAMES ARE A CONVENTION rather than a choice, and both are minted under `_olai/` — where olai puts the files it names itself, rather than at the top level of somebody else's directory. `_olai/Inbox.olai` is where a captured line goes when the directory has no inbox yet, and `_olai/Pins.olai` is where a pin goes when it has no shelf (`outlines_index` says how to look for either one first, and how a directory that keeps its own elsewhere is found — the reading is by NAME, wherever the file sits, and only the mint is written here). Seed it with the line or the address — one call, so a refused write leaves no empty file behind.",
    CreateRequest,
    { op: "create" },
  ),
  write(
    "delete",
    "Delete a file",
    "Remove ONE file entirely: a `.md` document of any content, or an `.olai` outline holding NO records. The file leaves the served directory, the sidebar and every live collection on the write's own revision, and waits for `git_commit` like any other write — which is also the undo story, the whole of it: there is no file-level trash in olai, and what survives a delete is whatever git had already recorded, because the write rides the same gate and the same commit door as every other. `trash_restore` puts a RECORD back; nothing spells a FILE back.\n\nREFUSED five ways, and each names what to settle first. An outline still carrying RECORDS is refused, naming them — this is a delete, not a move: `outlines_trash` is how a record leaves an outline, and what empties one entirely is nobody's verb to guess (nor is this the way to empty the TRASH — `trash_empty` is what deletes records, and its unit is the pile; name it, never a row). A DOCUMENT still NAMED is refused, naming the records that name it: a `doc` field, or the value of a key declared `doc` in `_olai/Properties.olai` — deleting under them would leave them pointing at nothing, which is the finding the validator would print on the next load, said early. A path the set does not hold is refused with the closest path it does. And a file the set could not READ — an outline whose lines did not parse, a document that would not open — is refused with the validator's own rows, because dropping bytes nobody has seen is not a delete, it is a loss.\n\nWHAT IS NOT SAID. A `.html`, `.csv`, picture or `.pdf` is a file olai only SHOWS and never writes — refused, however empty: it belongs to whatever put it there. A pin or shelf row into the file goes dead as an honest dead row (re-pinning is the fix), a markdown link into it is just a link that no longer opens, and a `path`-typed property PROMISES a shape and never an existence — so none of those is yours to settle first. Only a `doc` is: it promised its value names something served.\n\nNOT IN `outlines_apply`, with the other file verbs: each is already atomic over the thing it makes, and a mistyped path has no business in somebody else's transaction. There is no `was`: the path IS the condition — a delete of a file that is not exactly as asked is refused, which is the whole of what a conditional could add here.",
    DeleteRequest,
    { op: "delete" },
  ),
]

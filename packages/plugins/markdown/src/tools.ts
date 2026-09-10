/**
 * THE DOCUMENT ROW'S AGENT VERBS — the four tools that name a whole `.md`.
 *
 * They were entries in `@olai/ops`' one closed `TOOLS` table, which meant a
 * general package spelled this row's vocabulary and a serve without this row
 * still advertised `markdown_read` to an agent nothing would answer. A tool
 * leaves with the row that owns it now (juspay/olai#546).
 *
 * THE UNIT IS A WHOLE DOCUMENT, and it is the closest this surface comes to
 * file access while deliberately not being it: these four name a `.md` the SET
 * serves and carry its text ENTIRELY — `markdown_write` through the same plan →
 * validate → stage → rename → commit gate every other write goes through,
 * `markdown_read` out of the same snapshot every other read answers from — so
 * there is no offset, no range and nothing for a caller to splice at either
 * end. `markdown_index` is that closure said out loud: what an agent may read
 * is what the served set holds, so the listing IS the namespace and there is no
 * directory walk under it.
 *
 * THE READS CAME LATE (`md-second-class`) and their absence was not a policy:
 * an agent could `markdown_create` a file it could never read back, and
 * `markdown_write`'s `was` — the conditional write that refuses to land on
 * words nobody saw — asked callers for text no tool of theirs could fetch. A
 * surface with a write and no read is not a narrow surface, it is a broken one.
 */

import {
  CreateDocumentRequest,
  DocumentAnswer,
  DocumentBody,
  DocumentRequest,
  WriteDocumentRequest,
} from "@olai/format"
import { NoArgs, read, type Tool, write } from "@olai/ops"

export const tools: ReadonlyArray<Tool> = [
  read(
    "index",
    "List documents",
    "Every document under the served directory — every `.md` the set serves — with the line it opens with, how big it is, and the named facts its frontmatter writes. The map for the other kind of file, exactly as `outlines_index` is the map for the outlines: enough to choose one, never the text of all of them.\n\n`title` IS DERIVED, NOT DECLARED. It is the document's first non-blank line with its heading marks taken off (`# Finishes` is a document called Finishes), because a `.md` has no record for a name to be written on — it is the same line the app draws under a node that attaches one. Empty for a document holding nothing. `bytes` is what its text weighs as UTF-8, which is what to decide with before asking for the whole of it.\n\n`props` is the YAML block at the top of the file — the same open map a `prop:` query answers with and a node's `custom` is. Omitted when the document wrote none, so a listing of files that have no frontmatter does not grow an empty map per row. Present, the keys are in the file's canonical order. A `date:` here is a property named date, not the journal's day; a `done:` is a property, not a mark.\n\nWHAT IS NOT IN IT is a `.html` the directory holds: the app shows those and the set keeps their path without their body, so there is nothing for `markdown_read` to answer about one and nothing here to measure. `document` is the same word `markdown_create` and `markdown_write` use, and this is the listing those two are read against — what is here is what they take.\n\nA FILE THE SET COULD NOT READ is still here, carrying `unreadable` — its own errors — INSTEAD of a title and a size, because neither is known for a file nobody read. So a row is one shape or the other, never an empty title standing in for a name nobody has. It carries no `props` either: nobody read the block.",
    NoArgs,
    DocumentAnswer,
    (asking) => asking.documents,
  ),
  read(
    "read",
    "Read a document",
    "One document, whole and verbatim: the text `markdown_write` would replace, out of the same snapshot every other read here answers from. `file` is a `.md` path exactly as `markdown_index` lists it.\n\nREAD BEFORE YOU WRITE, and pass back what you read as `markdown_write`'s `was`. That makes the write CONDITIONAL: if the document changed since — another editor, a `git pull` — the write is refused instead of landing on top of words you have not seen. Reading, editing the text you were given and writing it back is the whole loop, and it is the only one there is: there is no offset and no line range at either end, because a document is one text.\n\nREFUSED, NOT ANSWERED EMPTY, when the path is not one. A path the set does not hold comes back with the closest one that does, in the same words `markdown_write` refuses a missing path in — one typo, one answer, whichever verb you typed it at. A `.html` is refused the same way: the set keeps its path and not its body. And a file the directory holds but could NOT read is refused with the validator's own rows, because handing back an empty text for a file that is not empty would be a lie an edit is then written against.\n\nMarkdown, stored exactly as on disk and interpreted only at view time. Nothing here parses it, and nothing about it is validated.",
    DocumentRequest,
    DocumentBody,
    (asking, args) => asking.document(args),
  ),

  write(
    "create",
    "Create a document",
    "Start a new `.md` document under the served directory. `file` is a relative `.md` path (no absolute paths, no `..`, and nothing under a directory the serve's walk prunes — one starting with `.`, or `node_modules` — because a create there lands a file no reader can see); refused if that document already exists — `markdown_write` is what edits one, and the split is what keeps a typo from minting a file. `text` is what it is born holding; absent creates it empty. The new document joins the set on the write's own revision, so the sidebar and every open tab see it immediately, and the write lands and waits for `git_commit` like any other.\n\nTHE SUCCESS MEANS THE BYTES ARE THERE. After the write lands, the file is read back off the disk before the revision is answered, and a file holding anything but `text` is refused — with what the disk DOES hold, the revision it still published, and `markdown_write` as the way back (the file exists now, so a second create is refused).\n\nWHERE IT GOES IS A CONVENTION YOU READ, NOT ONE YOU PICK. This directory is somebody's vault and it already has a shape: look at `markdown_index` before choosing a path, and put the new file where its neighbours are. That matters most for a DAY'S NOTE, whose name is the whole of what makes it one (a basename that is exactly an ISO date, `2026-08-13.md`): a vault keeping `Daily/2026/08/2026-08-12.md` wants `Daily/2026/08/2026-08-13.md`, and the same file at the root is a second convention nobody asked for. The web's calendar derives exactly that from the newest existing daily note; there is no separate op for it because the answer is a path, and this is the tool that takes one.",
    CreateDocumentRequest,
    { op: "create-doc" },
  ),
  write(
    "write",
    "Write a document",
    "Replace a document's text, whole and verbatim. `file` names a `.md` the set already holds (refused with the closest path otherwise); `text` is the entire new content — markdown, stored exactly as given, interpreted only at view time, never validated. Read the document first (`markdown_read`) and pass what you read back as `was` to make the write CONDITIONAL: if the file has changed since — another editor, a `git pull` — the write is refused instead of landing on top of words you have not seen, and the answer says to read again. Omit `was` only when overwriting whatever is there is what you mean. The write lands on disk, reaches every open page on its own revision, and waits for `git_commit`. And the success is EARNED, not reported: the landed file is read back off the disk first, and one holding anything but `text` is refused — with what it holds, the revision it still published, and this same verb as the way back.",
    WriteDocumentRequest,
    { op: "doc" },
  ),
]

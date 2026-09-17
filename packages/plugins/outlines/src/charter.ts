/**
 * WHAT A NOTE IS FOR — the one paragraph this row tells an agent about itself,
 * carried on its sibling entry beside the tools it brings and read by
 * `olai-plugin-mcp` into `initialize`'s `instructions` while this row stands
 * (`olai-plugin-chat`'s `charter.ts` argues the seam; `@olai/plugin-api`'s
 * `services.ts` the field).
 *
 * ## The failure it answers
 *
 * `outlines_desc` says a note is "markdown, stored verbatim", and that is a
 * fact about STORAGE: an agent that reads it writes whatever it has — a tool
 * result pasted whole, one unbroken paragraph, a list flattened into commas —
 * and the store keeps it faithfully. What the tool line does not say is who
 * reads the note back and where: a person, drawn under the node's title in
 * the tree and as the body of the node's own page (`./browser/Note.tsx`), set
 * as markdown in the app's own furniture. A note is written once by an agent
 * and read many times by a person, and that asymmetry is the whole
 * instruction.
 *
 * ## Why this row says it
 *
 * The drawing is this row's — `Note.tsx` is what turns `desc` into what a
 * person sees, and `./browser/edit/RowEditor.tsx` is the textarea that shows
 * it verbatim when they go to change it. `@olai/format` owns that the field is
 * text and validates nothing about it (`docs/format.md`, "A note is read as
 * TEXT"); the general markdown renderer owns how markdown is set; neither can
 * say what a note is FOR. A serve with no outlines row draws no notes, and
 * then this paragraph is not on the wire, which is right: nothing there is
 * read the way it describes.
 *
 * ## What it says, and what it does not
 *
 * One fact and the practice it implies: notes are read by people, so write
 * them for people — structure where it helps, prose where it does not, and
 * never a dump. No house style beyond that: heading levels, list markers and
 * line width are the renderer's and a person's taste, not a contract this row
 * can hold an agent to. Under the same 2 KB ceiling every charter shares
 * (Claude Code truncates server instructions there), so one paragraph.
 */
export const CHARTER =
  "A node's note (`desc`) is read by a person, drawn as markdown under the node's title and " +
  "as the body of its page. Write it for that reader: well-formed markdown a person can " +
  "scan — short paragraphs, a list or heading where it earns its place, links to nodes and " +
  "documents by address — never a raw tool result or a wall of text."

/**
 * The FACE a bodied file's page wears — one per kind, in one table.
 *
 * `/doc/<file>` opens any file whose content is a body (`@olai/format`'s
 * registry: a `.md` today, a `.html` beside it), and what changes between them
 * is not the page — same address, same heading, same "the directory does not
 * hold that" screen — but what the file is DRAWN AS. That is exactly one fact,
 * so the table is one component per kind, a `Record` over `BodyKind`: a kind
 * added to the registry with a body is a compile error here, naming the one
 * thing a new kind of file cannot inherit.
 *
 * The alternative is what this replaces before it could be written: a `Show`
 * per kind in `./DocumentPage.tsx`. Two conditions about one kind is two
 * answers, and the page they disagree in is the one where a reader is offered
 * an editor for a file the ops layer will refuse to write.
 *
 * IT USED TO CARRY A SECOND FIELD — `edits`, whether the kind's page offered an
 * Edit control and therefore whether the PAGE fetched the body for a draft to
 * be judged against. Both halves went with the mode: a `.md` page IS its editor
 * now (./DocEditor.tsx), so there is no control to gate, and each face asks for
 * what it draws from, so there is no body for the page to hold. What made a
 * `.html` unwritable is unchanged and is where it always was — `write_document`
 * takes a `.md` and nothing else (`@olai/ops`) — and it is now expressed as the
 * plainest possible fact: the hypertext face is not an editor.
 *
 * WHAT A FACE IS HANDED is the file and nothing else ({@link Reading}), and
 * that is the decision this table gained last. Each face asks the wire for what
 * it draws from — a document's body, a saved page's revision — through the one
 * module that owns both members (`./documents.tsx`), so a face cannot be handed
 * a value it does not read, and what a kind costs this tab is a fact about that
 * kind's own component rather than about a props type shared with another.
 */

import type { BodyKind } from "@olai/format"
import type { JSX } from "solid-js"

import { DocEditor } from "./DocEditor.tsx"
import { Hypertext } from "./Hypertext.tsx"

/**
 * What a reading face is handed: THE FILE, and nothing else.
 *
 * It used to be handed the body as well, and that is the field this type lost
 * on purpose. A face draws from what it draws from — the markdown face from
 * the document's text, the hypertext face from a frame that fetches the file
 * over HTTP and from the revision that says the file moved — and those are two
 * different members of the wire (`@olai/surface`: `documents`, `heads`). A
 * props type carrying both meant handing each face a value it does not read,
 * which for the hypertext face was an empty string standing in for bytes this
 * tab never asked for: a body-shaped hole that a future face could read and
 * quietly draw as an empty document.
 *
 * So each face ASKS, through the one module that owns both members
 * (`./documents.tsx`), and a face's cost on the wire is a fact about the face
 * rather than about this table's props. That is what makes a preview cost a
 * revision: `Hypertext` reads a head and never opens a body, and nothing here
 * can hand it one by accident.
 */
export interface Reading {
  readonly file: string
}

/** What a kind of file is drawn as — the file, and nothing else ({@link
 *  Reading}). */
export type Face = (props: Reading) => JSX.Element

export const FACES: Record<BodyKind, Face> = {
  document: DocEditor,
  hypertext: Hypertext,
}

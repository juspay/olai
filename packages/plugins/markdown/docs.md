# Markdown

`markdown` claims `.md` files, which olai calls documents, draws the page you read one on, and is the editor you type one in.[^what]

## The page of a document

Top to bottom:

| Part | What it is |
| --- | --- |
| the heading | the file's path, in a monospaced face |
| **Edit** and **Delete…** | drawn together, and only for a file this serve holds |
| the properties | one chip per frontmatter key, the value linking where it points |
| **Contents** | the document's headings, open by default[^contents] |
| the body | the document rendered |
| **Referenced by `N` things** | who points here, under the body[^referrers] |

A page says `Loading…` while its first reading arrives.[^missing]

## Edit a document

Clicking **Edit** replaces the body with a plain-text box named `Edit <file>`, holding the file as it is on disk, frontmatter included.

| Control | Key | What happens |
| --- | --- | --- |
| **Save** | `Cmd` + `Enter` | writes the file and leaves the editor |
| **Cancel** | `Escape` | abandons the text and leaves the editor |

`Cmd` is the modifier on a Mac and `Ctrl` elsewhere. Making a document is the **New document** item in the sidebar's `+` menu ([files.md](files.md)).[^new] A file that changes under you refuses the save.[^conflict] Your unsaved text belongs to the pane and the file.[^draft]

## Headings and links

A heading link and a line of the contents both point at `/notes/plan.md#slug`.[^click] `Alt` and a click open the same destination in a pane on the right, a preview card included.[^alt] A link to a file the directory does not serve says so.[^dead] Pictures are fetched in the order you meet them.[^pictures]

## What is still there without it

Switching `markdown` off takes away document pages and the document read and write procedures.[^off] Equally, switching off outlines or the files sidebar leaves a document page and its editor mounted and able to save.[^reverse]

[^what]: What a document is, and how it is written, is [../documents-and-kinds.md](../documents-and-kinds.md).

[^contents]: The list of headings is drawn only when the document has more than one.

[^referrers]: The referrers section is shut until you open it, and splits what it found across three rows: **Sees this**, **Mentions this** and **Links to this**. A row linking this document from its title or note opens that row's page; a document whose prose links here opens that file.

[^missing]: An address naming no such file says `Page not found`, with the detail `There is no document named notes/plan.md.`

[^new]: A document you have just made opens with its editor already open.

[^conflict]: The editor says `This file changed while you were editing. Your text is safe here, and Save won't overwrite the change.` **Save** is refused, and an **Overwrite anyway** button appears beside it once you have read the refusal.

[^draft]: Unsaved text survives switching tabs, resizing and layout changes, and a file that goes missing and comes back during the same visit. Closing the pane or navigating away abandons it, and switching the row off and on again does not bring it back.

[^click]: A plain click records the heading in the address and scrolls to it, once the page's faces have loaded, so the landing is measured in the type you will actually read.

[^alt]: A link to a fragment of the text you are already in, such as a footnote inside an outline's note, scrolls in place and leaves the address alone.

[^dead]: A link to an unserved file keeps its words and gains a sentence about being dead on its spoken name, so a keyboard and a screen reader meet it and not only a pointer. The sentence comes off the moment the file is served.

    A title the author wrote, `[x](y "…")`, is still rendered as the document's own tooltip. Code spans, code fences and frontmatter never raise the warning, and a query or a fragment on an address is not part of the check.

[^pictures]: The first picture is fetched at once, the rest as you scroll near them. The same renderer draws outline notes and chat replies, so that holds per rendered block rather than per page.

[^off]: Outline editing, the sidebar and open outline pages are untouched, and outline notes and chat messages keep rendering markdown text, which a static renderer draws rather than this row. Switching it back on reads the current files with fresh editor state, and an address navigation kept can draw its page again.

[^reverse]: A document page and its editor stand without those rows because the vault supplies file access and navigation supplies the address.

<details>
<summary>What other plugins contribute</summary>

| Location | Takes |
| --- | --- |
| `markdown.body` | one occupant, which draws a document's body somewhere else. The journal's day note uses it |
| `markdown.properties` | one occupant, which replaces the plain frontmatter chips with a richer drawer. Outlines contributes it |

`markdown.editing` carries where a newly minted document is opened, named by [journal.md](journal.md) on a component of its own, so with this row off the calendar, the agenda and the day page are whole and simply draw no day-note button. `markdown.browser-state` carries the open documents, their drafts and this row's own undo history.

</details>

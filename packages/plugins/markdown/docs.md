# Markdown documents: the page and the editor

olai calls a `.md` file a document. The `markdown` plugin draws the page you read a document on, and is the editor you type one in.[^what]

## The page of a document

Top to bottom:

| Part | What it is |
| --- | --- |
| the heading | the file's path, in a monospaced face |
| **Edit** and **Delete…** | drawn together, only for a file in the directory olai serves |
| the line at the top | a chat about this document[^line][^keys] |
| the properties | one chip per key in the file's frontmatter, the keys at its top[^props] |
| plugins' faces | hung in `document.page.head` |
| **Contents** | the document's headings, open by default[^contents] |
| the body | the document, rendered |
| **Referenced by `N` things** | what points at this document[^referrers] |
| plugins' faces | hung in `document.page.foot` |

A page says `Loading…` until olai has read the file.[^missing]

## Edit a document

Clicking **Edit** replaces the body with a plain-text box named `Edit <file>`, holding the file as it is on disk, frontmatter included.

| Control | Key | What happens |
| --- | --- | --- |
| **Save** | `Cmd` + `Enter` | writes the file and leaves the editor |
| **Cancel** | `Escape` | throws the text away and leaves the editor |

`Cmd` is the modifier on a Mac and `Ctrl` elsewhere.[^new] If the file changes on disk, olai refuses the save.[^conflict] olai keeps text you have not saved for that pane and that file.[^draft]

## Headings and links

Clicking a heading, or a line of **Contents**, goes to an address like `/notes/plan.md#slug`.[^click] `Alt` and a click open the same destination in a pane on the right.[^alt] `[[plan]]`, a wikilink, opens the document `plan` ([wikilinks.md](../wikilinks.md)).[^unresolved] A link to a file this directory does not serve says so.[^dead] Pictures load as you reach them.[^pictures]

## What still works without this plugin

Switching `markdown` off takes away document pages and the read and write procedures.[^off] Switching off outlines or the files sidebar leaves this page and its editor able to save.[^reverse]

[^what]: The `markdown` plugin claims `.md` files. What a document is, and how it is written, is in [../documents-and-kinds.md](../documents-and-kinds.md).

[^props]: A property's value is drawn as a link when it names a web address, or a file, a row or a day that this olai can open.

[^contents]: The list of headings is drawn only when the document has more than one heading.

[^referrers]: The referrers section is closed until you open it, and splits what it found across four rows: **Sees this**, **Mentions this**, **Links to this** and **Names this in a property**. A row that links to this document from its title or its note opens that row's page; a document whose prose links here opens that file. A row whose declared property names this document is in the fourth row ([../documents-and-kinds.md](../documents-and-kinds.md)).

[^missing]: An address naming no such file says `Page not found`, with the detail `There is no document named notes/plan.md.`

[^new]: To make a document, use **New document** in the sidebar's `+` menu ([files.md](files.md)). A document you have just made opens with its editor already open.

[^conflict]: The editor says `This file changed while you were editing. Your text is safe here, and Save won't overwrite the change.` **Save** is refused, and an **Overwrite anyway** button appears beside it once you have read the refusal.

[^draft]: Text you have not saved survives switching tabs, resizing, layout changes, and a file that goes missing and comes back during the same visit. Closing the pane or navigating away throws it away, and switching the plugin off and on again does not bring it back.

[^click]: A plain click records the heading in the address and scrolls to it once the page's typefaces have loaded, so where you land is measured in the type you will actually read.

[^alt]: The pane that opens on the right includes a preview card. A link to a part of the text you are already in, such as a footnote inside an outline's note, scrolls in place and leaves the address alone.

[^unresolved]: A wikilink whose name finds no file is marked as a dead link is, and a screen reader hears `no file is named plan` after its words. Clicking it opens **Page not found** for that name. It is marked or cleared as files arrive and leave, without drawing the page again, so a selection you made stays.

[^dead]: A link to a file this directory does not serve keeps its words, and gains a sentence saying it is dead in the name a screen reader reads out. A keyboard and a screen reader meet it that way too, not only a pointer. The sentence goes as soon as the file is served.

    A title the author wrote, `[x](y "…")`, is still rendered as the document's own tooltip. Code spans, code fences and frontmatter never raise the warning. A query or a fragment is taken off before the file is looked for: `[q](finishes.md?v=1)` is checked as `finishes.md`.

[^pictures]: The first picture is fetched at once, and the rest as you scroll near them. The same renderer draws outline notes and chat replies, so this holds for each rendered block rather than for each page.

[^off]: Outline editing, the sidebar and open outline pages are untouched, and outline notes and chat messages keep rendering markdown text, which a renderer that is always loaded draws, not this plugin. Switching it back on reads the files as they are now, with its editor state reset, and an address you kept can draw its page again.

[^reverse]: A document page and its editor stand without those plugins, because the directory supplies access to the file and the navigation plugin supplies the address.

[^line]: The line is this plugin's own place on a document's page, under the path and above the properties, and chat fills it ([chat.md](chat.md)). With a chat about this document it says how that chat stands, carries **Chat about this page**, and **Open beside ›**, which opens the conversation in the pane to the right. Without one it holds a box reading **Ask about plan…**, where `Enter` starts the chat and opens it beside.

    The pages of the kinds olai only shows, such as a `.csv` or a picture, draw no line, and nor does any page with chat switched off.

[^keys]: A chat about this document is kept in the file's own frontmatter, under two keys. `chat-agent-session` says which conversation the document is having. `chat-opens` says whether opening that chat brings the document with it. olai refuses a write by an agent that changes or drops the tie, so you move either key by editing the file yourself.

<details>
<summary>What other plugins contribute</summary>

| Location | Takes |
| --- | --- |
| `markdown.body` | one occupant, which draws a document's body somewhere else. The journal's day note uses it |
| `markdown.properties` | one occupant, which replaces the plain frontmatter chips with a richer drawer. Outlines contributes it |

`markdown.editing` is how another plugin opens a document it has just made. The journal ([journal.md](journal.md)) names it on a component of its own, so with `markdown` off the calendar, the agenda and the day page are whole and simply draw no day-note button. `markdown.browser-state` carries the open documents, their unsaved text, and this plugin's own undo history.

</details>

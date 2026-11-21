# Wikilinks: link to a note by its name

Write `[[finishes]]` and olai links to the document named `finishes`, in whatever folder it is in. A directory written in Obsidian or Logseq opens with its notes linked.

## Write a wikilink

| You write | It opens | It shows |
| --- | --- | --- |
| `[[finishes]]` | the document `finishes.md`, wherever it is[^which] | finishes |
| `[[finishes\|the finishes]]` | the same document[^bar] | the finishes |
| `[[kitchen-sink#Tables]]` | the heading `Tables` in it[^heading] | kitchen-sink > Tables |
| `[[house.olai#kitchen]]` | the row `kitchen` of the outline[^suffix] | house.olai > kitchen |
| `![[handle.png\|200]]` | nothing: it draws the picture, 200 pixels wide[^picture] | the picture |

A wikilink works in a document, in a row's title and note, in a day note and in what an agent says.[^where] Typing `[[` in a row offers the files you can name ([editing.md](editing.md)).

## When a name finds nothing

The link keeps its words and is marked the way a dead link is.[^dead] Clicking it opens **Page not found** for that name. It becomes a live link as soon as a file with that name is served.

## Who links here

A note's **Referenced by** section lists every row and document that wikilinks to it, beside standard links.[^backlinks]

[^which]: A name with no suffix finds Markdown documents only, so `[[house]]` does not find `house.olai`. A name with a suffix, such as `[[report.pdf]]` or `[[finishes.md]]`, finds any file olai serves. Of several files with one name, the rules in the closed block below choose one, and they always choose the same one.

[^bar]: Inside a table cell, write the bar as `\|`, as in Obsidian. The words after the bar are shown as plain text, never as markdown.

[^heading]: The heading is matched the way olai names headings, so capitals and punctuation do not matter. `[[kitchen-sink#Lists#Nested]]` lands on the last heading named, and `[[#Tables]]` names a heading of the same document. A heading that is not there opens the document at its top. A block reference, `[[finishes#^abc123]]`, opens the document.

[^suffix]: An outline is always written with its suffix: `[[house.olai]]` opens the outline, and `[[house.olai#kitchen]]` lands on the row with the id `kitchen`.

[^picture]: `![[handle.png]]` draws the picture at its own size, and `\|200x100` sets a width and a height. The picture must be a file in the directory, and an `.svg`, a file that is not there or a remote address is refused with a sentence where the picture would be. `![[finishes]]` and any other embed of a file that is not a picture is drawn as a link. In a row's title, every embed is a link.

[^where]: A wikilink inside a code span, a code block, or after a backslash, `\[[finishes]]`, stays text. One in a row's title is edited as you wrote it, brackets and all, and drawn as a link again when you leave the row.

[^dead]: A screen reader hears the link's words and then `no file is named nowhere`. An agent that writes one is told at once, with the nearest names, such as `did you mean [[finishes]]?`, and `markdown_read` and `outlines_read` list it under `deadLinks`. A link that finds nothing is never an error: the file still saves.

[^backlinks]: A wikilink is listed in the **Links to this** row, and one to a heading counts for the whole document. A file that something wikilinks to cannot be deleted until the link goes, as for a standard link. `markdown_read` lists who refers to a document under `referencedBy`.

<details>
<summary>How a name finds its file</summary>

olai looks a name up each time it reads the link, so moving a file on disk keeps its wikilinks working, and adding a file can change which one a link finds.

1. The name is the text before any `|` and `#`, with the spaces around it taken off.
2. A name with no suffix finds a Markdown document. A name with a suffix finds any file olai serves.
3. A name with a `/` in it is tried in three ways, in this order: from the top of the directory, beside the file that wrote the link, and as the end of a path, so `[[b/Note]]` finds `a/b/Note.md`.
4. A name that starts with `./` or `../` is read beside the file that wrote it, and a `..` that climbs out of the directory finds nothing.
5. A name with no `/` finds every file with that name, in any folder.
6. Of several files, olai takes the one whose capitals match exactly, then the one in the same folder as the file that wrote the link, then the one with the fewest folders above it, then the first in path order.

Capitals do not matter otherwise, and neither does how an accented letter is stored.

</details>

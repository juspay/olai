# Images

olai claims picture files and draws one as its own page, at the size the file
says, never wider than the column. The suffixes are `.png`, `.jpg`, `.jpeg`,
`.gif`, `.webp`, `.avif`, `.bmp`, `.ico` and `.svg`, written in lower case.

## Pictures inside a document

A document's `![](art/shot.png)` draws the file beside it, and an `.svg` is
never drawn that way: see [documents and kinds](../documents-and-kinds.md) for
what a document may point at.

A document's reference matches a picture's suffix whatever its case, so
`![](art/SHOT.PNG)` draws. The file itself is claimed only in lower case, so
`SHOT.PNG` has no page of its own and the sidebar does not list it.

A picture replaced on disk is fetched again rather than drawn out of the
browser's cache, and a picture that goes missing or comes back updates an open
page without a reload.

## What an agent can do with it

No tool writes a picture. `files_delete` refuses one, saying `olai only shows
files of this kind and never writes one`. You can attach a picture to a
conversation, up to 50 MB, except an `.svg`
([giving an agent work](../giving-an-agent-work.md)).

# Images

olai gives each picture file a page of its own, and draws the picture at the size the file says, never wider than the column.[^suffixes]

## Pictures inside a document

Writing `![](art/shot.png)` in a document, which is a `.md` file, draws the picture file beside it. An `.svg` is never drawn this way: see [documents and kinds](../documents-and-kinds.md) for what a document may point at.

A reference in a document matches a picture's suffix whatever its case, so `![](art/SHOT.PNG)` draws the picture. olai claims the file itself only in lower case. So `SHOT.PNG` has no page of its own, and the sidebar does not list it.

A picture replaced on disk is fetched again rather than drawn from the browser's cache, and a picture that goes missing or comes back updates an open page without a reload.

## What an agent can do with it

No tool writes a picture.[^tools]

[^suffixes]: The suffixes olai claims are `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico` and `.svg`, written in lower case.

[^tools]: Tools and a picture: `files_delete` refuses one, saying `olai only shows files of this kind and never writes one`. You can attach a picture to a conversation, up to 50 MB, except an `.svg` ([giving an agent work](../giving-an-agent-work.md)).

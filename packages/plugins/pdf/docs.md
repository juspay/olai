# PDF files

olai claims `.pdf` files and gives each one a page that hands the file to your browser's own viewer, in a tall frame the document scrolls inside.[^viewer]

A browser that will not draw a PDF says `This browser can't show a PDF here.` and offers an `Open <file>` link to the file itself, which you can open in whatever does draw one.

A file replaced on disk is fetched again rather than drawn out of the browser's cache. [Documents and kinds](../documents-and-kinds.md) is the format's account of the kinds olai only shows.

## What an agent can do with it

No tool writes a `.pdf`.[^tools]

[^viewer]: Pages, zoom, search and print are the browser viewer's own, and olai bundles no renderer of its own.

[^tools]: Tools and a `.pdf`: `files_delete` refuses one, saying `olai only shows files of this kind and never writes one`. You can attach a `.pdf` to a conversation, up to 50 MB, and the agent is handed the path ([giving an agent work](../giving-an-agent-work.md)).

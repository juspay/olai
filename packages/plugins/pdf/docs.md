# PDF files

olai gives each `.pdf` file a page of its own, which hands the file to your browser's own PDF viewer in a tall frame the document scrolls inside.[^viewer]

A browser that will not draw a PDF says `This browser can't show a PDF here.` and offers an `Open <file>` link to the file itself, which you can then open in a program that does draw one.

A file replaced on disk is fetched again rather than drawn from the browser's cache. [Documents and kinds](../documents-and-kinds.md) is the format's account of the kinds of file olai only shows and never writes.

## What an agent can do with it

No tool writes a `.pdf`.[^tools]

[^viewer]: Turning pages, zooming, searching and printing are all the browser viewer's own; olai includes no PDF renderer of its own.

[^tools]: Tools and a `.pdf`: `files_delete` refuses one, saying `olai only shows files of this kind and never writes one`. You can attach a `.pdf` to a conversation, up to 50 MB, and the agent is given the path to the file ([giving an agent work](../giving-an-agent-work.md)).

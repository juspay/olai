# HTML files

olai draws an `.html` file as the page it is, in a sealed frame: the file's own markup, stylesheets, pictures and scripts. Nothing is rewritten, and olai never writes one.

## What you see

The file is served at `/media/<its path>`, so a relative address in it means the file beside it on disk, and the page runs its own scripts in an origin that is nobody's.[^policy] The frame is as tall as the page measures itself to be.[^tall]

A file that is there but will not open says `This file couldn't be opened, so there's nothing to show.`

## Links inside the page

A link to another file in your directory opens that file's page in olai, the way clicking it in the sidebar does.[^click] Two links behave differently:

- a link to a file your directory does not serve opens nothing, and the page says `That link points to a file that isn't in this folder.`;
- a page that sends the frame to another site is brought back three times, and after that the frame is emptied.[^away]

## What an agent can do with it

No tool writes a saved page.[^tools]

[^policy]: olai claims `.html` files and serves each out of your directory. What a saved page may load, and the policy it is answered with, is [documents and kinds](../documents-and-kinds.md).

[^tall]: The frame's height is never shorter than a heading and never longer than two screens.

[^click]: Opening a link from inside the page: `Alt` + click opens it on the right, and `Alt` + `Shift` + click forces a new pane. Hovering one gives the same preview card an ordinary link gives.

[^away]: A frame sent elsewhere: opening the page again starts the count of three over.

[^tools]: Tools and an `.html` file: `files_delete` refuses one, saying `olai only shows files of this kind and never writes one`, and an `.html` file is not a kind you can attach to a conversation ([giving an agent work](../giving-an-agent-work.md)).

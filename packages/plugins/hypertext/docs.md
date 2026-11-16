# HTML files

olai claims `.html` files and draws each one as the page it is, in a sealed
frame: the file's own markup, stylesheets, pictures and scripts, served out of
your directory. Nothing in the file is rewritten, and olai never writes one.

## What you see

The file is served at `/media/<its path>`, so a relative address in it means
the file beside it on disk, and the page runs its own scripts in an origin
that is nobody's. What it may load, and the policy it is answered with, is
[documents and kinds](../documents-and-kinds.md).

The frame is as tall as the page measures itself to be, never shorter than a
heading and never longer than two screens.

A file that is there but will not open says `This file couldn't be opened, so
there's nothing to show.`

## Links inside the page

A link to another file in your directory opens that file's page in olai, the
way clicking it in the sidebar does: `Alt` + click opens it on the right, and
`Alt` + `Shift` + click forces a new pane. Hovering one gives the same preview
card an ordinary link gives.

Two links behave differently:

- a link to a file your directory does not serve opens nothing, and the page
  says `That link points to a file that isn't in this folder.`;
- a page that sends the frame to another site is brought back three times, and
  after that the frame is emptied. Opening the page again starts the count
  over.

## What an agent can do with it

No tool writes a saved page. `files_delete` refuses one, saying `olai only
shows files of this kind and never writes one`, and an `.html` file is not a
kind you can attach to a conversation
([giving an agent work](../giving-an-agent-work.md)).

# HTML files

olai draws an `.html` file as the page it is, inside a frame of its own. olai changes nothing in the file, and never writes one.

## What you see

The page is drawn with its own markup, stylesheets, pictures and scripts. olai serves the file at `/media/<its path>`, so an address written relative to it means the file beside it on disk. The page's own scripts run inside a frame that belongs to no website, so they get no cookies, no stored data and no reach into olai's own page.[^policy] The frame is as tall as the page says it is.[^tall]

A file that is there but will not open says `This file couldn't be opened, so there's nothing to show.`

## Links inside the page

A link to another file in your directory opens that file's page in olai, the way clicking the file in the sidebar does.[^click] Two other things can happen:

- a link to a file your directory does not serve opens nothing, and the page says `That link points to a file that isn't in this folder.`;
- if the page sends the frame to another site, olai brings the frame back three times, and after that empties the frame.[^away]

## What an agent can do with it

No tool writes an `.html` file.[^tools]

[^policy]: olai claims `.html` files and serves each one out of your directory. What a saved page is allowed to load, and the answer it gets when it asks for anything else, is [documents and kinds](../documents-and-kinds.md).

[^tall]: The frame is never shorter than a single heading and never taller than two screens.

[^click]: Opening a link from inside the page: `Alt` + click opens it on the right, and `Alt` + `Shift` + click opens it in a new pane. Resting the pointer on one gives the same preview card an ordinary link in olai gives.

[^away]: A frame sent to another site: opening the page again starts the count of three over.

[^tools]: Tools and an `.html` file: `files_delete` refuses one, saying `olai only shows files of this kind and never writes one`, and an `.html` file is not a kind of file you can attach to a conversation ([giving an agent work](../giving-an-agent-work.md)).

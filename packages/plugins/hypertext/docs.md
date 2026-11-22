# HTML files

olai draws an `.html` file as the page it is, inside a frame of its own. olai changes nothing in the file, and never writes one.

## What you see

The page is drawn with its own markup, stylesheets, pictures and scripts. olai serves the file at `/media/<its path>`, so an address written relative to it means the file beside it on disk. The page's own scripts run inside a frame that belongs to no website, so they get no cookies, no stored data and no reach into olai's own page.[^policy] The frame is as tall as the page says it is.[^tall]

A file that is there but will not open says `This file couldn't be opened, so there's nothing to show.`

<details>
<summary>What a web page in your directory may load, and the policy it carries</summary>

The file is served at `/media/<its path>`, so a relative address inside it means the file next to it on disk.

| In the file | Loads |
| --- | --- |
| `<img src="art/shot.png">` in `notes/report.html` | `notes/art/shot.png` |
| `<a href="other.html">` | the page of the file next door |
| a remote host, a `data:` URI, a path above the directory | nothing |

The route answers with the page, its pictures, its stylesheet, its script and its font, and nothing else, behind the same check against climbing out of the directory that markdown's pictures go through. A `.md`, an `.olai`, a `.json` and a `.csv` are not on that list, because they have pages of their own.

The response carries a content policy: `sandbox allow-scripts; default-src <host>/media/; script-src <host>/media/ 'unsafe-inline' 'unsafe-eval'; style-src <host>/media/ 'unsafe-inline'; frame-src 'none'; form-action 'none'; base-uri 'none'`. Every directive that allows a fetch names this directory on the host you asked for, and `base-uri 'none'` refuses the file's own `<base href>`.

> A script can navigate its own frame, and no directive covers that, so a page can tell somebody else's server what it is by leaving, once. Nothing it fetches leaves this directory, and a nested frame or a form post is refused.

The sandbox survives a navigation and the policy does not, so olai brings the frame back. A navigation to a file of this directory is kept; anything else is replaced by the file again, a limited number of times, and after that by an empty frame.

</details>

## Links inside the page

A link to another file in your directory opens that file's page in olai, the way clicking the file in the sidebar does.[^click] Two other things can happen:

- a link to a file your directory does not serve opens nothing, and the page says `That link points to a file that isn't in this folder.`;
- if the page sends the frame to another site, olai brings the frame back three times, and after that empties the frame.[^away]

## What an agent can do with it

No tool writes an `.html` file.[^tools]

[^policy]: olai claims `.html` files and serves each one out of your directory. What a saved page is allowed to load, and the answer it gets when it asks for anything else, is in the block under **What you see**; how olai claims the kinds it shows is [documents and kinds](../documents-and-kinds.md).

[^tall]: The frame is never shorter than a single heading and never taller than two screens.

[^click]: Opening a link from inside the page: `Alt` + click opens it on the right, and `Alt` + `Shift` + click opens it in a new pane. Resting the pointer on one gives the same preview card an ordinary link in olai gives.

[^away]: A frame sent to another site: opening the page again starts the count of three over.

[^tools]: Tools and an `.html` file: `files_delete` refuses one, saying `olai only shows files of this kind and never writes one`, and an `.html` file is not a kind of file you can attach to a conversation ([giving an agent work](../giving-an-agent-work.md)).

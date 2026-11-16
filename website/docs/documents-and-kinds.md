# Documents, references and the kinds olai shows

Every file olai serves is an outline, a markdown document, or a kind olai only shows. References and pins point at them.

## References

A reference points from one place to another, and olai works out what points back.[^reverse] Three things count as a reference.[^notref]

| Written as | What it says |
| --- | --- |
| `see` | a free cross-reference between two rows |
| `@<id>` in a title, a note or a document | a mention, if some row has that id[^sigil] |
| a `[…](…)` link | the row or file it names[^address] |

## Documents

A `.md` file olai serves is a document.[^loaded] Its title is its first line, and you can link to any heading inside it.[^names] Its properties are the `key: value` lines in the frontmatter at the top.[^frontmatter][^values][^chips] olai writes a document whole, never a part of it.[^gate][^was] Relative pictures and links are looked for beside the file.[^body][^links]

## Pins

A pin is an ordinary row whose title is an address, such as `/#herbs`; the sidebar lists your pins ([getting-around.md](getting-around.md)).[^shelf][^titles] Write the address bare, or as a markdown link to name the pin.[^named][^clicking] A pin promises the address, not that what it names still exists.[^promise][^notpin]

## The kinds olai only shows

Every file olai serves is claimed by a plugin; a file nothing claims is not loaded.[^registry] Four kinds are drawn and never written: a `.html` page, a `.csv`, a picture and a `.pdf`.[^shown]

## Web pages in your directory

A `.html` file is a web page, and olai draws it on a page at `/<path>`.[^frame][^height] A link in it to another file with a page opens that page in olai.[^follow][^landing] A `.html` file that will not open says so.[^unopened][^fetch]

[^reverse]: One index answers the question "what points at this", so the row's backlinks, the document page's list of referrers, and `referencedBy` in the answer from `outlines_read` are all one list. A source that refers twice is one referrer listed with two ways of referring, out of `see`, `mention` and `link`. A reference to a mirror counts as a reference to the row it shows, and nothing refers to itself.

[^notref]: Three things are not references. A `mirror` says "draw this row here too", and where else a row is drawn is in `mirrors` in the answer from `outlines_read`. An `after` or a `blocks` is the ordering between tasks ([dates-and-status.md](dates-and-status.md)). A row in an `_olai/Trash.olai` is drawn on the Trash page and nowhere else.

[^sigil]: `@` also starts a tag, so `@herbs` is a tag whether or not anything has the id `herbs`. Whether a row has that id is asked when the reference is read, so a row created today turns every `@its-id` already written into a reference to it. A `#herbs` is never a reference.

[^address]: A link points at an address: `[x](#id)` names the row with that id, and `[x](doc.md)`, `[x](doc.md#heading)` and `[x](art/handle.png)` name the file. A picture with no label, `![](…)`, is still a link, so a picture's page lists the documents that show it. A link to a heading counts as a link to the whole document.

[^loaded]: For each served file olai keeps its path, its title, the addresses it points at and the tags its text holds, all worked out from the file. Notes link to documents, and properties declared `doc` name them.

    A document's text is stored exactly as written, drawn as markdown and never checked, so a `.md` file can never make the directory invalid. Every file is loaded at startup; the text of a document is sent when a reader asks for it, at a named revision.

[^names]: A document is called by its first line that is not empty, with the `#` marks taken off, and by its filename when the body has no such line. You can link to any heading by its slug, taken in the order the headings appear, which is what `README.md#install` names, so rewording a heading breaks that address. What the document points at is wherever its `[…](…)` links land, read by the same rule a note is read by.

[^frontmatter]: Frontmatter is a `---` line at the very top of the file, closed by another `---`, holding `key: value` lines. It answers `prop:` in a search, in the same set of names a row's own properties use ([search.md](search.md)), so `prop:agent=claude-opus` finds both documents and rows. A `---` that is never closed is just a horizontal rule, and a note under a row has no frontmatter at all.

[^values]: A frontmatter value is text, or a list of text: `[a, b]` and a block of `- ` lines are both lists, and a number, a boolean or a date is read as the text somebody typed. A key whose value is a nested map, a block scalar (`|`, `>`), a flow map or an anchor is not read, so the document does not carry that key at all.

[^chips]: Frontmatter properties are not a row's properties: a `date:` is not the day the journal reads, a `done:` is not a mark, and a `tags:` is not a tag, so `is:done`, `has:date` and `date:today` never match a document. The page draws them as chips, the way a row's page does, under the path heading and above the body. They are hidden while the editor is open, and `markdown_index` reports them.

[^gate]: olai writes a whole document at a time, never a range of bytes. `create` refuses a path that already exists, and refuses anything but a relative `.md` path, judged one path segment at a time. `write` refuses a path that does not exist, so a typo cannot create a file. `delete` refuses a file anything still names, and an outline that is not empty.

[^was]: A write may carry `was`, the text the caller last read, and is refused if the file changed in the meantime, which is checked on every retry. A delete looks for links in live titles and notes, links in document bodies, and values of properties declared `doc` in `_olai/Properties.olai`. Links from trashed rows do not hold a file back; declared property values still do.

[^body]: A relative `![](art/shot.png)` in a document is looked for in that document's own directory, where the same link in a note is looked for beside the note's outline. It is served from `/media/`, and only picture suffixes are allowed. A `..` that would climb above the served directory stops at its root. Nothing else is drawn: no remote host, no `data:` URI, no absolute path, no `.svg`. olai knows pictures by their paths and never loads their bytes.

    The first picture of a block is fetched straight away, and the rest wait until you scroll near them.

[^links]: A relative `[the deck](../projects/deck.md)` opens that document's page in olai, as does a link to any other file that has a page. A filename with a space in it still works, written `the%20brief.md`, `<the brief.md>` or `the brief.md`. A `[shot](art/handle.png)` opens that picture's page, while `![](art/handle.png)` draws the picture itself from `/media/`. An `http:` or `https:` link opens in a new tab; everything else opens in this tab.

[^shelf]: The pins are the rows of the file named `Pins` directly inside `_olai/`, whatever its capitals, with any suffix that holds rows ([validation.md](validation.md)). A directory without that file has no pins, and when the configured outline plugin is off the sidebar says so. olai creates `_olai/Pins.olai` with that plugin's suffix. The top level of the file is the list of pins, in `ord` order, one row per pin; what you nest under a pin is your own business.

[^titles]: A pin's title is an address: a document, then `#`, then a place inside it, with a slash in front. Either half may be left out. An address may also carry `?q=<filter>`, which is how you pin a saved search ([filtering.md](filtering.md)).

    An address naming a row is the one whose file half can go out of date, because a row moves and its id does not. The id may name a mirror: the pin then lands on the mirror's own row where its file draws it, and otherwise on the row the mirror shows.

[^named]: A pin written as a bare address stores no name, so the list draws that row's title as it stands now, and a pin to a file is called by its filename. A pin written as a markdown link is a named pin, and you rename it by editing that row's text. A label keeps the words somebody chose, so a `#home` inside one stays four characters of text.

[^clicking]: Clicking a named pin's label opens the address; clicking a bare address opens the editor. olai writes a name only when somebody typed one, and asks for one only for a page carrying a `?q=`. A row whose title is an address is drawn as that address in any outline, with the pin mark, the file's name and the search, in either spelling. The editor opens the title exactly as stored.

[^promise]: A pin promises the address somebody saved, and the name of a row read fresh each time. It does not promise that what it points at is still there.

    A pin to an id nothing declares draws its own address, such as `/#gone`. A pin to a trashed row draws that row's title and opens its page, without saying that it was put away. A pin to a document is a path, so renaming or deleting the `.md` leaves a row named for a file that is not there.

[^notpin]: A row that is not an address is not a pin. A heading, a note, or a title that merely starts with a slash is not one. olai's own address parser decides, so `/etc/passwd` is read as text, and `/%` is skipped rather than causing an error. A mirror is never a pin, because it would pull the pinned row's children into the pins file.

    An agent pins by adding a row with `outlines_add` to `Pins.olai`, or `files_create` when there is no such file, reorders pins with `outlines_move`, and unpins with `outlines_trash`.

[^registry]: The list of file kinds is called `vault.file-kinds` and belongs to the vault plugin. It matches suffixes exactly as they are registered, so `IMG_1234.JPG` and `a.OLAI` are claimed by nothing. A plugin may claim more suffixes, as hledger does for its ledger files ([plugins/hledger.md](plugins/hledger.md)). A picture is the one kind with a list of suffixes, because `.png` and `.webp` are two encodings of the same thing.

[^shown]: The four kinds olai only shows have no editor and no tool that creates one. `markdown_create`, `markdown_write`, `markdown_index` and `markdown_read` take a `.md` file and refuse the rest. olai does not hold the contents of these files: it holds the path, and reads the contents when a reader opens the file.

    A `.html` page, a picture and a `.pdf` are served from `/media/`; a `.csv` is sent as text, the way a document's body is, which the `/media/` route will not do.

[^frame]: The sidebar lists a `.html` file under the folder it lives in, with a mark of its own. The page runs the file's own JavaScript in a frame sandboxed without `allow-same-origin`, so the page belongs to no site: no `document.cookie`, no `localStorage`, no reading the page around it and no reach into olai. An inline script and an old-style `<script src>` run; a module script and `fetch` do not, because both are requests from a page that belongs to no site.

[^height]: The frame is as tall as the page inside it, between `6rem` and two screens, and `70dvh` tall when the page reports no height. The height the page reports comes from a page olai does not trust, so olai holds it to those limits rather than believing it ([plugins/hypertext.md](plugins/hypertext.md)).

[^follow]: A plain left click follows a link out of the frame when the link lands inside this directory's `/media/` space and names a file olai has a page for. A `#` part naming another file is carried along, so `other.html#beds` lands on that section: on the frame's own URL for a `.html` file, and on the heading's slug for a `.md` file. A `#` part naming nothing leaves you at the top of the page.

[^landing]: olai scrolls to that place once, when you arrive, so coming back to the page puts you where you had scrolled to. A link to a picture, a stylesheet or a font is followed inside the frame; a link to another site, or a move the page makes by itself, is left alone.

    An in-page `#top` is the frame's own jump. A file that olai's walk over the directory skips, under a dot-directory or `node_modules`, is claimed and then dropped, in a notice that does not quote it.

[^unopened]: A `.html` file that is served and will not open says so on its page: `This file couldn't be opened, so there's nothing to show.` It does not say why it could not be opened: that would describe your disk to anybody who can reach the port.

[^fetch]: A `.html` page follows the file on disk. The frame asks for the file's details and its revision, then fetches the bytes itself, so the page arrives one fetch after a document's text would, and two readers mean two reads. An agent that reads the bytes reads them again at every later revision.

<details>
<summary>When a mention is a reference but is not drawn as a tag</summary>

A note is read as plain text, because the part of olai that finds references has no markdown parser in it. An `@` only starts a mention where a word starts: at the start of the text, or after a space, `(`, `[` or `{`. The browser, on the other hand, styles tags in rendered markdown, so the two can disagree.

| | A reference | Drawn as a tag |
|---|---|---|
| `` `@herbs` `` — a code span holding only that | no | no |
| `` `see @herbs here` `` — a space inside the span | yes | no |
| a fenced or indented code block, `@herbs` after a newline | yes | no |
| `[@herbs](…)` — a link's text | yes | no |
| `*@herbs*` / `**@herbs**` — emphasis around it | no | yes |

So `@herbs` can be styled as a tag on one row's page while that row is missing from the list of what refers to the herb bed, because a `*` does not start a word.

</details>

<details>
<summary>What a pin's title may say</summary>

| Title | Opens |
| --- | --- |
| `/#<id>` | the row, shown in its outline |
| `/zoom/#<id>` | the row's own page |
| `/<path>` | a file: a `.md`, a `.html` or an outline |
| `/<path>#<slug>` | a heading inside a document |
| `/<path>#<id>`, where the path is an outline | the row, in its own file |
| `/d/<ISO>`, `/today`, `/agenda`, `/trash` | that day, today, the agenda, the Trash |

A title may also address a whole workspace. Write `/s/`, then the addresses of the pages you have open, one per pane, each percent-encoded and without its leading slash. An example is `[Orchestrating](/s/%23abc/orchestrator%2Flanes.olai)`. olai saves the pages only, under a name you supply, with no `?w=` pane widths and no `?f=` focus.

Those two, and `?a=` and `?t=`, are accepted when read, and opening such a pin gives every pane the same width and puts the focus in the first one. One you write by hand is a pin too.

A pins file that spells a row's own page as `/#<id>` has it rewritten to `/zoom/#<id>` the first time olai reads the file, including the row parts of workspace titles.

```jsonl
{"id":"p-herbs","ord":"a0","title":"/#herbs"}
{"id":"p-late","ord":"a1","title":"[What is late](/agenda?q=is%3Atodo)"}
```

</details>

<details>
<summary>Every kind olai claims, and the ones it only draws</summary>

| Kind | Suffixes | Its page |
| --- | --- | --- |
| Olai | `.olai` | the outline ([format.md](format.md)) |
| Markdown | `.md` | the text, drawn as markdown |
| Hypertext | `.html` | [the sandboxed frame](#web-pages-in-your-directory) |
| CSV | `.csv` | [a table](#a-csv) |
| Image | nine picture suffixes, `.svg` among them | [the picture](#a-picture) |
| PDF | `.pdf` | [the browser's own viewer](#a-pdf) |
| Vault plugins | `.ts` and `.tsx`, under `plugins/` only | the plugin's own page ([dynamic-plugins.md](dynamic-plugins.md)) |

### A `.csv`

Read when you open it and drawn as a table, with the first row as the header, which is a convention and is marked nowhere in the file. The header cells are marked as headers in the markup (`scope="col"`), and no column is treated as a row header ([plugins/csv.md](plugins/csv.md)).

olai reads only part of a large file, and says so: "Showing the first 500 rows." It stops at five hundred rows, a hundred columns, and two thousand characters in one cell. Nothing in olai writes a `.csv` back.

### A picture

An `<img>` pointed at `/media/<its path>`, drawn at its own size, up to the width of the column. An `.svg` is drawn in that same element, which will not run it, and the `/media/` route answers an SVG with `default-src 'none'; sandbox`, so reaching that URL another way gives an inert document. Markdown may name a picture, but not an `.svg`.

### A `.pdf`

The browser's own viewer, embedded as an `<object>` pointed at `/media/<its path>`. A browser that will not draw a PDF gets a sentence and the file itself, and the browser's own separate viewer process is what keeps it apart from olai.

</details>

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

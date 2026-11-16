# Documents, references and the kinds olai shows

A served file is an outline, a markdown document, or one of the kinds olai only draws. This page is what each is, what a reference is, what a pin holds, and what a saved page may do.

## References

Every reference points one way on disk, and the reverse is derived. Three things are a reference.

| Written as | What it says |
| --- | --- |
| `see` | the free cross-reference: somebody thought the two belonged together |
| `@<id>` in a title, a note or a body | a mention, which is a reference when some record claims that id |
| a `[…](…)` link in a title, a note or a body | the address it names, a node or a file |

`@` is a tag sigil, so `@herbs` is a tag whether or not anything is called `herbs`. Whether a record claims that id is asked when the reference is read, so a node minted today turns every `@its-id` already written into a reference to it. A `#herbs` is never a reference.

A link's target is an address: `[x](#id)` names the node, and `[x](doc.md)`, `[x](doc.md#heading)` and `[x](art/handle.png)` name the file. An empty-labelled `![](…)` is still a link, so a picture's page lists the documents that show it. A link onto a heading files as one to the whole document.

One index answers the reverse reading, so the node page's backlinks, the document page's referrers and `outlines_read`'s `referencedBy` draw one list. A source referring twice is one referrer with two ways, out of `see`, `mention` and `link`. A reference to a placement is a reference to the node, and no record refers to itself.

### What is not a reference

- A `mirror`. A placement says *draw it here too*, and where else a node is drawn is `outlines_read`'s `mirrors`.
- An `after` or a `blocks`. Those are the ordering graph ([dates-and-status.md](dates-and-status.md)).
- A record in an `_olai/Trash.olai`. What is put away is drawn on the Trash page and nowhere else.

### Where a mention and a tag pill disagree

A note is read as text, since the validator's own floor holds no markdown parser. `@` is claimed only where a word starts: at the start of the text, or after a space, `(`, `[` or `{`. The browser styles tags out of rendered markdown, so the two answers differ.

| | A reference | Drawn as a tag |
|---|---|---|
| `` `@herbs` `` — a tight code span | no | no |
| `` `see @herbs here` `` — a space inside the span | yes | no |
| a fenced or indented code block, `@herbs` after a newline | yes | no |
| `[@herbs](…)` — a link's text | yes | no |
| `*@herbs*` / `**@herbs**` — emphasis | no | yes |

So `@herbs` can be styled as a tag on a record's own page while that record is absent from the herb bed's referenced-by section, because `*` does not open a word.

## Documents

A `.md` under the served directory is a document, and part of the loaded set: notes link to documents, and declared `doc` properties name them. Every served file has a path, a title, the addresses it points at and the tags its prose writes, all derived.

- A document is called by its first non-empty line with the heading marks off, and by its filename when the body has none.
- Its elements are the slugs of its headings, in document order, which is what `README.md#install` names. Rewording a heading breaks the address.
- What it points at is where its `[…](…)` land, read by the rule a note is read by.
- Its text is stored verbatim and drawn as markdown. Nothing in it is validated, so a `.md` cannot make a set invalid.
- The whole set loads, and a body travels when a reader asks for it, at a named revision.

### Frontmatter

A document's properties are its YAML frontmatter: a `---` block on the very first line, closed by another `---`, holding `key: value` lines. It answers `prop:` in the query grammar, in the namespace a node's `custom` map shares ([search.md](search.md)), so `prop:agent=claude-opus` answers with both kinds. An unclosed fence is a thematic break, and a note has none.

- A value is text, or a list of text: `[a, b]` and a `- ` block sequence are lists, and a number, a boolean or a date is the text somebody typed.
- A key whose value is a nested map, a block scalar (`|`, `>`), a flow map or an anchor is not read, so the document does not carry it.
- Properties are not a record: a frontmatter `date:` is not the day the journal reads, a `done:` is not a mark, and a `tags:` is not a tag. So `is:done`, `has:date` and `date:today` select no document.
- The page draws them as the chips a node's page draws, under the path heading and above the body. The run is off while the editor is open, and `markdown_index` reports the map.

### Writing a document

A document is written whole, through the one write gate, never as a byte range.

| Write | What it refuses |
| --- | --- |
| create | a path that exists, and anything but a relative `.md` path judged segment by segment |
| write | a path that does not exist, so a typo cannot mint a file |
| delete | a file anything still names, and an outline that is not empty |

A write may carry `was`, the text the caller read, and is refused if the file has moved since, checked on every retry. Deletion names live title and note links, document-body links, and properties declared `doc` in `_olai/Properties.olai`. Links from trashed records do not hold files; declared property fences still apply.

### Pictures and links in a body

A relative `![](art/shot.png)` resolves against the document's own directory, where a note's resolves against its outline's, and is served from `/media/`, restricted to picture suffixes. A `..` past the served root is clamped there. Nothing else is drawn: no remote host, no `data:` URI, no absolute path, no `.svg`. Pictures are in the set as paths, and nothing loads their bytes.

The first picture of a rendered block is fetched at once, and the rest wait until you scroll near them.

A relative `[the deck](../projects/deck.md)` is rewritten to that document's page, and so is a link to any other file with a page. A filename with a space is still that file, written `the%20brief.md`, `<the brief.md>` or `the brief.md`. A `[shot](art/handle.png)` opens that picture's page, where `![](art/handle.png)` is an embed from `/media/`. An `http:` or `https:` link opens in a new tab; everything else goes where it says, in this tab.

## Pins

A pin is an ordinary node, in an ordinary outline, whose title is an address, and the sidebar draws a shelf of them ([getting-around.md](getting-around.md)).

The shelf is the file matching the `Pins` stem directly under `_olai/`, case-insensitively, with any node-holding suffix ([validation.md](validation.md)). A directory without one has an empty shelf, and when the configured outline row is off the sidebar says so. olai mints `_olai/Pins.olai` with that row's suffix. The file's top level is the shelf, in `ord` order, one node per pin; what is nested under a pin is that pin's own business.

```jsonl
{"id":"p-herbs","ord":"a0","title":"/#herbs"}
{"id":"p-late","ord":"a1","title":"[What is late](/agenda?q=is%3Atodo)"}
```

### What a title may say

An address is `[document]#[element]`, with a slash in front of it.

| Title | Opens |
| --- | --- |
| `/#<id>` | the node, revealed in its outline |
| `/zoom/#<id>` | the node's own page |
| `/<path>` | a document: a `.md`, a `.html` or an outline |
| `/<path>#<slug>` | a heading inside a document |
| `/<path>#<id>`, after an outline | the row, landed in its own file |
| `/d/<ISO>`, `/today`, `/agenda`, `/trash` | the day, today, the agenda, the Trash |

Each may carry `?q=<filter>`, which is how a saved query is a pin ([filtering.md](filtering.md)). A row address is the one whose file half can go stale, since the node moves and the id does not. Its id may name a placement: it lands on the mirror's own row where the file draws it, and otherwise on the node it stands for.

A title may also be a workspace address: `/s/` and then percent-encoded page addresses, one per pane, each without its leading slash, as in `[Orchestrating](/s/%23abc/orchestrator%2Flanes.olai)`. olai saves pages only, with a supplied name and no `?w=` widths or `?f=` focus. Those, and the codec's `?a=` and `?t=`, are tolerated when read, and following one restores equal widths and first-pane focus. A hand-written one is a pin too.

A shelf spelling a node's own page as `/#<id>` is rewritten to `/zoom/#<id>` the first time pins reads it, layout titles' node segments included.

### A bare address and a named pin

A bare address stores no name, so the shelf draws that node's title as it stands, and a file's pin is called by its own filename. A markdown link is a named pin, renamed by editing that row's text. Both spellings draw the mark, the name and the query.

A label is drawn as the words somebody chose, so a `#home` in it stays four characters. Clicking a label opens the address, where clicking a bare address opens the editor. olai writes a name only when somebody typed one, and asks only about a page carrying a `?q=`.

A title that names a place is drawn as that place in any outline, with the pin mark, the file's name and the query. The editor opens the address exactly as stored.

### What a pin promises

It promises that the address is what somebody kept, and that a node's name is read live. It does not promise the target is still there.

- A pin to an id nothing declares draws its own address, such as `/#gone`.
- A pin to a trashed node draws that node's title and opens its page, without saying it was put away.
- A pin to a document is a path, so a renamed or deleted `.md` leaves a row named for a file that is not there.

A row that is not an address is not a pin: a heading, a note, or a title that merely begins with a slash. The test is olai's own parser, so `/etc/passwd` reads as text, and `/%` is skipped rather than thrown at. A mirror is not a pin, since a placement would pull a pinned node's subtree into the file.

An agent pins with `outlines_add` into `Pins.olai` (or `files_create` when there is none), reorders with `outlines_move` and unpins with `outlines_trash`.

## The kinds olai only shows

Each served file is claimed by a live row in the vault-owned `vault.file-kinds` registry, and a file with no claim is outside the set. Suffixes match exactly as registered, so `IMG_1234.JPG` and `a.OLAI` are unclaimed.

| Kind | Suffixes | Its page |
| --- | --- | --- |
| Olai | `.olai` | the tree ([format.md](format.md)) |
| Markdown | `.md` | the rendered body |
| Hypertext | `.html` | [the sealed frame](#hypertext) |
| CSV | `.csv` | [a table](#a-csv) |
| Image | nine picture suffixes, `.svg` among them | [the picture](#a-picture) |
| PDF | `.pdf` | [the browser's viewer](#a-pdf) |
| Vault plugins | `.ts` and `.tsx`, under `plugins/` alone | the plugin's own page ([dynamic-plugins.md](dynamic-plugins.md)) |

A plugin may claim more, as hledger does for its journal suffixes ([plugins/hledger.md](plugins/hledger.md)). A picture is the one kind with a list of suffixes: `.png` and `.webp` are two encodings of one thing.

The four kinds below are drawn and never written: no editor, and no create verb. `markdown_create`, `markdown_write`, `markdown_index` and `markdown_read` take a `.md` and refuse the rest. No body of theirs is kept in the set: the path is, and the content is read when a reader opens the file. Hypertext, a picture and a `.pdf` are drawn from `/media/`; a `.csv`'s text crosses the wire like a body, which the route refuses.

### A `.csv`

Parsed when you open it and drawn as a table, the first row as the header, a convention nothing in the file marks. The header cells say so in the markup (`scope="col"`), and no row header is claimed ([plugins/csv.md](plugins/csv.md)).

The reading is bounded and the bound is said — "Showing the first 500 rows." It stops at five hundred rows, a hundred columns and two thousand characters of a cell. Nothing writes a `.csv` back.

### A picture

An `<img>` pointed at `/media/<its path>`, at its own size up to the width of the column. An `.svg` is drawn in that same element, which will not run it, and the media route answers an SVG with `default-src 'none'; sandbox`, so reaching that URL another way gives an inert document. Markdown may name a picture and not an `.svg`.

### A `.pdf`

The browser's own viewer, embedded as an `<object>` pointed at `/media/<its path>`. A browser that will not draw a PDF gets a sentence and the file itself, and its out-of-process viewer is what sandboxes it.

## Hypertext

A `.html` file under the served directory is hypertext: the sidebar lists it under the folder it lives in with a glyph of its own, and it has a page at `/<path>`.

### What runs, and what it may load

The file's own JavaScript runs, in a frame sandboxed without `allow-same-origin`, so its origin is nobody's: no `document.cookie`, no `localStorage`, no reading the page around it, no reach into olai. An inline script and a classic `<script src>` run; a module script and `fetch` do not, both being `CORS`-mode requests from an origin that is nobody's.

The file is served at `/media/<its path>`, so a relative address in it means the file next to it on disk.

| In the file | Loads |
| --- | --- |
| `<img src="art/shot.png">` in `notes/report.html` | `notes/art/shot.png` |
| `<a href="other.html">` | the page of the file next door |
| a remote host, a `data:` URI, a path above the directory | nothing |

The route answers the page, its pictures, its stylesheet, its script and its font: a closed list behind the traversal guard markdown's pictures go through. A `.md`, an `.olai`, a `.json` and a `.csv` are not on it, having pages of their own.

The response carries a content policy: `sandbox allow-scripts; default-src <host>/media/; script-src <host>/media/ 'unsafe-inline' 'unsafe-eval'; style-src <host>/media/ 'unsafe-inline'; frame-src 'none'; form-action 'none'; base-uri 'none'`. Every fetching directive names this directory on the host you asked for, and `base-uri 'none'` refuses the file's own `<base href>`.

> A script can navigate its own frame, and no directive covers that, so a page can tell somebody else's server what it is by leaving, once. Nothing it fetches leaves this directory, and a nested frame or a form post is refused.

A sandbox survives navigation and the policy does not, so the frame comes home. A navigation to a file of this directory is kept; anything else is replaced by the file, a bounded number of times, and then by an empty frame.

### Following a link out of a preview

A plain left click on a link that resolves to this directory's `/media/` space, and names a file olai has a page for, opens that page in olai rather than in the frame. A fragment naming another file is carried, so `other.html#beds` lands on that section: a `.html` gets it on the frame's own URL, and a `.md` heading by the slug its face promises. A fragment naming no id leaves you at the top.

A landing is spent once, on arrival, so coming back restores where you had scrolled to.

A link to a picture, a stylesheet or a font is followed by the frame, and a link to a stranger, or a navigation the page makes itself, is untouched. An in-page `#top` is the frame's own jump. A file the store's walk skips, under a dot-directory or `node_modules`, is claimed and then dropped, in a notice that does not quote it.

### How tall it is, and what it costs

The frame is as tall as its page, clamped between `6rem` and two screens, with `70dvh` for a frame that reports no height. The reported height is a claim from an untrusted frame, and is clamped rather than obeyed ([plugins/hypertext.md](plugins/hypertext.md)).

A `.html` is read and not written: no editor, and no create op. It is in the set as a path, so an open page follows the file on disk. The preview asks for the file's head and a revision and fetches the bytes itself, so a page arrives one fetch later than a body, and two readers are two reads. An agent reading the bytes has them re-read on every later revision.

A `.html` that is served and will not open says so on its page: `This file couldn't be opened, so there's nothing to show.` Which way it is unavailable is not said, since that would describe the disk to anybody who reaches the port.

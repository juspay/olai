# Slots: where a plugin draws, and who owns each one

A slot is a named place in the page where a plugin draws a component, such as `app.banner`.[^api]

## Which plugin owns which slots

Each plugin owns the slots it defines, and the renderer owns `root`, the slot that is always there.[^owners] The closed blocks below list every owner, its slots, and what each takes.

## How many components a slot holds

What a slot is keyed by decides how many components it holds and who may add one. You never supply the key, except a property kind's word, which olai joins to the plugin's name.[^list]

| Keyed by | Holds | Example |
| --- | --- | --- |
| `plugin` | one component per plugin, under the name the runtime stamped | `app.header`, `delivery.mark` |
| `kind` | one component per property kind, under that kind's bare word | `outline.row.chip`, `outline.row.pane` |
| `app` | one component in all; a second plugin asking is refused by name | `app.viewer`, `search.box.below` |
| `nothing` | a list; one plugin may put several components in it | `outline.row.action`, `sidebar.entry` |

## Adding a component and taking it away

A plugin adds a component with `contribute(slot, value, { children, activate })`, and that registration belongs to it.[^activate] `Slots.register(name, …)` does the same with only the slot's name.[^facade] Declaring a slot in TypeScript creates nothing while olai runs.[^declare] Two registrations that conflict are refused.[^checks]

## What survives a plugin leaving

A plugin that goes away takes its own state and leaves unrelated work standing.

- Switching another plugin on or off leaves an outline's editor, selection and pending confirmation untouched.
- The outlines plugin drops the drafts it held, and starts fresh when it comes back.[^outlines]
- Undo history belongs to whichever plugin drew the content.[^undo]
- The confirmation for deleting a file leaves with the files plugin.
- A plugin talking to an outside program opens its shared subscriptions once, while it is mounted.[^appliance]
- A header readout and the health dot cannot disagree.[^dot]

[^api]: The plugin API defines the type that refers to a slot, and the calls that add a component and take it away. It holds no list of slots and no types for what they draw: each plugin owns the descriptions of its own slots and its own types, exported from its `/slots` or `/contract` subpath.

    Each description carries its owner's sentence saying what a component there is handed, which `vault-plugins_inspect` lists. The server reads a browser-only plugin's descriptions off its `/slots` subpath and never imports its browser code.

[^owners]: The owners are these plugins: outlines, navigation, layout, the sidebar, chat, markdown, files, preferences, search, the plugins panel and the renderer. The files plugin also owns the `files.state` service, which is a service rather than a slot.

[^list]: A slot keyed by nothing is a list, and it refuses nothing, because there is no key for two components to collide on. Where a collision in a list does matter, such as two plugins claiming one keyboard chord, the plugin that reads the list refuses it.

[^activate]: What `activate` is for: it acquires whatever that one entry needs, in a scope of its own, and anything that scope holds exists only while the entry is in use.

[^facade]: Registering by name alone: such a registration says neither who owns the slot nor how many components it holds, because it does not know. It may also arrive before the owner does: it waits, and then joins the slot under the owner's rules about keys. Taking it away drains it before releasing it. An owner that comes back is a new one, so the registration gets a fresh scope rather than reusing the old one.

[^declare]: Declaring a slot in TypeScript is not the same as creating one while olai runs. A plugin that wants the types imports the owner's `/slots` subpath, and those descriptions become child declarations of the entry using them. A declaration on its own starts nothing and allocates nothing.

[^checks]: What happens on a conflict: nothing picks a winner quietly. Reserved slots, the rules about keys, two plugins claiming ownership, cycles, and an entry that failed to start are all checked both while entries wait and when they start.

    Inspecting a build reports what it could contribute, and reads only fixed data: the descriptions exported by that build's plugin modules, which never change and do not depend on what is running. An owner missing from the list you hand it contributes no slots, and nothing is kept between calls.

[^outlines]: When the outlines plugin leaves it drops the drafts it was holding and stops its queued editor work from writing anything. When it comes back, it starts fresh.

[^undo]: Undo history belongs to whichever plugin drew the content, and the undo notice follows whichever history has focus. Going to a named file clears the old history straight away, without waiting for metadata still arriving.

[^appliance]: One subscription per outside program: kolu has one fleet, odu one collection of runs, Xyne Spaces one link cell, mail one account cell. Each is opened in that plugin's own activation, the scope that lasts as long as the plugin is mounted, and provided to that plugin's own part of the page. None of them wraps unrelated content in `app.mount`, whose renderer belongs to the layout plugin.

[^dot]: The readout in the header and the health dot read the same value, owned by the same plugin while it is mounted, so they cannot disagree, and both go away with the registration.

<details>
<summary>Every owner, and the slots it owns</summary>

| Owner | Slots |
| --- | --- |
| Outlines | `outline.row.chip`, `.pane`, `.block`, `.placement`, `.aside`, `.fold`, `.action`, `outline.crumb.aside`, `outline.page.head`, `.foot` |
| Outlines | `outlines.dated-row`, `outlines.page-view`, `outlines.title`, `outlines.property-route` |
| Navigation | `app.route`, `app.keys`, `app.palette` |
| Navigation | `navigation.content`, `navigation.pages`, `navigation.palette-adapters`, `navigation.link-previews` |
| Layout | `app.header`, `app.banner`, `app.viewer`, `app.mount` |
| Layout | `layout.sidebar`, `layout.strip`, `layout.tools`, `layout.thumbs`, `layout.overlays`, `layout.content-status` |
| Sidebar | `sidebar.entry`, `sidebar.section`, `sidebar.regions`, `sidebar.rail` |
| Chat | `conversation.wake`, `delivery.mark`, `tool.reply` |
| Markdown | `markdown.body`, `markdown.properties`, `markdown.note-line` |
| Files | `files.types`, `files.kinds`, and the `files.state` service |
| Preferences | `preferences.sections` |
| Search | `search.box.below` |
| Plugins panel | `plugins.row` |
| Renderer | `root`, the one slot that is always there |

</details>

<details>
<summary>What each slot takes</summary>

### `preferences.sections`

A contribution is `{ heading, order, scope, body }`.

- `heading` is a key of the preferences plugin's own table (`appearance`, `outlines` or `notifications`, drawn in that order), or a heading of a plugin's own, carrying that plugin's name and a way to read the words the build gives it.
- `order` places a contribution among the rows under that heading only, lower numbers first.
- `scope` says where its values are kept, `browser` or `shared`. It is declared rather than guessed. Groups kept in the browser are drawn first, then shared ones, and each run of them closes with a line saying which it was.
- Contributions naming one heading are drawn together under it, and a heading whose contributors are all switched off is not drawn at all.

### `app.header`

A contribution is `{ place, body, status? }`.

- `place` is `lead`, a place in the bar itself, or `cluster`, a row of the health popover on a desktop.
- `status` is a `{ tone, label, detail? }` that updates itself, read from state the contributing plugin owns while it is mounted, so it goes away with the registration.
- `tone` is `healthy`, `quiet`, `notice` or `alarm`. Each row paints its own dot from one shared table, and the health dot in the bar shows the worst tone present, so a dot that is not green always has a row of its colour under it.

### `layout.tools`

A contribution is `{ body, headerOrder, closetOrder, mobileWithoutSidebar?, desktop? }`.

- `desktop` picks where it goes on a desktop, `header` or `health`, and `body` is told where it is being drawn: `header`, `health` or `closet`.
- A button placed at `health` is drawn beside the health dot and gives the popover a row of its own. Clicking that row closes the popover and opens the button's panel, anchored to the dot. Preferences and Plugins both ask for `health`, so no door of olai's own stands in the bar.
- Rows at `health` stand in `headerOrder`: Preferences, then Plugins, the order the phone drawer's foot uses.
- A button whose open or closed state is kept outside the app frame, as the plugins panel keeps its own inside the plugin inspector, is drawn again by that button when the frame is rebuilt.

### `sidebar.entry` and `sidebar.section`

An entry is `{ place, body, rail? }` and a section is `{ said, body, place? }`.

- An entry's `place` is `top`, the first entries in the column, `bottom`, after the sections placed `top`, or `foot`, pinned under the scrolling list where it stays in view however long the list gets.
- A `foot` entry's icon sinks to the bottom of the strip of icons, which is where Trash sits.
- A section's `said` is its heading, in the contributing plugin's own words.
- A section's `place` is `top`, the default, above the pinned pages and the files, or `bottom`, after the files. **Needs you** is `top`; **Chats** and **Plugins** are `bottom`.

### `files.types` and `files.state`

A `files.types` contribution is `{ making, Create }`, contributed by the plugin that owns the file kind.

- `making` is the item that kind puts in the `+` menu under the Outlines heading, and is `undefined` while that kind cannot create files, in which case there is no item.
- `Create` is that kind's box for naming a new file, drawn under the heading and empty until the item opens it.

`files.state` is a service rather than a slot, with `Delete`, `New` and `open(kind)`. `open` opens the new-file box for one kind, which is what clicking that kind's `+` item does, and what a page offering to make the first file of a kind calls.

### `files.kinds` and `navigation.pages`

Both belong to the plugins that read them, and both take contributions keyed by a file kind: either a specific kind, `{ kind }`, or what that kind of file holds, `{ holds }`. A contribution for a specific kind wins over a general one.

| Slot | A contribution is |
| --- | --- |
| `files.kinds` | `{ by, glyph, noun, article, testid }`: how a file of this kind is drawn and named |
| `navigation.pages` | `{ by, page, edits }`: the page an address of this kind opens, and whether it can be edited |

The icon and the page are independent, so a kind may have one without the other. The outlines plugin contributes both once, for `holds: "nodes"`, and a plugin that only teaches olai a file format needs no browser code at all.

### `outline.row.action`

A contribution is a function from a row to a list of entries, each one either a command, `{ id, label, writes, run, confirm? }`, or a group, `{ id, label, writes, choices }`.

- A group draws as a submenu, so a command with several options costs the top level of the menu one line. A plugin with a single option hands over a plain command.
- `writes` puts the entry among the entries that read or among those that write. The menu keeps **Move to Trash** last.
- `run` returns the sentence it refuses with, which the menu shows beside the row it was opened on, so a plugin can explain an expected failure in its own words.

### `outline.crumb.aside`

A contribution is a component taking `{ node, record? }`, drawn beside the link in every breadcrumb trail the outlines plugin owns, and handed by search to the line saying where a result is, wherever search draws one. It is a component of its own, so it sits beside the link rather than inside it. Returning nothing leaves the breadcrumb as it was, and with nobody contributing, the slot draws nothing.

### `navigation.link-previews`

A contribution is `{ priority, matches, Preview }`, mounted once per page, and a page never changes while it is mounted.

- The highest priority that matches wins. The chat plugin's 100 beats the outlines plugin's 0 when the list chat already holds says this link is a conversation.
- Equal priorities are sorted by which plugin contributed them, so the order plugins started in cannot change which one is picked.
- A plugin may take out a lease for that page when the preview is built, and the card owns the lease. Navigating away, removing the link, dismissing the card and withdrawing the contribution all release it.
- A plugin leaving removes its component, and a plugin coming back is matched through the live list of slots.

### `markdown.note-line`

A contribution is one component, drawn as a single line at the top of a note's page, under the path and above the properties. The slot takes one occupant.

- Markdown places the line and tells it two things: the note's path, and the name a person reads for that note.
- The chat plugin fills it with how that note's chat stands and **Open beside ›**, or with a box that starts a chat where there is none.
- The contribution lives for the life of its own activation, so a plugin that leaves takes the line with it and the page is whole.
- No other page has one. An outline, a day, the Trash and the page of a kind olai only shows draw nothing here.

</details>

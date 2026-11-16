# Who owns each extension location

A location, also called a slot, is a named place in the page where a plugin hangs a face, such as `app.banner`. This page says which capability owns which locations, what each contribution is, and what happens when an owner comes and goes.

The plugin API defines the reference type and the register and withdraw verbs. It carries no catalogue of locations and no application face types: each capability owns its own static descriptors and its own types, exported from its `/slots` or `/contract` door.

## The owners

| Owner | Locations |
| --- | --- |
| Outlines | `outline.row.chip`, `.pane`, `.block`, `.placement`, `.aside`, `.fold`, `.action`, `outline.crumb.aside`, `outline.page.head`, `.foot` |
| Outlines | `outlines.dated-row`, `outlines.page-view`, `outlines.title`, `outlines.property-route` |
| Navigation | `app.route`, `app.keys`, `app.palette` |
| Navigation | `navigation.content`, `navigation.pages`, `navigation.palette-adapters`, `navigation.link-previews` |
| Layout | `app.panel`, `app.header`, `app.banner`, `app.viewer`, `app.mount` |
| Layout | `layout.sidebar`, `layout.strip`, `layout.tools`, `layout.thumbs`, `layout.overlays`, `layout.content-status` |
| Sidebar | `sidebar.entry`, `sidebar.section`, `sidebar.regions`, `sidebar.rail` |
| Chat | `conversation.wake`, `delivery.mark`, `tool.reply` |
| Markdown | `markdown.body`, `markdown.properties` |
| Files | `files.types`, `files.kinds`, and the `files.state` service |
| Preferences | `preferences.sections` |
| Search | `search.box.below` |
| Plugins panel | `plugins.row` |
| Renderer | `root`, the one permanent location |

## How a location is keyed

A location's key decides how many faces it holds and who may hold one. The contributor never supplies the key except for a kind word, which is composed with the plugin's name.

| Keyed by | Holds | Example |
| --- | --- | --- |
| `plugin` | one face per plugin, under the name the runtime stamped | `app.header`, `delivery.mark` |
| `kind` | one face per property kind, by its bare word | `outline.row.chip`, `outline.row.pane` |
| `app` | one face in all, and a second claimant is refused by name | `app.panel`, `search.box.below` |
| `nothing` | a list, in which a plugin may hang several faces | `outline.row.action`, `sidebar.entry` |

A list refuses nothing, because there is no key to collide on. Where a collision in a list matters, such as two plugins claiming one chord, it is refused by whichever capability reads the list.

## What each location takes

### `preferences.sections`

A contribution is `{ heading, order, scope, body }`.

- `heading` is a key of preferences' own table (`appearance`, `outlines` or `notifications`, drawn in that order), or a plugin heading carrying a plugin's name and a reader for the words the build gives it.
- `order` places a contribution among that heading's rows only, lower first.
- `scope` says where its values are kept, `browser` or `shared`, and is declared rather than inferred. Browser groups draw first, then shared ones, each closing with the scope line for its run.
- Contributions naming one heading are drawn together under it, and a heading whose contributors are all switched off is not drawn.

### `app.header`

A contribution is `{ place, body, status? }`.

- `place` is `lead`, the seat in the bar, or `cluster`, a row of the desktop health popover.
- `status` is a reactive `{ tone, label, detail? }` read from state the contributor's own activation owns, so it is withdrawn with the registration.
- `tone` is `healthy`, `quiet`, `notice` or `alarm`. Each row paints its own dot from one shared table, and the bar's health dot wears the worst tone present, so a dot that is not green always has a row of its colour under it.

### `layout.tools`

A contribution is `{ body, headerOrder, closetOrder, mobileWithoutSidebar?, desktop? }`.

- `desktop` picks the desktop seat, `header` or `health`, and `body` is told where it is drawn: `header`, `health` or `closet`.
- A `health` door is mounted beside the dot and lends the popover its row. Clicking the row shuts the popover and opens that door's panel, anchored to the dot.
- A door whose open state lives outside the shell, as the plugins panel keeps it in the inspector's activation, is drawn again by that standing door when the shell is rebuilt.

### `sidebar.entry` and `sidebar.section`

An entry is `{ place, body, rail? }` and a section is `{ said, body }`.

- `place` is `top`, the column's first doors, `bottom`, after the plugin sections, or `foot`, pinned under the scrolling list where it stays in view however long the list runs.
- A `foot` entry's icon sinks to the rail's foot, which is where Trash sits.
- A section's `said` is the heading, in the plugin's own words.

### `files.types` and `files.state`

A `files.types` contribution is `{ making, Create }`, contributed by the kind's own row.

- `making` is the item the kind puts in the Outlines heading's `+` menu, and is `undefined` while that kind cannot create files, when there is no item.
- `Create` is the kind's name box, drawn under the heading and empty until the item opens it.

`files.state` is a service rather than a location, with `Delete`, `New` and `open(kind)`. `open` opens the new-file box for one kind, which is what clicking that kind's `+` item does, and is what a page offering the first file of a kind calls.

### `files.kinds` and `navigation.pages`

Both belong to their readers and take contributions keyed by a file kind: either a row id, `{ kind }`, or what the kind holds, `{ holds }`. A row-specific contribution wins over a general one.

| Location | A contribution is |
| --- | --- |
| `files.kinds` | `{ by, glyph, noun, article, testid }`: how a file of this kind is drawn and named |
| `navigation.pages` | `{ by, page, edits }`: the page an address of this kind opens, and whether it edits |

Glyph and page are independent, so one may be absent without the other. Outlines contributes both once, for `holds: "nodes"`, and a format row needs no browser half at all.

### `outline.row.action`

A contribution is a function from a node to a list of entries, each a verb `{ id, label, writes, run, confirm? }` or a choice `{ id, label, writes, choices }`.

- A choice draws as a submenu, so a verb with several options costs the top level one line. A plugin with a single option hands a plain verb.
- `writes` places the entry among the reads or among the writes. The menu keeps **Move to Trash** last.
- `run` returns a refusal sentence, which the menu shows beside the originating row, so a plugin can explain an expected failure in its own words.

### `outline.crumb.aside`

A contribution is a face over `{ node, record? }`, drawn beside the crumb's link in every trail outlines owns, and handed by each search door to the place line. It is a door of its own, so it sits beside the link rather than inside it. Returning nothing leaves the crumb as it was, and with no contributor the location draws nothing.

### `navigation.link-previews`

A contribution is `{ priority, matches, Preview }`, mounted once per route, and a route never changes during a mount.

- The highest priority that matches wins. Chat's 100 beats outlines' 0 when the roster it already holds identifies a conversation.
- Equal priorities sort by contribution owner, so activation order cannot change the selection.
- A provider may take a route-specific lease at construction, and the card owns it. Navigation, anchor removal, dismissal and withdrawal all release that lease.
- A plugin's withdrawal removes its face, and a returning provider is matched through the live roster of locations.

## Registering and withdrawing

Declaring a location in TypeScript is separate from creating one at runtime. A consumer that wants types imports the owner's `/slots` door, and those descriptors become child declarations of the entry that consumes them. Declaring a static contract activates nothing and allocates nothing.

A contribution registers with `contribute(location, value, { children, activate })`. The registration belongs to the caller, and `activate` acquires location-dependent resources in a separate scope whose children exist only while that entry is active.

`Slots.register(name, …)` is the name-only facade over the same registry.

| Behaviour | Detail |
| --- | --- |
| It declares neither owner nor cardinality | a name-only registration carries neither |
| It may arrive before its owner | it waits, then acquires its integration under the owner's key rules |
| Withdrawal drains first | removing the registration drains that integration before releasing it |
| An owner that returns is new | the registration acquires a fresh scope rather than reusing the old one |
| Conflicting registrations fail | no winner is chosen silently |

Reservations, key policies, duplicate ownership, cycles and failed acquisition are all checked while entries wait, as well as when they activate.

Inspection reports what a bundle could contribute and reads only static data: the descriptors exported by the bundle's capability modules, which are immutable and independent of the live table. An owner missing from the supplied catalogue contributes no locations, and no global list is kept between calls.

## What survives an owner leaving

A plugin's departure clears its own state and leaves unrelated work standing.

- Changing an unrelated provider preserves an outline's editor, selection and pending confirmation.
- When outlines departs it clears its retained drafts and stops its queued editor work from issuing writes. When it returns, it starts fresh.
- Undo history belongs to each content provider, and the undo notice follows the focused history. Navigating to a named file clears the old history at once, without waiting for streamed metadata.
- File deletion confirmation follows the files owner.
- Each appliance acquires its shared subscriptions inside its own activation and provides them to its own subtree: one fleet for kolu, one run collection for odu, one link cell for Xyne Spaces, one account cell for mail. None of them wraps unrelated content in `app.mount`, whose renderer belongs to layout.
- A header readout and the health dot cannot disagree: both read the same activation-owned value, and both leave with the registration.

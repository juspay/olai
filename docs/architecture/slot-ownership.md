# Extension location ownership

A location (also called a slot) is a named place in the UI where a plugin can mount a contribution, such as `app.banner`. This page says which capability owns which locations and what happens when owners come and go.

The permanent plugin API defines only the generic location reference type and the register/withdraw operations. It carries no catalog of notebook slots and no application face types. Each capability owns its own static descriptors and TypeScript contracts.

| Owner | Compatibility locations |
| --- | --- |
| Outlines | `outline.row.chip`, `.placement`, `.aside`, `.fold`, `.pane`, `.block`, `.action`, `outline.page.head`, `.foot` and property contexts |
| Navigation | `app.route`, `app.keys`, `app.palette` |
| Layout | `app.panel`, `app.header`, `app.banner`, `app.viewer`, `app.mount`, `layout.strip`, `layout.tools` |
| Sidebar | `sidebar.entry`, `sidebar.section` |
| Chat | `conversation.wake`, `delivery.mark`, `tool.reply` |
| Search | `search.box.below` |
| Preferences | `preferences.sections` |
| Files | `files.types`, and the `files.state` service |
| Plugin inspector | `plugins.row` |

## The shapes a contributor fills in

These are the contracts a contributor writes against. Each is a static type
exported by the owner; the owner draws, the contributor owns what it hands over.

| Location | A contribution is | Notes |
| --- | --- | --- |
| `preferences.sections` | `{ heading, order, scope, body }` | `heading` is a key of preferences' own `HEADINGS` table (`appearance`, `outlines`, `notifications`) — whose fixed headings draw in that order — or a plugin heading carrying a plugin's name and a READER for its words (the build's label, off the roster). `order` places a contribution among that heading's rows only. `scope` says where its values are kept (`browser` or `shared`), and it is declared rather than inferred: `browser` groups draw first, then `shared` ones, each closing with the scope line for its run. Contributions naming the same heading are drawn together under it. A heading whose contributors are all switched off is not drawn. |
| `app.header` | `{ place, body, status? }` | `place` is `lead` (in the bar) or `cluster` (a row of the desktop health popover). `status` is a reactive `{ tone, label, detail? }` read from state the contributor's own activation owns; `tone` is `healthy`, `quiet`, `notice` (amber dot) or `alarm` (red dot), and the dot wears the worst tone present. |
| `layout.tools` | `{ body, headerOrder, closetOrder, mobileWithoutSidebar?, desktop? }` | `desktop` picks the desktop seat in the words `body` is told (`ToolWhere`): `header` (default) or `health`, the foot of the health popover. `body` is told where it is drawn (`header`, `health` or `closet`). A `health` door is mounted beside the dot and lends the popover only its row; picking the row shuts the popover and opens the door's panel, anchored to the dot. A door whose open state lives outside the shell (the plugins panel keeps it in the inspector's activation) is drawn again by that standing door when the shell is rebuilt. |
| `sidebar.entry` | `{ place, body, rail? }` | `place` is `top`, `bottom` or `foot`. `foot` is pinned under the scrolling list and sinks to the rail's foot (Trash). The old `sidebar.vault` location is gone; nothing contributes a vault entry to the sidebar any more. |
| `files.types` | `{ making, Create }` | `making` is the item the kind puts in the Outlines heading's `+` menu, or `undefined` while it cannot create files. `Create` is the kind's name box, empty until the item opens it. |
| `files.state` | a service with `Delete`, `New` and `open(kind)` | `open` opens the new-file box for one kind, the same as picking that kind's `+` item. A page offering the first file of a kind (an empty folder's `New outline`) calls it. |
| `outline.row.action` | a verb `{ id, label, writes, run, confirm? }` or a choice `{ id, label, writes, choices }` | A choice is drawn as a submenu of verbs (`Start an agent ›` and its engines). A plugin with a single option hands a plain verb rather than a one-entry choice. `writes` places the entry among the reads or among the writes. |

## Declaring and registering

Declaring a location in TypeScript is separate from creating one at runtime.

- A consumer that wants types imports the owner's `/slots` door, which is the package subpath the owner exports its descriptors from.
- The owner's descriptors then become child declarations of the entry that consumes them.
- Declaring a static contract does not activate a location and does not allocate storage for it.

`Slots.register(name, ...)` is a source-compatible facade that adds a name-only reference to the same native registry.

| Behavior | Detail |
| --- | --- |
| Cannot declare an owner or cardinality | A name-only registration carries neither. |
| May arrive before its owner | It waits until the owner supplies the location, then acquires its integration under the owner's key rules. |
| Withdrawal | Removing the registration drains that integration before releasing it. |
| Owner returns | The registration acquires a fresh scope; it does not reuse the old one. |
| Conflicting registrations | They fail. No winner is chosen silently. |

## Plugin inspection

Inspection reports what a bundle could contribute, reading only static data.

- It reads the static descriptors exported by the bundle's capability modules.
- This metadata is immutable and independent of the live registration table.
- An owner missing from the supplied module catalog contributes no slots.
- The API keeps no global list between calls.

## Builtin appliances

Each builtin appliance acquires its shared subscriptions inside its own activation and shares them downward, rather than through a global.

| Appliance | Contributions | Shared state |
| --- | --- | --- |
| Kolu | Terminal blocks and header | One fleet |
| Odu | Chip and matrix | One run collection |
| Spaces | Header | One link cell |
| Mail | Header readout and its own plugins-panel row | One account cell |

A header readout (`app.header`, `cluster`) is drawn by Layout as a row of the
desktop health popover, and its optional `status` accessor colours the health
dot. Both are the contributor's: the status reads the same activation-owned
value the row does — one tone per state, painted from the one `TONE` table —
and is withdrawn with the registration, so Layout draws the row and the dot
without owning or importing any readout's state, and the two cannot disagree.

- Each contribution provides that state to its own subtree only.
- They do not wrap unrelated content in `app.mount`. Its compatibility renderer belongs to Layout.

## What survives a provider change

A plugin's departure clears only its own state; unrelated editing state keeps working.

- Changing an unrelated provider preserves an outline's editor, selection and pending confirmation.
- When Outlines departs, it clears retained drafts and stops its queued editor work from issuing new writes. When Outlines returns, it starts fresh.
- File deletion confirmation follows the Files owner.
- Undo history belongs to each content provider, and the undo notice follows the focused history.
- Navigating to a named file clears the old history immediately, without waiting for streamed metadata.

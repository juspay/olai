# Extension location ownership

A location (also called a slot) is a named place in the UI where a plugin can mount a contribution, such as `app.banner`. This page says which capability owns which locations and what happens when owners come and go.

The permanent plugin API defines only the generic location reference type and the register/withdraw operations. It carries no catalog of notebook slots and no application face types. Each capability owns its own static descriptors and TypeScript contracts.

| Owner | Compatibility locations |
| --- | --- |
| Outlines | `outline.row.chip`, `.placement`, `.aside`, `.fold`, `.pane`, `.block`, `.action`, `outline.page.head`, `.foot` and property contexts |
| Navigation | `app.route`, `app.keys`, `app.command`, `app.palette` |
| Layout | `app.panel`, `app.header`, `app.banner`, `app.viewer`, `app.mount` |
| Sidebar | `sidebar.entry`, `sidebar.section` |
| Chat | `delivery.mark`, `tool.reply`, `engine.install` |
| Search | `search.box.below` |

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

- Each contribution provides that state to its own subtree only.
- They do not wrap unrelated content in `app.mount`. Its compatibility renderer belongs to Layout.

## What survives a provider change

A plugin's departure clears only its own state; unrelated editing state keeps working.

- Changing an unrelated provider preserves an outline's editor, selection and pending confirmation.
- When Outlines departs, it clears retained drafts and stops its queued editor work from issuing new writes. When Outlines returns, it starts fresh.
- File deletion confirmation follows the Files owner.
- Undo history belongs to each content provider, and the undo notice follows the focused history.
- Navigating to a named file clears the old history immediately, without waiting for streamed metadata.

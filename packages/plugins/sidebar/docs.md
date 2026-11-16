# Sidebar

`sidebar` draws the left column of the app, labelled **Sidebar**, and the
narrow rail it collapses to. It holds no files and no readings of its own:
every row, heading and shelf in it is contributed by another plugin, and this
row decides only where each one stands.

Using the column day to day is [../getting-around.md](../getting-around.md).

## What the column shows

Top to bottom:

| Region | Contributed by |
| --- | --- |
| Agenda, with what is owed folded under it while anything is overdue or due today, then Today with the month under it | [journal.md](journal.md) |
| Inbox | [capture.md](capture.md) |
| **Needs you** and **Chats** | [chat.md](chat.md) |
| **Plugins** | [vault-plugins.md](vault-plugins.md) |
| **Pinned** | [pins.md](pins.md) |
| **Outlines**, **Reference** and the `olai` group of `_olai/` files | [files.md](files.md) |
| **Trash**, pinned under the scrolling list | [trash.md](trash.md) |

On a phone the column is a drawer, and the foot sits above the drawer's own
foot, which carries the Preferences and Plugins rows. On a desktop the foot
shares a line with **Collapse sidebar**.

## The rail

Collapsing the column leaves a rail of icons, also named **Sidebar**, with
**Expand sidebar** at the top and the same entries' icons under it in the same
order. A `foot` entry's icon sinks to the rail's bottom.

An icon says what it opens twice, because the two readings differ on purpose:
the tip a pointer or a keyboard gets (`Outlines`) and the name everything else
reads (`Open outlines`). Neither is the browser's own `title`, which it places
itself and shows to a pointer alone.

Opening and closing the column is `Cmd` + `\` (`Ctrl` + `\` away from a Mac),
the palette's `Toggle sidebar`, and the burger on a phone, named **Show
sidebar** and **Hide sidebar**. `Reset sidebar width` in the palette puts a
dragged column back to its default.

## Headings

Every heading in the column wears one treatment: the words are written in
sentence case and drawn as small, spaced capitals, so a test or a screen reader
reads `Outlines`, not `OUTLINES`.

Some headings carry an action: the `+` beside **Chats** opens the palette at
New chat, the `+` beside **Plugins** opens it at New plugin, and the `+` beside
**Outlines** opens the new-file menu. The plugin that owns the heading draws
the action too, so the two leave together when its row switches off.

A section decides for itself what an empty one looks like. **Chats** and
**Pinned** draw nothing at all until there is something in them. **Plugins**
stands whatever the directory holds, with one row reading **Ask for your first
plugin…**, because a directory with no plugins is where somebody is looking for
the way to make one ([vault-plugins.md](vault-plugins.md)).

## What other plugins contribute

| Location | Takes |
| --- | --- |
| `sidebar.entry` | a row placed `top` (the column's first doors), `bottom` (after the plugin sections) or `foot` (pinned under the list), with an optional rail icon |
| `sidebar.section` | a heading in the plugin's own words, and what sits under it |
| `sidebar.regions` | a region of the column: `primary`, `shelf` or `files` |
| `sidebar.rail` | an icon on the collapsed rail |

A contributor names a placement, never a pixel and never another plugin: the
Trash is at the foot because the trash row asked for `foot`. Contributions wait
while the sidebar or the layout row is absent and come back when their owner
returns; the contributing plugin's own work stays mounted meanwhile.

Switching `sidebar` off removes the column and the rail, and leaves the open
page and its editor exactly as they are. The seat it fills is `layout.sidebar`
([layout.md](layout.md)).

# Sidebar

The `sidebar` plugin draws the left column of the app, labelled **Sidebar**, and the narrow strip of icons the column collapses to.[^holds]

Using the column day to day is [../getting-around.md](../getting-around.md).

## What the column shows

Top to bottom:[^phone]

| Entry | Added by |
| --- | --- |
| Agenda, with what is overdue or due today folded under it, then Today with the month under it | [journal.md](journal.md) |
| Inbox | [capture.md](capture.md) |
| **Needs you**, while a chat is waiting on you | [chat.md](chat.md) |
| **Pinned** | [pins.md](pins.md) |
| **Outlines**, **Reference** and the `olai` group of `_olai/` files | [files.md](files.md) |
| **Chats**[^chats] | [chat.md](chat.md) |
| **Plugins** | [vault-plugins.md](vault-plugins.md) |
| **Trash**, pinned under the scrolling list | [trash.md](trash.md) |

## The strip of icons

Collapsing the column leaves a narrow strip of icons, also named **Sidebar**. **Expand sidebar** is at the top, and the icons of the entries above follow in the same order.[^rail]

To open and close the column, press `Cmd` + `\` (`Ctrl` + `\` away from a Mac), run `Toggle sidebar` in the command palette, or tap the burger button on a phone.[^toggle]

## Headings

Every heading in the column is drawn the same way.[^case] Some headings carry a button.[^plus] A section with nothing in it either draws nothing or draws a line of its own.[^empty]

## How other plugins add to the column

A plugin that adds something asks for a named place, such as `foot`, and never for a pixel position or a place next to a named plugin. **Trash** sits at the bottom because the trash plugin asked for `foot`.[^waiting] The named places are listed in the block at the foot of this page.

Switching `sidebar` off removes the column and the strip of icons, and leaves the open page and its editor exactly as they are. It fills the `layout.sidebar` place in the app frame ([layout.md](layout.md)).

[^holds]: The sidebar plugin has no files and no data of its own. Every entry, heading and section in the column comes from another plugin, and the sidebar only decides where each one stands.

[^phone]: On a phone the column is a drawer that slides in. Its foot sits above the drawer's own foot, which carries the Preferences and Plugins entries. On a desktop the foot shares a line with **Collapse sidebar**.

[^rail]: An entry placed `foot` has its icon sink to the bottom of the strip. Each icon carries two labels, which differ on purpose: the tooltip a pointer or the keyboard shows (`Outlines`), and the name a screen reader and the tests read (`Open outlines`). Neither of them is the browser's own `title` attribute, which the browser places itself and shows only to a pointer.

[^toggle]: On a phone the burger button is named **Show sidebar** and **Hide sidebar**. `Reset sidebar width` in the palette puts a column you have dragged back to its default width.

[^case]: How a heading is drawn: the words are written in sentence case and drawn as small, widely spaced capitals, so a test or a screen reader reads `Outlines`, not `OUTLINES`.

[^plus]: The buttons on headings: the `+` beside **Chats** opens the palette at New chat, the `+` beside **Plugins** opens it at New plugin, and the `+` beside **Outlines** opens the menu for making a new file. The plugin that owns a heading draws its button too, so both leave together when that plugin is switched off.

    These buttons, and the arrows beside **Agenda** and **Today**, are drawn while the pointer is in the column or the keyboard is on them, and always on a touch screen.

[^chats]: A **Chats** row is named after the row or the file its chat is about, with that agent's mark beside it. Clicking it opens the chat's own page, and the row's two-column button, **Open beside**, puts that page in the pane to the right on a desktop. A document whose chat is set to open beside brings the document along; everything else opens alone ([chat.md](chat.md)).

[^empty]: An empty section: **Pinned** draws nothing at all until there is something in it, while **Chats** keeps its heading and its `+` with no chats yet. **Plugins** is always drawn, whatever the directory holds, with one entry reading **Ask for your first plugin…**, because a directory with no plugins is where somebody is looking for the way to make one ([vault-plugins.md](vault-plugins.md)).

[^waiting]: While the sidebar plugin or the layout plugin is switched off, what other plugins contribute to the column waits, and comes back when the sidebar returns. Those plugins keep running and doing the rest of their work meanwhile.

<details>
<summary>Every place in the sidebar another plugin can fill</summary>

| Place | Takes |
| --- | --- |
| `sidebar.entry` | an entry placed `top` (the first entries in the column), `bottom` (after the sections placed `top`) or `foot` (pinned under the list), with an icon for the collapsed strip if it wants one |
| `sidebar.section` | a heading in the plugin's own words and what sits under it, placed `top` (the default, above the pinned pages and the files) or `bottom` (after the files) |
| `sidebar.regions` | a region of the column: `primary`, `shelf` or `files` |
| `sidebar.rail` | an icon on the collapsed strip |

</details>

# Outlines

A row is one line of an outline. This plugin draws the page of every file of rows: the tree, each row's title, note, mark and properties.[^elsewhere]

It also draws the breadcrumbs and the filter box. A note is the text under a row, a mark is **To do**, **Doing**, **Done** or **Cancelled**, and a property is a key and a value. Every mark is spoken as well as drawn.[^spoken]

## The pages it draws

It draws every kind of file whose contents are rows.[^hosted][^seat] A single row has its own page at `/zoom/#<id>`, which the bullet and **Zoom in** open; `/#<id>` selects the row where it is.[^reveal] Links inside a row belong to [navigation.md](navigation.md).[^rowlinks]

## The filter bar

Every page whose address can take `?q=` draws the box: outline pages, a single row's page, a day, the Agenda and the Trash.[^hint] It narrows the page.

On an outline the bar also carries the **Finished** checkbox.[^finished]

## The row menu

A row's `•••` menu, which a long press opens on a phone, is grouped, with a rule between groups.[^groups] The palette lists the same commands flat, so a mark there reads `Mark: Done`.[^submenu]

## Preferences, and a directory with no outlines

Two rows under **Outlines** in the preferences panel ([preferences.md](preferences.md)) set **Row density** and **Show finished**.[^motion] With no outlines at all the page says **No outlines yet** and offers **New outline**.[^empty]

## What an agent can read

Two MCP tools, the calls an agent makes, read rows: `outlines_read` reads one row and its children, `outlines_subtree` everything under a row.[^fields] Outlines also adds a paragraph to an agent's instructions ([mcp.md](mcp.md)).[^paragraph] Switching outlines off takes its pages with it.[^off]

[^elsewhere]: Typing in an outline is [../editing.md](../editing.md); moving work about is [../organising.md](../organising.md).

[^hosted]: Outlines claims those files by registering one bullet glyph and one page, rather than by naming a file format plugin. It also draws the pages other plugins define over a reading of rows, such as the journal's day page and Agenda. A page a plugin draws for itself belongs to [navigation.md](navigation.md) instead.

[^seat]: An outline's page carries a seat at its foot, which chat fills with the conversation about this outline ([chat.md](chat.md)). The page says which file it is drawing, so the front page `/` and an address such as `house.olai#install` are both the outline `house.olai`, with one chat between them. A day, the Agenda and the Trash carry no seat.

[^reveal]: A link written `/#<id>` selects the row in the pane that is already showing it. Where no pane shows it, the row's file opens at that row.

[^rowlinks]: A link inside a row, which means the bullet, a link in the title, or a reference written under it, is handled by [navigation.md](navigation.md). These behave the same on an outline page, on a day page and on the Agenda.

    Clicking one never also starts editing the title or changes which row is selected, even with `Ctrl` or `Cmd` held. A right-click, or a held finger, on a link opens the link menu, while the rest of the row opens the row menu.

[^spoken]: olai gives every mark words as well as a shape, so a screen reader reads them aloud. The glyph beside a row reads `Done, zoom in`, `Doing, zoom in`, `blocked by …, zoom in`, or plain `Zoom in` where the row has no mark. `⇢` before a title says the row is a mirror of a row that lives elsewhere.

    `+N done` says how many finished rows a collapsed row hides. `↻ every week` reads as `Repeats every week`, and a property value that points somewhere, such as a CI run, is drawn as a short label and says its whole value.

    olai writes these words itself, and a pointer gets the same sentence.

[^hint]: The box is labelled **Filter**. Narrowing a page with it is [../filtering.md](../filtering.md), and the query language is [../search.md](../search.md).

    Click into the box while it is empty and it lists the forms a filter can take. Arrow keys move through that list, `Enter` or a click puts the form in the box with its example part selected, and `Escape` closes the list and keeps the cursor where it was. Nothing is chosen until you press an arrow key, so `Enter` in an empty box does nothing.

[^finished]: The checkbox is named `Show finished`: ticked, the page shows finished work; clear, it hides it. It is also on a single row's page opened from an outline.

    The page follows your Show finished preference until you click the box. From then on the page keeps its own answer, and a **Reset** link beside it, named `Use my default`, hands the choice back to the preference. `Cmd` + `O` sets the same answer, and the box follows it. A day page and the Agenda have no box, because the choice is not about them.

[^groups]: The groups, in order: **Zoom in**, **Mark ›** and any plugin command that only reads. Then **Set date…** or **Change date…**, **Set repeat…** on a row with a date, and **Pin to sidebar** or **Unpin from sidebar**.

    Then **Move to…** and **Duplicate**, then plugin commands that write, in the order their plugins loaded, then **More ›**, whose entries are in the closed block below. **Move to Trash** comes last and on its own, and asks before it moves anything.

[^submenu]: The triangle beside the `•••` opens and closes the row, so the menu has no entry for that. A submenu opens on a click, and from the keyboard on `ArrowRight`, `Enter` or `Space`, with the cursor on its first entry. `ArrowLeft` closes it and gives the cursor back. On a phone a submenu covers the panel rather than hanging off the screen.

    An entry that asks a question replaces the whole panel with it, with the cursor on the answer. Switching browser tabs closes an open menu, question and submenus included; coming back restores the entry you were on.

[^motion]: The density choices are **Compact**, **Cozy** and **Open**. **Show finished** is on or off, with the hint `Pages can override this`. A computer set to reduce motion changes how the tree moves, never what it says. A triangle turns over without animating through the angle, and a row you navigate to appears in the middle of the screen at once rather than scrolling there. Colours do not change, and the row is still selected and still highlighted.

    What a screen forcing its own colours keeps is [theme.md](theme.md).

[^empty]: Pressing **New outline** opens the box for a new file path ([files.md](files.md)). With the files plugin off there is no box and no button. An address that names nothing says **Page not found**, names what was asked for, and offers **Go home**.

[^fields]: `outlines_read` answers its row in full and lists its immediate children. `outlines_subtree` answers everything under its row, or every top-level row of a file you name, nested to `depth` levels; `depth` is 3 unless you say otherwise.

    `fields` names what each row carries: in `outlines_read` it shapes the list of children, and in `outlines_subtree` it shapes every row, including the one you asked for. The closed block below lists every name `fields` takes, what a read refuses, and `withDesc`, the switch for notes.

[^paragraph]: The MCP plugin puts that paragraph into the instructions an agent receives when it starts. It says that a person reads a row's note, so an agent writes one as well-formed markdown rather than as a raw tool result or a wall of text. The paragraph is sent along with this plugin, so a serve without outlines says nothing about notes.

[^off]: Switching outlines off also removes the calls it answers on the server, closes the updates it was listening for, and withdraws the way it drew properties. Documents keep working ([markdown.md](markdown.md)), and an address you kept can draw its page again once outlines is back on. Switching it on again reads the directory and your stored preferences afresh. It does not bring back an unsaved draft from before.

<details>
<summary>What <strong>More ›</strong> holds</summary>

Copy link, Copy as text, Expand all and Collapse all, Add property…, Link to…, Wait for…, Remove from here, Clear date and Stop repeating, each where the row can take it.

</details>

<details>
<summary>What a read answers</summary>

| In `fields` | Carries |
| --- | --- |
| `title`, `parent`, `date`, `repeat`, `desc`, `see`, `after`, `custom` | the row's own fields, exactly as the file holds them |
| `done`, `cancelled`, `doing`, `todo`, `created`, `changed`, `started`, `worked` | the times and the marks as the file holds them |
| `status` | the mark worked out for the row |
| `took` | how long the work took, in whole seconds, worked out as the answer is made, and absent where there are no times to tell it from |
| `custom.<key>` | one property. A property named `took` is `custom.took`, never the worked-out duration, and a row asked for both carries both |

Every row carries its `id` whatever you ask for, and anything you did not name is left out, including where the row sits and what its ancestors are. Leave `fields` out and you get the whole row with its place.

The keys the walk itself adds (`children`, `truncated` and `placed`) are structure rather than fields, so asking for a few fields cannot drop them. The rows inside `children`, and the `shows` inside a `placed` entry, follow `fields` all the same. A `deadLinks` list, where it is not empty, comes back whatever you named.

`withDesc` is `outlines_subtree`'s switch for notes, and it is on by default, because a read aimed at one row usually wants the note. `withDesc: false` is the lean read for a table of contents: ids, titles, marks, properties and structure only. A note comes back whole or not at all, never cut short, and `depth` limits levels rather than prose.

| Refused | What it says |
| --- | --- |
| a name `fields` does not know | the refusal quotes the name, lists every legal one, and adds that every row carries its `id` already |
| `fields` and `withDesc` together | that `fields` is the whole shape of a row, so name `desc` in it and drop `withDesc` |

A read never walks into a mirror, because a mirror is a second view of a row that lives elsewhere. A row with mirrors under it carries `placed` instead, naming the mirror's own id, where the mirror sits, and `shows`, the row it stands for. Mirrors are named and never expanded.

</details>

<details>
<summary>What other plugins can add to an outline</summary>

| Location | Takes |
| --- | --- |
| `outline.row.action` | a command or a choice on a row's menu. The plugin supplies the words, what the press does, and whether it writes; outlines decides where it goes. Entry ids are `<plugin>:<id>` |
| `outline.crumb.aside` | something drawn beside one breadcrumb, given that ancestor's id |
| `outline.row.aside`, `outline.row.fold` | something drawn beside a row, and something drawn inside it when it is open |
| `outline.page.head`, `outline.page.foot` | something drawn above and below a page's rows |
| `outline.row.chip`, `outline.row.pane`, `outline.row.block` | how one kind of property is drawn, keyed by kind |
| `outline.row.placement` | whether a kind of property is drawn among the rows |
| `outlines.title` | one plugin only, which draws a row's title |
| `outlines.dated-row` | one plugin only, which draws a row that has a date |
| `outlines.page-view` | one plugin only, which wraps a page's body |
| `outlines.property-route` | where a property value points, for the meanings that plugin owns |

Outlines adds things elsewhere too: its pages through `navigation.content`, its new-outline entry through `files.types`, and its preference rows through `preferences.sections` under the group `Outlines`.

`outlines.references` is how this plugin answers questions about a row: whether it is visible in a pane, selecting it there, and which file it lives in. Navigation uses that to turn a `/#id` link into a landing, so with outlines off such a link waits and resolves when outlines is back. `outlines.browser-state` holds the undo stack, what each page read, the two registers used while dragging, and the element the floating menus hang from.

</details>

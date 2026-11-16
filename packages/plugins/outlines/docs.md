# Outlines

`outlines` draws the page of every file that holds rows: the tree, each row's
title, note, mark and properties, the breadcrumbs above it and the filter bar
over it. Typing in one is [../editing.md](../editing.md); moving work about is
[../organising.md](../organising.md).

## The pages it draws

It draws every claimed file whose kind holds nodes, through one glyph and one
page contribution, rather than naming a format row. It also hosts the pages
other plugins define over a reading of rows, such as the journal's day and
agenda, while a page a plugin draws itself belongs to
[navigation.md](navigation.md).

A row's own page is `/zoom/#<id>`, which the bullet and **Zoom in** open. A
link spelled `/#<id>` reveals instead: it selects the row where it is already
visible in that pane, and otherwise opens the row's file at that row.

A link drawn inside a row, whether the bullet, a link in the title or a
reference under it, belongs to navigation, on an outline page and on a day or
agenda page alike. Clicking one never also edits the title or changes the
selection, `Ctrl` or `Cmd` held included. A right-click or a held finger on a
link opens the link menu, while the rest of the row opens the row menu.

## What a row says out loud

A row's quiet marks are said in words as well as drawn as shapes, so a keyboard
and a screen reader get them:

| The mark | What it is called |
| --- | --- |
| the glyph cell | `Done, zoom in`, `Doing, zoom in`, `blocked by …, zoom in`, or plain `Zoom in` where the row carries no mark |
| `⇢` before a mirrored title | that it is a mirror |
| `+N done` on a collapsed row | what the fold is hiding |
| `↻` on a repeat badge | `Repeats`, so `↻ every week` reads as `Repeats every week` |
| a hot fact drawn short | its full value |

olai draws these itself rather than leaving them to the browser's `title`,
which answers a pointer and nothing else. The same sentence is the tip.

## The filter bar

Every page that can carry a `?q=` draws the bar: outline pages, a zoomed row,
a day, the Agenda and the Trash. The box is labelled **Filter**, and narrowing
with it is [../filtering.md](../filtering.md); the query language is
[../search.md](../search.md).

Focused and empty, the box opens a hint listing the forms the filter takes.
Arrows walk it, `Enter` or a click puts the form in the box with its example
part selected, and `Escape` puts it away and keeps the caret. Nothing is chosen
until an arrow is pressed, so `Enter` in an empty box still does nothing.

On an outline, and on a zoom into one, the bar also carries the **Finished**
checkbox, named `Show finished`: ticked shows finished work on this page, clear
hides it.

The page follows your Show finished preference until you press the box; from
then on the page holds its own answer, and a **Reset** link beside it, named
`Use my default`, hands the choice back to the preference. `Cmd` + `O` writes
the same answer, and the box follows it. A day and the Agenda have no box: the
choice is not about them.

## The row menu

A row's `•••` menu, which a long press opens on a phone, is short and grouped,
with a rule between groups:

| Group | What it holds |
| --- | --- |
| 1 | **Zoom in**, **Mark ›**, and any plugin verb that only reads |
| 2 | **Set date…** or **Change date…**, **Set repeat…** on a dated row, and **Pin to sidebar** or **Unpin from sidebar** |
| 3 | **Move to…** and **Duplicate** |
| 4 | plugin verbs that write, in bundle order |
| 5 | **More ›**: Copy link, Copy as text, Expand all and Collapse all, Add property…, Link to…, Wait for…, Remove from here, Clear date and Stop repeating, each where the row can take it |
| 6 | **Move to Trash**, last and alone. It asks before it moves anything |

The palette lists the same verbs flat, so a mark there reads `Mark: Done`. A
row's own fold is the triangle beside the `•••`, so the menu offers no
single-row expand or collapse.

A submenu opens on a click, and from the keyboard on `ArrowRight`, `Enter` or
`Space`, with the caret on its first entry; `ArrowLeft` closes it and gives the
caret back. On a phone a submenu overlaps the panel rather than hanging off the
screen.

A verb that asks first swaps the whole panel for its question, with the
caret on the answer. Switching tabs suspends an open menu, its question and
submenus included, and returning restores the entry you were on.

## Empty pages

With no outlines at all the page says **No outlines yet** and offers **New
outline**, which opens the files row's own path box ([files.md](files.md)).
With no files row mounted there is no box and no button. A path that names
nothing says **Page not found**, names what was asked for, and offers **Go
home**.

## Preferences

Two rows under **Outlines** in the preferences panel
([preferences.md](preferences.md)):

| Row | Choices |
| --- | --- |
| **Row density** | **Compact**, **Cozy**, **Open** |
| **Show finished** | on or off, with the hint `Pages can override this` |

A system set to reduce motion changes what the tree does, never what it says. A
chevron turns over without travelling through the angle, and a row navigation
reveals arrives in the middle of the screen at once rather than gliding there.
It is still selected and still accented, and colour is untouched. What a screen
forcing its own colours keeps is [theme.md](theme.md).

## What other plugins contribute

| Location | Takes |
| --- | --- |
| `outline.row.action` | a verb or a choice on a row's menu. The plugin supplies the words, the press, and whether it writes; outlines decides where it goes. Entry ids are `<plugin>:<id>` |
| `outline.crumb.aside` | a face beside one crumb of a trail, given that ancestor's id |
| `outline.row.aside`, `outline.row.fold` | a face beside a row, and one on its fold |
| `outline.page.head`, `outline.page.foot` | a face above and below a page's rows |
| `outline.row.chip`, `outline.row.pane`, `outline.row.block` | how one kind of property is drawn, keyed by kind |
| `outline.row.placement` | whether a kind of property is drawn among the rows |
| `outlines.title` | one occupant, which draws a row's title |
| `outlines.dated-row` | one occupant, which draws a dated row |
| `outlines.page-view` | one occupant, which wraps a page's body |
| `outlines.property-route` | where a property value points, for the meanings that plugin owns |

Outlines contributes in the other direction too: its pages through
`navigation.content`, its new-outline item through `files.types`, and its
preference rows through `preferences.sections` under the group `Outlines`.

`outlines.references` carries this row's naming of a node: whether the row is
visible in a pane, selecting it there, and which file is its home. Navigation
spends it to turn a `/#id` link into a landing, so with this row off a reveal
waits and resolves when the row comes back. `outlines.browser-state` carries
the undo stack, the page readings, the two drag registers and the socket the
floating menus hang from.

## What a read answers

Two MCP tools read rows. `outlines_read` answers one node in full with its
immediate children as a list; `outlines_subtree` answers a node, or every root
of a named file, and everything under it, nested, to `depth` levels — 3 unless
you say otherwise.

`fields` names what each row carries. On `outlines_read` it shapes the child
list; on `outlines_subtree` it shapes every row, the one you asked for
included.

| In `fields` | Carries |
| --- | --- |
| `title`, `parent`, `date`, `repeat`, `desc`, `see`, `after`, `custom` | the record's own fields, verbatim |
| `done`, `cancelled`, `doing`, `todo`, `created`, `changed`, `started`, `worked` | the stamps and the marks as the record holds them |
| `status` | the mark derived for the row |
| `took` | how long the work took, in whole seconds, derived as the answer is made and absent when there is no span to tell |
| `custom.<key>` | one property. A property spelled `took` is `custom.took`, never the derived span, and a row asked both carries both |

The `id` rides every row regardless, and whatever you did not name is not
there, the row's place and ancestry included. Leave `fields` out and you get
the full situated row.

The walk's own keys (`children`, `truncated` and `placed`) are structure rather
than fields, so a projection cannot drop the naming. The rows inside
`children`, and the `shows` inside a `placed` entry, obey `fields` all the
same. A nonempty `deadLinks` reading comes back whatever you named.

`withDesc` is `outlines_subtree`'s note dial, and it is on by default, because
a targeted read usually wants the note. `withDesc: false` is the lean read for
a table of contents: ids, titles, marks, properties and structure only. A note
comes back whole or not at all, never cut, and `depth` bounds levels rather
than prose.

| Refused | What it says |
| --- | --- |
| a name `fields` does not know | the refusal quotes the name, lists every legal one, and adds that `id` rides every row already |
| `fields` and `withDesc` together | that `fields` is the whole shape of a row, so name `desc` in it and drop `withDesc` |

Mirrors are never walked: a placement is a second view of a node. A node with
placements under it carries `placed` instead, naming the placement's own id,
where the mirror record sits, and `shows`, the node it stands for. They are
named and never expanded.

## What it tells an agent

Beside its tools, this row carries one paragraph that the MCP row composes into
what `initialize` says ([mcp.md](mcp.md)). A row's note is read by a person, so
an agent writes it as well-formed markdown rather than a raw tool result or a
wall of text. The paragraph leaves the wire with the row, so a serve without
outlines says nothing about notes.

## When it is switched off

Outline pages and this row's server procedures go, its subscriptions close and
its property renderers are withdrawn. Documents keep working
([markdown.md](markdown.md)), and an address navigation kept can draw its page
again once the row is back. Switching it on again builds fresh state from the
directory and reads your stored preferences afresh; it does not resurrect an
unsaved draft from the activation that left.

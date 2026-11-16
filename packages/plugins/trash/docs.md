# Trash

Trash is where a deleted row waits until you say otherwise. It puts a quiet **Trash** row at the foot of the sidebar, a trash glyph at the foot of the collapsed rail, and its page at `/trash`. Deleted outlines land there too.

## Putting something away

A row goes away through **Move to Trash**, on a row's menu and on the bar a multi-selection raises. It asks before it writes, and the question names what goes with it:

- one row, with nothing under it: `Move “Kitchen” to Trash? You can put it back from Trash in the sidebar.`
- one row with a branch: `Move “Kitchen” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar.`
- a selection: `Move these 4 rows to Trash? You can put them back from Trash in the sidebar.`

A selection is counted rather than named, and the rows hanging under the ones going are counted on top of them.

## Putting it back

Every row on the Trash page carries **Put back**, which returns it where it came from. It appears with the pointer on the row or the keyboard in it, and is drawn outright on a screen with no hover.

An empty page says `Trash is empty` and `Deleted outlines and rows appear here.`

## Emptying it

Emptying asks once, and the question counts every row in `_olai/Trash.olai` rather than the rows the page happens to be drawing, so a filter cannot understate it:

`Permanently delete all 12 rows in Trash? olai can't bring them back. Only what git has already saved can be recovered.`

For a single row it reads `Permanently delete the one row in Trash? olai can't bring it back. Only what git has already saved can be recovered.` The page's **Empty trash** button raises that question, a second press of it does the deed, and **Cancel** leaves the trash standing.

> Emptying is the one write olai cannot reverse. What git has already committed can be recovered, and nothing else: a directory with no repository, or a trash that has been waiting uncommitted, has nothing behind it.

With the `outline-olai` plugin off, the page reads `the outline-olai row is off.`

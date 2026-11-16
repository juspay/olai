# Trash

Trash is where a deleted row, which is one line of an outline, waits until you put it back or delete it for good.[^where] Deleted outlines land there too.

## Move a row to Trash

A row goes to Trash through **Move to Trash**, which sits on a row's menu and on the bar that appears when you select several rows. It asks before it writes, and the question names what goes with the row:[^counts]

- one row with nothing under it: `Move “Kitchen” to Trash? You can put it back from Trash in the sidebar.`
- one row with rows under it: `Move “Kitchen” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar.`
- several rows you selected: `Move these 4 rows to Trash? You can put them back from Trash in the sidebar.`

## Put a row back

Every row on the Trash page carries **Put back**, which returns it to where it came from.[^drawn]

A page with nothing on it says `Trash is empty` and `Deleted outlines and rows appear here.`

## Empty the Trash

Emptying asks once, and the question counts every row in `_olai/Trash.olai` rather than the rows the page happens to be drawing, so a filter on the page cannot make the number look smaller:

`Permanently delete all 12 rows in Trash? olai can't bring them back. Only what git has already saved can be recovered.`[^single]

The page's **Empty trash** button asks that question, pressing it a second time deletes the rows, and **Cancel** leaves them where they are.

> Emptying the Trash is the one write olai cannot undo. What git has already committed can be recovered, and nothing else. A directory with no git repository, or a Trash whose rows git has never committed, has nothing behind it.

With the `outline-olai` plugin off, which is the plugin that reads and writes `.olai` files, the page reads `the outline-olai row is off.`

[^where]: Where Trash appears: a quiet **Trash** entry at the foot of the sidebar, a trash icon at the foot of the collapsed strip of icons, and its own page at `/trash`.

[^counts]: What the question counts: when you have selected several rows it counts them rather than naming them, and the rows nested under the ones you are moving are counted as well.

[^drawn]: The **Put back** button appears when the pointer is on the row or the keyboard focus is in it, and is drawn all the time on a screen with no pointer to hover with.

[^single]: For a single row the question reads `Permanently delete the one row in Trash? olai can't bring it back. Only what git has already saved can be recovered.`

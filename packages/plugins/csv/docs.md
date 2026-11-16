# CSV files

olai draws the start of a `.csv` as a table, with the file's first row as the header.[^kind] olai never writes one.

## What you see

The table scrolls inside its own region rather than widening the page, and the header row stays at the top while the rows move under it.[^scroll] A file rewritten on disk redraws the table without a reload,[^redraw] and a file with no rows at all draws `This file is empty.` rather than an empty table.

## What is left out, and what says so

A `.csv` is read only as far as the bounds below, so a huge export costs one page rather than a database. When a bound is reached, a quiet line under the table says which:[^lines]

| Bound | The line under the table |
| --- | --- |
| 500 rows | `Showing the first 500 rows.` |
| 100 columns | `Showing the first 100 columns.` |
| 2,000 characters in one cell | `Long cells are cut at 2,000 characters.` |

## What an agent can do with it

No tool writes a `.csv`.[^tools]

[^kind]: A `.csv` page is a look at somebody's export, not a grid you can type in. The format's own account of the kind is [documents and kinds](../documents-and-kinds.md).

[^scroll]: Reaching the table: press `Tab` to reach the region and the arrow keys to scroll it.

[^redraw]: Redrawing: the table you are looking at stays until the new text arrives.

[^lines]: The lines under the table: both bounds in one file give one sentence, `Showing the first 500 rows, and the first 100 columns.` No line is drawn when the whole file is on screen. The count of rows the file holds is never shown: the reading stops at the bound, so nothing counted them.

[^tools]: Tools and a `.csv`: `files_delete` refuses one, saying `olai only shows files of this kind and never writes one`. You can attach a `.csv` to a conversation, up to 50 MB, and the agent is handed the path ([giving an agent work](../giving-an-agent-work.md)).

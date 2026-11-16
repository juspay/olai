# CSV files

olai draws the beginning of a `.csv` file as a table, using the file's first row as the column headings.[^kind] olai never writes a `.csv`.

## What you see

The table scrolls inside its own area rather than making the page wider, and the headings stay at the top while the rows move under them.[^scroll] A file rewritten on disk redraws the table without a reload,[^redraw] and a file with no rows at all draws `This file is empty.` rather than an empty table.

## What is left out, and what says so

olai reads a `.csv` only as far as the limits below, so a very large export costs one page of reading rather than loading the whole file. When a limit is reached, a quiet line under the table says which one:[^lines]

| Limit | The line under the table |
| --- | --- |
| 500 rows | `Showing the first 500 rows.` |
| 100 columns | `Showing the first 100 columns.` |
| 2,000 characters in one cell | `Long cells are cut at 2,000 characters.` |

## What an agent can do with it

No tool writes a `.csv`.[^tools]

[^kind]: olai claims `.csv` files, which means it draws a page for each one. That page is a way to look at somebody's export, not a grid you can type in. The format's own account of this kind of file is [documents and kinds](../documents-and-kinds.md).

[^scroll]: Reaching the table with the keyboard: press `Tab` to move into it and the arrow keys to scroll it.

[^redraw]: Redrawing: the table you are looking at stays on screen until the new text has arrived.

[^lines]: The lines under the table: when one file reaches both limits, olai draws one sentence, `Showing the first 500 rows, and the first 100 columns.` No line is drawn when the whole file is on screen. olai never says how many rows the file holds. The reading stops at the limit, so nothing counts the rest.

[^tools]: Tools and a `.csv`: `files_delete` refuses one, saying `olai only shows files of this kind and never writes one`. You can attach a `.csv` to a conversation, up to 50 MB, and the agent is given the path to the file ([giving an agent work](../giving-an-agent-work.md)).

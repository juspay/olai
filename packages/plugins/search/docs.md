# search

Keeps the index every search in olai is answered from, and brings the search box in the header. [../search.md](../search.md) is the query language; this page is the row.

## What turns it off

The row is on by default. Set `on: no` on the `search` node in `_olai/Settings.olai`, or use its switch, **Search** under **Notes** on the plugins panel ([../settings.md](../settings.md)).

With it off, the box, the palette and the `search_nodes` tool are all still there and none of them finds anything.[^reason] Switching it on restores the services and rebuilds the index.

Narrowing the page in front of you is not this row's.[^filter]

The row accepts no settings of its own.

## What it gives

| Where | What you get |
| --- | --- |
| the header | a box with the placeholder **Search**, and an **All** / **Rows** / **Files** selector under it that picks what kind of hit to ask for |
| a phone | a **Search** button in the bar that opens the palette |
| an agent | `search_nodes`, the same question answered from the same index |

Both boxes behave as a query box rather than a writing box.[^keys]

## What it refuses

The index is held in memory for the directory you are serving, and the row fails if it cannot be opened. The plugins panel says so on the row, every other row keeps running, and search refuses in words meanwhile.

Switching the row off gives that memory back. Switching it on builds a fresh index, level with the next reading it is handed.

[^reason]: What a search says with the row off: each answers with no hits and the reason, `the search plugin is not running on this serve, so there is no matcher to look this up in`, carried in the same place a query the grammar could not read is reported.

[^filter]: Narrowing a page: the filter bar over an outline, a day, the agenda or the trash reads the page a tab already holds, and goes on working with search off.

[^keys]: The boxes on a touch screen: both say **Go** on an on-screen keyboard's return key, because pressing it opens the row the cursor is on rather than submitting a search. Neither is autocapitalized, autocorrected or spell-checked: a query is matched, not read.

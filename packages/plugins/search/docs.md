# The search plugin: the index and the Search button

The `search` plugin keeps the index every search in olai is answered from, and draws the **Search** button in the header.

What you can type in a query is [../search.md](../search.md); this page is about the plugin itself.

## What turns it off

The plugin is on by default. Set `on: no` on the `search` row in `_olai/Settings.olai`, or use its switch, **Search** under **Notes** in the plugins panel ([../settings.md](../settings.md)).

With it off, the **Search** button leaves the header. The palette and the `search_nodes` tool are still there, and neither finds anything.[^reason] Switching it on brings search back and builds the index again.

Narrowing the page in front of you is not this plugin's work.[^filter]

This plugin takes no settings of its own.

## What it gives you

| Where | What you get |
| --- | --- |
| the header, on a desktop | a button reading **Search** and the palette's keys, `⌘K` on a Mac and `Ctrl K` elsewhere, that opens the palette[^button] |
| a phone | a magnifier named **Search** in the bar that opens the palette |
| the palette | an **All** / **Rows** / **Files** selector under its box that chooses what kind of result to ask for |
| an agent | `search_nodes`, which asks the same question of the same index |

## What it refuses

The index is held in memory for the directory you are serving. If the index cannot be opened, the plugin fails, the plugins panel says so on that plugin, every other plugin keeps running, and searches refuse with a message meanwhile.

Switching the plugin off gives that memory back. Switching it on builds a fresh index from the next reading of the directory it is handed.

[^reason]: What a search says with the plugin off: it answers with no results and the reason, `the search plugin is not running on this serve, so there is no matcher to look this up in`, shown in the same place as the message for a query olai could not read.

[^filter]: Narrowing a page: the filter bar over an outline, a day, the agenda or the Trash reads the page the tab already holds, and goes on working with search off.

[^button]: The **Search** button: click it, or put the keyboard on it and press `Enter` or `Space`. It opens the same palette `Cmd` + `K` opens (`Ctrl` + `K` elsewhere), with the caret in its box. A screen reader reads it as **Search** and announces the keys.

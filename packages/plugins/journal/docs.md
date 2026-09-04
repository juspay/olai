# The journal

The day page, calendar and agenda are one plugin. It is enabled by default, so ordinary olai looks and behaves as before: dates written on nodes light the calendar, `/today` and `/d/YYYY-MM-DD` collect one day, and `/agenda` shows overdue, due-today and upcoming work.

The difference is ownership. Those screens and their wire readings now arrive with the `journal` row in the plugin bundle. A serve that does not name that row has no calendar, Agenda entry, owed badge, *Go to today* palette item or journal routes:

```
olai web ~/outlines                         # journal included
olai web ~/outlines --plugins=chat,claude  # no journal UI or routes
```

Turning the plugin off does not change the files. `date`, `repeat`, stamped marks and daily-note filenames remain ordinary parts of the [file format](../format.md). Re-enabling journal reads the same values again.

## Pages and navigation

The plugin owns three address forms:

- `/today` — the reader's current local day;
- `/d/YYYY-MM-DD` — one named day;
- `/agenda` — overdue, today and upcoming work, counted from the reader's local day.

The Agenda entry and its owed badge sit beside Inbox. The month calendar sits below the app's own sidebar entries. When the full sidebar is collapsed, the journal contributes its compact Today and Agenda doors to the rail. The command palette gets *Go to today* and *Go to agenda* from the same row.

An empty day may mint its daily note. The browser sends only the date through `journal`'s `note.mint` procedure; the server derives the path from the vault's existing daily-note convention and returns the file it created. That write never travels through core's general `edit.apply` vocabulary.

## On the wire

Journal is a sibling surface, exposed only to the browser:

```
surface/journal/dated/get       days lit in one month
surface/journal/owed/get        overdue and due-today counts
surface/journal/day/get         one day's rows and notes
surface/journal/agenda/get      the agenda's three stretches
surface/journal/note/mint       create one daily note
```

The MCP face does not expose these screen-shaped readings. An agent reads and searches the same dated nodes through the core vault resources and tools.

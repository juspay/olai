# Preferences

Preferences is the one panel for what olai is set to.[^open] Each row is a label and the control that sets it, grouped under a heading.

## What is on it

| Heading | Rows |
| --- | --- |
| **Appearance** | **Theme**, **Font** and **Size**, from [theme.md](theme.md) |
| **Outlines** | **Row density** (**Compact**, **Cozy**, **Open**) and **Show finished**, from [outlines.md](outlines.md) |
| **Notifications** | **Alerts** and **Sound** from [alerts.md](alerts.md), **Reminders** from [journal.md](journal.md) |
| a plugin's own name | the settings that plugin marks as preferences, drawn by [plugin-inspector.md](plugin-inspector.md) |

The **Show finished** row is the default a page follows until its own finished box says otherwise. A control that cannot move is drawn dimmed rather than taken away, which is what **Sound** and **Reminders** are while **Alerts** is off.[^line]

## Where a setting is kept

Every group closes with a line saying where its rows are kept:[^order]

| The line | What it means |
| --- | --- |
| `Saved in this browser only.` | this browser's choice, reaching its other tabs, never sent to the server |
| `Saved in Settings.olai, for everyone using this directory.` | written to `_olai/Settings.olai`, so everyone who opens this directory gets it |

A heading named after a plugin holds that plugin's promoted settings.[^promoted]

## What is deliberately not here

- No switch for movement or contrast. You have already told your operating system, and olai follows that answer live: [theme.md](theme.md) has the account.
- No width controls. The sidebar and the panels are sized by dragging their edges.

## When something is off

| What is off | What you get |
| --- | --- |
| a plugin that contributes rows | its rows go, and a heading left with nothing under it is not drawn, without a reload |
| preferences | the panel goes; a promoted setting stays editable in the plugins panel |

[^open]: Opening the panel: the ⚙ **Preferences** in the desktop header opens it, and on a phone it is a row at the foot of the directory drawer.

[^line]: The line under a row: a row carries one only where its label does not already say what it does, or where there is news, such as a browser that blocks notifications and the **Allow notifications** button.

[^order]: The order of the groups: the browser's own are drawn first and the shared ones after, so a shared row can never sit under the browser-only line.

[^promoted]: A plugin's promoted settings are the same controls the plugins panel draws, with the same marker for a value set in the file, the same reset and the same refusals. They leave this panel the moment that plugin is switched off.

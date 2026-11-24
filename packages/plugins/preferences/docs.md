# Preferences

Preferences is the one panel where you change how olai is set up.[^open] Each line is a label and the control that changes it, grouped under a heading.

## What is on it

| Heading | What is under it |
| --- | --- |
| **Appearance** | **Theme**, **Font** and **Size**, from [theme.md](theme.md) |
| **Outlines** | **Row density** (**Compact**, **Cozy**, **Open**) and **Show finished**, from [outlines.md](outlines.md) |
| **Notifications** | **Alerts** and **Sound** from [alerts.md](alerts.md), **Reminders** from [journal.md](journal.md) |
| a plugin's own name | the settings that plugin asks to have shown here, drawn by [plugin-inspector.md](plugin-inspector.md) |

The **Show finished** setting says what every page does until the finished box on that page says otherwise. A control you cannot change is drawn dimmed rather than taken away, which is what happens to **Sound** and **Reminders** while **Alerts** is off.[^line]

## Where a setting is saved

Every group ends with a line saying where its settings are saved:[^order]

| The line | What it means |
| --- | --- |
| `Saved in this browser only.` | this browser's choice, which reaches its other tabs and is never sent to the server |
| `Saved in Settings.olai, for everyone using this directory.` | written to `_olai/Settings.olai`, so everyone who opens this directory gets it |

A heading named after a plugin holds the settings that plugin asks to have shown here.[^promoted]

## What is deliberately not here

- No switch for reduced motion or higher contrast. You have already set those in your operating system, and olai follows them as they change: [theme.md](theme.md) explains how.
- No controls for width. You size the sidebar and the panes by dragging their edges.

## When something is off

| What is off | What you get |
| --- | --- |
| a plugin whose settings are shown here | its lines go, and a heading left with nothing under it is not drawn, without a reload |
| preferences | the panel goes; a setting shown here stays editable in the plugins panel |

[^open]: Opening the panel: on a desktop, click the dot in the header and then **Preferences**, a line at the foot of its list above **Plugins**. The panel hangs from the dot, and `Escape` closes it and puts the keyboard back on the dot. On a phone it is a line at the foot of the directory drawer.

[^line]: The line under a setting: a setting carries a short line of its own only where its label does not already say what the setting does. It also carries one where there is news to give, such as a browser that blocks notifications and the **Allow notifications** button beside it.

[^order]: The order of the groups: the groups saved in this browser are drawn first and the shared ones after, so a shared setting can never sit under the line about this browser.

[^promoted]: A plugin's settings shown here are the same controls the plugins panel draws, with the same marker for a value set in the settings file, the same reset and the same refusals. They leave this panel the moment that plugin is switched off.

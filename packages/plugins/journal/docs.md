# The journal

Dates on rows light a calendar, gather into day pages, and queue on an agenda.[^owns] The journal is on by default.

## The three pages

| Address | What it draws |
| --- | --- |
| `/today` | Your current local day. |
| `/d/YYYY-MM-DD` | One named day, such as `/d/2026-08-12`. |
| `/agenda` | Overdue work, today's, and what is coming, counted from your local day. |

The palette ([getting around](../getting-around.md)) carries **Go to today** and **Go to Agenda**.[^claims] Rows here are the outlines plugin's dated rows, with the same `•••` menu ([organising](../organising.md)).[^rows] A day with nothing on it offers to mint its note.[^empty]

## What the sidebar shows

The Agenda entry wears a badge of one number,[^badge] and the **Today** row under it unfolds the month calendar.[^today] While anything is late or due today, the owed rows hang beneath that entry,[^owed] five at a time.[^five]

## The one reminder

Dates and repeats are readings: nothing on disk is a reminder, nothing is scheduled, and nothing fires at a chosen time of day. Once per local day, in each browser, the first reading of owed work raises a notification,[^notify] with a chime when **Sound** is on.[^chime] The switch is **Reminders**, in the preferences panel.[^switch] It rides the [alerts](alerts.md) plugin's channel.[^channel]

## Switching it off

Set `on: no` on the `journal` node in `_olai/Settings.olai`, or use the switch in the plugins panel ([settings](../settings.md)).[^off] It reads no environment variables and offers no MCP tools.[^tools]

## The agenda as a service

Another plugin, including one [your directory defines](../dynamic-plugins.md), reads the same two answers through `journal.agenda`, a service with one verb, `read`.[^service] There is a worked example in [two plugins, start to finish](../dynamic-plugins-examples.md).

[^owns]: The journal owns three pages, the sidebar's Agenda and Today doors, and the one notification olai raises without being asked.

[^claims]: The three addresses are this plugin's exclusive claims. Another plugin cannot overlap them, and a page claiming one that is taken is dropped with a diagnostic naming both.

[^rows]: The journal supplies the dates; the verbs stay the outlines plugin's, so a row on a day page or the agenda carries the menu a row in an outline carries. Each entry also carries how many records hang under its node, counted with the reading, for that menu's **Move to Trash** question.

[^empty]: An empty day says `Nothing is on today.`, or `Nothing is on 2026-08-10.` for another day, and offers to mint that day's note. The button reads **Creating…** and refuses repeat presses while the request is in flight. The browser sends only the date; the server derives the path from the vault's daily-note convention and answers with the file it created. Navigating away before the answer arrives still creates the note, without replacing the view you moved to.

    An agenda with nothing owed says `Nothing due` and `Rows with a date show up here.`

[^badge]: The Agenda entry sits among the sidebar's first doors. Its tip and its accessible name say the badge's number in words, such as `Agenda — 1 due today` or `Agenda — 2 overdue, 3 due today`.

[^today]: The **Today** row is the word and the date, such as `Sep 28`, linking to today's page, with a chevron that unfolds the month calendar in place. Whether the month is open is remembered per browser under `olai.sidebar.calendar`, followed across tabs, and it starts shut. When the sidebar is collapsed, the journal puts compact Today and Agenda doors on the rail; on a phone it puts the same two in the thumb bar ([layout](layout.md)).

[^owed]: The owed list is late work first, oldest day first, then today's. A late row is a filled alarm dot, its title, and how long ago its day was, such as `Yesterday` or `5 days ago`. A today row is a muted ring and its title. Each row links to the node where it lives.

[^five]: Five owed rows fit. Whatever is left is one muted line, `N more on the agenda`, which opens the agenda page. The list and the badge come from the same reading, so the count tells the whole truth even when the list is shorter. A chevron folds the list away, remembered per browser under `olai.sidebar.agenda-rows` and unfolded by default. Folding never stops the reading, and the list is not drawn while the agenda page is in front.

[^notify]: The one thing olai says unprompted is that the day has work on it. The notification is raised by the first non-empty reading of what is owed. Its title is this deployment's name and its body is the Agenda entry's own phrase, such as `Agenda: 2 overdue, 3 due today`. Pressing it opens the agenda page in the focused pane.

    Reminders never badge the app or mark the tab. Two tabs can race on their first reading and chime twice; the shared notification tag `olai:due:<day>` replaces the duplicate banner instead of stacking it.

[^chime]: A chime goes with the notification only when the **Sound** preference is on and an earlier pointer or keyboard gesture in this page has unlocked audio. Before that the sound is skipped for the day and never replayed.

[^switch]: The **Reminders** switch is a browser choice, default on, under Notifications in the Preferences panel, beneath **Alerts** and **Sound**. Turning it off leaves the Agenda entry working. Turning Alerts off silences reminders too and freezes the Reminders row with an explanation. Neither switch spends an unannounced day, so turning one back on can remind once.

    The choice is kept under `olai.reminders`, and the day already said under `olai.reminders.said`, both in this browser rather than in your files.

[^channel]: The alerts channel carries the same limit as chat's: the app has to be running, in the foreground or the background, and a fully closed olai hears nothing. With alerts absent, reminders wait while the calendar, day and agenda keep working. There are no per-node alarms, no times added to dates, no snooze, no repeat-specific alerts and no push server.

[^off]: The choice survives a restart. A serve without this row has no calendar, no Agenda entry, no owed badge, no **Go to today** palette row and none of the three pages. Your files do not change: `date`, `repeat`, stamped marks and daily-note filenames stay ordinary parts of the [file format](../format.md), and switching the row back on reads the same values again.

[^tools]: An agent reads and searches the same dated rows through olai's core vault tools. The plugin's one setting is `on`, on the `journal` node in `_olai/Settings.olai`. Its four browser readings are the lit days of a month, the owed counts with the first owed rows, one day's page, and the agenda's three stretches. They are served to the browser alone, and the agent face does not carry them.

[^service]: `journal.agenda` is offered under this row's own name. Its `read` verb takes `date`, the day the answer is about, and `at`, the vault reading it is about. The day is the caller's, because what counts as late is late where the asker is standing. The reading is passed on unchanged from your own `Vault.revision` or `Ops.reading`.

<details>
<summary>What <code>journal.agenda</code> answers, and what it refuses</summary>

The answer carries `dated`, everything on that day grouped by outline, and `agenda`, the same three stretches the agenda page draws. Both are located rows, and a row is four fields: `id`, `title`, `date`, and `status`, which is `null` for a row carrying no mark.

A date that is not a day is refused with `` `<value>` is not a day (YYYY-MM-DD), so there is no agenda to read for it ``. A value that is not a vault reading is refused with a sentence telling you to pass on what the vault's revision door gave you, unchanged.

Switching the journal off takes the key with it: every consumer's row reads `waiting`, naming `journal.agenda`, and switching the journal back on starts them again.

</details>

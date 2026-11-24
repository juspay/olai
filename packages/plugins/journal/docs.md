# The journal: a calendar, day pages and an agenda

A row is one line of an outline. Give a row a date and the journal shows it on a calendar, on that day's page, and on an agenda.

The journal plugin is on by default.[^owns]

## The three pages it adds

| Address | What it draws |
| --- | --- |
| `/today` | Your current local day. |
| `/d/YYYY-MM-DD` | One named day, such as `/d/2026-08-12`. |
| `/agenda` | Work that is overdue, work due today, and work coming up, counted from your local day. |

The command palette ([getting around](../getting-around.md)) has a **Go to today** item and a **Go to Agenda** item.[^claims] The rows on these pages are the dated rows of your outlines.[^rows] A day with nothing on it offers to create that day's note.[^empty]

## What the journal adds to the sidebar

The sidebar is the left column of files. The journal adds an **Agenda** entry there, with a badge,[^badge] and a **Today** row under it that opens the month calendar.[^today] While any row is late or due today, the arrow beside **Agenda** unfolds those rows under it,[^owed] five at a time.[^five]

## The one notification olai sends

Once per local day, in each browser, the first reading that finds work owed raises a notification,[^notify] with a chime when **Sound** is on.[^chime] The switch is **Reminders**, in the preferences panel.[^switch] It uses the [alerts](alerts.md) plugin's channel.[^channel]

## Switching the journal off

Set `on: no` on the `journal` node in `_olai/Settings.olai`, or use the switch in the plugins panel ([settings](../settings.md)).[^off] An agent gets no tools from the journal.[^tools]

## Reading the agenda from another plugin

Another plugin, including one [your own directory defines](../dynamic-plugins.md), can read the same answers through the service `journal.agenda`.[^service] [Two plugins, start to finish](../dynamic-plugins-examples.md) works through an example.

[^owns]: The journal adds three pages, the **Agenda** and **Today** entries in the sidebar, and the one notification olai raises without being asked for it.

[^claims]: The three addresses belong to this plugin alone. No other plugin may use them, and a page that claims an address already taken is dropped, with a diagnostic message naming both of them.

[^rows]: A row on a day page or on the agenda carries the same `•••` menu it carries in its outline ([organising](../organising.md)), because the journal supplies the dates and the actions stay the outlines plugin's. Each entry also carries how many records are stored under its node, counted during the reading, for that menu's **Move to Trash** question. A node is a row, seen as the thing an address or a tool names.

[^empty]: An empty day page says `Nothing is on today.`, or `Nothing is on 2026-08-10.` for another day, and offers to create that day's note. The button reads **Creating…** and ignores further presses while the request is in flight. The browser sends only the date; the server works out the path from the directory's daily-note convention, and answers with the file it created. If you navigate away before the answer arrives, the note is still created, and the page you moved to is not replaced.

    An agenda with nothing owed says `Nothing due` and `Rows with a date show up here.`

[^badge]: The **Agenda** entry sits among the first entries in the sidebar. Its tooltip, and the name a screen reader reads out, say the badge's number in words, such as `Agenda — 1 due today` or `Agenda — 2 overdue, 3 due today`.

[^today]: The **Today** row is the word and the date, such as `Sep 28`, linking to today's page. The chevron beside it opens the month calendar in place. Whether the month is open is remembered in this browser under `olai.sidebar.calendar`, shared across its tabs, and it starts closed. When the sidebar is collapsed to its narrow rail, the journal puts small Today and Agenda buttons on that rail; on a phone it puts the same two in the thumb bar ([layout](layout.md)).

[^owed]: The list shows late work first, oldest day first, and then work due today. A late row shows a filled alarm dot, the row's title, and how long ago its day was, such as `Yesterday` or `5 days ago`. A row due today shows a grey ring and its title. Each row links to the node where it lives.

[^five]: Five owed rows are listed. Anything left over is one grey line, `N more on the agenda`, which opens the agenda page. The list and the badge come from the same reading, so the count is right even when the list is folded. The list starts folded, and whether it is folded is remembered in this browser under `olai.sidebar.agenda-rows`. Folding does not stop the reading, and the list is not drawn while the agenda page is in front of you.

[^notify]: This notification is the only thing olai says without being asked. It is raised by the first reading that finds work owed. Its title is this deployment's name, and its body is the same phrase the Agenda entry uses, such as `Agenda: 2 overdue, 3 due today`. Clicking it opens the agenda page in the pane you are in.

    Reminders never put a badge on the app or a mark on the tab. Two tabs can take their first reading at the same time and chime twice; both notifications share the tag `olai:due:<day>`, so the second banner replaces the first rather than stacking on it.

[^chime]: A chime plays with the notification only when the **Sound** preference is on and you have already clicked or typed somewhere in this page, which is what lets a browser play audio. Before that the sound is skipped for the day, and it is never played later.

[^switch]: The **Reminders** switch is a choice of this browser, on by default, under Notifications in the Preferences panel, below **Alerts** and **Sound**. Turning it off leaves the Agenda entry working. Turning Alerts off silences reminders too, and freezes the Reminders row with an explanation. A day that was never announced stays unannounced while a switch is off, so turning one back on can remind you once.

    The choice is stored under `olai.reminders`, and the day already announced under `olai.reminders.said`, both in this browser rather than in your files.

[^channel]: The alerts channel has the same limit as chat's: olai has to be running, in the foreground or in the background, and a fully closed olai hears nothing. With the alerts plugin absent, reminders wait, while the calendar, the day pages and the agenda keep working. There are no alarms on single rows, no snooze, no alerts for repeats, and no push server.

    Nothing is scheduled. A date or a repeat on a row is a value olai reads, no time of day is added to it, and nothing fires at a chosen time.

[^off]: The choice survives a restart. A serve with the journal off has no calendar, no Agenda entry, no owed badge, no **Go to today** palette item, and none of the three pages. Your files do not change: `date`, `repeat`, stamped marks and daily-note filenames stay ordinary parts of the [file format](../format.md), and switching the journal back on reads the same values again.

[^tools]: The journal reads no environment variables, and it gives an agent no tools of its own: an agent reads and searches the same dated rows through olai's core tools for the directory. The journal's one setting is `on`, on the `journal` node in `_olai/Settings.olai`.

    Its four readings for the browser are which days of a month have something on them, the owed counts with the first owed rows, one day's page, and the agenda's three groups. They are served to the browser only, and an agent cannot call them.

[^service]: `journal.agenda` is a service with one verb, `read`, offered under the journal's own name. The verb takes `date`, the day the answer is about, and `at`, the reading of the directory the answer is about. The day comes from the caller, because whether work is late depends on where the caller is. The reading is passed on unchanged from your own `Vault.revision` or `Ops.reading`.

<details>
<summary>What <code>journal.agenda</code> answers, and what it refuses</summary>

The answer carries `dated`, everything on that day grouped by outline, and `agenda`, the same three groups the agenda page draws. Both are lists of rows with their location, and each row has four fields: `id`, `title`, `date` and `status`, which is `null` for a row carrying no mark. A mark is **To do**, **Doing**, **Done** or **Cancelled**.

A date that is not a day is refused with `` `<value>` is not a day (YYYY-MM-DD), so there is no agenda to read for it ``. A value that is not a reading of the directory is refused with a sentence telling you to pass on, unchanged, what the directory's revision door gave you.

Switching the journal off takes the service with it: every plugin that uses it reads `waiting`, naming `journal.agenda`, and switching the journal back on starts them again.

</details>

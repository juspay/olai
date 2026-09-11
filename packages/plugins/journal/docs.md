# The journal

The day page, calendar and agenda are one plugin. It is enabled by default, so ordinary olai looks and behaves as before: dates written on nodes light the calendar, `/today` and `/d/YYYY-MM-DD` collect one day, and `/agenda` shows overdue, due-today and upcoming work.

The difference is ownership. Those screens and their wire readings now arrive with the `journal` row in the plugin bundle. A serve that does not name that row has no calendar, Agenda entry, owed badge, *Go to today* palette item or journal routes:

Set `on: no` on the `journal` node in `_olai/Settings.olai`, or use its durable switch on `⧉`. The file choice survives restart.

Turning the plugin off does not change the files. `date`, `repeat`, stamped marks and daily-note filenames remain ordinary parts of the [file format](../format.md). Re-enabling journal reads the same values again.

## Reminders

**Olai is pull with one push.** Dates, repeats and the agenda are readings:
nothing on disk is a reminder, nothing schedules one, and nothing fires at a
chosen time of day. The one thing olai says unprompted about due work is that
the day has work on it. Once per local day, in each browser, its first non-empty
reading of what is owed raises a notification. The title is the deployment's
name and the body uses the Agenda entry's own phrase, such as **Agenda: 2
overdue, 3 on today**. Pressing it opens `/agenda` in the focused pane.

The notification is the reminder. A chime accompanies it only if Alert sound
is on and an earlier pointer or keyboard gesture in this page has unlocked
audio. Before that, the sound is skipped for the day and never replayed at a
later gesture. Reminders never badge the app or mark the tab: the Agenda entry
and rail dot already carry the durable reading of due work; the badge counts
chat's questions alone.

**Reminders** is a browser preference, default on, beneath **Alerts** and
**Alert sound**. Turning it off leaves the Agenda entry working. Turning Alerts
off silences reminders too and freezes the Reminders row with an explanation.
Neither switch spends an unannounced day: turning it back on can remind once.
The choice is kept under `olai.reminders`, not in the vault's configuration.

The rule reads the renderer's existing local-day clock and the journal's
existing `owed` stream: `overdue + today > 0`, with a known day and a first
frame, and with both preferences on. It has no timer and reads neither focus
nor visibility. Boot with overdue work, local midnight in an open tab, waking
after midnight, and a mid-day count leaving zero all reach the same rule.
Completing a repeat creates a fresh dated task, so it needs no separate trigger.

Before asking for the notification and then the chime, the circuit records
the day under `olai.reminders.said` in local storage and follows that record
across tabs. A later frame, reconnect, reload, later-opened tab or journal
reactivation that day says nothing again. Two tabs can still race on their
first reading and chime twice; the shared OS tag `olai:due:<day>` replaces
duplicate banners instead of stacking them. There is no cross-tab election.

This uses the [alerts row's channel](alerts.md), with the same running-app
limit as chat: foreground or background, the app has to be running, and a
fully closed olai hears nothing. There are no per-node alarms, times added to
dates, snooze, repeat-specific alerts or push server. Each would be a separate
decision, not an unfinished part of reminders.

### Ownership and absence

The journal's `reminders` component names `alerts.channel`, `navigation.state`
and `layout.deployment`; the journal row itself does not depend on alerts.
It owns the preference and daily-record followers, the effect and owed
subscription, and the `due` claim on `channel.onPress`. It shares the row's
existing clock and wire holders. Startup waits for those row resources and
for navigation to publish the agenda route before claiming `due`: the alerts
row holds the newest unclaimed press until then, including a cold-start press.
There is one framework click listener, owned by alerts, so chat's `ask` claim
cannot consume the journal's click.

On withdrawal the effect and subscription stop, followers leave, and the
`due` claim is released; the day stays in storage. A press arriving afterwards
is held by alerts until the component returns, or dropped when that channel
activation ends. Without a clock there is no day to ask about. With alerts
absent, reminders wait while calendar, day and agenda keep working. With the
journal off, its reading and Reminders row leave together.

The separate `reminder-controls` component names `alerts.channel` and
`rendererSlots` and contributes the row to `preferences.sections`, using the
reminders activation's preference state. Its contribution is withdrawn with
its owner; there is no Reminders row while alerts is absent. Turning the
Alerts *preference* off instead leaves the row visible and frozen.

## Pages and navigation

The plugin owns three address forms:

- `/today` — the reader's current local day;
- `/d/YYYY-MM-DD` — one named day;
- `/agenda` — overdue, today and upcoming work, counted from the reader's local day.

Those forms are exclusive route claims. A mounted plugin cannot silently take
`/trash` or overlap another plugin's exact path/prefix; the shell keeps the
first claim and drops a later conflicting page with a diagnostic naming both. Journal's
typed route definitions also mint the sidebar, calendar and palette destinations,
so those affordances cannot drift from the parser that owns their URLs.

The Agenda entry and its owed badge sit beside Inbox. The month calendar sits below the app's own sidebar entries. When the full sidebar is collapsed, the journal contributes its compact Today and Agenda doors to the rail. The command palette gets *Go to today* and *Go to agenda* from the same row.

An empty day may mint its daily note. The browser sends only the date through `journal`'s `note.mint` procedure; the server derives the path from the vault's existing daily-note convention and returns the file it created. That write never travels through core's general `edit.apply` vocabulary.

The button shows **Creating…** and disables repeat presses while that request is pending. A refusal re-enables it. If the reader navigates or changes panes before the answer arrives, the note is still created, but the response does not replace their newer view or leave an automatic editing request for a later visit.

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

Day and agenda pages use core's one standing page cache, so repeated asks share
the answer and use the same composed property-kind vocabulary as validation.
The small calendar and owed readings remain in the plugin and read its retained
vault revision directly; no second ops standing cache or vocabulary service is
created for them.

## The agenda as a service

The wire above is drawn for the browser. Another **plugin** reaches the same two
readings through `journal.agenda`, a service this row offers with `Offers.own`,
so the key is stamped from the journal's own fiber name and no other row can
take it:

```ts
const Agenda = serviceTag<{
  readonly read: (
    ask: { readonly at: unknown; readonly date: string },
  ) => Effect.Effect<Answer, { readonly reason: string }>
}>("journal.agenda")
```

One verb. `date` is the day the answer is about — the CALLER's day, because
the dates in the files are what a person wrote down and what counts as late is
late where the asker is standing. `at` is the vault reading the answer is to be
about, passed on unchanged from the reader's own `Vault.revision` or `Ops.reading`.

The answer carries `dated`, everything on that day grouped by outline, and
`agenda`, the same three stretches the Agenda page draws — both as located rows,
and a row is four fields: `id`, `title`, `date`, and `status` (`null` for a row
carrying no mark, which is an occurrence and is nobody's late work).

**Those four are the door's own shape, not the page's.** The reading is built out
of `@olai/format`'s `DayGroup` and `Agenda` and then projected down to them,
which costs three lines and buys the thing a boundary is for. Those types are the
journal's *page* model and have moved for drawing reasons — `overdue` became days
rather than groups when the Agenda page became a spine — and every reader of them
in this repository is rebuilt in the same commit. The readers of this door are
not: they are notes in somebody's vault, spelling the shape by hand, carrying no
version. Widening `DayGroup` is now invisible to them; moving a field is a type
error in the journal, where a person decides whether the door moves with it.

**The reading comes in, and that is the contract.** A door that read the vault
for itself would answer about a revision of its own choosing, and a caller
composing a sentence from it could not say which. Handing the reading over makes
the answer about one snapshot; a value that is not a reading, and a date that is
not a day, are refused with a sentence rather than guessed at.

**The ask is opaque and the answer is not.** The consumer this was built for is a
[plugin the vault defines](../dynamic-plugins.md), which may import
`@olai/plugin-api`, `effect` and `solid-js` and nothing else — so it cannot name
a `Reading`, and does not have to. What it can do is pass one through. The
answer is spelled with the format's own types because the journal produces it;
a consumer that cannot name `DayGroup` writes the fields it reads and the two
agree structurally.

**Switching the journal off takes the key with it.** It leaves
`plugins.inspect`'s catalog, every consumer's row reads `waiting` naming
`journal.agenda`, and switching the journal back on reactivates them. Nothing in
core knows which rows are connected by this key.

The worked example in [plugins the vault defines](../dynamic-plugins.md) is a
morning agenda written against it.

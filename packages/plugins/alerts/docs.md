# Alerts

Alerts is how olai reaches you when you are looking at something else: a notification, a short chime, and a count or a mark.[^raises]

## The switches

Both sit under **Notifications** in the preferences panel, both start on, and both are kept in this browser alone.[^off]

| Switch | What it governs |
| --- | --- |
| **Alerts** | every notification, chime and badge on this device |
| **Sound** | the chime alone |

Under **Alerts** one line says what you are being told about:[^allow]

| The line | What it means |
| --- | --- |
| `When the agent needs you` | nothing is in the way |
| `Notifications are blocked in this browser` | the browser has refused, and only the browser can undo that |
| `This browser can't show notifications` | this browser has no notifications to give |

## What a press opens

| The alert | Where it takes you |
| --- | --- |
| an agent's question | the question it is about |
| something due | today's agenda |
| a plugin ready for you, or one that would not start | that plugin's own page |

The plugin alert is the only one that names what it is about.[^named]

## What alerts cannot do

- olai has to be running in a tab. A closed app hears nothing and rings nothing.
- The chime needs an earlier click or keypress in this page, because a browser plays nothing before one. A chime called before that is skipped, never saved up.
- Notifications need the browser's consent, which **Allow notifications** can ask for once.

## When something is off

| What is off | What you get |
| --- | --- |
| alerts | conversations and reminders stand, nothing rings, and attention waits |
| chat | no agent questions to be alerted about, and no badge count |
| journal | no reminders; the calendar, the day and the agenda are untouched |
| preferences | the switches go, and alerts keep arriving |
| theme | the tab's mark goes, and alerts keep arriving |

[^raises]: What raises an alert: chat, when an agent has a question, and journal, for what is due. The count sits on the app icon and the mark on the tab.

[^off]: Turning **Alerts** off dims **Sound** and journal's **Reminders**, and clears the badge at once.

[^allow]: The **Allow notifications** button is drawn while **Alerts** is on and the browser has neither granted nor refused; pressing it raises the browser's own prompt.

[^named]: Why the plugin alert carries a name: two plugins can finish in the same minute and nothing at press time could tell them apart. One that arrives without a name is dropped rather than opened on the wrong plugin.

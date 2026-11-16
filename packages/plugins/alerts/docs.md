# Alerts

Alerts reach you when you are looking at something other than olai: a browser notification, a short chime, and a count on the app icon.[^raises]

## Switching alerts on and off

Both switches sit under **Notifications** in the preferences panel, both start on, and each is remembered in this browser only.[^off]

| Switch | What it governs |
| --- | --- |
| **Alerts** | every notification, chime and count on this device |
| **Sound** | the chime alone |

A line under **Alerts** says what you are told about, or what is stopping a notification:[^allow]

| The line | What it means |
| --- | --- |
| `When the agent needs you` | nothing is in the way |
| `Notifications are blocked in this browser` | the browser has refused, and only the browser can undo that |
| `This browser can't show notifications` | this browser cannot show notifications at all |

## Where clicking an alert takes you

| The alert | Where it takes you |
| --- | --- |
| an agent's question | the question it is about |
| something due | today's agenda |
| a plugin ready for you, or one that would not start | that plugin's own page |

The alert about a plugin is the only one that names what it is about.[^named]

## What alerts cannot do

- olai has to be open in a tab. With olai closed, nothing is raised and nothing rings.
- The chime needs an earlier click or keypress in this page, because a browser plays no sound before one. An earlier chime is skipped, never saved up.[^skipped]
- Notifications need the browser's permission, which **Allow notifications** can ask for once.

## When something is off

| What is off | What you get |
| --- | --- |
| alerts | conversations and reminders carry on, nothing rings, and a question from an agent waits until you look |
| chat | no agent questions to be alerted about, and no count |
| journal | no reminders; the calendar, the day and the agenda are untouched |
| preferences | the switches go, and alerts keep arriving |
| theme | the mark on the tab goes, and alerts keep arriving |

[^raises]: What raises an alert: chat, when an agent has a question, and journal, for what is due. The count sits on the app icon, and a mark appears on the browser tab.

[^off]: Turning **Alerts** off dims **Sound** and journal's **Reminders** so that you cannot change them, and clears the count at once.

[^allow]: The **Allow notifications** button is drawn while **Alerts** is on and the browser has neither granted permission nor refused it. Pressing it raises the browser's own prompt.

[^named]: Why the alert about a plugin carries a name: two plugins can finish in the same minute, and when you click the alert nothing else could tell them apart. An alert about a plugin that arrives without a name is dropped rather than opening the wrong plugin.

[^skipped]: A chime olai tries to play before you have clicked or pressed a key in the page is dropped. olai does not hold it back and play it once you do.

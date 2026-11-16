# What olai tells you about

olai interrupts you for one thing: an agent that has stopped and is waiting for your answer. Everything else is a quiet mark.

## When an agent is waiting on you

A turn that stops on a question does not time out.[^form] With the conversation in front of you, nothing rings.[^front] Otherwise three things happen at once: a short chime,[^chime] a system notification,[^notification] and a mark on the app's icon.[^icon] Looking at the conversation clears it.[^clear] A turn that merely finishes is silent on purpose.[^silent]

## Choosing what reaches you

Three rows under **Notifications** in preferences decide it, and all three start on: **Alerts**, **Sound** and **Reminders**.[^rows] The notification is the one part that needs the browser's permission.[^permission]

> Alerts ride the same live connection as everything else, so they reach you with the window behind an editor or on another desktop. A closed olai is not listening, and nothing wakes it.

## What you have not read yet

An agent that answers while you are not looking at its conversation leaves a mark.[^mark] Two places carry it, the conversation's row in **Chats** and the tab.[^places] What clears it is looking.[^clears] Two limits come with that.[^limits] Your reading is not reported anywhere.[^private]

## What this conversation wakes on

A plugin can put a message into a conversation, and you decide which conversation it may put one into.[^wakes] Under the tools strip, one row per plugin says what a wake would be about and what you chose.[^picker]

## Reading what a machine said

A plugin's message sits in the left column, drawn as prose.[^machine] It is one line until you ask for the rest.[^open] A sentence arriving mid-turn waits for the turn to end.[^queued]

[^form]: A question stops the turn, and the turn does not carry on. The question arrives as a form in the conversation, and each one keeps its own draft answer, so switching between agents or folding the conversation leaves an unfinished answer where it was.

[^front]: With the conversation in front of you, the form appearing is the whole of it. The box says the agent is waiting on you. That counts another tab of the same olai: the tab you are reading says so to the others, so a tab behind it stays quiet about a form you are looking at. A different olai, on another address, is not caught by that and goes on telling you.

[^chime]: The chime is one short sound, two notes long.

[^notification]: The system notification names the conversation and the question. Clicking it brings olai forward and opens the first agent in **Needs you** order on its own page, at the question. With nothing waiting it opens no page.

[^icon]: The mark on the app's icon carries the count. A plain tab marks its name and its icon instead, since only an installed olai can badge an icon.

[^clear]: Looking at the conversation acknowledges it and clears the mark. Dismissing the banner does not answer the question, and the mark stays until somebody looks.

[^silent]: A turn that merely finishes rings nothing. An agent that has finished will still have finished in five minutes, and a chime for every turn is a chime people switch off.

[^rows]: The three rows govern different things. **Alerts** governs all three signals above: with it off, nothing chimes, nothing is notified and the icon goes back to normal. **Sound** is the chime alone, drawn frozen while **Alerts** is off, so turning the chime off in a quiet office does not cost you the notification. **Reminders** is the journal's daily summary of what is due, through the same channel, and a reminder never badges the icon or marks the tab.

[^permission]: olai asks for the browser's permission the first time it has something real to tell you, and while the browser has neither granted nor refused, the **Alerts** row carries an **Allow notifications** button. Refuse it and the chime and the icon mark go on working; the row then says that notifications are blocked in this browser.

[^mark]: The unread mark is left by an agent that answered while you were not looking at its conversation, and you meet it when you next look. It is bookkeeping rather than an alert: nothing chimes, nothing is notified and the app's icon says nothing.

[^places]: The conversation's row in **Chats** is drawn in bold weight and reads *Unread* for assistive technology, with its age line still saying when the agent spoke. The tab holding that conversation wears a muted dot, quieter than the one a waiting question draws; where both apply, the question's dot is the one drawn.

[^clears]: The moment the conversation is on screen in a focused window, the mark comes off for every tab of this olai at once, and across a reload, because what was acknowledged is a record the serve keeps. A conversation you are already reading never shows the mark.

[^limits]: olai marks what it heard, so a conversation driven from a terminal, or one no node claims, has no line to be unread about. A turn that adds no prose of its own re-offers the line before it, so an agent repeating itself word for word does not make its row unread again.

[^private]: Your reading is not reported anywhere: not to the agent, not to another machine, and not to a plugin. It is one record on the machine that did the looking.

[^wakes]: Every conversation starts with all of the plugin wakes off, and the row says so rather than hiding the control. Each plugin's choice is saved for that conversation across restarts. A conversation bound to a node can choose any eligible outline, including one outside its node's own file, and binding a chat to a node subscribes it to nothing.

[^picker]: The file picker offers the outlines you keep, since only an outline has rows that can claim anything. What is in the Trash, a leftover `Archive.olai` and the files olai made for itself under `_olai/` are left out. **Clear** turns that plugin's wake off and discards what it had queued, and choosing a different file is how you go quiet about one board without going quiet about the tool.

[^machine]: A message a plugin sent is drawn as prose rather than as the tinted bubble that means you said something, and it opens by naming who is speaking and when. There is no **Send again** under it: what it says is how something stood when it rang, and whatever rang will ring again.

[^open]: Press the small mark in front of the line and the plugin's whole account opens under it; hovering the line shows the same thing. The agent is handed all of it either way. Ids written in backticks are clickable, exactly as ids in the agent's own prose are.

[^queued]: A sentence that arrives mid-turn waits for the turn to end, however it ended, and the count of events waiting is on the row. What you type is never held: a message you send while a turn runs still goes out.

<details>
<summary>What each plugin wakes on</summary>

| The row | What rings it |
| --- | --- |
| **wake on terminal activity · terminals from** an outline | a terminal claimed by that outline's unfinished rows has stopped and is waiting on a person ([kolu](plugins/kolu.md)) |
| **wake on CI runs · runs from** an outline | a run claimed by those rows first goes red, and again when it settles ([odu](plugins/odu.md)) |
| **Alert on new mail · On** | mail arrives ([mail](plugins/mail.md)) |

</details>

<details>
<summary>When a doorbell stops watching</summary>

A doorbell stops when the file you pointed it at is renamed, moved or deleted, or when it is a file the plugin cannot watch. The plugin then puts one message into the conversation saying nothing is being watched and what to do about it. The row stops reading as on: the file's name stays, with a sentence beside it asking you to choose another. The picker still opens, because choosing another file is the fix.

That message is sent once while the fault stands. A restart does not repeat it, and the plugin's own heartbeat stops with it, so a doorbell watching nothing cannot send you the message that means the watch is running and had nothing to say. Point it at a file it can watch and everything starts again quietly.

Thirty-two picks are kept for one directory, a pick being one conversation's choice for one plugin. Make a thirty-third and the one nobody has touched for longest drops off, which turns that conversation's doorbell off; its row says off again, and choosing a file brings it back.

The picks are on disk and the held sentences are in memory, so a restart comes back knowing which conversations wake on which files and holding nothing. Nothing is lost by that: whatever derived a held sentence looks at its subject again and rings again.

</details>

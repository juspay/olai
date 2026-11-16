# When olai interrupts you, and what it marks unread

olai interrupts you for one thing: an agent that stopped and is waiting for your answer. Everything else is a quiet mark.

## When an agent is waiting on you

A turn that stops on a question never times out.[^form] If that conversation is in front of you, nothing rings.[^front] Otherwise three things happen at once: a short chime,[^chime] a system notification,[^notification] and a count on olai's icon.[^icon] Looking at the conversation clears all three.[^clear] A turn that simply finishes rings nothing, on purpose.[^silent]

## Choosing what reaches you

Three rows under **Notifications** in preferences decide this, and all three start on: **Alerts**, **Sound** and **Reminders**.[^rows] The notification is the one part that needs the browser's permission.[^permission]

> Alerts travel over the same live connection as everything else, so they reach you when the window is behind an editor or on another desktop. A closed olai is not listening, and nothing wakes it.

## What you have not read yet

An agent that answers while you are looking elsewhere leaves an unread mark.[^mark] Two places show it: the conversation's row in **Chats**, and the browser tab.[^places] Looking at the conversation clears it.[^clears][^limits] What you read is not reported anywhere.[^private]

## Letting a plugin interrupt a conversation

A plugin can put a message into a conversation, about new mail, a terminal or a failed run.[^wakes] In the **Tools** strip above it, one row per plugin says what it writes about and which file you chose.[^picker]

## Reading a message a plugin sent

A plugin's message sits in the left column, written as prose.[^machine] It shows one line until you open the rest.[^open] A message arriving during a turn waits for the turn to end.[^queued]

[^form]: A question stops the turn, and the agent does not carry on until you answer. The question arrives as a form in the conversation, and each form keeps its own half-written answer, so switching between agents, or folding the conversation away, leaves an unfinished answer where it was.

[^front]: With the conversation in front of you, the form appearing is all that happens. The box says the agent is waiting on you. Another tab of the same olai counts as well: the tab you are reading tells the others, so a tab behind it stays quiet about a form you are looking at. A second olai, at another address, does not hear that and goes on telling you.

[^chime]: The chime is one short sound, two notes long.

[^notification]: The notification names the conversation and the question. Clicking it brings olai forward and opens the first agent in **Needs you** order on its own page, at the question. With nothing waiting, it opens no page.

[^icon]: The mark on olai's icon carries how many agents are waiting. A browser tab that is not an installed olai marks its name and its icon instead, because only an installed olai can mark the icon in your dock.

[^clear]: Looking at the conversation counts as hearing the alert and clears the mark. Dismissing the notification is not an answer to the question, and the mark stays until somebody looks.

[^silent]: An agent that has finished will still have finished in five minutes, and a chime for every turn is a chime people switch off.

[^rows]: The three rows govern different things. **Alerts** governs all three signals above: with it off, nothing chimes, nothing is notified and the icon goes back to normal. **Sound** is the chime alone, and it is drawn frozen while **Alerts** is off, so turning the chime off in a quiet office does not cost you the notification. **Reminders** is the journal's daily summary of what is due, sent the same way, and a reminder never marks the icon or the tab.

[^permission]: olai asks the browser for permission the first time it has something real to tell you. While the browser has neither granted nor refused, the **Alerts** row carries an **Allow notifications** button. If you refuse, the chime and the icon mark go on working, and the row then says that notifications are blocked in this browser.

[^mark]: The unread mark is left by an agent that answered while you were not looking at its conversation, and you meet it when you next look. It is bookkeeping rather than an alert: nothing chimes, nothing is notified and olai's icon says nothing.

[^places]: The conversation's row in **Chats** is drawn in bold and reads *Unread* to a screen reader, and its age line still says when the agent spoke. The browser tab holding that conversation wears a faint dot, quieter than the dot a waiting question draws. Where both apply, the question's dot is the one drawn.

[^clears]: The moment the conversation is on screen in a focused window, the mark comes off in every tab of this olai at once, and stays off across a reload, because the server records that you saw it. A conversation you are already reading never shows the mark.

[^limits]: olai marks only what it heard, so a conversation driven from a terminal, and a conversation no row claims, have no line to be unread about. A turn that adds no prose of its own shows the line before it again, so an agent that repeats itself word for word does not make its row unread a second time.

[^private]: What you read is not reported to the agent, to another machine or to a plugin. It is one record on the machine that did the looking.

[^wakes]: Every conversation starts with every plugin's messages switched off, and the row says so rather than hiding the control. Each plugin's choice is kept for that conversation across restarts. A conversation on a row may choose any outline it is offered, including one outside its own row's file, and putting a chat on a row subscribes it to nothing by itself.

[^picker]: The file picker offers the outlines you keep, because only an outline has rows that can claim a terminal or a run. It leaves out what is in the Trash, a left-over `Archive.olai`, and the files olai made for itself under `_olai/`. **Clear** switches that plugin's messages off and discards what it had waiting. Choosing a different file is how you go quiet about one board without going quiet about the tool itself.

[^machine]: A message a plugin sent is drawn as prose, rather than as the tinted bubble that means you said it, and it opens by naming who is speaking and when. There is no **Send again** under it: it says how something stood at the moment it was sent, and whatever sent it will send again.

[^open]: Press the small mark in front of the line and the plugin's whole report opens under it; hovering the line shows the same thing. The agent is given all of it either way. Ids written in backticks are clickable, exactly as ids in the agent's own prose are.

[^queued]: A message that arrives during a turn waits for the turn to end, however it ended, and the row says how many such messages are waiting. What you type is never held back: a message you send while a turn runs still goes out.

<details>
<summary>What each plugin writes about</summary>

| The row | What makes it write |
| --- | --- |
| **wake on terminal activity · terminals from** an outline | a terminal claimed by an unfinished row of that outline has stopped and is waiting on a person ([kolu](plugins/kolu.md)) |
| **wake on CI runs · runs from** an outline | a run claimed by those rows first fails, and again when it settles ([odu](plugins/odu.md)) |
| **Alert on new mail · On** | mail arrives ([mail](plugins/mail.md)) |

</details>

<details>
<summary>When a plugin stops watching a file</summary>

A plugin stops watching when the file you pointed it at is renamed, moved or deleted, or when it is a file the plugin cannot watch. The plugin then puts one message into the conversation saying that it is watching nothing and what to do about it. The row stops reading as on: the file's name stays, with a sentence beside it asking you to choose another file. The picker still opens, because choosing another file is the fix.

That message is sent once while the fault lasts. A restart does not repeat it, and the plugin's regular check stops with it, so a plugin watching nothing cannot send you the message that means the watch is running and had nothing to report. Point it at a file it can watch and everything starts again quietly.

One directory keeps thirty-two choices, a choice being one conversation's file for one plugin. Make a thirty-third and the one nobody has touched for longest is dropped, which switches that conversation's plugin off. Its row reads off again, and choosing a file brings it back.

The choices are on disk and the waiting messages are in memory, so a restart comes back knowing which conversations hear about which files, and holding no messages. Nothing is lost by that: whatever produced a waiting message looks at its subject again and sends again.

</details>

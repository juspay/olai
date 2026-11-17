# Node agents: giving a row its own agent

A row of an outline can have its own agent: its title names the agent, its note says what to do, and the rows under it are its memory.

## Start a chat on a row, or about the page you are reading

Hover or focus a row with no agent and **Start an agent** appears beside it.[^start] A note's page has one line at the top, **Chat about this page**.[^seat] The palette (`Cmd` + `K`) has **New chat** and **Chat about this page** rows.[^palette] Zooming into a row with no agent gives you an **Ask about** box below it.[^zoom]

## Where the conversation appears

One conversation, with one draft and one transcript, is drawn in four places on a desktop and three on a phone:

- under the row, when you unfold it[^fold]
- on the row's own page[^page]
- in a pane of its own[^beside]
- in the agent panel, the column on the right[^panel][^column]

## Find a chat again

Each row says how its agent is doing.[^standings][^above] In the sidebar, **Needs you** lists agents waiting for an answer,[^needs] and **Chats** lists every chat, at most ten rows,[^chats][^opening] with the rest in the palette.[^beyond]

## Keep, close or replace a conversation

A conversation's buttons are **Fresh start**, **Close**, **Put to sleep**, **Sleep when idle**, **Tidy memory** and **Open the agent above**.[^verbs][^earlier] Eight agents can be awake at once; a ninth is refused until one sleeps.[^seats][^waiting]

## What the agent is told about its row

The agent's first message carries an instruction from olai:[^preamble][^about] the row's note says what to do, and the rows under it are its only memory.[^memory] Every twentieth message repeats that rule.[^remind] A chat you have marked tidies its own rows when it is left alone.[^tidy]

[^start]: Where only one agent is available it starts at once; where several are, they offer their names in a small menu. The row's menu carries the same entry, for the keyboard and for a long press on a phone. A successful start opens the conversation, records on the row which chat it has, and unfolds it. If the start fails, the reason stays on the row and no chat is recorded on it.

[^seat]: The line sits at the top of a note (a `.md` file), under its path. No other page has one: not an outline, a day, the Agenda, the Trash, a saved layout, or a file olai only shows such as a `.csv` or a picture. Nor does a serve with no agent this machine can start.

    Without a chat about that note, the line holds a box reading **Ask about plan…** where `Enter` sends. The closed block at the foot of this page says what sending does.

[^palette]: `Cmd` + `K` opens the palette on a Mac, and `Ctrl` + `K` everywhere else. The `+` beside **Chats** opens the palette already on **New chat**, which asks two things, and nothing is created until you send the second.

    The palette's **Chat about this page** asks one thing, in a box reading **Ask about plan…**, and is offered only while the page in front has no chat. Where a new chat can go, and what creating one does, are in the closed block at the foot of this page.

[^zoom]: Zooming into a row means opening it so that it is the top of what you see. Sending from the box below it starts that row's agent and delivers what you typed to the new conversation, with the rows under it still in front of you.

[^fold]: Unfolding puts the conversation under the row and above the row's children. Press the state shown beside the row to unfold it, and press it again to fold it. Several rows can be unfolded at once.

[^page]: On the row's own page, the agent line and the strips above the conversation sit under the title. The rows under it come below the drawer of the row's properties, and the conversation comes after those rows, scrolling with the pane.

[^beside]: A chat has an address of its own. **Open beside ›** on the agent line opens it in the pane to the right, and leaves the page you are reading as it is. While a pane holds the conversation, the row's fold, the row's page and the line at the top of a note each read **Shown beside**, which takes you to that pane. A link you click inside a chat pane opens in the pane beside it.

[^panel]: The agent panel, labelled **Agent panel**, stays where it is while you move between outlines. A phone has no panel. Four things open it on the conversation they name: the control on a **Chats** row that hovering reveals, **Open in panel ›** on the agent line, `Cmd` + `J`, and the panel button in the bar beside the health dot.

[^column]: The panel's bar names the conversation it is showing, carries **Switch conversation** for picking another, and a `×` that closes it. With no conversation chosen, the panel offers that same list. Which conversation it shows, whether it is open and how wide it is are remembered by this browser.

[^standings]: What a row can say about its agent. **Needs you**: it asked you something and is waiting for the answer. **Working…**: it is working on a reply, with the time it has been at it. **Starting…**: it is starting. **Idle**: it is ready for your next message.

    The rest: **Not running**, the agent stopped. **Asleep**: it is saved, and opening it carries the conversation on, with the age of the last line heard. **No agent**: there is no chat on this row yet.

[^needs]: The **Needs you** part of the sidebar lists agents waiting for an answer first and agents that are not running after them, newest activity first. A row there shows how many questions are waiting, or **Not running**. The part is absent when nothing is waiting. Pressing a row in either part opens that chat's own page.

[^chats]: The **Chats** part lists every chat. Awake agents come first, in the order of the states above, and the rest follow by when they last said something. The limit of ten is applied after that sorting, so ten sleeping chats can never hide a live one. An awake row wears its state's dot, and a title in bold means the agent has spoken since you last read it ([what olai tells you about](attention.md)).

[^beyond]: Search for **Agents**, or for a title, in the palette to reach every agent, including the ones past the limit of ten. Each **Chats** row has a **•••** button of its own, revealed when you hover or focus it, carrying **Put to sleep**, **Tidy memory** and **Close the agent**. A phone draws no **•••**: the row's menu in the outline carries the same entries.

[^opening]: Clicking a chat, in **Chats**, in **Needs you** or in the palette, opens that chat's own page: `/chat/notes/plan.md` for a note, `/chat/<row id>` for a row. The page is headed by the name of the thing that chat belongs to. **Open plan beside ›** on it puts that thing in the pane to its left. Its **Chats** row is marked while you read the page.

    A chat about a page is listed under that page's name, with the page's own mark, and the palette adds the path under it, `Agents · notes/plan.md`. What such a title is called, however it is spelled, is in [plugins/chat.md](plugins/chat.md).

[^above]: The button on a row that sits under an agent's row reads `↑` with that agent's mark, the row's title and the agent's name. Pressing it opens that chat's own page.

    The trail of parent rows drawn above a row, on a day's row and in the place line of a search result marks every parent that has an agent, and each mark opens that agent's conversation. Where two rows above you have agents, the button names the nearest one and both marks are drawn.

[^verbs]: Replacing a conversation asks you to confirm first, and the question says that the memory is the rows under this one, and that the transcript stays in the earlier chats. What each button does, and where it is, are in the closed block at the foot of this page.

    Where several agents can start, the **Fresh start** menu puts this row's current agent first, and picking another moves the row onto that agent. On a chat that could not be opened there is nothing to replace, so the press goes straight through.

[^earlier]: The conversation line's **Earlier chats ↑** lists those chats with the counts and dates its agent supplies. Choosing one opens it in the same fold or page and puts **Back to current chat ↩** on the line. An earlier chat stays writable, and opening it changes neither which chat the row has nor the current conversation. Pi lists at most its newest fifty conversations.

[^seats]: Eight is the limit on agents awake at once. An agent left idle is closed after 48 hours, which the chat plugin's `idle-ms` setting shortens. Reading a conversation, work that is running and a question you have not answered each keep an agent awake.

[^waiting]: When no agent can be given up, starting or opening a chat is refused with *All 8 agents are awake — put one to sleep in Chats.* The panel says that quietly and offers no retry, because it is holding your request: **This chat opens here as soon as a seat frees.** Putting one agent to sleep is all you have to do.

[^preamble]: The instruction is drawn as a notice under your message. It says who the agent is, naming the row's title, its id and its file, and that the row's note says what to do and overrides the rest. It then says when to write to the rows below, which is only when a lasting fact has changed, and in what shape, which is one row per fact.

[^memory]: The agent's own memory files are switched off under olai, and the instruction says so, so the agent does not go looking for a second memory. A chat that was filed under **Chats** and then moved onto a row is told that it was moved, and asked to take what still matters from its conversation and write it into the rows below.

[^remind]: The reminder is one line, carried by every twentieth message a person sends. The number is `remind-every` on the chat row in `_olai/Settings.olai`, where `0` never reminds.

[^about]: A chat about a page is told one line more in its first message: ``This conversation is about `/notes/plan.md`: the person talks to you from that page, so read it before you answer.`` What a chat on a row of its own is told, and what the two have in common, are in [plugins/chat.md](plugins/chat.md).

[^tidy]: Tidying is one turn olai starts itself: when the chat has been left alone long enough, and enough has moved, the agent is asked to tidy its rows, shorten what they say and file them away. Nothing is tidied until you ask for it, chat by chat.

    Press **On** on the **Sleep** item in the **Tools** strip above the conversation, which writes `chat-agent-sleep: on` onto the row, or use **Sleep when idle** in the menus. What the item then says, what a pass does, and the settings that time it, are in the closed block at the foot of this page.

<details>
<summary>Where a new chat can go, and what creating one does</summary>

| Question | What it offers |
| --- | --- |
| Where? | **Inbox › Chats** as the default, so a plain `Enter` takes it; **Here**, the focused row or the row you zoomed into; **Recent**, up to five parents of recently active chats; **Nodes**, up to twenty matching rows once you type |
| What to say? | one line, with the agents that can start as its options and the first one chosen |

`Enter` or **Start chat** creates a child of the place you chose, titled from the first line of your message and cut at a word boundary to 60 characters. It starts the agent, opens the new row's own page and delivers the message once. An empty message is refused on the spot. Files olai keeps for itself, such as Settings and Properties, are never offered as a home.

While one new chat is starting, another is refused with *A new chat is already starting*, and your words stay in the box. Closing the palette does not cancel it: the chat is still created, and the message waits there as its draft.

</details>

<details>
<summary>What a chat about a note is, and what starting one does</summary>

Three doors start a chat about a note: the line at the top of it, the **This page** block at the top of the agent panel's picker, and the palette's **Chat about this page**. Sending writes `chat-agent-session` into that note's own front matter, which is what makes it that note's chat ([plugins/chat.md](plugins/chat.md)). It starts the agent, delivers your message once, and opens the conversation in the pane beside the note.

| What you ask for | What happens |
| --- | --- |
| a chat about a note that has none | the note carries the chat, and it opens in the pane beside the page |
| a second chat about one note | refused: `“plan” already has a chat; no conversation was created` |
| a chat about anything that is not a note or a row | there is no door to ask from: only those two can have one |

With a chat there, the line says how it stands: the agent's mark and its standing word. It reads nothing, so opening a note never wakes its agent.

Press the line, or **Open beside ›** at its end, to read the conversation in the pane to the right. Press it again and it takes you to that pane rather than opening a second one.

Two things are asked once for each row while this browser tab is open: whether a row a chat stands for still exists, and that row's name where the title is a bare `/#id`. So a row deleted after that still counts as its chat's place until you reload the tab, and a row renamed after that keeps its old name under **Chats** until you reload.

</details>

<details>
<summary>The buttons, and where they are</summary>

| Button | Where | What it does |
| --- | --- | --- |
| **Fresh start** | agent line, row menu | replaces the conversation with a new one, keeping the old one in the earlier chats |
| **Close** | agent line (**Close the agent** in the menus) | takes the chat off the row; the chat survives and is filed back under **Chats** |
| **Put to sleep** | row menu, **Chats** **•••**, palette | stops the turn, discards a question it was holding, frees the seat, leaves the chat on the row |
| **Sleep when idle** | row menu, palette | marks this chat for the tidying pass below; it reads **Stop sleeping when idle** once set |
| **Tidy memory** | row menu, **Chats** **•••**, palette, the sleep item | runs that pass now |
| **Open the agent above** | row menu, palette | opens the conversation of the nearest row above that has one |

</details>

<details>
<summary>Tidying an agent's memory for it</summary>

The rows under an agent grow and nothing shortens them. So olai can give a node agent one turn of its own for shortening them, and the **Sleep** item then says where that chat stands:

| The item says | What it means |
| --- | --- |
| **Off** with the last pass's age | nobody has asked for this chat to be tidied |
| **On · next in 4h if left alone** | due once the quiet period ends |
| **On · nothing new to tidy** | nothing has moved since the last pass |
| **On · too little to tidy · 2 of 5 rows** | some rows moved, not enough of them |
| **On · when this chat is quiet** | due, but the chat is still talking |
| **On · tidying now** | the pass is running |
| **On · last pass failed · not before 14:05** | a failed pass is left alone until that time |
| **off in Settings** | `sleep: off` in `_olai/Settings.olai` turns the whole thing off |

The turn is the conversation you already read: one row olai sent, the instruction behind one press, and the agent's edits under it as ordinary outline changes. Rows are moved under an `Archive` child, grouped by month, and nothing is deleted. A fact that changed keeps its earlier wording in the note, and numbers, dates and names are copied exactly. One pass touches at most about a fifth of the rows, and it writes only under that row.

A pass commits its own writes as `olai: sleep: <title>`, so `git revert` puts the rows back ([committing](git.md)). It can never interrupt you: a question asked inside a pass is cancelled after twenty minutes rather than shown to you. One pass runs at a time per directory, so pressing **Tidy memory** while olai is already tidying is refused in words.

| Setting | Default | What it decides |
| --- | --- | --- |
| `sleep` | `on` | whether tidying runs at all, for the chats that asked for it |
| `sleep-after` | `6h` | how long a chat is left alone before it is tidied |
| `sleep-floor` | `5` | how many rows must have moved to be worth a turn |
| `sleep-latest` | `7d` | how long a moved row may wait before olai tidies anyway |

</details>

<details>
<summary>Which machine holds the conversation</summary>

Which chat a row has is a property on the row, so it travels with your notes, and moving or renaming the row keeps it. The conversation itself belongs to the agent on the machine that ran it.

So another machine draws the row, and its own agent answers that it has no record of that conversation. That has a screen of its own, **This chat isn't on this machine.**, with the agent's words kept as a quiet detail. Beside them are **Start fresh chat**, which asks for no confirmation, and **Try again**, for a store that was simply not mounted.

You meet the same screen for a chat you started and never spoke in, because no agent writes a conversation down until something is said in it.

> Two machines on one directory overwrite each other's records of which chat a row has. A fresh start on either machine repoints the row for both, and the other machine then meets the same screen. It is one press to get out of, and nothing keeps the two in step.

Opening one of that row's earlier chats that has gone the same way says the same thing and offers no fresh start, since a fresh start repoints the row and this is not the chat the row has.

</details>


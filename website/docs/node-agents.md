# Node agents: giving a row or a document its own agent

A chat belongs to one row of an outline, or to one Markdown document. The conversation is a page of its own, drawn in a pane.

## Start a chat

Hover or focus a row with no agent and **Start an agent** appears beside it.[^start] A document's page has one line at the top, **Chat about this page**.[^line] The palette (`Cmd` + `K`) has **New chat**, which asks which row or document it is for.[^palette] Zooming into a row gives you an **Ask about** box below it.[^zoom]

## Read a chat's own page

The page is headed by the row or document the chat belongs to, with its path under it.[^page] **Open beside ›** puts the two in panes side by side.[^beside] On a document's chat, **Opens** decides whether a later press brings the document too.[^opens]

## Find a chat again

Each row says how its agent is doing.[^standings][^above] In the sidebar, **Needs you** lists agents waiting for an answer,[^needs] and **Chats** lists every chat, at most ten rows,[^chats][^opening] with the rest in the palette.[^beyond]

## Keep, close or replace a conversation

A conversation's buttons are **Fresh start**, **Close**, **Put to sleep**, **Sleep when idle**, **Tidy memory** and **Open the agent above**.[^verbs][^earlier] Eight agents can be awake at once; a ninth is refused until one sleeps.[^seats][^waiting]

## What the agent is told

The first message carries an instruction from olai.[^preamble] On a row, the note under it says what to do and the rows under it are its only memory.[^memory] A document is the whole memory of its own chat.[^about] Every twentieth message repeats the rule.[^remind] A row's chat you have marked tidies its own rows when left alone.[^tidy]

[^start]: Where only one agent is available it starts at once; where several are, they offer their names in a small menu. The row's menu carries the same entry, for the keyboard and for a long press on a phone. A successful start opens the conversation, records on the row which chat it has, and unfolds it. If the start fails, the reason stays on the row and no chat is recorded on it.

[^line]: The line sits at the top of a document (a `.md` file), under its path. No other page has one: not an outline, a day, the Agenda, the Trash, or a file olai only shows such as a `.csv` or a picture. With a chat there it carries the agent's mark, how the chat stands, **Chat about this page** and **Open beside ›**. It reads nothing, so opening a document never wakes its agent.

    Without a chat, the line holds a box reading **Ask about plan…** where `Enter` sends. The closed block below says what sending does.

[^palette]: `Cmd` + `K` opens the palette on a Mac, and `Ctrl` + `K` everywhere else. The `+` beside **Chats** opens the palette already on **New chat**, which asks two things, and nothing is started until you send the second.

    The palette's **Chat about this page** asks one thing, in a box reading **Ask about plan…**, and is offered only while the page in front is a document with no chat. What the two questions offer is in the closed block at the foot of this page.

[^zoom]: Zooming into a row means opening it so that it is the top of what you see. Sending from the box below it starts that row's agent and delivers what you typed to the new conversation, with the rows under it still in front of you. A row that already has a chat shows the conversation there instead.

[^page]: The head carries the row's title, or the document's name with its file mark, then its path, and how the chat stands at the right. Under that is the agent line, and then the conversation, whose box stays at the foot of the pane while the messages scroll. The page draws no trail of the pages above it. An item with no chat yet shows an **Ask about plan…** box in the conversation's place.

[^beside]: Pressing **Open beside ›** opens the conversation in the pane to the right, and leaves the page you are reading as it is. The same button on a chat's own page, **Open plan beside ›**, puts the row or document in the pane to its left. Below `md` it reads **Open plan ›** and opens the item in the next tab ([the sidebar, tabs and the palette](getting-around.md)).

    A conversation is drawn in one place at a time: a row's fold, the row's page and a document's line each read **Shown beside** while a pane holds it, and take you there.

[^opens]: The **Opens** line sits under the agent line on a document's chat page, and says **alone** or **with plan beside**. Pressing it writes `chat-opens` into that document's own front matter ([the outline file format](format.md)), so the answer travels with your files. With **beside**, opening that chat from **Chats** or the palette puts the document on the left and the conversation on the right. A row's chat always opens alone, because a row has nowhere to keep the switch.

[^standings]: What a row can say about its agent. **Needs you**: it asked you something and is waiting for the answer. **Working…**: it is working on a reply, with the time it has been at it. **Starting…**: it is starting. **Idle**: it is ready for your next message.

    The rest: **Not running**, the agent stopped. **Asleep**: it is saved, and opening it carries the conversation on, with the age of the last line heard. **No agent**: there is no chat on this row yet.

[^needs]: The **Needs you** part of the sidebar lists agents waiting for an answer first and agents that are not running after them, newest activity first. A row there shows how many questions are waiting, or **Not running**. The part is absent when nothing is waiting. Pressing a row in either part opens that chat's own page.

[^chats]: The **Chats** part lists every chat, on rows and on documents alike, each named by the thing it belongs to: a row's title, or a document's name with its file mark. A `README` is named after its folder, so the chat of `plugins/swatch/README.md` is `swatch`.

    Awake agents come first, in the order above, and the rest by when they last said something. The limit of ten comes after that sorting, so sleeping chats cannot hide a live one. An awake row wears its state's dot, and a bold title means it has spoken since you last read it ([attention.md](attention.md)).

[^beyond]: Search for **Agents**, or for a title, in the palette to reach every chat, including the ones past the limit of ten. Each **Chats** row has a **•••** button of its own, revealed when you hover or focus it, carrying **Put to sleep**, **Tidy memory** and **Close the chat**. Beside it is a two-column button, **Open beside**, which puts that conversation in the pane to the right. A phone draws neither: the row's menu in the outline carries the same entries.

[^opening]: Clicking a chat, in **Chats**, in **Needs you** or in the palette, opens that chat's own page: `/chat/notes/plan.md` for a document, `/chat/<row id>` for a row. A document whose **Opens** switch says **beside** opens as two panes, the document and the chat, and that pair is one address, so a reload brings both back. The chat's **Chats** row is marked while you read it, and the palette adds the path under a document's chat, `Agents · notes/plan.md`.

[^above]: The button on a row that sits under an agent's row reads `↑` with that agent's mark, the row's title and the agent's name. Pressing it opens that chat's own page.

    The trail of parent rows drawn above a row, on a day's row and in the place line of a search result marks every parent that has an agent, and each mark opens that agent's conversation. Where two rows above you have agents, the button names the nearest one and both marks are drawn.

[^verbs]: Replacing a conversation asks you to confirm first, and the question says that the memory is the rows under this one, and that the transcript stays in the earlier chats. What each button does, where it is, and which two a document's chat refuses, are in the closed block at the foot of this page.

    Where several agents can start, the **Fresh start** menu puts this row's current agent first, and picking another moves the row onto that agent. On a chat that could not be opened there is nothing to replace, so the press goes straight through.

[^earlier]: The conversation line's **Earlier chats ↑** lists those chats with the counts and dates its agent supplies. Choosing one opens it in the same fold or page and puts **Back to current chat ↩** on the line. An earlier chat stays writable, and opening it changes neither which chat the item has nor the current conversation. Pi lists at most its newest fifty conversations.

[^seats]: Eight is the limit on agents awake at once. An agent left idle is closed after 48 hours, which the chat plugin's `idle-ms` setting shortens. Reading a conversation, work that is running and a question you have not answered each keep an agent awake.

[^waiting]: When no agent can be given up, starting or opening a chat is refused with *All 8 agents are awake — put one to sleep in Chats.* Where the conversation would be drawn, olai says that quietly and offers no retry, because it is holding your request: **This chat opens here as soon as a seat frees.** Putting one agent to sleep is all you have to do.

[^preamble]: The instruction is drawn as a notice under your message. On a row it names the row's title, its id and its file, and says that the row's own note overrides the rest. It then says when to write to the rows below, which is only when a lasting fact has changed, and in what shape, which is one row per fact.

[^memory]: The agent's own memory files are switched off under olai, and the instruction says so, so the agent does not go looking for a second memory.

[^about]: A document's chat is told which document it belongs to, and that the document is its memory, to be read with `markdown_read` before every answer. It is told that the file is yours and changes only when you ask, and that the `---` block at the top is to be left exactly as it is. There are no rows under a document to write to, so none of the law about writing them is sent.

[^remind]: The reminder is one line, carried by every twentieth message a person sends. A document's chat is reminded to read the document again before answering. The number is `remind-every` on the chat row in `_olai/Settings.olai`, where `0` never reminds.

[^tidy]: Tidying is one turn olai starts itself: when the chat has been left alone long enough, and enough rows have moved, the agent is asked to shorten its own rows and file them away. Nothing is tidied until you ask for it, chat by chat.

    Press **On** on the **Sleep** item in the **Tools** strip above the conversation, which writes `chat-agent-sleep: on` onto the row, or use **Sleep when idle** in the menus. What a pass does, what the item can say and the settings behind it are on [the chat plugin's page](plugins/chat.md).

<details>
<summary>Which row or document a new chat is for, and what starting one does</summary>

| Question | What it offers |
| --- | --- |
| Which row or document? | **Here**, the page or row in front of you, so a plain `Enter` takes it; **Recent**, up to five chats you were last in; **Nodes** and **Notes** once you type, up to twenty of each |
| What to say? | one line, with the agents that can start as its options and the first one chosen |

`Enter` or **Start chat** starts the agent on the thing you chose, delivers your message once, and opens that chat's page. Nothing is created to keep the chat in: it belongs to the row or the document itself. An empty message is refused on the spot. A row or document that already has a chat is listed as *has a chat*, and choosing it opens that conversation instead of starting a second.

The list leaves out what olai keeps for itself in `_olai/`, such as Settings and Pins, and anything in the Trash. Typing filters every heading at once.

While one new chat is starting, another is refused with *A new chat is already starting*, and your words stay in the box. Closing the palette does not cancel it: the chat is still started and your message is still delivered.

</details>

<details>
<summary>What a chat about a document is, and what starting one does</summary>

Two doors start a chat about a document: the line at the top of it, and the palette's **Chat about this page**. Sending writes `chat-agent-session` into that document's own front matter, which is what makes it that document's chat ([the outline file format](format.md)). It starts the agent, delivers your message once, and opens the conversation in the pane beside the document.

| What you ask for | What happens |
| --- | --- |
| a chat about a document that has none | the document carries the chat, and it opens in the pane beside the page |
| a second chat about one document | refused: `“plan” already has a chat; no conversation was created` |
| a chat about anything else | there is no door to ask from: only a row and a document can have one |

The words you type stay in the box they were typed in, so a refusal leaves them there with the reason under them, and so does leaving the page and coming back.

</details>

<details>
<summary>The buttons, and where they are</summary>

| Button | Where | What it does |
| --- | --- | --- |
| **Fresh start** | agent line, row menu | replaces the conversation with a new one, keeping the old one in the earlier chats |
| **Close** | agent line (**Close the chat** in the menus) | unties the chat from the row or document |
| **Put to sleep** | row menu, **Chats** **•••**, palette | stops the turn, discards a question it was holding, frees the seat, leaves the chat where it is |
| **Sleep when idle** | row menu, palette | marks this chat for tidying; it reads **Stop sleeping when idle** once set |
| **Tidy memory** | row menu, **Chats** **•••**, palette, the sleep item | runs that pass now |
| **Open the agent above** | row menu, palette | opens the conversation of the nearest row above that has one |

The one button with a cost is **Close**. A conversation is this row's or this document's only because the tie names it, so taking the tie off means olai shows that conversation nowhere: not in **Chats**, not in **Needs you**, not in the palette.

The transcript stays where the agent keeps it on this machine, and typing the same `chat-agent-session` value back onto the row, or into the document's `---` block, brings it back. A conversation you started outside olai is listed nowhere for the same reason: nothing in your files names it.

A document's chat can be put to sleep, which frees its seat. The two tidying buttons are refused on one, with *a note's chat keeps its memory in the note itself, so olai never tidies it or puts it to sleep*. Its conversation has no **Sleep** item and no count of rows.

</details>

<details>
<summary>Which machine holds the conversation</summary>

Which chat a row has is a property on the row, and a document keeps the same fact in the `---` block at the top of it. Either way it travels with your notes, and moving or renaming the row or the file keeps it. The conversation itself belongs to the agent on the machine that ran it.

So another machine draws the row, and its own agent answers that it has no record of that conversation. That has a screen of its own, **This chat isn't on this machine.**, with the agent's words kept as a quiet detail. Beside them are **Start fresh chat**, which asks for no confirmation, and **Try again**, for a store that was simply not mounted.

You meet the same screen for a chat you started and never spoke in, because no agent writes a conversation down until something is said in it.

> Two machines on one directory overwrite each other's records of which chat a row has. A fresh start on either machine repoints the row for both, and the other machine then meets the same screen. It is one press to get out of, and nothing keeps the two in step.

Opening one of that row's earlier chats that has gone the same way says the same thing and offers no fresh start, since a fresh start repoints the row and this is not the chat the row has.

</details>

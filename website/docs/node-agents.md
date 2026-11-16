# Node agents

A row can hold a conversation of its own: its title is the agent's name, its note the agent's charter, its subtree the agent's memory.

## Start an agent on a row

Hover or focus a plain row and **Start an agent** appears in its aside.[^start] The palette carries a **New chat** row that asks where to put it and what to say.[^palette] Zoom into a plain node and the box below it reads **Ask about** the node's title.[^zoom]

## Where a conversation is drawn

A conversation has three faces on a desktop and two on a phone, all with one draft and one transcript:

- the fold under the row[^fold]
- the node's own page[^page]
- the agent panel, a column on the right[^panel] with a bar of its own[^column]

## Find a chat again

A row's standing says where its agent stands.[^standings] The sidebar's **Needs you** region lists agents waiting for an answer,[^needs] and **Chats** under it lists every chat, capped at ten rows,[^chats] with the rest in the palette.[^beyond] A node under an agent wears a pill naming the closest bound ancestor.[^above]

## Keep, close or replace a conversation

Six verbs keep a conversation: **Fresh start**, **Close**, **Put to sleep**, **Sleep when idle**, **Tidy memory** and **Open the agent above**.[^verbs] The conversation line offers **Earlier chats ↑** beside them.[^earlier] At most eight agents are awake at once,[^seats] and a ninth waits for a seat.[^waiting]

## What the agent is told about its node

The first message a node agent accepts carries a preamble[^preamble] saying that the node's note is its charter and the subtree its only memory.[^memory] Every twentieth message repeats the rule.[^remind] Left alone long enough, a chat you marked tidies its own subtree.[^tidy]

[^start]: Starting on a row: one available agent starts at once, and several offer their names in a small menu. The row menu carries the same entry, for the keyboard and for a long press on a phone. A successful start opens the conversation, writes the binding onto the row, and unfolds it. A refusal stays on the row and binds nothing.

[^palette]: The palette is what `Cmd` + `K` opens, which is `Ctrl` + `K` on everything but a Mac, and the `+` beside **Chats** opens it already on **New chat**. It asks two things, and nothing is created until the second is sent. Where a new chat can go, and what creating one does, are in the closed block at the foot of this page.

[^zoom]: Asking about a zoomed node sends from the box below it. Sending starts its agent and delivers what you typed to the new conversation, with the subtree still in front of you.

[^fold]: The fold under the row holds the conversation above the row's children. Press the standing in the row's aside to unfold it, and press again to fold it. Several rows can be unfolded at once.

[^page]: On the node's own page, the agent line and the strips sit under the title, the subtree below the property drawer, and the conversation after the subtree, scrolling with the pane.

[^panel]: The agent panel, labelled **Agent panel**, stays where it is while you move between outlines. A phone has no panel. Four doors open it on the conversation they name: the control on a Chats row revealed on hover, **Open in panel ›** on the agent line, `Cmd` + `J`, and the panel toggle in the bar beside the health dot.

[^column]: The column's bar names the docked agent, carries **Switch conversation** to pick another, and a `×` that shuts it. With nothing docked, the column offers that same list. Which conversation is docked, whether the column is open and how wide it is are remembered by this browser.

[^standings]: A standing is one word on the row. **Needs you**: the agent asked you something and is waiting for the answer. **Working…**: it is working on a reply, with the time it has been at it. **Starting…**: it is starting. **Idle**: ready for your next message. **Not running**: the agent stopped. **Asleep**: saved, and opening it continues the conversation, with the age of the last line heard. **No agent**: no chat here yet.

[^needs]: The **Needs you** region lists agents waiting for an answer before agents that are not running, newest activity first. A row shows how many questions are waiting, or **Not running**. The region is absent when nothing is waiting. Pressing a row in either region opens the conversation's own page.

[^chats]: The **Chats** region lists every chat. Awake agents lead, in the order of the standings above, and everything else follows by what it last said. The cap of ten is applied after that order, so ten sleeping chats can never hide a live one. An awake row wears the standing's dot, and a title in bold weight means the agent has spoken since you last read it ([what olai tells you about](attention.md)).

[^beyond]: Search **Agents** or a title in the palette to reach every agent, including those beyond the cap. Each Chats row has a **•••** of its own, revealed on hover or focus, carrying **Put to sleep**, **Tidy memory** and **Close the agent**. A phone draws no **•••**: the row menu in the outline carries the same verbs.

[^above]: The pill on a node under a node agent is a door. It reads `↑` with the ancestor's mark, title and agent name, and pressing it opens that ancestor's conversation page.

    Every crumb of a bound ancestor wears that agent's mark too, in the breadcrumbs above a node, on a day's row and in a search result's place line, and each mark is the same door. When two ancestors are bound, the pill names the closest and every bound crumb is marked.

[^verbs]: Replacing a conversation asks for confirmation first, and the question says that the memory is the subtree and that the transcript stays in the earlier chats. What each verb does, and where it is, is in the closed block at the foot of this page.

    Where several agents can start, the **Fresh start** menu puts the node's current one first, and picking another moves the node onto it. On a chat that could not be opened there is nothing to replace, so the press goes straight through.

[^earlier]: The line's **Earlier chats ↑** comes with the counts and dates its agent supplies. Choosing one opens it in the same fold or page and puts **Back to current chat ↩** on the line. History stays writable, and opening it changes neither the binding nor the current conversation. Pi lists at most its newest fifty conversations.

[^seats]: Eight is the cap on agents awake at once. An idle one is closed after 48 hours, which the chat plugin's `idle-ms` setting shortens. Reading a conversation, work in flight and an unanswered question all keep one alive.

[^waiting]: When nothing can be given up, starting or opening a chat is refused with *All 8 agents are awake — put one to sleep in Chats.* The panel draws that quietly and offers no retry, because it is holding your request: **This chat opens here as soon as a seat frees.** Putting one agent to sleep is the whole of what you do.

[^preamble]: The preamble is drawn as a notice under your message. It says who the agent is, naming the node's title, id and file, and that the node's note is its charter, which overrides the rest. It then says when to write to the subtree, which is only when a durable fact changed, and in what shape, which is one node per fact.

[^memory]: The agent's own harness memory is switched off under olai, and the preamble says so: the subtree is the only memory, so the agent does not go looking for a second one. A chat that was filed under Chats and then moved onto a node is told it was moved here, and asked to distil what is still relevant from its conversation into the subtree.

[^remind]: The reminder is one line, carried by every twentieth message a person sends. The count is `remind-every` on the chat row in `_olai/Settings.olai`, where `0` never reminds.

[^tidy]: Tidying is one machine turn of the agent's own: left alone long enough, and with enough moved, the agent is asked to tidy, distil and tuck away. Nothing is tidied until you ask for it per chat.

    Press **On** on the **Sleep** item under the tools strip, which writes `chat-agent-sleep: on` onto the node, or use **Sleep when idle** in the menus. What the item then says, what a pass does and the settings that time it are in the closed block at the foot of this page.

<details>
<summary>Where a new chat can go, and what creating one does</summary>

| Level | What it offers |
| --- | --- |
| Where? | **Inbox › Chats** as the default, so a plain `Enter` takes it; **Here**, the focused row or zoomed node; **Recent**, up to five parents of recently active chats; **Nodes**, up to twenty matches once you type |
| What to say? | one line, with the agents that can start as its options and the first chosen |

`Enter` or **Start chat** creates a child of the chosen place, titled from the first line of your message and clipped at a word boundary to 60 characters. It starts the agent, opens the child's own page and delivers the message once. An empty message is refused in place; machinery files such as Settings and Properties are never offered as a home.

While one new chat is starting, another is refused with *A new chat is already starting*, and your words stay in the box. Closing the palette does not cancel it: the chat is still created, and the message waits there as its draft.

</details>

<details>
<summary>The verbs, and where they are</summary>

| Verb | Where | What it does |
| --- | --- | --- |
| **Fresh start** | agent line, row menu | replaces the conversation with a new one, keeping the old one in the earlier chats |
| **Close** | agent line (**Close the agent** in the menus) | takes the binding off the node; the chat survives and is filed back under Chats |
| **Put to sleep** | row menu, Chats **•••**, palette | stops the turn, discards a question it was holding, closes the seat, keeps the binding |
| **Sleep when idle** | row menu, palette | marks this chat for the tidying pass below; it reads **Stop sleeping when idle** once set |
| **Tidy memory** | row menu, Chats **•••**, palette, the sleep item | runs that pass now |
| **Open the agent above** | row menu, palette | opens the nearest bound ancestor's conversation |

</details>

<details>
<summary>Tidying memory while nobody is looking</summary>

A subtree grows and nothing compacts it. So olai can give a node agent one machine turn of its own, and the **Sleep** item then says where the chat stands:

| The item says | What it means |
| --- | --- |
| **Off** with the last pass's age | nobody has asked for this chat to be tidied |
| **On · next in 4h if left alone** | due once the quiet window closes |
| **On · nothing new to tidy** | nothing has moved since the last pass |
| **On · too little to tidy · 2 of 5 rows** | some rows moved, not enough of them |
| **On · when this chat is quiet** | due, but the chat is talking |
| **On · tidying now** | the pass is running |
| **On · last pass failed · not before 14:05** | a failed pass is left alone until then |
| **off in Settings** | `sleep: off` in `_olai/Settings.olai` turns the loop off for everything |

The turn is the conversation you already read: one machine-sent row, its instruction folded behind one press, and the agent's edits under it as ordinary outline changes. Rows move under an `Archive` child grouped by month and nothing is deleted. A fact that changes keeps its earlier wording in the note, and numbers, dates and names are copied exactly. One pass is capped at about a fifth of the subtree, and it writes only inside that node's subtree.

A pass commits its own writes as `olai: sleep: <title>`, so `git revert` puts the subtree back ([committing](git.md)). It can never wake you: a question asked inside one is cancelled after twenty minutes rather than announced. One pass runs at a time per directory, so pressing **Tidy memory** while olai is already tidying is refused in words.

| Setting | Default | What it decides |
| --- | --- | --- |
| `sleep` | `on` | whether the loop runs at all for the chats that asked |
| `sleep-after` | `6h` | how long a chat is left alone before it is tidied |
| `sleep-floor` | `5` | how many rows must have moved to be worth a turn |
| `sleep-latest` | `7d` | how long a moved row may wait before olai tidies anyway |

</details>

<details>
<summary>Where the binding lives, and what a second machine sees</summary>

The binding is a property on the node, so it travels with your notes; moving or renaming the node keeps it. The conversation itself belongs to the agent on the machine that ran it.

Another machine therefore draws the node, and its own agent answers that it has no record of that conversation. That gets a face of its own, **This chat isn't on this machine.**, with the agent's words kept as a quiet detail. Beside them are a **Start fresh chat** that needs no confirmation, and a **Try again** for a store that was simply not mounted.

You meet the same face for a chat you started and never spoke in, because no agent writes a conversation down until something is said in it.

> Two machines on one directory overwrite each other's pointers. A fresh start on either repoints the binding for both, and the other machine then meets the same face. It is one press out, and nothing keeps the two in step.

Reading one of that node's earlier chats that has gone the same way says the same thing and offers no fresh start, since that gesture repoints the node and this is not the chat it is bound to.

</details>

<details>
<summary>The chats you already have</summary>

olai files conversations that no node claims under a top-level **Chats** node, which it keeps in the Inbox. Without an Inbox nothing is filed. It asks every installed agent at boot and when sessions change, and asks a running agent again after each settled turn, so a conversation driven from a terminal is filed shortly after.

A filed row is titled with the stored title, or the session id where there is none, and its note carries whichever of the message count and last-touched minute the agent supplied. Filed rows are asleep until something opens them. **Move to…** gives one a different home and keeps its binding, and trashing one does not bring it back.

Each machine files its own conversations. Moving a filed agent into another agent's subtree makes that subtree part of the outer agent's memory, and both stay usable.

</details>

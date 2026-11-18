# Talking to an agent from a row or a page

This plugin lets you talk to an agent about one row of an outline or one `.md` file. An agent is a coding assistant such as Claude Code or Codex.

Chat is on by default.[^workflow]

## What chat needs to work

One engine plugin, the plugin that runs one agent program: [claude](claude.md), [codex](codex.md), [opencode](opencode.md), [pi](pi.md) or [omp](omp.md).[^none][^engine]

## Where a conversation is drawn

Every chat has a page of its own, at `/chat/<the row's id>` or `/chat/<the document's path>`, which a pane shows.[^page][^drawnonce][^faces][^noteline][^links] Chat adds no tools an agent can call, only instructions.[^charter]

## Give a row or a document a chat

A row with its own agent is called a node agent: a property whose kind is `chat-agent-session`, with the rows under it as its memory.[^declare] A document keeps that key in its frontmatter and is its own memory.[^notekeys][^opens]

| Kind | What a value means |
| --- | --- |
| `chat-agent-session` | The engine, and after a colon the conversation: `claude`, or `claude:0f3c8d21-…`. |
| `chat-agent-slept` | When olai last shortened that memory. Only olai's own pass writes it. |
| `chat-agent-sleep` | `on` lets olai shorten that memory on a schedule; absent or `off` does not. |
| `chat-opens` | On a document: `beside` opens its chat with the document beside it. |

The `+` beside **Chats** and the palette's **New chat** ask which node or document a chat is for.[^newchat][^named]

## Let olai shorten a node agent's memory

olai can shorten a node agent's memory, and does nothing until you ask. The line under the conversation carries **Sleep**, with a switch, and **Tidy memory**, which runs a pass now.[^sleepline] A chat about a document has neither.[^notesleep]

## Switching chat off

Set `on: no` on the `chat` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)).[^off]

[^workflow]: [Talking to an agent](../chat.md) explains how to work with an agent. This page describes the plugin itself: what it needs, what it draws, and what it stores.

[^none]: With no engine available the agent menu says `No agent is set up` and offers **Open plugins**. The palette offers no **New chat** row while nothing can start.

[^engine]: `OLAI_AGENT_PATH` lists the directories that hold those programs; unset, olai searches `PATH`. Switching one engine plugin off, or emptying the path to its own program, makes only that engine unavailable. The other engines that are switched on are still found, and conversations carry on.

[^page]: A chat's page is headed by the name of the row or document it is about, with that document's path, or the path of the outline the row is written in, under it. Then comes the agent line, carrying **Open <name> beside ›**, and the conversation with its box pinned at the foot. There are no breadcrumbs. An item with no chat yet draws a box reading **Ask about <name>…** in place of the conversation.

[^drawnonce]: The agent line's **Open beside ›** opens the conversation in the pane to the right, and leaves the page you are reading as it is. Where a pane already holds that conversation, every other place draws one line reading **Shown beside**, which takes you to that pane. A link clicked inside a chat pane opens in the pane beside it: the one on its left, or a new one on its right.

[^faces]: Chat draws in ten places. They are inside a row, on a node's page, on the chat's own page, in the line at the top of a document, beside a row, in a row's menu and in the breadcrumbs. The other three are the sidebar, the palette, and a phone's bar of buttons along the bottom. The closed block below says what it draws in each.

[^noteline]: A document's page carries one line at the top, under the path: the agent's mark, how its chat stands, the words **Chat about this page**, and **Open beside ›**, which opens the conversation in the pane to the right. No other page has one, not an outline, a day, the Agenda, the Trash or a file olai only shows.

    Without a chat about that document, the line holds a box reading **Ask about plan…** where `Enter` sends, and an agent picker where more than one agent can start.

[^links]: Every row a conversation names is a link you can click. A reference an author wrote, the result of a write, and an id in backticks all select that row in whichever outline is showing it. A sidebar row, a **Needs you** row and an agent in the palette open the chat's own page instead, so that you can read the whole chat.

[^charter]: The paragraph chat adds to every conversation tells the agent three things. A person reads the answer in the pane beside the outline. An id in backticks is clickable, while one in a code fence is a quotation. A link to an address inside olai is opened in place. The [mcp](mcp.md) plugin puts this paragraph into the instructions an agent receives when it starts.

[^declare]: What a node agent writes under its row goes into your files. Each kind claims the property key spelled the same way as itself, so you need not declare any of them. olai never adds the property for you, and it never treats an undeclared column as one of these kinds. An agent may write none of them: an agent that gave itself the property would be deciding on its own that olai may wake it.

    The closed block below shows how to use column names of your own.

[^notekeys]: A document's chat lives in the `---` block at the top of the file. `chat-agent-session` says which conversation the document is having, and `chat-opens` says where that chat opens. olai refuses a write by an agent that changes or drops the tie, so an agent rewriting the file keeps that block as it is.

[^opens]: The chat page of a document carries **Opens**, with a switch reading `alone` or `with plan beside`, which writes `chat-opens`. Opening that chat from **Chats** obeys it: `beside` draws the document and the conversation side by side, as one address, so a reload brings both back. A node's chat always opens alone, because a row has nowhere to keep the switch.

[^newchat]: The first step lists **Here**, the chats you were last in under **Recent**, and every matching node and document under **Nodes** and **Notes** once you type. Nothing is created but the chat itself: it belongs to the node or the document you choose. An item that already has a chat reads `has a chat`, and choosing it opens that conversation. The second step takes your first message, and the agent to start where more than one can.

[^named]: A chat is named after what it is about: a row's own title, or a file's name without its suffix, `plan` for `notes/plan.md`. A `README.md` takes the name of its folder, so `plugins/swatch/README.md` reads `swatch`. Rename the file or retitle the row and every place that names the chat says the new name.

[^sleepline]: The switch reads **On** or **Off**. The row menu's **Sleep when idle** and **Stop sleeping when idle** write the same property, and the palette offers the same choice for the conversation on screen. Asking for a pass while `sleep` is off is refused with `sleep is off in this directory's settings`. The closed blocks below list everything that line can say, and the settings behind it.

[^notesleep]: Asking olai to tidy a document's chat, or to put that chat to sleep, is refused with `a note's chat keeps its memory in the note itself, so olai never tidies it or puts it to sleep`.

[^off]: To stop using one agent, switch that engine's own plugin off instead. Turn chat off when a deployment asks for it, or when this serve should not be a chat for a while.

    Switching it off removes the conversations, the chat pages, the sidebar sections, the palette rows, the line at the top of a document and everything in the closed block below, including any **New chat** step you had open. Every page is then whole, outline and document editors already on screen keep working, and switching chat back on restores what it draws.

<details>
<summary>What chat draws, place by place</summary>

| Place | What chat draws there |
| --- | --- |
| inside a row | The conversation, the line naming the agent, and the box you type in. |
| a node's page | The agent line under the title, and the conversation and the box after the rows. |
| the chat's own page | The whole conversation, headed by the name of the row or document it is about. |
| the line at the top of a document | How that document's chat stands, **Chat about this page** and **Open beside ›**, or the box that starts a chat. |
| beside a row | What the row's agent is doing, or a button to start an agent while one is available. |
| a row's menu | **Start an agent** on a plain row; **Fresh start**, **Close the agent** and the sleep entries on a row that has one. |
| the breadcrumbs | A mark on an ancestor row that has an agent, on a trail, a day's row and a search result. |
| the sidebar | The **Needs you** and **Chats** sections, with a `+` beside the Chats heading for **New chat**. |
| the palette | Every agent, the **New chat** row and **Chat about this page**, while an engine can start. |
| a phone's bottom bar | The **Chats** button, with a count of how many conversations need an answer. |

Where a pane already holds a conversation, the fold under its row and that row's own page draw one line reading **Shown beside** in place of it.

On a phone the chat page fills the screen, and the pane strip stays under the header while the page scrolls. **Open <name> beside ›** reads **Open <name> ›** there, and puts the row or document in the next tab along.

An agent that is working or starting shows a dot that pulses, with a ring around it, so a computer set to reduce motion still shows what the agent is doing. On a screen that forces its own colours, these marks are drawn in your colours rather than olai's ([theme](theme.md)). The words beside them say the same thing either way.

</details>

<details>
<summary>A chat about the document in front of you</summary>

Two doors offer a chat where the page in front is a document with no chat yet and an agent this machine can start. They are the box in the line at the top of that document, and **Chat about this page** in the palette, under **New chat**.

Sending writes `chat-agent-session` into the document's own frontmatter, starts the agent and delivers your message once. The line's box sends on `Enter`; the conversation then opens in the pane to the right of the document, once, on that press. A second chat for one document is refused with `“plan” already has a chat; no conversation was created`, and a path the directory serves nothing at with `olai holds nothing at /notes/plan.md to talk about; no conversation was created`.

A start the agent refuses keeps your words in the box you typed them in, with the reason beside them, and writes no session into the document. Sending again starts on the same document. A start that stops at sign-in leaves your words waiting for the conversation the sign-in opens.

With a chat about the document, the line says how that chat stands: the agent's mark and its standing word. It reads nothing, so opening the document wakes no agent.

Pressing the line, or **Open beside ›** at its end, opens the conversation in the pane to the right. While a pane holds it, both read **Shown beside** and take you to that pane instead.

| Where a document's chat is named | What you read |
| --- | --- |
| the sidebar's **Chats** and **Needs you** | the document's name, with its file's own kind mark |
| the palette | that name, with the document's path on the second line, `Agents · notes/plan.md` |
| a pane's header, a tab and the phone's strip | that name and the word chat, `plan · chat`, so the chat's column is not the document's column |

The agent is told in its first message that the conversation belongs to `notes/plan.md`. It is told that the document is its only memory, and to read it again before every answer. It is also told to change it only when you ask, and to leave the `---` block at its top exactly as it is.

A chat on a row is told what a node agent is told: the rows under that row are its memory.

> A file's address is its path. Rename the document outside olai and its chat moves with the file, because the tie is written inside the file rather than anywhere else.

</details>

<details>
<summary>Keep the properties under column names of your own</summary>

Say which column holds which kind with one row in `_olai/Properties.olai`:

```json
{"title":"agent-session","custom":{"type":"chat-agent-session"}}
```

A plugin may only declare a key carrying its own name, so switching a plugin on cannot take over a column you have been using for something else. You can name a column `last-consolidated` for `chat-agent-slept`, `agent-sleep` for `chat-agent-sleep` and `opens` for `chat-opens` the same way.

</details>

<details>
<summary>What the Sleep line says</summary>

| What it says | What is true |
| --- | --- |
| `off in Settings` | `sleep` is off for this directory, so there is no switch to offer. |
| `last 3h ago` alone | Nobody has asked for this one. |
| `no conversation yet` | The node has no conversation to hand a turn to. |
| `nothing new to tidy` | Nothing has changed since the last pass. |
| `too little to tidy · 2 of 5 rows` | Some rows changed, fewer than `sleep-floor`. |
| `when this chat is quiet` | A turn, a question or an unanswered form is in the way. |
| `next in 4h if left alone`, or `due now` | The quiet window is running, or has closed. |
| `tidying now` | This node's pass is running. |
| `last pass failed · not before 14:05` | A pass failed, and olai waits until then to try again. |

</details>

<details>
<summary>Settings</summary>

All of these go on the `chat` node in `_olai/Settings.olai`, and each has a field in the plugins panel ([settings](../settings.md)). A duration is a whole number and a unit out of `ms`, `s`, `m`, `h` and `d`, at most `2147483647ms`. A duration olai cannot read warns and falls back to the default.

| Setting | Default | What it does |
| --- | --- | --- |
| `on` | `yes` | Whether this plugin runs at all. |
| `idle-ms` | `172800000` | How long an idle chat keeps its agent running, in milliseconds. |
| `sleep` | `on` | Whether olai may shorten a chat's memory on a schedule. Each chat still has to ask. |
| `sleep-after` | `6h` | How long a node agent is left alone before olai shortens its memory. |
| `sleep-floor` | `5` | How many rows must have changed since the last pass before olai shortens. |
| `sleep-latest` | `7d` | How long a changed row may wait before olai shortens anyway. |
| `sleep-tick` | `15m` | How often olai looks for a node agent whose memory it could shorten. |
| `sleep-question` | `20m` | How long a tidying turn may sit on a question before olai stops it. |
| `sleep-limit` | `1h` | How long one tidying turn may run before olai stops it. |
| `remind-every` | `20` | Every how many messages a node agent is reminded where to write. Zero never reminds. |

</details>

<details>
<summary>What chat refuses to do</summary>

Eight node agents are awake at once. Opening a ninth is refused in its own conversation with `All 8 agents are awake — put one to sleep in Chats.`, and that refusal offers no retry button, because the thing to press is **Put to sleep** on another chat. The attempt waits where it is and is retried the moment a place frees up. A browser tab that closes takes its waiting attempt with it.

A conversation the engine cannot load is a different refusal. It names the machine, shows the engine's own sentence in a muted line, and offers one button to start a session. It does not heal on its own, and it never waits for a place.

Chat keeps at most 32 choices an agent is waiting on, rejects any an agent tries to write itself, and cancels queued messages when a choice is cleared or replaced. It stores the choice you made and draws how many are waiting, without reading what they mean: [kolu](kolu.md) and [odu](odu.md) draw their file pickers there, and [mail](mail.md) draws its switch there.

An action naming a conversation you are not looking at is refused rather than applied to another one, so a read, a send or a retry cannot land on the wrong chat.

</details>

<details>
<summary>What other plugins get from chat</summary>

Every plugin that can reach a conversation uses one of seven services chat provides.

| Service | What it offers | Which plugins use it |
| --- | --- | --- |
| `agents` | Which engines this build can run. | claude, codex, opencode, pi, omp |
| `deliveries` | A way to send a message into a conversation. | kolu, odu, mail |
| `session-start` | What to ask this machine when a conversation opens. | kolu, odu |
| `chat.seating` | Which rows have agents, with the engine and session of each, from one reading of the directory. | [xyne-spaces](xyne-spaces.md) |
| `watching` | What a plugin that mirrors a conversation is told. | xyne-spaces |
| `conversations` | Starting a chat on a node or a document, speaking into the one there, and which agents can be started. | [vault-plugins](vault-plugins.md) |
| `chat.beside` | Opening an item's chat in the pane beside the page a press came from. | vault-plugins |

The name `conversations` belongs to olai's core rather than to chat, and chat is what stands behind it while it is running. A plugin asks core for it on each call and gets either the service or nothing, so a plugin that can work without chat is never held up by it.

It offers four calls, and every one of them names a node or a document. `open` starts the chat of that item, gives it an agent and sends a first message. `say` speaks into the chat of an item, `here` takes a list of items and answers which of them have a chat, and `engines` says what this machine can start.

There is no call that reads a conversation: a plugin may start one and talk to it, never hold a copy of what was said.

Chat's `navigation` component offers `chat.beside`, rather than the plugin itself, because opening a pane is a call on the router that component holds. A serve with no router leaves a plugin waiting for it instead of handing over something that does nothing, and the page draws no button. Its `open` takes the item and the pane the press came from, and chat decides the rest: the pane to the right, or the pane that already holds that chat.

A serve with no chat plugin leaves all seven unavailable, and the plugins panel says so on each plugin's row, naming what it is waiting for. The runtime resolves that the moment chat is back.

</details>

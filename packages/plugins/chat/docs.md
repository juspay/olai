# Talking to an agent from a row

This plugin lets you talk to an agent from any row, which is one line of an outline. An agent is a coding assistant such as Claude Code or Codex.

Chat is on by default.[^workflow]

## What chat needs to work

One engine plugin, the plugin that runs one agent program: [claude](claude.md), [codex](codex.md), [opencode](opencode.md), [pi](pi.md) or [omp](omp.md).[^none] `OLAI_AGENT_PATH` lists the directories that hold those programs; unset, olai searches `PATH`.[^engine]

## Where conversations appear

Chat draws the conversation inside a row, on a node's page, in the agent panel, and in the sidebar's **Needs you** and **Chats** sections.[^faces] The panel opens and closes with `Cmd` + `J`.[^panel] Every row a conversation names is a link.[^links] Chat adds no tools an agent can call, only instructions.[^charter]

## Give a row its own agent

A row with its own agent is called a node agent. You make one by giving the row a property, a key and a value, whose kind is `chat-agent-session`. The rows under it are that agent's memory.[^declare]

| Kind | What a value means |
| --- | --- |
| `chat-agent-session` | The engine, and after a colon the conversation: `claude`, or `claude:0f3c8d21-…`. |
| `chat-agent-slept` | When olai last shortened that memory. Only olai's own pass writes it. |
| `chat-agent-sleep` | `on` lets olai shorten that memory on a schedule; absent or `off` does not. |

## Let olai shorten an agent's memory

olai can shorten a node agent's memory, and does nothing until you ask. The line under the conversation reads **Sleep**, with a switch, when the next pass is due, and **Tidy memory**, which runs one now.[^sleepline]

## Switching chat off

Set `on: no` on the `chat` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)). The choice survives a restart.[^off]

[^workflow]: [Talking to an agent](../chat.md) explains how to work with an agent. This page describes the plugin itself: what it needs, what it draws, and what it stores.

[^none]: With no engine available the agent menu says `No agent is set up` and offers **Open plugins**, and a Chats section with nothing in it reads `No chats yet. Start an agent on any row, or press + beside Chats.`

[^engine]: Switching one engine plugin off, or emptying the path to its own program, makes only that engine unavailable. The other engines that are switched on are still found, and conversations carry on.

[^faces]: Chat draws in nine places. They are inside a row, on a node's page, beside a row, in a row's menu, in the breadcrumbs, in the sidebar, in the palette, in the agent panel, and in a phone's bar of buttons along the bottom. The closed block below says what it draws in each.

[^panel]: `Cmd` is the key on a Mac and `Ctrl` elsewhere. Each browser remembers which conversation sits in the panel. Whether the column is open, and how wide it is, belongs to the frame around the page. A serve with no desktop interface draws no panel, no toggle and no shortcut.

[^links]: Every row a conversation names is a link you can click. A reference an author wrote, the result of a write, and an id in backticks all select that row in whichever outline is showing it. A sidebar row, a **Needs you** row and an agent in the palette open the conversation's own page instead, so that you can read the whole chat.

[^charter]: The paragraph chat adds to every conversation tells the agent three things. A person reads the answer in the panel beside the outline. An id in backticks is clickable, while one in a code fence is a quotation. A link to an address inside olai is opened in place. The [mcp](mcp.md) plugin puts this paragraph into the instructions an agent receives when it starts.

[^declare]: What a node agent writes under its row goes into your files. Each kind claims the property key spelled the same way as itself, so you need not declare any of the three. olai never adds the property for you, and it never treats an undeclared column as one of these kinds. An agent may write none of the three: an agent that gave itself the property would be deciding on its own that olai may wake it.

    The closed block below shows how to use column names of your own.

[^sleepline]: The switch reads **On** or **Off**. The row menu's **Sleep when idle** and **Stop sleeping when idle** write the same property, and the palette offers the same choice for the conversation on screen. Asking for a pass while `sleep` is off is refused with `sleep is off in this directory's settings`. The closed blocks below list everything that line can say, and the settings behind it.

[^off]: To stop using one agent, switch that engine's own plugin off instead. Turn chat off when a deployment asks for it, or when this serve should not be a chat for a while.

    Switching it off removes the conversations, the sidebar sections, the palette rows, the agent panel and everything in the closed block below, including any **New chat** step you had open. Outline and document editors already on screen keep working, and switching chat back on restores what it draws.

<details>
<summary>What chat draws, place by place</summary>

| Place | What chat draws there |
| --- | --- |
| inside a row | The conversation, the line naming the agent, and the box you type in. |
| a node's page | The agent line under the title, and the conversation and the box after the rows. |
| beside a row | What the row's agent is doing, or a button to start an agent while one is available. |
| a row's menu | **Start an agent** on a plain row; **Fresh start**, **Close the agent** and the sleep entries on a row that has one. |
| the breadcrumbs | A mark on an ancestor row that has an agent, on a trail, a day's row and a search result. |
| the sidebar | The **Needs you** and **Chats** sections, with a `+` beside the Chats heading for **New chat**. |
| the palette | Every agent, and the **New chat** row while an engine can start. |
| the agent panel | The conversation you put there, on a desktop. |
| a phone's bottom bar | The **Chats** button, with a count of how many conversations need an answer. |

An agent that is working or starting shows a dot that pulses, with a ring around it, so a computer set to reduce motion still shows what the agent is doing. On a screen that forces its own colours, these marks are drawn in your colours rather than olai's ([theme](theme.md)). The words beside them say the same thing either way.

</details>

<details>
<summary>Keep the properties under column names of your own</summary>

Say which column holds which kind with one row in `_olai/Properties.olai`:

```json
{"title":"agent-session","custom":{"type":"chat-agent-session"}}
```

A plugin may only declare a key carrying its own name, so switching a plugin on cannot take over a column you have been using for something else. You can name a column `last-consolidated` for `chat-agent-slept` and `agent-sleep` for `chat-agent-sleep` the same way.

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
| `conversations` | Starting a conversation, speaking into it, and which agents can be started. | [vault-plugins](vault-plugins.md) |
| `chat.dock` | Putting a conversation beside the page, and whether this window has room for one. | vault-plugins |

The name `conversations` belongs to olai's core rather than to chat, and chat is what stands behind it while it is running. A plugin asks core for it on each call and gets either the service or nothing, so a plugin that can work without chat is never held up by it.

It offers three calls. `open` creates the row, gives it an agent and sends a first message. `say` speaks into a conversation that already exists. `engines` says what this machine can start. There is no call that reads a conversation: a plugin may start one and talk to it, never hold a copy of what was said.

Chat's panel component offers `chat.dock`, rather than the plugin itself, so a serve with no desktop interface leaves a plugin waiting for it instead of handing over something that does nothing.

A serve with no chat plugin leaves all seven unavailable, and the plugins panel says so on each plugin's row, naming what it is waiting for. The runtime resolves that the moment chat is back.

</details>

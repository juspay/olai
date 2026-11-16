# The conversation

This plugin puts an agent conversation on any row, on a node's own page, and in the agent panel, with **Needs you** and **Chats** in the sidebar. It is on by default. [Talking to an agent](../chat.md) is the workflow; this page is the plugin's own account.

## What it needs

One engine plugin, each of which is a separate row: [claude](claude.md), [codex](codex.md), [opencode](opencode.md), [pi](pi.md) and [omp](omp.md). With none of them available the agent menu says `No agent is set up` and offers **Open plugins**, and a Chats section with nothing in it reads `No chats yet. Start an agent on any row, or press + beside Chats.`

| Environment variable | What it says |
| --- | --- |
| `OLAI_AGENT_PATH` | The directories holding agent executables. Unset, olai searches `PATH`. |

Switching an engine off, or emptying its own executable path, makes only that engine unavailable: the other enabled engines are still discovered, and conversations carry on.

## Where its faces hang

Chat contributes no tools of its own. What it adds to the agent face is one paragraph: its charter, which the [mcp](mcp.md) row composes into `initialize`'s instructions while this row is standing. The charter says that a person reads the answer in the panel beside the outline. It says that a backticked id in prose is clickable, that one in a code fence is a quotation, and that a link to an app address is followed in place.

| Place | What chat draws there |
| --- | --- |
| a row's fold | The conversation, the agent line and the composer. |
| a node's page | The agent line under the title, and the conversation and composer after the subtree. |
| a row's aside | A bound row's standing, or the start pill while an agent is available. |
| a row's menu | **Start an agent** on a plain row; **Fresh start**, **Close the agent** and the sleep verbs on a row with one. |
| the breadcrumbs | A bound ancestor's agent mark, on a trail, a day's row and a search result. |
| the sidebar | The **Needs you** and **Chats** sections, with a `+` beside the Chats heading for **New chat**. |
| the palette | Every agent, and the **New chat** row while an engine can start. |
| the agent panel | The docked conversation, on a desktop. |
| a phone's thumb bar | The **Chats** door, badged with how many conversations need somebody. |

The agent panel opens and closes with `Cmd` + `J`, which is `Cmd` on a Mac and `Ctrl` elsewhere. Which conversation is docked is remembered per browser; whether the column is open, and how wide, belongs to the frame. A serve with no desktop shell draws no panel, no toggle and no shortcut.

Every reference the panel draws is a real link. An authored reference chip, a write's result and a backticked id that names a node select that row in whichever outline draws it. A sidebar row, a **Needs you** row and an agent row in the palette open the conversation's own page instead, because opening a chat means reading it.

A standing is never told by movement alone. The dot for an agent that is working or starting wears a ring as well as a pulse, so a system set to reduce motion stills the animation without taking the fact away. On a screen that forces its own colours, every standing mark is drawn from your palette rather than olai's ([theme](theme.md)). The words beside them are unchanged either way.

## The properties a node agent carries

A node becomes a node agent by carrying a property whose kind is `chat-agent-session`. The subtree under that node is that agent's memory, and its writes reach your files.

| Kind | What a value means |
| --- | --- |
| `chat-agent-session` | The engine, and after a colon the conversation: `claude`, or `claude:0f3c8d21-…`. |
| `chat-agent-slept` | The instant olai last tidied that node agent's memory. Written by the pass alone. |
| `chat-agent-sleep` | `on` means olai may tidy that memory on its own clock. Absent or `off` means it may not. |

A kind claims the key equal to its own word, so none of the three needs a declaration. To keep bindings under a column of your own name, say which column is this kind with one row in `_olai/Properties.olai`:

```json
{"title":"agent-session","custom":{"type":"chat-agent-session"}}
```

olai never writes that row for you, and it never reads an undeclared column as a binding. A plugin may only declare a key carrying its own name, so enabling a plugin cannot take over a column you have been using for something else. The same holds for `last-consolidated` as `chat-agent-slept` and for `agent-sleep` as `chat-agent-sleep`.

A seated session may write none of the three: an agent that opted itself in would be authorizing its own wake-up.

## What the sleep line says

Nothing is tidied until you say so. Under a node agent's conversation, one standing line reads **Sleep**, then the **On** or **Off** switch, then what is due, then **Tidy memory** for a pass you want now. The row menu's **Sleep when idle** and **Stop sleeping when idle** write the same property, and the palette offers the same row for the conversation on screen.

| What it says | What is true |
| --- | --- |
| `off in Settings` | `sleep` is off for this directory, so there is no switch to offer. |
| `last 3h ago` alone | Nobody has asked for this one. |
| `no conversation yet` | The node has no conversation to hand a turn to. |
| `nothing new to tidy` | Nothing has moved since the last pass. |
| `too little to tidy · 2 of 5 rows` | Some rows moved, fewer than `sleep-floor`. |
| `when this chat is quiet` | A turn, a question or an unanswered form is in the way. |
| `next in 4h if left alone`, or `due now` | The quiet window is running, or has closed. |
| `tidying now` | This node's pass is in flight. |
| `last pass failed · not before 14:05` | A pass failed, and its backoff ends then. |

Asking for a pass with `sleep: off` is refused with `sleep is off in this directory's settings`.

## Settings

All of these go on the `chat` node in `_olai/Settings.olai`, and each has a field in the plugins panel ([settings](../settings.md)). A span is a whole number and a unit out of `ms`, `s`, `m`, `h` and `d`, at most `2147483647ms`; an unreadable one warns and falls back to the default.

| Setting | Default | What it does |
| --- | --- | --- |
| `on` | `yes` | Whether this row runs at all. |
| `idle-ms` | `172800000` | How long an idle chat keeps its agent running, in milliseconds. |
| `sleep` | `on` | Whether olai may tidy a chat's memory on its own clock. Each chat still has to ask. |
| `sleep-after` | `6h` | How long a node agent is left alone before olai tidies its memory. |
| `sleep-floor` | `5` | How many rows must have moved since the last pass before olai tidies. |
| `sleep-latest` | `7d` | How long a moved row may wait untidied before olai tidies anyway. |
| `sleep-tick` | `15m` | How often olai looks for a node agent whose memory it could tidy. |
| `sleep-question` | `20m` | How long a tidying turn may sit on a question before olai stops it. |
| `sleep-limit` | `1h` | How long one tidying turn may run before olai stops it. |
| `remind-every` | `20` | Every how many messages a node agent is reminded where to write. Zero never reminds. |

## What it refuses

Eight node agents are awake at once. Opening a ninth is refused in its own conversation with `All 8 agents are awake — put one to sleep in Chats.`, and that refusal alone offers no retry button, because the thing to press is **Put to sleep** on another chat. The attempt waits where it stands and is retried the moment a seat frees; a tab that leaves takes its wait with it.

A conversation the engine cannot load is a different refusal. Its body names the machine, keeps the engine's own sentence as a muted line, and carries one press to start a session. It does not heal on its own, and it never queues for a seat.

Chat keeps at most 32 wake choices, rejects any an agent tries to write, and revokes queued deliveries when a choice is cleared or replaced. It stores the pick and draws the waiting count without interpreting it: [kolu](kolu.md) and [odu](odu.md) draw their file pickers in that place, and [mail](mail.md) draws its switch.

A conversation verb that names a conversation you are not looking at is refused rather than acting on another one, which is how a read, a send or a retry cannot attach to the wrong chat.

## What waits on this row

Every plugin that can reach a conversation names one of five doors this row stands behind.

| Door | What it is | Who names it |
| --- | --- | --- |
| `agents` | Which engines this build can seat. | claude, codex, opencode, pi, omp |
| `deliveries` | Where a doorbell may ring. | kolu, odu, mail |
| `session-start` | What to ask this host when a conversation opens. | kolu, odu |
| `chat.seating` | The durable nodes, engines and sessions over one vault reading. | [xyne-spaces](xyne-spaces.md) |
| `watching` | What a plugin that mirrors a conversation is told. | xyne-spaces |

A serve with no chat row leaves all of them waiting, and the plugins panel says so per row, naming the account. That is a legitimate state the runtime resolves the moment the door arrives.

## Switching it off

Set `on: no` on the `chat` node in `_olai/Settings.olai`, or use its switch in the plugins panel; the choice survives a restart. That removes the conversations, the sidebar sections, the palette rows, the agent panel and every face in the table above, with any **New chat** level it had open. Outline and document editors already on screen keep working. Switching the row back on restores its services and its faces.

Turning the row off is a deployment's word, or a decision that this serve should stop being a chat for a while. To stop using one agent, reach for that engine's own row instead.

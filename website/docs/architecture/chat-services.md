# What chat offers other plugins

Every plugin that can reach a conversation uses one of seven services the chat plugin provides. This page lists them, and what happens while chat is not running.

## The seven services

| Service | What it offers | Which plugins use it |
| --- | --- | --- |
| `agents` | Which engines this build can run. | claude, codex, opencode, pi, omp |
| `deliveries` | A way to send a message into a conversation. | kolu, odu, mail |
| `session-start` | What to ask this machine when a conversation opens. | kolu, odu |
| `chat.seating` | Which rows have agents, with the engine and session of each, from one reading of the directory. | [xyne-spaces](../plugins/xyne-spaces.md) |
| `watching` | What a plugin that mirrors a conversation is told. | xyne-spaces |
| `conversations` | Starting a chat on a node or a document, speaking into the one there, and which agents can be started. | [vault-plugins](../plugins/vault-plugins.md) |
| `chat.beside` | Opening an item's chat in the pane beside the page a press came from. | vault-plugins |

There is no call that reads a conversation: a plugin may start one and talk to it, never hold a copy of what was said.

## While chat is not running

A serve with no chat plugin leaves all seven unavailable, and the plugins panel says so on each plugin's row, naming what it is waiting for. The runtime resolves that the moment chat is back. How a conversation is drawn and stored is on [chat's own page](../plugins/chat.md).

<details>
<summary>The conversations service, call by call</summary>

The name `conversations` belongs to olai's core rather than to chat, and chat is what stands behind it while it is running. A plugin asks core for it on each call and gets either the service or nothing, so a plugin that can work without chat is never held up by it.

It offers four calls, and every one of them names a node or a document. `open` starts the chat of that item, gives it an agent and sends a first message. `say` speaks into the chat of an item, `here` takes a list of items and answers which of them have a chat, and `engines` says what this machine can start.

</details>

<details>
<summary>Who offers chat.beside</summary>

Chat's `navigation` component offers `chat.beside`, rather than the plugin itself, because opening a pane is a call on the router that component holds. A serve with no router leaves a plugin waiting for it instead of handing over something that does nothing, and the page draws no button. Its `open` takes the item and the pane the press came from, and chat decides the rest: the pane to the right, or the pane that already holds that chat.

</details>

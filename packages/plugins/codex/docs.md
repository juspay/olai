# Codex, as a chat agent

Codex comes with olai: both the Codex program and the adapter that connects it, so you install nothing.[^pinned] For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

olai starts Codex through a helper program called an adapter, named in the `OLAI_ACP_CODEX` variable.[^swap] To stop offering Codex, switch its plugin off on the **Plugins** panel.[^off]

## Full access, on every conversation

> Before a conversation starts, new or resumed, olai asks Codex for full access, the same as `codex --yolo`: Codex reads and writes files and reaches the network without asking.[^fullaccess]

If Codex refuses, the conversation does not open.[^failed] A permission question Codex asks is yours to answer.[^asks]

## Sending a message while it works

A message you send while Codex is working joins the reply already running instead of starting a new one.[^steer] Codex offers no queue, so nothing promises it is kept until that reply ends.[^noqueue]

## What you see while it answers

A subagent Codex starts gets a panel of its own.[^children] A command left running in the background stays on screen afterwards.[^background] The line above the box you type in shows Codex's settings, such as reasoning effort.[^line] Click the model name while nothing is running to switch models.[^models] That line also names the account signed in,[^identity] and signing in uses a code you type on a web page.[^login] Memory from one conversation to the next is off.[^memory]

## When Codex does not appear

If `OLAI_ACP_CODEX` is empty, Codex is listed but cannot start.[^missing] Switching the plugin off and on makes olai look again; an environment change needs a restart. A model this build of Codex does not know fails on your first message.[^newer]

[^pinned]: Both halves come with olai, at fixed versions. Every documented way of starting olai carries the `codex-acp` adapter and the Codex program it drives, so neither has to be on the server's `PATH`.

    | Shipped with olai | Version |
    | --- | --- |
    | `codex-acp` | 1.13.1 |
    | Codex CLI | 0.156.1 |

[^swap]: `OLAI_ACP_CODEX` holds the command line olai runs as the adapter, and the wrapper sets it to the build olai ships unless you set it yourself first. Set it to a command line of your own to run a different adapter. Signing in to Codex and configuring it happen through Codex's own files and environment variables, not through olai.

[^off]: A plugin switched off stops looking for Codex and takes away everything it draws. Switch it off either by putting `on: no` on the `codex` node in `_olai/Settings.olai`, or with its switch on the **Plugins** panel, the list of olai's parts ([choosing what runs](../settings.md)).

[^fullaccess]: Full access is three settings olai asks for: `approvalPolicy: "never"`, `approvalsReviewer: "user"` and `sandboxPolicy: { type: "dangerFullAccess" }`. olai asks for them before a conversation starts, whether the conversation is new or one you are resuming.

[^failed]: If Codex refuses full access, the conversation fails to open, and olai tells you which mode it asked for, which conversation it was, and what Codex answered. That conversation is not started or remembered: the model, settings and transcript olai had ready are thrown away, and sending another message opens it again from the beginning.

[^asks]: A permission question from Codex is answered by you rather than by olai's own rule about which calls run unasked. The adapter displays titles such as `mcp.server.tool`, but the fields that rule reads carry only a meaningless call id, with no dependable server or tool name, so olai asks you instead of guessing from the displayed title.

[^steer]: A message sent mid-reply is delivered through `_session/steering`, and the box you type in offers **Interrupt** only because the adapter says it accepts such a message. The reply you first asked for is still the one that ends when the working indicator stops. olai asks for `idleBehavior: "promptRequired"`. If the reply finishes before your message arrives, the adapter leaves it unused, and olai sends it as an ordinary new message instead. Cancelling while that is happening starts no second reply.

[^noqueue]: Codex says it accepts a message mid-reply but says nothing about holding one, so nothing here promises that a message you send while it works is kept and answered after the running reply ends.

[^children]: A subagent says what it is and which conversation started it, including a subagent started by another subagent. Opening one replaces the work panel, and its back button takes you to the one above. A subagent's tool calls appear inside its own work, and its prose stays folded inside its panel. Permission questions stay in the main conversation and name the subagent asking. A subagent's settings, title and usage figures never replace the main conversation's.

[^background]: A terminal left running in the background outlives the reply. Running, completed, failed and stopped are shown both on the command's own line and in the strip of running tasks, and tasks that were already running when you open a conversation reappear there. Codex can stop such a task, but olai draws no stop button for one, as with its other task lines.

[^line]: The line above the box you type in shows the settings Codex reports, such as reasoning effort and collaboration mode, with the **Execution plan** drawn below it and kept up to date. Output from a shell command arrives under the line for that command, and ends with the command's exit status.

[^models]: You switch models from that line, and only while no reply is running. olai applies your choice with `session/set_config_option`, the names in the picker are exact model ids, and a choice that was accepted survives restarting the conversation. Codex's adapter has no `/model` command.

[^identity]: Codex tells olai which account it is signed in as, and the line above the box you type in names it: a label such as `ChatGPT Plus` with the account's email and plan, `OpenAI API key` when a key is used, or `Not logged in`. Codex reports it when olai first connects, each time a conversation opens, and whenever Codex itself sends an `account/updated` notice, so a sign-in Codex ran itself changes the label as soon as it finishes.

[^login]: Signing in uses the adapter's `chat-gpt-device-code` method, which it offers to a program that can show a web address. The adapter asks Codex for a one-time code and gives olai an address to visit. olai shows a card with the host, a link and the code, and tells the adapter when you are finished with the page. Closing the card cancels the sign-in.

    Two other methods are not offered: `chat-gpt`, which sends the browser back to an address on your own machine that a server cannot receive, and `api-key`, which needs a credential box the panel does not have.

[^memory]: Codex's memory across conversations is forced off. The `features.memories` setting is off by default, your own `~/.codex/config.toml` can switch it on, and Codex has no environment variable for it, so olai adds a `CODEX_CONFIG` overlay that sets it to false every time it starts Codex. The rows under the node the chat hangs from are the conversation's only memory.

    The overlay is merged, not substituted: every other key you set in `CODEX_CONFIG` is kept, and only `features.memories` is overridden. A `CODEX_CONFIG` that is not a JSON object is treated as if it were absent.

[^missing]: An agent that cannot be started is not offered anywhere a chat begins, and the **Plugins** panel files it under **Needs you**, saying *not found — olai was started without the wrapper that carries the pinned adapter*.

[^newer]: A model this build of Codex does not know can still appear in the picker, and then fail on your first message, with a warning about missing model metadata and the words *requires a newer version of Codex*. Update olai and restart the server to get a newer pair of programs.

    A `codex` on your own `PATH` is not the one olai runs, so upgrading that changes nothing. If you set `OLAI_ACP_CODEX` or `CODEX_PATH` yourself, upgrade the installation they point at.

<details>
<summary>Every variable olai reads or sets</summary>

| Variable | What it does |
| --- | --- |
| `OLAI_ACP_CODEX` | the command line olai runs as the adapter. The wrapper sets it to the build olai ships unless you set it first |
| `CODEX_PATH` | the Codex program that adapter drives. The wrapper sets it to the one olai ships |
| `OPENAI_API_KEY` | the credential Codex reads to reach the model provider |
| `CODEX_CONFIG` | a JSON object olai merges into Codex's settings every time it starts Codex |

</details>

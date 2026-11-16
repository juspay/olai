# Codex, as a chat agent

Codex comes with olai: a pinned adapter and executable, so the row needs nothing from the server's `PATH`.[^pinned] For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

olai runs the adapter named in `OLAI_ACP_CODEX`, and you can point that at another one.[^swap] The closed block below lists every variable. To switch the row off, use its switch on the **Plugins** panel.[^off]

## Full access, on every conversation

> olai asks for `agent-full-access` before a conversation becomes active, new or resumed. That is the equivalent of `codex --yolo`, so Codex reads and writes files and reaches the network without asking.[^fullaccess]

A failed selection takes the conversation with it.[^failed] A permission request Codex sends is yours to answer.[^asks]

## Talking while it works

A message sent while Codex works steers the running turn, so the original prompt is still the one whose completion clears the working indicator.[^steer] Nothing promises that it waits its turn.[^noqueue]

## What a turn looks like

A child session announces itself and its parent, and draws a card of its own.[^children] Background terminals stay visible after the turn.[^background] The agent line carries the settings the adapter advertises, with live plans below.[^line] Click the model name while the conversation is idle to switch models.[^models] The line names the account too,[^identity] and signing in is a device code and a page.[^login] Memories are off.[^memory]

## When Codex does not appear

An empty `OLAI_ACP_CODEX` leaves the row enabled but unavailable.[^missing] Detection is cached per activation: switching the row off and on asks again; changing the service's environment needs a restart. A model the shipped CLI does not know fails on the first prompt.[^newer]

[^pinned]: Both halves are pinned. Every documented way of starting olai carries a pinned `codex-acp` adapter and the Codex executable it drives.

    | Pinned | Version |
    | --- | --- |
    | `codex-acp` | 1.13.1 |
    | Codex CLI | 0.156.1 |

[^swap]: `OLAI_ACP_CODEX` is the command line olai runs as the adapter, and the wrapper sets it to the pinned build unless you set it first. Set it to a command line of your own to run another adapter. Signing in and configuring Codex go through Codex's own files and environment.

[^off]: Switching the row off takes its probing and everything it draws away. Put `on: no` on the `codex` node in `_olai/Settings.olai`, or use the switch on the **Plugins** panel ([choosing what runs](../settings.md)).

[^fullaccess]: Full access is three settings: `approvalPolicy: "never"`, `approvalsReviewer: "user"` and `sandboxPolicy: { type: "dangerFullAccess" }`. olai asks for them before a conversation becomes active, whether it is new or resumed.

[^failed]: A failed selection fails the open, with the mode, the conversation and the adapter's error. The conversation is not activated or remembered, the provisional model, settings and replayed transcript are cleared, and a later prompt has to open it again.

[^asks]: A permission request is answered by you rather than by olai's rule. The adapter shows MCP titles such as `mcp.server.tool`, but the fields that rule reads carry an opaque call id and no stable server or tool name, so olai asks rather than inferring one from display text.

[^steer]: A mid-turn message goes through `_session/steering`, and the composer offers that gesture only because the adapter advertises it. olai asks for `idleBehavior: "promptRequired"`. If the turn finishes before the steer arrives, the adapter leaves your message unconsumed and olai sends it as an ordinary tracked prompt instead. Cancelling during that race starts no second turn.

[^noqueue]: There is no queue. Codex advertises steering rather than queueing, so nothing here promises that a message sent mid-turn waits its turn.

[^children]: A child session announces itself and its parent, nesting included. Opening a nested agent replaces the work panel, and its back button returns you to the parent. Child tool calls appear inside that agent's work, and its prose stays in the agent card's fold. Permissions and questions stay in the main conversation and name the child asking. A child's settings, title and usage never replace the main conversation's.

[^background]: Background terminals outlive the turn. Running, completed, failed and stopped states attach to the command row and to the activity strip, and tasks announced while a conversation loads are restored there. The adapter can stop a task, but olai draws no per-task stop control, as with its other task rows.

[^line]: The agent line carries what the adapter advertises, such as reasoning effort and collaboration mode, with live plans below it. Terminal output streams into the tool row it belongs to, with an exit status.

[^models]: Models are switched from the agent line while the conversation is idle. olai applies the choice through `session/set_config_option`, the values are exact model ids, and a confirmed choice survives a restart of the conversation. Codex's adapter has no `/model` command.

[^identity]: Codex pushes its account over ACP, so the agent line names it: a `ChatGPT Plus`-style label with the account's email and plan, `OpenAI API key` for a key, or `Not logged in`. It reports after `initialize`, on each conversation open, and on Codex's own `account/updated` notification, so a sign-in it drove itself changes the chip as soon as it lands.

[^login]: Signing in runs `chat-gpt-device-code`, which the adapter offers to a client that says it can show a URL. It presses the Codex CLI for a one-time code and hands back a verification address. olai draws that as a card with the destination host, a link and the code, and answers the adapter when the page is done with. Backing out cancels the login at the adapter's end.

    Two methods are not offered: `chat-gpt`, which is a localhost redirect no server can receive, and `api-key`, which wants a credential box the panel does not have.

[^memory]: Cross-session memories are forced off. `features.memories` defaults off, your own `~/.codex/config.toml` can switch it on, and Codex has no environment variable for it, so every spawn carries a `CODEX_CONFIG` overlay that sets it false. The node's subtree is the conversation's only memory.

    The overlay is a merge: every other key you set in `CODEX_CONFIG` survives, and only `features.memories` is overridden. A `CODEX_CONFIG` that is not a JSON object is treated as absent, and the forced value stands alone.

[^missing]: An unavailable row is not offered anywhere a chat starts, and the **Plugins** panel files it under **Needs you** saying *not found — olai was started without the wrapper that carries the pinned adapter*.

[^newer]: A model the shipped CLI does not know can appear in the picker and then fail on the first prompt, with a missing-model-metadata warning and *requires a newer version of Codex*. Update olai and restart the server to pick up a newer pair. A `codex` on your own `PATH` is not the executable olai runs, so upgrading it changes nothing. If you override `OLAI_ACP_CODEX` or `CODEX_PATH`, update that installation instead.

<details>
<summary>Every variable olai reads or sets</summary>

| Variable | What it does |
| --- | --- |
| `OLAI_ACP_CODEX` | the command line olai runs as the adapter. The wrapper sets it to the pinned build unless you set it first |
| `CODEX_PATH` | the Codex executable that adapter drives. The pinned wrapper sets it to the one olai ships |
| `OPENAI_API_KEY` | the provider credential Codex reads |
| `CODEX_CONFIG` | a JSON object olai merges into the Codex session config on every spawn |

</details>

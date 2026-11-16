# pi, as a chat agent

pi takes both halves: an adapter olai ships pinned, and a `pi` you install. Put `pi` on this server's search path and the panel offers it as **Pi**.[^pinned]

## What olai runs

For what a conversation is, read [talking to an agent](../chat.md). olai hands the `pi` its probe found to the adapter, which keeps the row on the one your search path names.[^handed] The closed block below lists every variable. To switch the row off, use its switch on the **Plugins** panel.[^off]

## How olai's tools reach pi

pi's harness has no MCP client, so the adapter loads a bridge extension into each conversation's `pi`, and pi registers olai's servers as ordinary tools.[^bridge] No permission question comes back over ACP.[^permissions]

## Talking while it works

A mid-turn message queues, and says so: the adapter accepts it, announces *Queued message (position n).* and answers when its turn comes. There is no interruption to offer,[^steering] and no bypass mode either.[^bypass]

## What a turn looks like

A conversation's open answers with a startup banner for editors, drawn once.[^banner] Shell output streams under its tool row with its exit status, and edits draw fully, as diffs with `path:line` locations. An error inside a turn is silent.[^silent] The stored list answers in pages of fifty.[^stored] Memory is opt-in packages, and olai installs none.[^memory]

## Signing in, and when pi does not appear

pi is configured in a terminal, and olai draws no sign-in for it.[^login] The row needs both halves, so it names the one that is missing.[^missing] Install `pi` where the server can see it, then switch the plugin off and on to probe again; changing the service's environment needs a restart.

[^pinned]: The adapter and its bridge come with olai; `pi` is yours to install, from <https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent>.

    | Pinned | Version |
    | --- | --- |
    | `pi-acp` | 0.0.33 |
    | the `pi` these readings were taken against | 0.84.2 |

[^handed]: olai sets `PI_ACP_PI_COMMAND` on the spawn to the `pi` its own probe found. Left to itself, the adapter would resolve the word against its own parent's path, which is olai's rather than your shell's. An adapter you point `OLAI_ACP_PI` at answers for the wiring it carries, which need not include the bridge olai ships.

[^off]: Switching the row off takes its probing and everything it draws away. Put `on: no` on the `pi` node in `_olai/Settings.olai`, or use the switch on the **Plugins** panel ([choosing what runs](../settings.md)).

[^bridge]: The bridge carries that conversation's servers in its environment, and pi's own extension interface registers them as ordinary tools. They answer by the names the other agents use, `olai_*` and `kolu_*`.

[^permissions]: Permissions are pi's own settings, the way the other agents' settings govern theirs. The servers strip lists every server olai handed over, and no tick arrives to mark one connected.

[^steering]: There is no interruption on this wire. `_session/steering` does not exist, and the `/steering` in pi's own slash menu is about pi's message delivery rather than the ACP extension of the same name.

[^bypass]: `session/set_mode "bypassPermissions"` is refused, because the modes pi offers are its thinking levels.

[^banner]: The startup banner carries pi's version, an update notice, and the context and skills it loaded. pi then sends the same text again as an ordinary message. A client drawing no such block still shows it that way, and olai drops the double, matched on the exact text the open itself carried.

[^silent]: A silent error is one with nothing to show: a provider pi cannot reach ends the turn with no prose, no tool row and no usage, so what you get is olai naming a silent turn.

[^stored]: The stored list answers in pages of fifty. olai sends no limit and follows no cursor, so a directory with more than fifty stored pi conversations draws the newest page and loses the rest.

[^memory]: Memory is opt-in packages pi loads from its own config, and olai installs none. The node's subtree is the conversation's only memory.

[^login]: The one sign-in method the adapter advertises is its own `pi-acp --terminal-login`. A pi that is not signed in is refused when a conversation opens, with `-32000 "Authentication required"`, which the panel draws as a refused conversation you can reopen.

[^missing]: An unavailable row is not offered anywhere a chat starts, and the **Plugins** panel files it under **Needs you** with its reason.

    | What is missing | What the row says |
    | --- | --- |
    | `OLAI_ACP_PI` is unset or empty | *OLAI_ACP_PI is unset or empty — start olai with the wrapper that carries the pinned pi adapter* |
    | no runnable `pi` on the search path | *put `pi` on this server's `PATH` — the adapter for it comes with olai*, with a link to the agent |

<details>
<summary>Every variable olai reads or sets</summary>

| Variable | What it does |
| --- | --- |
| `OLAI_ACP_PI` | the command line olai runs as the adapter. The wrapper sets it to the pinned build unless you set it first |
| `OLAI_AGENT_PATH` | the directories olai looks in for `pi`. Set, it replaces the search path rather than adding to it |
| `PI_ACP_PI_COMMAND` | olai sets it on the spawn to the `pi` its own probe found |
| `PI_ACP_MCP_EXTENSION` | the pinned wrapper sets it to the bridge that gives pi olai's tools |

</details>

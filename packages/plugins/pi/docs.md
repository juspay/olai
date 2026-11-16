# pi, as a chat agent

pi takes both halves: an adapter olai ships pinned, and a `pi` your machine has. Put `pi` on this server's agent search path and the panel offers it as **Pi**. For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

| Variable | What it does |
| --- | --- |
| `OLAI_ACP_PI` | the command line olai runs as the adapter. The wrapper sets it to the pinned build unless you set it first |
| `OLAI_AGENT_PATH` | the directories olai looks in for `pi`. Set, it replaces the search path rather than adding to it |
| `PI_ACP_PI_COMMAND` | olai sets it on the spawn to the `pi` its own probe found |
| `PI_ACP_MCP_EXTENSION` | the pinned wrapper sets it to the bridge that gives pi olai's tools |

| Pinned | Version |
| --- | --- |
| `pi-acp` | 0.0.33 |
| the `pi` these readings were taken against | 0.84.2 |

The adapter and its bridge come with olai; `pi` is yours to install. Handing the found `pi` to the adapter is what keeps the row on the one your search path names: left to itself, the adapter would resolve the word against its own parent's path, which is olai's rather than your shell's.

An adapter you point `OLAI_ACP_PI` at answers for the wiring it carries, which need not include the bridge olai ships.

To switch the row off, put `on: no` on the `pi` node in `_olai/Settings.olai`, or use its switch on the **Plugins** panel ([choosing what runs](../settings.md)). The row stops probing and withdraws what it draws.

## How olai's tools reach pi

pi's harness has no MCP client of its own, so the adapter loads a bridge extension into each conversation's `pi` with that conversation's servers in its environment, and pi's own extension interface registers them as ordinary tools. They answer by the names the other agents use, `olai_*` and `kolu_*`.

No permission question comes back over ACP. What pi may do is pi's own settings, the way the other agents' settings govern theirs, so the servers strip lists every server olai handed over and no tick arrives to mark one connected.

## Talking while it works

A mid-turn message queues, and says so: the adapter accepts it, announces *Queued message (position n).* and answers your request when its turn comes.

- There is no interruption to offer. `_session/steering` does not exist on this wire, and the `/steering` in pi's own slash menu is about pi's message delivery rather than the ACP extension of the same name.
- There is no bypass mode either. `session/set_mode "bypassPermissions"` is refused, because the modes pi offers are its thinking levels.

## What a turn looks like

A conversation's open answers with a startup banner for editors. It carries pi's version, an update notice, and the context and skills it loaded.

pi then sends the same text again as an ordinary message, so that a client drawing no such block still shows it. olai drops the double, matched on the exact text the open itself carried.

- Shell output streams under its tool row and stays readable with its exit status. Edits draw fully, as diffs with `path:line` locations.
- An error inside a turn is silent: a provider pi cannot reach ends the turn with no prose, no tool row and no usage, so what you get is olai naming a silent turn.
- Its stored list answers in pages of fifty. olai sends no limit and follows no cursor, so a directory with more than fifty stored pi conversations draws the newest page and loses the rest.
- pi's memory is opt-in packages it loads from its own config, and olai installs none. The node's subtree is the conversation's only memory.

## Signing in

pi is configured in a terminal, and olai draws no sign-in for it: the one method the adapter advertises is its own `pi-acp --terminal-login`. A pi that is not signed in is refused when a conversation opens, with `-32000 "Authentication required"`, which the panel draws as a refused conversation you can reopen.

## When pi does not appear

The row needs both halves, so it names the one that is missing.

| What is missing | What the row says |
| --- | --- |
| `OLAI_ACP_PI` is unset or empty | *OLAI_ACP_PI is unset or empty — start olai with the wrapper that carries the pinned pi adapter* |
| no runnable `pi` on the search path | *put `pi` on this server's `PATH` — the adapter for it comes with olai*, with a link to the agent |

Either way the row is enabled but unavailable: it is not offered anywhere a chat starts, and the **Plugins** panel files it under **Needs you** with that reason. Install `pi` where the olai server can see it, then switch the plugin off and on to probe again without restarting olai. Changing the service's environment needs the service restarted.

The agent is at <https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent>.

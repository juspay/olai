# Spaces integration

[Xyne Spaces](https://github.com/xynehq/xyne) is a team chat. Bind one olai conversation to one Spaces channel and olai mirrors that conversation into the channel: doorbell digests, the agent's replies trimmed, and a working signal while a turn runs. Nothing comes back the other way.

## What it needs

Two facts, kept in two places because one of them is a secret.

| Environment variable | What it says |
| --- | --- |
| `OLAI_SPACES_URL` | The Spaces server to reach. |
| `OLAI_SPACES_TOKEN` | The credential for Spaces: the installed app's JWT. A secret, so the plugins panel shows whether it is set and never its value. |

Neither is a setting and neither is written to your files. The app you install in Spaces supplies both, and the bot posts under that app's name.

This plugin is off by default, because not every machine has a Spaces credential. Set `on: yes` on the `xyne-spaces` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)); the choice survives a restart.

| Setting | Default | What it does |
| --- | --- | --- |
| `reply-limit` | `500` | The maximum reply characters mirrored to a channel. A whole number of 1 or more. |

The mirror needs the chat plugin as well, for the reading of which nodes are seated with which conversation. With [chat](chat.md) switched off, the `xyne-spaces` row waits, naming `chat.seating`; switching chat on starts the mirror again.

## Bind a conversation to a channel

The bind is a property on the node agent, beside the property that holds its session:

```jsonl
{"id":"orch","ord":"a0","title":"orchestrator","custom":{"agent-session":"claude:<session-id>","xyne-channel":"<spaces-channel-id>"}}
```

`xyne-channel` is required on that node, and olai never writes it. Without it nothing posts, and a connected readout that posts nothing is the honest answer. The node is the identity, so a fresh session re-points the session property and the mirror follows it. A conversation that no node agent claims does not post.

## What the readout says

One row of the header's health-dot popover is this link's readout. A fault turns the health dot red; being unconfigured leaves it alone.

| Row | What it means |
| --- | --- |
| `xyne` | Both variables are set and the last post, if any, was accepted. The tip reads `Posting to <url>`. |
| `No xyne` | Nothing is configured. The tip names where olai looked and the two variables. |
| `xyne error` | A post was refused, or a channel is bound and the environment is missing. The tip says which. |

Nothing configured and a bind whose process has no Spaces app are different facts, which is why the readout has three states rather than two. The second is a fault: you named a channel and this process cannot post, so the dot goes red, the readout names the missing variable, and the first bound conversation is told once.

## What mirrors

Doorbell digests go over, at digest level of roughly five to eight messages per pull request rather than the firehose:

- a lane dispatched;
- a review verdict, with its counts;
- a CI result, posted once and then edited in place from first-red to final, never posted twice;
- a merge, with its timings line;
- anything stuck or needing a person.

A kolu heartbeat is not a digest and does not post. Messages you type in olai never mirror, and nothing a person says in the Spaces channel reaches olai.

The agent's replies and doorbell bodies all mirror, each cut to the first `reply-limit` Unicode code points with an ellipsis, and an open code fence that the cut would have left is closed. While the agent runs a turn, the channel carries an ephemeral working signal rather than a stored message; it ends when the turn does.

Each bound conversation gets one thread. The first digest opens it and later digests reply into it. Threads and the outbound queue are kept under `$XDG_STATE_HOME/olai/xyne-spaces/`, one file per served directory, so a restart opens the same thread and still holds the queued digests.

## When a post is refused

A refused post, and a bind whose process has no Spaces app, are said once into the olai conversation rather than once per message. The recovery sentence is a separate message, so it cannot replace the fault line.

Digests queue, capped at 32, and post in order when Spaces accepts again; the queue retries on its own rather than waiting for the next digest. A channel id that names nothing keeps retrying with the fault said. A thread that has gone is forgotten and the next digest opens a new one. A refusal that will never be accepted, such as a validation error, is dropped so it cannot wedge the rest.

Overflowing the cap drops the oldest and says so with the count. The readout stays on `xyne error`, and the health dot red, until a post is accepted.

> A kill between a post landing and its record being saved leaves the saved snapshot naming a digest already sent, and the next serve posts it again. Delivery is at least once, not exactly once.

## What this does not do

- No inbound. A message, mention, direct message, slash command or button press in the Spaces channel does not reach olai.
- No channel picker. The bind is the `xyne-channel` property on the node agent.
- No second file of knobs. Channels are properties, limits are the setting above, and credentials are the environment.

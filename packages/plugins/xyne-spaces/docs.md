# Spaces integration

[Xyne Spaces](https://github.com/xynehq/xyne) is a team chat. Bind one olai conversation to one channel and olai mirrors that conversation there.[^mirror] Nothing comes back the other way.

## What it needs

Two facts, kept in two places because one of them is a secret.

| Environment variable | What it says |
| --- | --- |
| `OLAI_SPACES_URL` | The Spaces server to reach. |
| `OLAI_SPACES_TOKEN` | The credential for Spaces: the installed app's JWT.[^secret] |

Neither is a setting and neither is written to your files.[^app] The plugin is off by default,[^off] and needs chat as well.[^chat] Its one setting, `reply-limit`, caps a mirrored reply.[^limit]

## Bind a conversation to a channel

The bind is a property on the node agent, beside the property that holds its session:

```jsonl
{"id":"orch","ord":"a0","title":"orchestrator","custom":{"agent-session":"claude:<session-id>","xyne-channel":"<spaces-channel-id>"}}
```

`xyne-channel` is required on that node, and olai never writes it.[^bind]

## What mirrors

Doorbell digests go over, at digest level rather than the firehose:[^level]

- a lane dispatched;
- a review verdict, with its counts;
- a CI result, posted once and then edited in place from first-red to final, never posted twice;
- a merge, with its timings line;
- anything stuck or needing a person.

Replies and doorbell bodies mirror, each cut to `reply-limit`.[^cut] Each bound conversation gets one thread.[^thread] What you type never mirrors.[^never]

## When a post is refused

A refused post, and a bind whose process has no Spaces app, are said once into the olai conversation rather than once per message.[^once] Digests queue, capped at 32, and post in order when Spaces accepts again.[^queue]

> A kill between a post landing and its record being saved leaves the saved snapshot naming a digest already sent, and the next serve posts it again. Delivery is at least once, not exactly once.

[^mirror]: What goes over is doorbell digests, the agent's replies trimmed, and a working signal while a turn runs.

[^secret]: The token is a secret, so the plugins panel shows whether it is set and never its value.

[^app]: The app you install in Spaces supplies both variables, and the bot posts under that app's name.

[^off]: Not every machine has a Spaces credential. Set `on: yes` on the `xyne-spaces` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)); the choice survives a restart.

[^chat]: The mirror needs the chat plugin for the reading of which nodes are seated with which conversation. With [chat](chat.md) switched off, the `xyne-spaces` row waits, naming `chat.seating`; switching chat on starts the mirror again.

[^limit]: `reply-limit` is the maximum reply characters mirrored to a channel: a whole number of 1 or more, `500` by default.

[^bind]: Without `xyne-channel` nothing posts, and a connected readout that posts nothing is the honest answer. The node is the identity, so a fresh session re-points the session property and the mirror follows it. A conversation that no node agent claims does not post.

[^level]: Digest level is roughly five to eight messages per pull request. A kolu heartbeat is not a digest and does not post.

[^cut]: A reply is cut to the first `reply-limit` Unicode code points with an ellipsis, and an open code fence that the cut would have left is closed. While the agent runs a turn, the channel carries an ephemeral working signal rather than a stored message; it ends when the turn does.

[^thread]: The first digest opens the thread and later digests reply into it. Threads and the outbound queue are kept under `$XDG_STATE_HOME/olai/xyne-spaces/`, one file per served directory, so a restart opens the same thread and still holds the queued digests.

[^never]: Messages you type in olai never mirror, and nothing a person says in the Spaces channel reaches olai.

[^once]: The recovery sentence is a separate message, so it cannot replace the fault line.

[^queue]: The queue retries on its own rather than waiting for the next digest. A channel id that names nothing keeps retrying with the fault said. A thread that has gone is forgotten and the next digest opens a new one. A refusal that will never be accepted, such as a validation error, is dropped so it cannot wedge the rest. Overflowing the cap drops the oldest and says so with the count.

<details>
<summary>What the header readout says</summary>

One row of the header's health-dot popover is this link's readout. A fault turns the health dot red; being unconfigured leaves it alone.

| Row | What it means |
| --- | --- |
| `xyne` | Both variables are set and the last post, if any, was accepted. The tip reads `Posting to <url>`. |
| `No xyne` | Nothing is configured. The tip names where olai looked and the two variables. |
| `xyne error` | A post was refused, or a channel is bound and the environment is missing. The tip says which. |

Nothing configured and a bind whose process has no Spaces app are different facts, which is why the readout has three states rather than two. The second is a fault: you named a channel and this process cannot post, so the dot goes red, the readout names the missing variable, and the first bound conversation is told once.

The readout stays on `xyne error`, and the health dot red, until a post is accepted.

</details>

<details>
<summary>What this does not do</summary>

- No inbound. A message, mention, direct message, slash command or button press in the Spaces channel does not reach olai.
- No channel picker. The bind is the `xyne-channel` property on the node agent.
- No second file of knobs. Channels are properties, limits are the setting above, and credentials are the environment.

</details>

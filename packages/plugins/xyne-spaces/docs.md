# Mirror a conversation into a Xyne Spaces channel

[Xyne Spaces](https://github.com/xynehq/xyne) is a team chat. Link one olai conversation to one Spaces channel, and olai posts that conversation's progress there.[^mirror] Nothing comes back the other way.

A conversation is one chat in olai's agent panel.

## What it needs

Two facts, kept outside your files; one is secret.

| Environment variable | What it says |
| --- | --- |
| `OLAI_SPACES_URL` | The Spaces server to reach. |
| `OLAI_SPACES_TOKEN` | The credential for Spaces: the installed app's JWT.[^secret] |

Neither is written to your files.[^app] The plugin is off by default[^off] and needs the chat plugin.[^chat] Its one setting, `reply-limit`, limits how much of a reply is posted.[^limit]

## Link a conversation to a channel

The link is a property on the node agent, the row an agent works on:

```jsonl
{"id":"orch","ord":"a0","title":"orchestrator","custom":{"agent-session":"claude:<session-id>","xyne-channel":"<spaces-channel-id>"}}
```

`xyne-channel` is required; olai never writes it.[^bind]

## What gets posted

A doorbell is a watch that messages a conversation when a file changes. olai posts its digests, not every message.[^level] One digest goes over for each of these:

- a lane, one row of work, sent out;
- a review verdict, with its counts;
- a CI result, posted once and edited in place;
- a merge, with its timings;
- anything stuck or needing a person.

Replies go over too, each cut to `reply-limit`, as is each digest.[^cut] Each linked conversation gets one thread.[^thread] What you type never goes over.[^never]

## When a post is refused

A refused post is reported once into the olai conversation, not per message.[^once] Digests wait in a queue of 32 and post in order when Spaces accepts again.[^queue]

> If olai is killed after a post lands but before its record is saved, the next serve posts that digest again. Delivery is at least once, not exactly once.

[^mirror]: What goes over is doorbell digests, the agent's replies trimmed, and a signal that the agent is working while a turn runs.

[^secret]: The token is a secret, so the plugins panel shows whether it is set and never shows its value.

[^app]: Neither variable is a setting. The app you install in Spaces supplies both of them, and the bot posts under that app's name.

[^off]: Not every machine has a Spaces credential. Set `on: yes` on the `xyne-spaces` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)); the choice survives a restart.

[^chat]: The mirror needs the chat plugin, which is what knows which rows are seated with which conversation. With [chat](chat.md) switched off, the `xyne-spaces` plugin waits, naming `chat.seating`; switching chat on starts the mirror again.

[^limit]: `reply-limit` is the greatest number of characters of a reply that are posted to a channel: a whole number of 1 or more, and `500` by default.

[^bind]: A node agent works on one row and on the rows under it. The link sits beside the property that holds the agent's session. Without `xyne-channel` nothing is posted, and a readout that says it is connected while nothing is posted is correct rather than a fault. The row is the identity, so a new session changes the session property and the mirror follows it. A conversation that no node agent works on posts nothing.

[^level]: At digest level, a pull request produces roughly five to eight messages. A CI result is edited in place from the first failure to the final result, and is never posted twice. A kolu heartbeat is not a digest and is not posted.

[^cut]: A reply is cut to the first `reply-limit` Unicode code points and ends in an ellipsis, and a code fence the cut would have left open is closed. While the agent runs a turn, the channel carries a signal that it is working rather than a stored message; the signal ends when the turn does.

[^thread]: The first digest opens the thread, and later digests reply into it. The threads and the queue of posts waiting are kept under `$XDG_STATE_HOME/olai/xyne-spaces/`, one file per served directory, so a restart opens the same thread and still holds the queued digests.

[^never]: Messages you type in olai are never posted to Spaces, and nothing a person says in the Spaces channel reaches olai.

[^once]: A link in an olai process where the two environment variables are not set is reported in the same way, once rather than once per message. The sentence saying posting works again is a separate message, so it cannot replace the sentence that reported the fault.

[^queue]: The queue retries on its own rather than waiting for the next digest. A channel id that names nothing keeps being retried, with the fault reported. A thread that has been deleted is forgotten, and the next digest opens a new one. A refusal that will never be accepted, such as a validation error, is dropped so that it cannot block the rest. When the queue is full, the oldest is dropped and olai says so, with the count.

<details>
<summary>What the header readout says</summary>

One row of the popover on the header's health dot is this plugin's readout. A fault turns the health dot red; not being configured at all leaves it alone.

| Row | What it means |
| --- | --- |
| `xyne` | Both variables are set and the last post, if there was one, was accepted. The tip reads `Posting to <url>`. |
| `No xyne` | Nothing is configured. The tip names where olai looked and the two variables. |
| `xyne error` | A post was refused, or a channel is linked and the environment variables are missing. The tip says which. |

Nothing configured, and a link in a process where the two environment variables are not set, are different facts, which is why the readout has three states rather than two. The second one is a fault: you named a channel and this process cannot post, so the dot goes red, the readout names the missing variable, and the first linked conversation is told once.

The readout stays on `xyne error`, and the health dot stays red, until a post is accepted.

</details>

<details>
<summary>What this does not do</summary>

- Nothing comes in. A message, mention, direct message, slash command or button press in the Spaces channel does not reach olai.
- There is no channel picker. The link is the `xyne-channel` property on the node agent.
- There is no second file of settings. Channels are properties, limits are the setting above, and credentials are environment variables.

</details>

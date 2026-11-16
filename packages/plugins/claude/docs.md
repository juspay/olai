# Claude Code, as a chat agent

Claude Code comes with olai: a fresh install has a working agent with nothing to install.[^pinned] For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

olai runs the adapter named in `KOLU_ACP_AGENT`, and you can point that at another build.[^swap] Other variables shape each spawn, and the closed block below lists them. To switch the row off, use its switch on the **Plugins** panel.[^off]

## What it asks you about

olai asks for the adapter's `bypassPermissions` mode on every conversation it opens or resumes.[^bypass] After that:

- allowed without asking: a call to an MCP server olai handed the conversation[^mcp]
- yours to answer: everything else, including a request olai cannot name[^unnamed]
- stamped with its parent: a subagent's call, so a fan-out draws in lanes[^lanes]

## Talking while it works

A message sent during a turn waits behind it and runs in the order you sent it.[^queue] The composer draws the interrupt gesture because the adapter says it takes a steer.[^steer]

## What a turn looks like

Shell output streams under its tool row, with the exit code at the end.[^terminal] A background command is carried by the strip above the transcript.[^background] The picker offers the adapter's aliases while the agent line names the model the CLI reports.[^models] A switch can be refused.[^refused] The agent line also names the account.[^identity] Automatic memory is off.[^memory] **Earlier chats** draws what each stored conversation holds.[^earlier]

## When Claude Code does not appear

An empty or unset `KOLU_ACP_AGENT` leaves the row enabled but unavailable, and only this agent is affected.[^missing] Switching an agent off and on probes it again; changing the service's environment needs the service restarted.

[^pinned]: The adapter is pinned. Every documented way of starting olai bakes a pinned build into the wrapper, so the row needs nothing installed by hand.

    | Pinned adapter | Version |
    | --- | --- |
    | `@agentclientprotocol/claude-agent-acp` | 0.81.2 |

[^swap]: `KOLU_ACP_AGENT` is the command line olai runs as the adapter, and the wrapper sets it to the pinned build unless you set it first. Set it to a command line of your own to run another build, or another ACP agent entirely: olai then reads that agent the way it reads Claude Code.

[^off]: Switching the row off takes its probing and everything it draws away. Put `on: no` on the `claude` node in `_olai/Settings.olai`, or use the switch on the **Plugins** panel ([choosing what runs](../settings.md)).

[^bypass]: The bypass mode is asked for, not required. A refusal adds a notice and the conversation opens anyway, with olai's own rule as the backstop. The adapter omits that mode under root unless `IS_SANDBOX` is set, and olai changes neither your host's permissions nor that environment.

[^mcp]: Claude Code calls the tools an MCP server contributes `mcp__<server>__<tool>`. A call to one of the servers olai handed the conversation is allowed without asking.

[^unnamed]: Everything olai did not hand over is yours to answer, a request olai cannot name included. Nothing is approved by failing to recognize it.

[^lanes]: A subagent's call carries the `Agent` or `Task` call that spawned it, so a fan-out draws in lanes and a subagent's question is asked in that subagent's name.

[^queue]: The adapter says it holds a prompt sent while it is busy, so your mid-turn message waits behind the running turn. It also says whether it takes a steer, and the composer draws the interrupt gesture only when it does.

[^steer]: A steer pre-empts the generation in flight and lands between the turn's own steps, so the running cycle is torn down. A turn whose work cannot survive that loses it: interrupting a `/compact` ends it with *Compacting failed: API Error: Request was aborted*.

    olai asks for `idleBehavior: "promptRequired"`, so a steer arriving after the turn is over is handed back and sent as an ordinary prompt instead of starting a turn nobody asked for. A steer unanswered for 30 seconds gives you your words back, in a row that keeps them.

[^terminal]: Terminal output is asked for at `initialize`, so the adapter reports Bash and PowerShell as a terminal: the bytes stream under the tool row as they arrive and the exit code lands at the end. Told nothing, the adapter fences the whole output into one markdown block with no exit code anywhere. The handle is the adapter's; olai draws what it reports.

    A call is announced before its arguments arrive, so a shell command appears as the bare word **Terminal** while they stream. The frame that carries them names the row after the command, and nothing renames it again.

[^background]: Background work answers early. `Bash(run_in_background)` answers the moment the command is running, so the row carries the adapter's *Command running in background with ID …* notice and `exit_code: 0`. Both are about the launch rather than the work. olai draws no terminal for that frame, and the strip carries the task until the harness says how it ended: `completed`, `failed`, `killed` or `stopped`.

[^models]: Two vocabularies meet at the picker. It offers the adapter's aliases, such as `sonnet` and `opus[1m]`. The running model is the concrete id the CLI reports, such as `claude-sonnet-5`. olai bridges them, so the agent line says **Sonnet** beside a turn running `claude-sonnet-5`, and claims no context window the model never stated.

[^refused]: A model switch can be refused, because the picker lists what the CLI knows rather than what your account may use. The CLI refuses one per account entitlement (*"… isn't available for your account yet"*), per organization restriction, for a 1M-context Opus or Sonnet the account does not have, or because a `PreModelSwitch` hook blocked it.

    Every one of those arrives as `-32603 "Internal error"` with the CLI's own sentence in `data.details`. olai shows you that sentence rather than the code word, and writes the code and its data to the log as one warning line.

[^identity]: Claude Code pushes its identity over ACP, so the agent line can name the account. It re-reads at `initialize`, after an `authenticate` or a logout, at each conversation open including a refused one, and at the start of every prompt. A `claude /login` you ran in another terminal therefore shows up on your next message. A probe that cannot read its own identity pushes nothing, which the panel draws as no chip. A known logged-out state is `kind: "none"`.

[^memory]: Automatic memory is off. Every spawn carries `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, which wins over `autoMemoryEnabled` in the adapter's `settings.json` and over anything you export, so the node's subtree is the conversation's only memory. A `CLAUDE.md` is instructions you wrote rather than memory, and still loads.

[^earlier]: The stored list says how many messages each conversation holds, and for one that a `/clear` left behind it names the conversation that replaced it. The **Earlier chats** list draws both.

[^missing]: An unavailable row is not offered anywhere a chat starts, and it moves to **Needs you** saying *not found — olai was started without the wrapper that carries the pinned adapter*. Switch the chat row off to remove the conversation.

<details>
<summary>Every variable olai sets or removes, and how it signs you in</summary>

| Variable | What it does |
| --- | --- |
| `KOLU_ACP_AGENT` | the command line olai runs as the adapter. The wrapper sets it to the pinned build unless you set it first |
| `ANTHROPIC_API_KEY` | the provider credential Claude Code reads |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | olai sets it to `1` on every spawn, whatever you export |
| `IS_SANDBOX` | the adapter offers its bypass mode under root only when this is set |
| `NO_BROWSER`, `SSH_CONNECTION`, `SSH_CLIENT`, `SSH_TTY`, `CLAUDE_CODE_REMOTE` | removed from the adapter's environment on every spawn |

olai says it can run terminal methods, so the adapter offers `claude-ai-login` and `console-login` as commands for olai to run, which is what the panel does.

Those five variables are taken off the spawn because the adapter reads any of them as a sign that the person is somewhere else, and then offers only its full-screen `claude /login`, which a browser has no terminal for. Setting one in olai's own environment changes nothing: the removal is unconditional.

</details>

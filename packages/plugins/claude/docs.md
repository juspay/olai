# Claude Code, as a chat agent

Claude Code comes with olai: a new install can chat with it without you installing anything.[^pinned] For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

olai starts Claude Code through a helper program called an adapter, named in the `KOLU_ACP_AGENT` variable.[^swap] To stop offering Claude Code, switch its plugin off on the **Plugins** panel.[^off]

## What it asks you about

When you open or resume a conversation, olai asks the adapter to run without permission prompts.[^bypass] After that:

- a call to a tool olai gave the conversation runs without asking you[^mcp]
- every other request is yours to allow or refuse[^unnamed]
- a call made by a subagent is drawn in that subagent's own column[^lanes]

## Sending a message while it works

A message you send while the agent is working waits until it finishes, then runs, in the order you sent it.[^queue] The box you type in also has **Interrupt**, which puts your message into the running reply.[^steer]

## What you see while it answers

Shell output appears under the line for that command, ending with the exit code.[^terminal] A command left running in the background is tracked in the strip above the conversation.[^background] The line above the box you type in names the model running and the account signed in,[^models][^identity] and a model switch can be refused.[^refused] Memory between conversations is off.[^memory] A long conversation compacts itself.[^compact] **Earlier chats** lists saved conversations.[^earlier]

## When Claude Code does not appear

If `KOLU_ACP_AGENT` is empty or unset, Claude Code is still listed but cannot start, and no other agent is affected.[^missing] Switching an agent off and on makes olai look again; changing the service's environment needs a restart.

[^pinned]: The adapter comes with olai, at a fixed version. Every documented way of starting olai runs it through a wrapper that carries this build, so you install nothing by hand.

    | Adapter olai ships | Version |
    | --- | --- |
    | `@agentclientprotocol/claude-agent-acp` | 0.81.2 |

[^swap]: `KOLU_ACP_AGENT` holds the command line olai runs as the adapter, and the wrapper sets it to the build olai ships unless you have set it to something else first. Set it to a command line of your own to run another build of Claude Code, or another agent that speaks the same protocol: olai then talks to that agent exactly as it talks to Claude Code.

[^off]: A plugin switched off stops looking for Claude Code and takes away everything it draws. Switch it off either by putting `on: no` on the `claude` node in `_olai/Settings.olai`, or with its switch on the **Plugins** panel, the list of olai's parts ([choosing what runs](../settings.md)).

[^bypass]: olai asks for the adapter's `bypassPermissions` mode, which lets the agent act without Claude Code asking its own permission questions. olai asks on every conversation it opens or resumes, but does not require it. If the adapter refuses, olai adds a notice and opens the conversation anyway, and olai's own rule about which calls you are asked about still applies.

    The adapter withholds that mode from a user running as root unless the `IS_SANDBOX` variable is set, and olai changes neither your computer's permissions nor that variable.

[^mcp]: An MCP server gives an agent extra tools to call, and olai gives each conversation some of its own. Claude Code names such a tool `mcp__<server>__<tool>`. A call to a tool from a server olai itself handed the conversation runs without asking you.

[^unnamed]: Every request that is not a call to a tool olai handed over is put to you to allow or refuse. That includes a request olai cannot identify: olai never approves a call just because it does not recognize it.

[^lanes]: A call made by a subagent carries the `Agent` or `Task` call that started it. So when an agent sends out several subagents at once, each subagent's work is drawn in a column of its own, and a question from a subagent is asked in that subagent's name.

[^queue]: The adapter says it holds on to a message sent while it is busy, so your message waits until the running reply is finished and is then answered. The adapter also says whether it accepts a message sent into a reply already running, and olai shows **Interrupt** only when it does.

[^steer]: An interrupting message cuts off the text being written and lands between the steps of the reply, so work in progress that cannot survive that is lost. Interrupting a `/compact` ends it with *Compacting failed: API Error: Request was aborted*.

    olai asks the adapter for `idleBehavior: "promptRequired"`, so an interrupting message that arrives after the reply is already over is handed back and sent as an ordinary message instead. If nothing answers it for 30 seconds, olai gives you your words back, in a row that keeps them.

[^terminal]: olai asks for terminal output when it first connects, so Bash and PowerShell run as terminals: output arrives a piece at a time under that command's line, and the exit code at the end. An adapter that is not asked puts the whole output in one code block, with no exit code. The adapter runs the terminal; olai draws what it reports.

    A tool call is announced before its arguments arrive, so a shell command shows as the bare word **Terminal** until they do. The message carrying them names that line after the command, and the name then stays.

[^background]: A command started in the background reports back early. `Bash(run_in_background)` answers as soon as the command is running. The line then carries the adapter's *Command running in background with ID …* notice and `exit_code: 0`, both of which describe the start rather than the result. olai draws no terminal for that answer. The strip above the conversation keeps the task until Claude Code says how it ended: `completed`, `failed`, `killed` or `stopped`.

[^models]: The picker and the agent line use different names for the same model. The picker offers the adapter's short names, such as `sonnet` and `opus[1m]`. The running model is the full name the command reports, such as `claude-sonnet-5`. olai matches the two, so the line says **Sonnet** beside a reply running `claude-sonnet-5`, and claims no context window size the model never stated.

[^refused]: Claude Code can refuse a model switch, because the picker lists the models the command knows about rather than the ones your account may use. It refuses a model your account is not entitled to (*"… isn't available for your account yet"*), one your organization restricted, a 1M-context Opus or Sonnet your account does not have, or one a `PreModelSwitch` hook blocked.

    Each refusal comes back as `-32603 "Internal error"`, with Claude Code's own sentence in `data.details`. olai shows you that sentence rather than the error code, and writes the code and its data to the log as one warning line.

[^identity]: Claude Code tells olai which account it is signed in as, so the line above the box you type in can name it. It reads the account again when olai first connects, after a sign-in or a sign-out, every time a conversation opens (including one that was refused), and at the start of every message. A `claude /login` you ran in another terminal therefore shows up on your next message.

    If Claude Code cannot read its own account it sends nothing, and the panel then shows no account label. When it knows it is signed out it reports `kind: "none"`.

[^memory]: Claude Code's automatic memory is switched off. Every time olai starts the adapter it sets `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, which overrides `autoMemoryEnabled` in the adapter's `settings.json` and anything you set yourself, so the rows under the node the chat hangs from are the conversation's only memory. A `CLAUDE.md` file is instructions you wrote rather than memory, and it still loads.

[^compact]: olai tells Claude Code where to compact by opening and resuming every conversation with settings that turn auto-compaction on at the `compact-at` size, plus the 33,000 tokens Claude Code keeps in reserve. A model with a smaller window compacts sooner. These settings replace any `--settings` your own `KOLU_ACP_AGENT` passes, and the models `CLAUDE_MODEL_CONFIG` names. A compaction shows as a **Compact conversation** tool call. With [chat](chat.md)'s `auto-compact` at `no`, olai sends none of this.

[^earlier]: The list of saved conversations says how many messages each one holds, and when a `/clear` ended one, it names the conversation that took its place. The **Earlier chats** list shows both.

[^missing]: An agent that cannot be started is not offered anywhere a chat begins, and the **Plugins** panel moves it to **Needs you**, saying *not found — olai was started without the wrapper that carries the pinned adapter*. To remove a conversation with it, switch that chat off.

<details>
<summary>Every variable olai sets or removes, and how it signs you in</summary>

| Variable | What it does |
| --- | --- |
| `KOLU_ACP_AGENT` | the command line olai runs as the adapter. The wrapper sets it to the build olai ships unless you set it first |
| `ANTHROPIC_API_KEY` | the credential Claude Code reads to reach the model provider |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | olai sets it to `1` every time it starts the adapter, whatever you set |
| `IS_SANDBOX` | the adapter offers its permission-free mode to a user running as root only when this is set |
| `NO_BROWSER`, `SSH_CONNECTION`, `SSH_CLIENT`, `SSH_TTY`, `CLAUDE_CODE_REMOTE` | olai removes these every time it starts the adapter |
| `DISABLE_AUTO_COMPACT`, `DISABLE_COMPACT`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | olai removes these every time it starts the adapter, unless chat's `auto-compact` is `no` |

olai tells the adapter that it can run terminal commands, so the adapter offers `claude-ai-login` and `console-login` as sign-in commands for olai to run, and that is what the panel does.

Those five variables are removed because the adapter reads any of them as a sign that you are sitting at a different computer, and then offers only its full-screen `claude /login`, which a browser has no terminal for. Setting one in olai's own environment changes nothing: they are removed every time.

</details>

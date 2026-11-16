# Oh My Pi, as a chat agent

olai runs the `omp` it finds on this server's agent search path, as `omp --approval-mode yolo acp` in the served directory, and offers it as **Oh My Pi**. omp brings its own ACP server and MCP client, so olai pins nothing for it. For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

| Variable | What it does |
| --- | --- |
| `OLAI_AGENT_PATH` | the directories olai looks in for `omp`. Set, it replaces the search path rather than adding to it |

olai ships no adapter and no override variable for this agent, so the build on the search path is the build it runs. Every reading on this page was taken against omp 18.1.21.

> The row is autonomous. `--approval-mode yolo` skips omp's own permission gate for everything but `bash`, `edit`, `delete` and `move`. A per-tool `tools.approval` policy in your omp settings narrows what it covers, and olai never widens what it answers.

There is no bypass mode to ask for on this wire: omp's ACP modes are `default` and `plan`, and `session/set_mode "bypassPermissions"` answers `-32603 "Unsupported ACP mode"`.

Nothing on the command line says where the conversation is. omp reads the directory it was started in, which is the served one, and its own calls carry an absolute directory of their own.

olai's `PATH` is not your shell's. Run as a user service it inherits neither your profile nor your login shell ([keeping it running](../deploying.md)), so an `omp` you can run in a terminal is not necessarily one this process can see.

To switch the row off, put `on: no` on the `omp` node in `_olai/Settings.olai`, or use its switch on the **Plugins** panel ([choosing what runs](../settings.md)).

## olai's tools go through omp's own `write`

With omp's default `tools.xdev` on, a call to `mcp__olai_outlines_done` is not announced as itself. What you see is a `write` whose `rawInput.path` is `xd://mcp__olai_outlines_done`, with the tool's answer nested inside that `write`'s result. olai reads the path to know which of its own tools a call is. That is what puts the friendly name, the outline and the write story on the row.

The path is minted by the agent rather than written by the model, and nothing about it decides a permission: it is the same tool with the same mediated write at the far end. A conversation configured with `tools.xdev: false` dispatches the tools top-level instead, and olai reads that shape too.

A permission question about one of olai's tools is yours to answer here. omp correlates the request with the `write` that carries it, so the only name olai has is `write`. A call it cannot name positively is one it asks about. With `--approval-mode yolo` this rarely comes up; a `tools.approval` policy of your own is what would raise it.

## Talking while it works

A message sent while omp works replaces the turn. omp cancels the turn in flight and runs what you just sent, so the first turn ends cancelled and the second is answered. That first row is the one you also get from pressing stop.

- There is no interruption to offer either: `_session/steering` answers `-32603 "Unknown ACP ext method"`. To omp, a send already is one.
- A prompt arriving during a turn omp started for itself answers `-32000 session_busy`.

Two screenshots from a real conversation through this panel:

![A read drawn as olai's own tool](../images/omp/omp-olai-read.png)

![A mid-turn send replacing the turn](../images/omp/omp-busy-send.png)

## What a turn looks like

Shell commands run as olai's own processes. The panel says it can run a terminal, omp asks olai to create one, and the call carries that handle. The output you watch stream under the row is a process spawned in the served directory, and olai is what stops it when you cancel or the conversation ends.

- The tool's name is the head of the call id, as in `write:0` or `bash:3`, which is also the key a permission request arrives under. The title is the model's own sentence for a `write`, or the `$ <command>` line for a `bash`, so it never names a row.
- `_meta` never appears on any frame, so nothing about a call is remembered from one, and a call nobody named is a call you are asked about.
- Its fan-outs draw flat. Nothing on an omp frame says which call spawned an agent, so every call is drawn in one column rather than in lanes.

## Models, stored conversations and your own configuration

The picker offers the ids omp reports, such as `litellm/kimi-k3`, under its own labels, so the agent line needs no aliases.

Its stored list answers newest first with a cursor, and each row carries a real message count, which is what the picker's note says about a conversation's length.

olai sends no limit and follows no cursor, so a directory with more than fifty stored omp conversations draws the newest page and loses the rest.

omp loads the servers, extensions and skills in your own `~/.omp` into the same conversation, and olai draws no row for them: the servers strip lists what olai handed over, which is exactly as complete as it says it is. A server that will not connect fails the conversation open outright, rather than coming up with one row marked broken, because omp reports nothing per server over ACP.

Its `memory.backend` defaults to `off` and olai leaves it there: `omp acp` ignores an unknown flag silently, so a config overlay could not be verified and your own `~/.omp` config governs. The node's subtree is the conversation's only memory.

## When Oh My Pi does not appear

While it is missing, the row is enabled but unavailable. It is not offered anywhere a chat starts, and the **Plugins** panel files it under **Needs you** saying *put `omp` on this server's `PATH`*, with a link to <https://github.com/can1357/oh-my-pi>.

Install it where the olai server can see it, then switch the plugin off and on to probe again without restarting olai. Changing the service's environment needs the service restarted.

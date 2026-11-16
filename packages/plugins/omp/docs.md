# Oh My Pi, as a chat agent

olai runs the `omp` it finds on this server's search path, as `omp --approval-mode yolo acp`.[^runs] For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

`OLAI_AGENT_PATH` is where olai looks for `omp`, and olai's own `PATH` is not your shell's.[^path] omp reads the directory it was started in, which is the served one.[^cwd] There is no bypass mode to ask for on this wire.[^bypass] To switch the row off, use its switch on the **Plugins** panel.[^off]

> The row is autonomous. `--approval-mode yolo` skips omp's own permission gate for everything but `bash`, `edit`, `delete` and `move`.[^yolo]

## olai's tools go through omp's own `write`

With omp's default `tools.xdev` on, a call to `mcp__olai_outlines_done` is not announced as itself: what you see is a `write` whose `rawInput.path` is `xd://mcp__olai_outlines_done`.[^xdev] A permission question about one of olai's tools is yours to answer here.[^asks]

![A read drawn as olai's own tool](../images/omp/omp-olai-read.png)

## Talking while it works

A message sent while omp works replaces the turn: the first turn ends cancelled and the second is answered.[^replace] There is no interruption to offer either.[^steering]

## What a turn looks like

Shell commands run as olai's own processes, spawned in the served directory, and olai is what stops them.[^terminal] The tool's name is the head of the call id, as in `write:0` or `bash:3`.[^naming] Its fan-outs draw flat.[^flat]

## Models, stored conversations, and when it does not appear

The picker offers the ids omp reports, such as `litellm/kimi-k3`, under its own labels.[^models] omp loads the servers, extensions and skills in your own `~/.omp` into the same conversation.[^config] While `omp` is missing, the row is enabled but unavailable.[^missing]

[^runs]: olai offers the agent as **Oh My Pi**. omp brings its own ACP server and MCP client, so olai pins nothing for it. It ships no adapter and offers no override variable: the build on the search path is the build it runs. Every reading on this page was taken against omp 18.1.21.

[^path]: `OLAI_AGENT_PATH` is the directories olai looks in for `omp`, and set, it replaces the search path rather than adding to it. Run as a user service, olai inherits neither your profile nor your login shell ([keeping it running](../deploying.md)), so an `omp` you can run in a terminal is not necessarily one this process can see.

[^cwd]: Nothing on the command line says where the conversation is. omp reads the directory it was started in, which is the served one, and its own calls carry an absolute directory of their own.

[^bypass]: omp's ACP modes are `default` and `plan`, and `session/set_mode "bypassPermissions"` answers `-32603 "Unsupported ACP mode"`.

[^off]: Switching the row off is `on: no` on the `omp` node in `_olai/Settings.olai`, or its switch on the **Plugins** panel ([choosing what runs](../settings.md)).

[^yolo]: A per-tool `tools.approval` policy in your omp settings narrows what `--approval-mode yolo` covers, and olai never widens what it answers.

[^xdev]: The `xd://` path is how olai knows which of its own tools a call is, and that is what puts the friendly name, the outline and the write story on the row. The tool's answer is nested inside that `write`'s result.

    The path is minted by the agent rather than written by the model, and nothing about it decides a permission: it is the same tool with the same mediated write at the far end. A conversation configured with `tools.xdev: false` dispatches the tools top-level instead, and olai reads that shape too.

[^asks]: omp correlates a permission request with the `write` that carries it, so the only name olai has is `write`. A call it cannot name positively is one it asks about. With `--approval-mode yolo` this rarely comes up; a `tools.approval` policy of your own is what would raise it.

[^replace]: omp cancels the turn in flight and runs what you just sent, so that first row is the one you also get from pressing stop. A prompt arriving during a turn omp started for itself answers `-32000 session_busy`.

[^steering]: `_session/steering` answers `-32603 "Unknown ACP ext method"`. To omp, a send already is one.

[^terminal]: The panel says it can run a terminal, omp asks olai to create one, and the call carries that handle. The output you watch stream under the row is a process spawned in the served directory, and olai is what stops it when you cancel or the conversation ends.

[^naming]: The head of the call id is also the key a permission request arrives under. The title is the model's own sentence for a `write`, or the `$ <command>` line for a `bash`, so it never names a row. `_meta` never appears on any frame, so nothing about a call is remembered from one, and a call nobody named is a call you are asked about.

[^flat]: Nothing on an omp frame says which call spawned an agent, so every call is drawn in one column rather than in lanes.

[^models]: The picker's labels are omp's own, so the agent line needs no aliases. Its stored list answers newest first with a cursor. Each row carries a real message count, which is what the picker's note says about a conversation's length.

    olai sends no limit and follows no cursor, so a directory with more than fifty stored omp conversations draws the newest page and loses the rest.

[^config]: olai draws no row for what `~/.omp` loads: the servers strip lists what olai handed over, which is exactly as complete as it says it is. A server that will not connect fails the conversation open outright, rather than coming up with one row marked broken, because omp reports nothing per server over ACP.

    Its `memory.backend` defaults to `off` and olai leaves it there: `omp acp` ignores an unknown flag silently, so a config overlay could not be verified and your own `~/.omp` config governs. The node's subtree is the conversation's only memory.

[^missing]: An unavailable row is not offered anywhere a chat starts, and the **Plugins** panel files it under **Needs you** saying *put `omp` on this server's `PATH`*, with a link to <https://github.com/can1357/oh-my-pi>. Install it where the olai server can see it, then switch the plugin off and on to probe again without restarting olai. Changing the service's environment needs the service restarted.

<details>
<summary>A mid-turn send replacing the turn</summary>

![A mid-turn send replacing the turn](../images/omp/omp-busy-send.png)

</details>

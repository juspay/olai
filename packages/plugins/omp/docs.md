# Oh My Pi, as a chat agent

olai runs the `omp` it finds on this server's search path, starting it as `omp --approval-mode yolo acp`.[^runs] For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

olai looks for `omp` in the directories `OLAI_AGENT_PATH` lists, which are not the ones your shell searches.[^path] omp works in the directory olai serves.[^cwd] There is no mode here that turns permission questions off.[^bypass] Its switch is on the **Plugins** panel.[^off]

> `--approval-mode yolo` means omp asks you nothing, except before a `bash`, an `edit`, a `delete` or a `move`.[^yolo]

## olai's tools arrive as omp's own `write`

With omp's `tools.xdev` setting on, which is its default, a call to one of olai's tools is not announced by name. What you see is a `write` call whose `rawInput.path` is `xd://mcp__olai_outlines_done`.[^xdev] A permission question about one of olai's tools is yours to answer.[^asks]

![A read drawn as olai's own tool](../images/omp/omp-olai-read.png)

## Sending a message while it works

A message you send while omp is working replaces the reply in progress: the first reply ends as cancelled, and your new message is answered.[^replace] There is no way to interrupt a reply either.[^steering]

## What you see while it answers

Shell commands run as olai's own processes, started in the directory olai serves, and olai is what stops them.[^terminal] A tool's name is the first part of the call id, as in `write:0` or `bash:3`.[^naming] Subagents are drawn in one column rather than side by side.[^flat]

## Models, saved conversations, and when it does not appear

The picker lists the model ids omp reports, such as `litellm/kimi-k3`, under omp's own labels.[^models] omp also loads the servers, extensions and skills in your own `~/.omp` into the same conversation.[^config] If `omp` is not found, it is listed but cannot start.[^missing]

[^runs]: olai offers the agent as **Oh My Pi**. omp speaks olai's protocol itself and talks to MCP servers itself, so olai ships nothing for it: no copy of omp, no adapter, and no variable for naming a different one. The `omp` on the search path is the one that runs. Every reading on this page was taken against omp 18.1.21.

[^path]: `OLAI_AGENT_PATH` is the list of directories olai looks in for `omp`. If you set it, it replaces the search path rather than adding to it. Run as a user service, olai inherits neither your profile nor your login shell ([keeping it running](../deploying.md)), so an `omp` you can run in a terminal is not necessarily one this process can find.

[^cwd]: Nothing on the command line tells omp where to work. It reads the directory it was started in, which is the directory olai serves, and its own calls carry a full path of their own.

[^bypass]: omp's two modes are `default` and `plan`, and asking for `session/set_mode "bypassPermissions"` answers `-32603 "Unsupported ACP mode"`.

[^off]: Switch the plugin off either by putting `on: no` on the `omp` node in `_olai/Settings.olai`, or with its switch on the **Plugins** panel, the list of olai's parts ([choosing what runs](../settings.md)).

[^yolo]: A `tools.approval` rule of your own, in omp's settings, narrows what `--approval-mode yolo` covers, and olai never answers more than that rule allows.

[^xdev]: The `xd://` path is how olai recognizes which of its own tools a call is, and recognizing it is what puts the tool's friendly name, the link to the outline and the summary of what was written on that line. The tool's answer sits inside the `write` call's result.

    The path is written by omp rather than by the model, and it changes no permission: it is the same tool, with the same checked write at the far end. A conversation set up with `tools.xdev: false` sends the tools directly instead, and olai understands that shape too.

[^asks]: omp ties a permission request to the `write` call that carries it, so `write` is the only name olai has for it. A call olai cannot identify for certain is one it asks you about. With `--approval-mode yolo` that rarely happens; a `tools.approval` rule of your own is what would bring it up.

[^replace]: omp cancels the reply in progress and answers what you just sent, so that first cancelled line is the same one you get by pressing **Cancel**. A message that arrives during a reply omp started by itself answers `-32000 session_busy`.

[^steering]: Asking for `_session/steering` answers `-32603 "Unknown ACP ext method"`. To omp, sending a message during a reply already is the interruption.

[^terminal]: olai tells omp that it can run terminals, omp asks olai to create one, and the tool call carries that terminal. The output you watch arrive under the line comes from a process started in the directory olai serves, and olai is what stops it when you cancel or the conversation ends.

[^naming]: The first part of the call id is also the key a permission request arrives under. The title is the model's own sentence for a `write`, or the `$ <command>` line for a `bash`, so the title never names the tool. No `_meta` field ever appears, so nothing about a call is remembered from one message to the next, and a call olai cannot name is a call you are asked about.

[^flat]: Nothing in what omp sends says which call started a subagent, so every call is drawn in one column instead of a column per subagent.

[^models]: The labels in the picker are omp's own, so olai needs no short names of its own. Saved conversations are listed newest first, a page at a time, each with a true count of its messages, which is what the picker says about a conversation's length.

    olai sends no limit and does not ask for the next page, so a directory with more than fifty saved omp conversations shows the newest page and leaves out the rest.

[^config]: olai draws no line for what `~/.omp` loads: the strip of servers lists what olai itself handed over, and is exactly as complete as it says it is. A server that will not connect fails the whole conversation rather than appearing as one broken line, because omp reports nothing per server.

    omp's `memory.backend` setting is `off` by default and olai leaves it alone: `omp acp` ignores an unknown option without saying so, so olai could not verify a settings overlay, and your own `~/.omp` decides. The rows under the node the chat hangs from are the conversation's only memory.

[^missing]: An agent that cannot be started is not offered anywhere a chat begins, and the **Plugins** panel files it under **Needs you**, saying *put `omp` on this server's `PATH`*, with a link to <https://github.com/can1357/oh-my-pi>. Install it where the olai server can see it, then switch the plugin off and on to look again without restarting olai. A change to the service's environment does need a restart.

<details>
<summary>A message sent mid-reply replacing the reply</summary>

![A mid-turn send replacing the turn](../images/omp/omp-busy-send.png)

</details>

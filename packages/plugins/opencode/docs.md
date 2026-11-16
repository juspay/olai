# opencode, as a chat agent

olai runs the `opencode` it finds on this server's search path and offers it as **OpenCode**. Nothing is pinned.[^runs] For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

`OLAI_AGENT_PATH` is where olai looks for `opencode`, and olai's `PATH` is not your shell's.[^path] The child runs in the served directory.[^cwd] The **Plugins** panel has its switch.[^off]

> opencode 2 only. Every reading here was taken against opencode 2.2.7; against the 1.x line nothing matches.[^one]

## olai's tools arrive inside a script

opencode 2 hands every MCP tool to the model as **Code Mode**: one `execute` call whose `rawInput.code` is JavaScript against a `tools.<server>.<tool>` object.[^codemode] One script can call several of olai's tools, and the row names each.[^several] The tool's name is a frame field.[^naming]

## What it asks you about

Every MCP tool is dispatched through `execute`, so a permission request is named `execute` whichever tool is inside it. olai answers one without asking only when four things hold.[^four] One approval covers the whole script.[^once] There is no bypass mode here.[^bypass]

## Talking while it works

A send while opencode works goes into the running turn; with no turn to put it in, olai sends it as an ordinary prompt.[^steer] There is no queue.[^noqueue] A spawn is a `subagent` call, a session behind a door of its own.[^subagent]

## Models, signing in, and when it does not appear

The picker offers the ids opencode reports, under its own labels.[^models] Signing in is an interactive wizard, so the card names the command to run in a terminal on the server.[^login] Then put the chat to sleep and open it again.[^sleep] A missing `opencode` leaves the row unavailable.[^missing]

[^runs]: olai spawns `opencode acp` in the served directory. It ships no adapter and no override variable for this agent, so the build on the search path is the build it runs.

[^path]: `OLAI_AGENT_PATH` is the directories olai looks in for `opencode`, and set, it replaces the search path rather than adding to it. Run as a user service, olai inherits neither your profile nor your login shell ([keeping it running](../deploying.md)), so an `opencode` you can run in a terminal is not necessarily one this process can see.

[^cwd]: There is no `--cwd` on the command line, because opencode 2 answers that flag with its usage text rather than with ACP. The child's own working directory is the served one, and that is also the directory opencode lists stored conversations for. olai filters the answer again on its own side.

[^off]: Switching the row off takes away what it draws. Put `on: no` on the `opencode` node in `_olai/Settings.olai`, or use the switch on the **Plugins** panel ([choosing what runs](../settings.md)).

[^one]: The 1.x line is a different wire. It names a tool at the head of the call id, spells an MCP tool `<server>_<tool>`, and holds a mid-turn prompt instead of steering.

[^codemode]: A **Code Mode** script reads like `return await tools.olai.outlines_done({ id: "n1" })`. Its completion reports what it actually ran, with `metadata.error: true` when anything threw or was refused. The script's return value comes back as a text block, and that is where olai reads a tool's answer. There is no structured output on this wire. `tools` also carries opencode's own builtins, under `tools.opencode.*`.

[^several]: A script that calls several tools names each of them on a line of its own, with the `execute` call under the fold. What the completion reported beats what the script said it would do. Such a script gets no single reply, so the outline link and the write story drawn from one are missing for it.

[^naming]: The name is a field on the frame. `tool_call`, `tool_call_update` and a permission request's `toolCall` all carry `name` beside `title`, and the three agree. The `toolCallId` is an opaque `chatcmpl-tool-<hex>`, and the `title` is display text that moves over a call's life, so neither names a row.

[^four]: All four conditions must hold, and the closed block at the foot of this page lists them. In short: the request is about an `execute`, its code parses under olai's closed grammar, every server it names is one olai handed this conversation, and the request offers an allow-flavoured option.

[^once]: opencode asks once per inner call and sends the same frame each time, so answering one request answers all of them, and nothing says which one you answered. Options arrive as `once`, `always` and `reject`, and olai reads each option's own kind rather than its position.

    A rejected inner call does not fail the turn: the `execute` completes with `Permission.DeclinedError` as its content and `metadata.error: true`, which the model reads as the answer it got. A script that calls no tool is never asked about.

[^bypass]: The modes are `build` and `plan`, and `session/set_mode "bypassPermissions"` is refused. Unattended auto-approval for opencode lives in its own `opencode.json`, outside ACP.

[^steer]: `initialize` answers `_meta.steering.supported: true`, so the composer draws the interrupt gesture off a positive fact.

[^noqueue]: A second `session/prompt` while a turn runs is refused with `-32603 "Session already has an active ACP prompt: <sessionId>"`, so nothing here promises that a mid-turn message waits its turn.

[^subagent]: A `subagent` call carries the agent it sent out and what it was sent to do. The frame joining the child to the spawning row arrives only when the child is over, so while a subagent is out you see two live rows for it.

[^models]: The picker shows an id under opencode's own label: `opencode/claude-sonnet-5` under **opencode/Claude Sonnet 5**, so the agent line needs no aliases. A conversation's settings are `model`, `effort` (the thought level) and `mode`, and a change comes back in the response rather than as a pushed update. What its stored list holds is in a closed block at the foot of this page.

[^login]: The one method is `opencode-login`, and olai cannot run it for you, so the card draws no button. It names the method and the exact command to run in a terminal on the server, starting with the absolute path the probe found and ending `auth login --standalone`. `opencode acp --login` and `opencode auth login` both answer *Pass an integration ID or name when running without an interactive terminal* and exit 1 when they find no TTY, and `auth login <target> --method key` answers *API key input requires an interactive terminal*.

[^sleep]: Sleep is what picks up a new credential. An `opencode acp` reads its credentials when it starts and never again, so a new conversation inside the running process does not see an account connected after it started, and **Fresh start** is not enough. **Put to sleep** is on the chat's row menu under **Chats**, on a node's row menu, and in the palette; opening the chat again continues it on a new process.

[^missing]: An unavailable row is not offered anywhere a chat starts, and the **Plugins** panel files it under **Needs you** saying *put `opencode` on this server's `PATH`*, with a link to <https://opencode.ai>. Install it where the olai server can see it, then switch the plugin off and on to probe again without restarting olai. Changing the service's environment needs the service restarted.

    A provider opencode cannot reach is a JSON-RPC error on the prompt, such as `-32603 "Internal error: Insufficient balance…"`, rather than a quiet successful end of turn. The turn ends with the agent's own words on the banner, and your message is marked undelivered.

<details>
<summary>When olai answers a permission without asking</summary>

1. the request is about an `execute`. A `shell`, a `subagent`, a `read` or an unnamed call is yours;
2. its `rawInput.code` parses under olai's closed grammar: a sequence of `tools.<server>.<tool>(literal)` calls, optionally bound to names and returned. A comment, a string, an operator, a variable argument, a template or a property read puts a script outside it;
3. it calls at least one tool, and every server it names is one olai handed this conversation. `tools.opencode.*` never is. A server whose name is not a JavaScript identifier is reached as `tools["xyne-spaces"]`, which the grammar accepts for a literal key alone;
4. the request offers an allow-flavoured option.

</details>

<details>
<summary>Stored conversations, memory, and where the login writes</summary>

Its stored list is the protocol's four fields: `sessionId`, `cwd`, `title` and `updatedAt`. It answers the whole directory in one page. A limit is ignored, and following the cursor beside the rows answers no rows at all, so olai sends no limit and follows no cursor.

opencode's memory is opt-in plugins and olai installs none, so a node's subtree is the conversation's only memory.

`--standalone` is in the login line on purpose: it writes to `$XDG_DATA_HOME/opencode/opencode.db`, which is where the `opencode acp` olai spawns reads. The default path goes through opencode's own background service on `127.0.0.1:49374`, and whether what that stores is what `acp` reads is unverified here.

</details>

# opencode, as a chat agent

olai runs the `opencode` it finds on this server's agent search path, as `opencode acp` in the served directory, and offers it as **OpenCode**. Nothing about it is pinned or bundled. For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

| Variable | What it does |
| --- | --- |
| `OLAI_AGENT_PATH` | the directories olai looks in for `opencode`. Set, it replaces the search path rather than adding to it |

olai ships no adapter and no override variable for this agent, so the build on the search path is the build it runs. Every reading on this page was taken against opencode 2.2.7.

> opencode 2 only. The 1.x line names a tool at the head of the call id, spells an MCP tool `<server>_<tool>`, and holds a mid-turn prompt instead of steering. Against it, nothing on this page matches: every call is unnamed and every permission question reaches you.

olai's `PATH` is not your shell's. Run as a user service it inherits neither your profile nor your login shell ([keeping it running](../deploying.md)), so an `opencode` you can run in a terminal is not necessarily one this process can see.

There is no `--cwd` on the command line, because opencode 2 answers that flag with its usage text rather than with ACP. The child's own working directory is the served one, and that is also the directory opencode lists stored conversations for. olai filters the answer again on its own side.

To switch the row off, put `on: no` on the `opencode` node in `_olai/Settings.olai`, or use its switch on the **Plugins** panel ([choosing what runs](../settings.md)).

## olai's tools arrive inside a script

opencode 2 hands every MCP tool to the model as **Code Mode**: one `execute` call whose `rawInput.code` is JavaScript against a `tools.<server>.<tool>` object, such as `return await tools.olai.outlines_done({ id: "n1" })`. Its completion reports what it actually ran, with `metadata.error: true` when anything threw or was refused.

- The script's return value comes back as a text block, and that is where olai reads a tool's answer. There is no structured output on this wire.
- `tools` also carries opencode's own builtins, under `tools.opencode.*`.
- One script can call several of olai's tools, and the row names each of them on a line of its own, with the `execute` call under the fold. What the completion reported beats what the script said it would do.
- A script that ran several calls gets no single reply, so the outline link and the write story drawn from one are missing for it.

The tool's name is a field on the frame. `tool_call`, `tool_call_update` and a permission request's `toolCall` all carry `name` beside `title` and the three agree. The `toolCallId` is an opaque `chatcmpl-tool-<hex>`, and the `title` is display text that moves over a call's life, so neither names a row.

## What it asks you about

Every MCP tool is dispatched through `execute`, so a permission request is named `execute` whichever tool is inside it. The code is the only thing that tells them apart, and olai answers one without asking only when all four of these hold:

1. the request is about an `execute`. A `shell`, a `subagent`, a `read` or an unnamed call is yours;
2. its `rawInput.code` parses under olai's closed grammar: a sequence of `tools.<server>.<tool>(literal)` calls, optionally bound to names and returned. A comment, a string, an operator, a variable argument, a template or a property read puts a script outside it;
3. it calls at least one tool, and every server it names is one olai handed this conversation. `tools.opencode.*` never is. A server whose name is not a JavaScript identifier is reached as `tools["xyne-spaces"]`, which the grammar accepts for a literal key alone;
4. the request offers an allow-flavoured option.

One approval covers the whole script. opencode asks once per inner call and sends the same frame each time, so answering one request answers all of them, and nothing says which one you answered.

Options arrive as `once`, `always` and `reject`, and olai reads each option's own kind rather than its position. A rejected inner call does not fail the turn: the `execute` completes with `Permission.DeclinedError` as its content and `metadata.error: true`, which the model reads as the answer it got. A script that calls no tool is never asked about.

Unattended auto-approval for opencode lives in its own `opencode.json`, outside ACP. There is no bypass mode on this wire: the modes are `build` and `plan`, and `session/set_mode "bypassPermissions"` is refused.

## Talking while it works

`initialize` answers `_meta.steering.supported: true`, so the composer draws the interrupt gesture off a positive fact. A send while opencode works goes into the running turn; when there is no turn to put it in, olai sends it as an ordinary prompt.

There is no queue behind that. A second `session/prompt` while a turn runs is refused with `-32603 "Session already has an active ACP prompt: <sessionId>"`, so nothing here promises that a mid-turn message waits its turn.

A spawn is a `subagent` call carrying the agent it sent out and what it was sent to do, and the child is a real session that draws behind a door of its own. The frame joining the child to the spawning row arrives only when the child is over, so while a subagent is out you see two live rows for it.

## Models and stored conversations

The picker offers the ids opencode reports, under its own labels: `opencode/claude-sonnet-5` under **opencode/Claude Sonnet 5**, so the agent line needs no aliases. A conversation's settings are `model`, `effort` (the thought level) and `mode`, and a change comes back in the response rather than as a pushed update.

Its stored list is the protocol's four fields: `sessionId`, `cwd`, `title` and `updatedAt`. It answers the whole directory in one page, where a limit is ignored and following the cursor beside the rows answers no rows at all. olai sends no limit and follows no cursor.

opencode's memory is opt-in plugins and olai installs none, so a node's subtree is the conversation's only memory.

## Signing in

Its one method is `opencode-login`, and olai cannot run it for you: opencode's login is an interactive wizard. `opencode acp --login` and `opencode auth login` both answer *Pass an integration ID or name when running without an interactive terminal* and exit 1 when they find no TTY, and `auth login <target> --method key` answers *API key input requires an interactive terminal*.

So the card draws no button. It names the method and the exact command to run in a terminal on the server, starting with the absolute path the probe found and ending `auth login --standalone`.

`--standalone` is in that line on purpose: it writes to `$XDG_DATA_HOME/opencode/opencode.db`, which is where the `opencode acp` olai spawns reads. The default path goes through opencode's own background service on `127.0.0.1:49374`, and whether what that stores is what `acp` reads is unverified here.

Then put the chat to sleep and open it again. An `opencode acp` reads its credentials when it starts and never again, so a new conversation inside the running process does not see an account connected after it started, and **Fresh start** is not enough. **Put to sleep** is on the chat's row menu under **Chats**, on a node's row menu, and in the palette; opening the chat again continues it on a new process.

## When a turn fails

A provider opencode cannot reach is a JSON-RPC error on the prompt, such as `-32603 "Internal error: Insufficient balance…"`, rather than a quiet successful end of turn. The turn ends with the agent's own words on the banner, and your message is marked undelivered.

## When opencode does not appear

While it is missing, the row is enabled but unavailable. It is not offered anywhere a chat starts, and the **Plugins** panel files it under **Needs you** saying *put `opencode` on this server's `PATH`*, with a link to <https://opencode.ai>.

Install it where the olai server can see it, then switch the plugin off and on to probe again without restarting olai. Changing the service's environment needs the service restarted.

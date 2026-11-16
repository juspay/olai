# opencode, as a chat agent

olai runs the `opencode` it finds on this server's search path, and offers it as **OpenCode**.[^runs] For what a conversation is, read [talking to an agent](../chat.md).

## What olai runs

olai looks for `opencode` in the directories `OLAI_AGENT_PATH` lists, which are not the ones your shell searches.[^path] opencode runs in the directory olai serves.[^cwd] Its switch is on the **Plugins** panel.[^off]

> This page is about opencode 2, read against version 2.2.7. Against version 1 nothing here matches.[^one]

## olai's tools reach opencode as JavaScript

opencode 2 does not give the model olai's tools one at a time. It gives one `execute` tool whose argument is a short JavaScript program calling `tools.<server>.<tool>`, which opencode calls **Code Mode**.[^codemode] Several of olai's tools can go in one program, each named on its own line.[^several][^naming]

## What it asks you about

Every tool call goes through `execute`, so a permission request is named `execute` whichever tool is inside. olai answers one without asking you only when four conditions hold, listed at the foot of this page.[^four] Answering once covers the whole program.[^once] Nothing turns permission questions off.[^bypass]

## Sending a message while it works

A message you send while opencode works joins the reply already running; if none is running, olai sends it as an ordinary message.[^steer] There is no queue.[^noqueue] A subagent runs as a conversation of its own.[^subagent]

## Models, signing in, and when it does not appear

The picker lists the model ids opencode reports, under its own labels.[^models] Signing in needs a terminal on the server, and the card names the command to run there.[^login] Then put the chat to sleep and open it again.[^sleep] A missing `opencode` is listed but cannot start.[^missing]

[^runs]: olai starts `opencode acp` in the directory it serves. It ships no copy of opencode and no adapter for it, and there is no variable for naming a different one, so the `opencode` on the search path is the one that runs.

[^path]: `OLAI_AGENT_PATH` is the list of directories olai looks in for `opencode`. If you set it, it replaces the search path rather than adding to it. Run as a user service, olai inherits neither your profile nor your login shell ([keeping it running](../deploying.md)), so an `opencode` you can run in a terminal is not necessarily one this process can find.

[^cwd]: olai does not pass a `--cwd` option, because opencode 2 answers that option with its usage text instead of starting. The program starts in the directory olai serves, which is also the directory opencode lists saved conversations for. olai filters that list again on its own side.

[^off]: Switch the plugin off either by putting `on: no` on the `opencode` node in `_olai/Settings.olai`, or with its switch on the **Plugins** panel, the list of olai's parts ([choosing what runs](../settings.md)).

[^one]: Version 1 talks to olai differently. It puts a tool's name at the start of the call id, spells a tool from an MCP server `<server>_<tool>`, and holds a message you send mid-reply instead of adding it to the reply. Against version 1 nothing on this page holds: no call is named, and every permission question reaches you.

[^codemode]: A **Code Mode** program reads like `return await tools.olai.outlines_done({ id: "n1" })`. What opencode reports back says what the program actually ran, with `metadata.error: true` when anything failed or was refused. The program's return value comes back as plain text, and that is where olai reads a tool's answer: there is no structured result here. `tools` also holds opencode's own built-in tools, under `tools.opencode.*`.

[^several]: A program that calls several tools shows each call on a line of its own, with the `execute` call itself folded away. Where the two disagree, what opencode reported running beats what the program said it would do. Such a program gets no single answer, so the link to the outline and the summary of what was written, which olai draws from a single answer, are missing for it.

[^naming]: The name of a tool is a field on the message rather than part of the call id. `tool_call`, `tool_call_update` and a permission request's `toolCall` all carry a `name` beside the `title`, and the three agree. The `toolCallId` is a meaningless `chatcmpl-tool-<hex>`, and the `title` is display text that changes over the life of a call, so neither one names a tool reliably.

[^four]: The JavaScript inside is the only thing that tells one `execute` call from another, so all four conditions below must hold. In short: the request is about an `execute` call, its code fits the small set of shapes olai accepts, every server it names is one olai handed this conversation, and the request offers an option that means allow.

[^once]: opencode asks once for each tool call inside the program and sends the same request every time, so answering one request answers all of them, and nothing tells you which one you answered. The options arrive as `once`, `always` and `reject`, and olai reads what each option says it means rather than where it sits in the list.

    Refusing one call inside a program does not fail the reply: the `execute` call finishes with `Permission.DeclinedError` as its result and `metadata.error: true`, and the model reads that as the answer. A program that calls no tool at all is never asked about.

[^bypass]: opencode's two modes are `build` and `plan`, and asking for `session/set_mode "bypassPermissions"` is refused. Approving everything unattended is configured in opencode's own `opencode.json`, outside the protocol olai speaks.

[^steer]: When olai and opencode first connect, opencode answers `_meta.steering.supported: true`, so the box you type in shows **Interrupt**, which adds your message to the reply already running. olai draws that control on what opencode said rather than on a guess.

[^noqueue]: A second message sent while a reply is running is refused with `-32603 "Session already has an active ACP prompt: <sessionId>"`, so nothing here promises that a message sent mid-reply is kept and answered when that reply ends.

[^subagent]: A `subagent` call says which agent was sent out and what it was asked to do. The message joining the subagent to the line that started it arrives only once the subagent has finished, so while one is working you see two live lines for it.

[^models]: The picker shows an id under opencode's own label: `opencode/claude-sonnet-5` under **opencode/Claude Sonnet 5**, so olai needs no short names of its own. A conversation has three settings, `model`, `effort` (how much the model thinks) and `mode`, and a change comes back in opencode's reply rather than as a separate announcement. What opencode's list of saved conversations holds is in a closed block at the foot of this page.

[^login]: The one sign-in method is `opencode-login`, and olai cannot run it for you, so the card has no button. It names the method and the exact command to type in a terminal on the server, starting with the full path olai found and ending `auth login --standalone`. Both `opencode acp --login` and `opencode auth login` answer *Pass an integration ID or name when running without an interactive terminal* and exit 1 when they find no terminal, and `auth login <target> --method key` answers *API key input requires an interactive terminal*.

[^sleep]: Putting the chat to sleep is what picks up a new sign-in. An `opencode acp` reads its credentials when it starts and never again, so a conversation inside the running program never sees an account connected afterwards, and **Fresh start** is not enough either. **Put to sleep** is on the chat's menu under **Chats**, on a node's own menu, and in the command palette, which `Cmd` + `K` opens (`Ctrl` elsewhere). Opening the chat again continues it in a newly started program.

[^missing]: opencode is then not offered anywhere a chat begins, and the **Plugins** panel files it under **Needs you**, saying *put `opencode` on this server's `PATH`*, with a link to <https://opencode.ai>. Install it where the olai server can see it, then switch the plugin off and on to look again without restarting olai. A change to the service's environment does need a restart.

    A provider opencode cannot reach comes back as an error on your message, such as `-32603 "Internal error: Insufficient balance…"`, rather than as a quiet success. The reply ends with opencode's own words on the banner, and your message is marked undelivered.

<details>
<summary>When olai answers a permission without asking</summary>

1. the request is about an `execute` call. A `shell`, a `subagent`, a `read` or an unnamed call is yours to answer;
2. its `rawInput.code` fits the small set of shapes olai accepts: a sequence of `tools.<server>.<tool>(literal)` calls, optionally given names and returned. A comment, a string, an operator, a variable argument, a template or a property read puts a program outside that set;
3. it calls at least one tool, and every server it names is one olai handed this conversation. `tools.opencode.*` never is. A server whose name is not a valid JavaScript name is reached as `tools["xyne-spaces"]`, which olai accepts for a plain text key alone;
4. the request offers an option that means allow.

</details>

<details>
<summary>Saved conversations, memory, and where the sign-in writes</summary>

opencode's list of saved conversations holds the protocol's four fields: `sessionId`, `cwd`, `title` and `updatedAt`. It answers with the whole directory in one page. It ignores a limit, and asking for the next page returns no rows at all, so olai sends no limit and asks for no next page.

opencode's memory is a plugin you add yourself, and olai installs none, so the rows under the node a chat hangs from are the conversation's only memory.

`--standalone` is in the sign-in command on purpose: it writes to `$XDG_DATA_HOME/opencode/opencode.db`, which is where the `opencode acp` olai starts reads its credentials. Without it, opencode goes through its own background service on `127.0.0.1:49374`, and whether what that stores is what `acp` reads has not been checked here.

</details>

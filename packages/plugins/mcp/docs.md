# The MCP endpoint for agents outside olai

This plugin serves `/mcp`, the address an agent outside olai reads and writes the directory olai serves through, using MCP, the protocol agents call tools over.[^point]

## What the endpoint answers

| Request | Answer |
| --- | --- |
| `POST /mcp` carrying one JSON-RPC message | one JSON-RPC answer |
| a notification, which carries no `id` | `202`, with an empty body |
| `GET /mcp` | `405`, `this MCP server pushes nothing` |
| a request from another machine with no bearer token | `401`, `unauthorized` |
| a body that is not JSON | `400`, error `-32700`, `the body is not JSON` |
| a body that is not an object | `400`, error `-32600`, `a JSON-RPC message is an object` |
| a second request under an `id` already in flight | error `-32600`, naming that `id` |

Nothing is ever pushed down this route: one message in, one answer out.[^push] A request from this machine needs no token.[^token]

## Which tools an agent sees

Every tool is named `<plugin>_<verb>`, such as `outlines_read` or `git_commit`, so a plugin that is off has no tools here, and a tool you cannot see is one you cannot call.[^resources] The list follows which plugins are running.[^changed] The endpoint works on a serve with no directory at all.[^nodirectory]

## What a client is told when it connects

olai writes the server's instructions afresh at each `initialize`, from the plugins running at that moment.[^instructions]

> Codex and Claude Code honour the instructions. opencode fetches them and throws them away, so an agent there is told none of this; pi is unverified.

## The ticket a conversation holds

A conversation attached to a row of an outline is handed its own bearer token, and every write made with it carries that conversation's writer name and the list of property keys it may not write.[^release] Two property keys are refused whatever the conversation is.[^words]

[^point]: [../connecting-agents.md](../connecting-agents.md) points a client at the endpoint; this page is about the endpoint itself.

[^push]: A client that wants live updates is asking for the half of the protocol this endpoint refuses with that `405`.

[^token]: Needing no token on this machine is how a client here reaches the same directory the browser is looking at, with nothing to configure but the address. From another machine, and when the address of the caller is unknown, the bearer token olai mints for this process is required. A request from this machine that carries one is accepted too.

[^resources]: The `surface://` resources come from the same plugins.

[^changed]: Switching a plugin on or off while a client is connected sends `tools/list_changed` and `resources/list_changed`, and the tools and resources that plugin brought arrive or leave with it.

[^nodirectory]: That includes a serve whose directory failed to open or was switched off in the plugins panel. The endpoint keeps answering, and from the next call on, the tools that need the directory refuse in the directory's own words.

[^instructions]: The instructions say what a tool caller can reach, how an address is written, and carry a paragraph from each plugin that has one to give. A client that is already connected keeps the text it was handed, so reconnect it after switching plugins on or off.

[^release]: Releasing the conversation shuts off what it may write through, then drops its token. A client holding a released token, including a multi-step tool coming back for its next write, is told `this conversation has been reaped, so the door it was handed is closed and nothing may be written through it`. Starting a new agent cannot revive it. Writes accepted before the release stay on disk.

[^words]: An agent cannot set the `approved` property on any row, because that is a person's approval of code that runs with this server's authority. It cannot change the `on` property in the settings file either, because which tools run is a person's decision there.

<details>
<summary>What turns the endpoint off</summary>

This plugin runs in the `web` and `surface` profiles. Set `on: no` on the `mcp` node in `_olai/Settings.olai`, or use its switch, **MCP** under **Connections** on the plugins panel ([../settings.md](../settings.md)).

With it off, `/mcp` answers `404`, and no conversation ticket can be made. Switching it on builds a fresh server and a fresh table of tickets. The browser's websockets keep their connections through both.

This plugin accepts no settings of its own.

</details>

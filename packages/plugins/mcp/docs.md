# mcp

Serves `/mcp`, the MCP endpoint an agent outside olai reads and writes the served directory through.[^point]

## What the endpoint answers

| Request | Answer |
| --- | --- |
| `POST /mcp` carrying one JSON-RPC message | one JSON-RPC answer |
| a notification, which carries no `id` | `202`, with an empty body |
| `GET /mcp` | `405`, `this MCP server pushes nothing` |
| a request from off this machine with no bearer token | `401`, `unauthorized` |
| a body that is not JSON | `400`, error `-32700`, `the body is not JSON` |
| a body that is not an object | `400`, error `-32600`, `a JSON-RPC message is an object` |
| a second request under an `id` already in flight | error `-32600`, naming that `id` |

Nothing is ever pushed down this route: one message in, one answer out.[^push] A request from loopback needs no token.[^token]

## Which tools an agent sees

Every tool is named `<row>_<verb>`, such as `outlines_read` or `git_commit`, so a row that is off has no verbs here and a verb you cannot see is not available.[^resources] The list follows what is running.[^changed] The endpoint stands on a serve with no directory at all.[^nodirectory]

## What a client is told when it connects

olai composes the server's instructions at each `initialize` from the rows standing at that moment.[^instructions]

> Codex and Claude Code honour the instructions. opencode fetches them and drops them, so an agent there is told none of this; pi is unverified.

## The ticket a conversation holds

A conversation seated on a node is handed its own bearer token, and every write through it carries that conversation's writer name and the words it may not write.[^release] Two words are refused whatever the conversation is.[^words]

[^point]: [../connecting-agents.md](../connecting-agents.md) points a client at the endpoint; this page is the endpoint itself.

[^push]: A client that wants live updates is asking for the half this endpoint refuses with the `405`.

[^token]: Needing no token on loopback is how a client on this machine reaches the same directory the browser is looking at with nothing to configure but the address. Off loopback, and when the peer address is unknown, the bearer token olai mints for this process is required. A loopback request that carries one is accepted either way.

[^resources]: The `surface://` resources come from the same rows.

[^changed]: Switching a row on or off while a client is connected sends `tools/list_changed` and `resources/list_changed`, and the tools and resources that row brought arrive or leave with it.

[^nodirectory]: That includes a serve whose vault failed to open or was switched off at the panel. The endpoint keeps answering, and the tools that need the directory refuse in the vault's own words from the next call on.

[^instructions]: The instructions say what a tool caller can reach, how an address is written, and carry a paragraph from each row that has one to give. A client that is already connected keeps the text it was handed, so reconnect it after switching rows on or off.

[^release]: Releasing the conversation closes its door and then drops the token. A client holding a released token, including a multi-step tool coming back for its next write, is told `this conversation has been reaped, so the door it was handed is closed and nothing may be written through it`. A new provider cannot revive it. Writes accepted before the release stay on disk.

[^words]: A session cannot write `approved` on any node, because that is a person's approval of code that runs with this server's authority, and it cannot change `on` in the settings file, because which tools run is a person's decision there.

<details>
<summary>What turns the endpoint off</summary>

The row runs in the `web` and `surface` profiles. Set `on: no` on the `mcp` node in `_olai/Settings.olai`, or use its switch, **MCP** under **Connections** on the plugins panel ([../settings.md](../settings.md)).

With it off, `/mcp` answers `404` and no session ticket can be minted. Switching it on builds a fresh server and a fresh ticket table. Browser websockets keep their connections through both.

The row accepts no settings of its own.

</details>

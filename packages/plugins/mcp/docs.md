# mcp

Serves `/mcp` for external clients and agent sessions. Enabled in the `web` and `surface` profiles. Turning it off closes protocol requests and withdraws session ticket minting. Turning it back on creates a fresh server and ticket table without disconnecting browser control sockets.

Profiles select its boot default; `on` on the `mcp` node in `_olai/Settings.olai` overrides it. The panel writes that durable choice. The package has no browser half or stylesheet.

MCP owns its resource projection: outlines and documents collections and the vault error cell come from their providers’ surface contracts. Its typed client includes those resources as well as tool procedures, so discovery and reads use the same projection.

The catalog follows active capabilities. Turning off a content provider removes
its tools and resources from discovery; calling a previously advertised tool
returns a capability-unavailable refusal. Providers that share a write procedure
retain only their own operation cases. Re-enabling a provider makes its tools
usable through the existing MCP server without restarting it.

The vault's own doors are DECLARED now. This row names `host.served`, a narrow
broker with two readings — the served directory, and its write gate — and
nothing else. What it replaced was `HostServices`, a capability whose whole
shape is *give me whatever stands behind this key*, named on the row and then
spent on three keys the row never declared. The graph a person reads said this
row wanted a transport; the code reached for the vault's gate on every tool
call.

The reach could not become a `needs` on the row or a component of it, and both
reasons are the same fact from two sides: the protocol server, its carrier, its
route and its ticket mint stand up on a serve with **no vault at all**, and a
row reported as `waiting` — which is what a row with a permanently-waiting
component reads as — is a row the roster reports as not running. So `/mcp`
survives a failed vault, a file choice that disables it, and the panel switch,
and the domain tools refuse in the vault's own words. Both readings resolve per
call, so a vault switched off mid-session refuses the next tool call rather than
the one after the next reconnect.

The third key is simply gone. `bindAgent` took a `ledger` predicate, the lookup
answered it, and no line in the package ever read it — `git_commit` and
`git_push` go through the write gate, which refuses in the vault's own words on
a serve with no history.

Every request and node-session credential resolves the current provider
generation while retaining its writer and remaining write rule. A departed
generation cannot be reused, and a replacement does not inherit an earlier
provider's resources. The protocol remains available when no notebook
capability is enabled.

Releasing a node ticket closes its door before removing the credential lookup.
A retained client, including the delayed next write of a multi-step tool, then
receives the same reaped-conversation refusal. A provider returning with fresh
handlers cannot revive that credential; writes accepted before release remain
on disk.

## What `initialize` says

The server's `instructions` are COMPOSED, at each `initialize`, from the rows
standing at that moment — the same reading the tool list and the `surface://`
resources come from. This row's own paragraphs come first: what olai IS to a
tool caller (nodes and whole files, never bytes, no filesystem under it), the
address grammar (`/#<id>` a node anywhere, `/<path>` a document or an outline,
`/<path>#<element>` a row or a heading — `@olai/format`'s, true with no other
row standing), that a tool's `at` is that address without the leading `/`, that
an address is the app's own with no host or port to know, and that tools are
named `<row>_<verb>` with an absent row's verbs absent. After them, in roster
order, comes every standing row's **charter**: the one paragraph a row tells an
agent about itself as an application, carried on its `Sibling.charter` beside
the `tools` it brings. Today one row has one — chat's, that a person reads the
answer in the panel beside the outline, that a backticked id in prose is
pressable and a fenced one is a quotation, that a link to an app address is
followed in place ([chat.md](../chat.md), "Pointing back at a node", is the
person's side of that contract).

**A sentence leaves with its row, like a verb.** It was one static paragraph in
`@olai/surface` for one PR, and that was core speaking for a plugin: a serve
may run `mcp` with no `chat` row, and an external host dialling `/mcp` from a
terminal has no panel anywhere, so both were told about a panel they did not
have. A charter the agent's next glance can disprove teaches that the rest is
decoration. `/today`, `/agenda`, pins, mirrors, marks and the search operators
are each a plugin's too, and are taught by the tool that owns them rather than
here.

**Per connection, not per session.** The text is read when a host sends
`initialize`, so a host that connects after a row is switched on or off is told
the roster it gets. A host already connected keeps what it was told: MCP has
`tools/list_changed` and `resources/list_changed` and no `instructions_changed`
— the same reconnect-per-roster-change limit a browser socket has, stated
rather than hidden. This depends on `@kolu/surface-mcp` taking `instructions`
as a function (juspay/kolu#2253).

**The composed whole stays under 2000 bytes with every row standing.** Claude
Code truncates server instructions at 2 KB, silently, and bills them on every
turn; `@olai/server`'s `profiles.test.ts` holds the ceiling over the full
bundle and reads both states of chat's paragraph. Codex and Claude Code honour
`instructions`; **opencode fetches it and drops it**
([anomalyco/opencode#7373](https://github.com/anomalyco/opencode/issues/7373)),
so an agent on opencode is exactly as untaught as before and this row cannot
close that from its side of the wire; pi is unverified.

## Tool display catalogue

The activation offers `mcp.catalogue`, an optional `advertised(server, tool)` lookup returning the served title and owning plugin name. The activation supplies the endpoint’s server identity; the lookup imports no HTTP implementation. It walks the live agent rows on every call, using the same scoped name as tool serving; it keeps no cache or subscription. Other servers and absent tools answer `null`. The bundle resolves the offer per call through `Tools.advertised`, so MCP and chat remain independently optional and withdrawal or replacement takes effect immediately.

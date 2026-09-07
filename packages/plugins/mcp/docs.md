# mcp

Serves `/mcp` for external clients and agent sessions. Enabled in the `web` and `surface` profiles. Turning it off closes protocol requests and withdraws session ticket minting. Turning it back on creates a fresh server and ticket table without disconnecting browser control sockets.

The plugins panel switches this row for the current process. Profiles select its boot default; an explicit `--plugins` set must name this row to enable it. The package has no browser half or stylesheet.

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
survives a failed vault, a `--plugins` set that omits it, and the panel switch,
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

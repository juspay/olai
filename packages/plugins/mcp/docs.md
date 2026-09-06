# mcp

Serves `/mcp` for external clients and agent sessions. Enabled in the `web` and `surface` profiles. Turning it off closes protocol requests and withdraws session ticket minting. Turning it back on creates a fresh server and ticket table without disconnecting browser control sockets.

The plugins panel switches this row for the current process. Profiles select its boot default; an explicit `--plugins` set must name this row to enable it. The package has no browser half or stylesheet.

The catalog follows active capabilities. Turning off a content provider removes
its tools and resources from discovery; calling a previously advertised tool
returns a capability-unavailable refusal. Providers that share a write procedure
retain only their own operation cases. Re-enabling a provider makes its tools
usable through the existing MCP server without restarting it.

Every request and node-session credential resolves the current provider
generation while retaining its writer and subtree fence. A departed generation
cannot be reused, and a replacement does not inherit an earlier provider's
resources. The protocol remains available when no notebook capability is enabled.

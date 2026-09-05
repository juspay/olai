# mcp

Serves `/mcp` for external clients and agent sessions. Enabled in the `web` and `surface` profiles. Turning it off closes protocol requests and withdraws session ticket minting. Turning it back on creates a fresh server and ticket table without disconnecting browser control sockets.

The plugins panel switches this row for the current process. Profiles select its boot default; `--plugins` continues to select the other bundle rows independently.

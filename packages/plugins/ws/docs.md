# ws

Serves the browser websocket over the shared listener. Enabled in the `web` profile. Turning it off disconnects browser control sockets; MCP can remain available on the same port.

The plugins panel switches this row for the current process. Profiles select its boot default; an explicit `--plugins` set must name this row to enable it. The package has no browser half or stylesheet.

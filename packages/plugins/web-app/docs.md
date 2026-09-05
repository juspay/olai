# web-app

Serves the browser build over the shared listener. Enabled in the `web` profile. Turning it off removes browser assets and rebuilds the listener; the websocket and MCP registrations remain independent. This plugin alone does not open a port.

The plugins panel switches this row for the current process. Profiles select its boot default; an explicit `--plugins` set must name this row to enable it. The package has no browser half or stylesheet.

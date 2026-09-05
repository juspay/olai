# web-app

Serves the browser build over the shared listener. Enabled in the `web` profile. Turning it off removes browser assets and rebuilds the listener; the websocket and MCP registrations remain independent. This plugin alone does not open a port.

The plugins panel switches this row for the current process. Profiles select its boot default; `--plugins` continues to select the other bundle rows independently.

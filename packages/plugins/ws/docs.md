# ws

Serves the websocket a browser tab talks to olai over, on the same port as everything else. Every keystroke a tab sends and every update it draws travels through it.

## What turns it off

The row runs in the `web` profile. Set `on: no` on the `ws` node in `_olai/Settings.olai`, or use its switch, **WebSocket** under **Connections** on the plugins panel ([../settings.md](../settings.md)).

With it off, open tabs lose their connection and `GET /olai/who` answers `404`. The browser build and `/mcp` keep serving on the same port.

A socket from an origin this serve was not told to allow is refused before it is upgraded, and so is a tab left over from an olai that has stopped.

The row accepts no settings of its own.

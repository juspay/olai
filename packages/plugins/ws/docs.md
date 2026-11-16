# ws: the live connection between a browser tab and olai

The `ws` plugin serves the websocket, which is the live connection a browser tab talks to olai over, on the same port as everything else.

Every keystroke a tab sends and every update it draws travels through it.

## What turns it off

The plugin runs in the `web` profile. Set `on: no` on the `ws` row in `_olai/Settings.olai`, or use its switch, **WebSocket** under **Connections** in the plugins panel ([../settings.md](../settings.md)).

With it off, open tabs lose their connection and `GET /olai/who` answers `404`. The browser app and `/mcp` keep serving on the same port.

A connection from a site this serve was not told to allow is refused before the connection is opened, and so is one from a tab left over from an olai that has stopped.

This plugin takes no settings of its own.

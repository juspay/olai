# web-app

Serves the compiled browser app over the shared listener: the shell, its hashed assets, the web manifest and the notification service worker. It is the only row that serves the build.

## What turns it off

The row runs in the `web` profile. Set `on: no` on the `web-app` node in `_olai/Settings.olai`, or use its switch, **Web app** under **Connections** on the plugins panel ([../settings.md](../settings.md)).

With it off, those routes withdraw together and a browser gets nothing to load. Open websockets and `/mcp` keep serving on the same port.

Serving the build enables nothing else: a socket, a directory and the agent tools each arrive with their own row.

## What it refuses

The row looks the browser build up when it starts. A build it cannot find fails the row, which the plugins panel reports, rather than leaving an empty shell on the port.

The row accepts no settings of its own.

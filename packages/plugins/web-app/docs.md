# web-app: serving the browser app

The `web-app` plugin serves the compiled browser app, on the same port everything else uses.[^parts] It is the only plugin that serves that build.

## What turns it off

The plugin runs in the `web` profile. Set `on: no` on the `web-app` row in `_olai/Settings.olai`, or use its switch, **Web app** under **Connections** in the plugins panel ([../settings.md](../settings.md)).

With it off, the app and the files it loads stop being served together, and a browser has nothing to load. Websockets that are open, and `/mcp`, keep serving on the same port.

Serving the build switches nothing else on: the websocket, the directory of files and the tools an agent calls each come from a plugin of their own.

## What it refuses

The plugin looks for the compiled browser build when it starts. If it cannot find one, the plugin fails and the plugins panel says so, rather than leaving an empty app on the port.

This plugin takes no settings of its own.

[^parts]: What it serves: the app itself, the files it loads (each with a hash in its name), the web manifest a browser reads when you install olai as an app, and the service worker that shows notifications.

# web-app

Serves the browser build over the shared listener. Enabled in the `web` profile. Turning it off withdraws browser assets, the manifest and service worker routes while existing websocket connections and MCP remain available. This plugin alone can serve the build on the shared port.

The plugins panel switches this row for the current process. Profiles select its boot default; an explicit `--plugins` set must name this row to enable it. The package has no browser half or stylesheet.

Its `/assets` build export supplies stable install icons and install-related head metadata. Bundle generation discovers this export; the generic web builder copies no named application icon itself.

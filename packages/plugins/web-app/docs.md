# web-app

Serves the browser build over the shared listener. Enabled in the `web` profile. Turning it off withdraws browser assets, the manifest and service worker routes while existing websocket connections and MCP remain available. This plugin alone can serve the build on the shared port.

Profiles select its boot default; `on` on the `web-app` node in `_olai/Settings.olai` overrides it. The panel writes that durable choice. The package has no browser half or stylesheet.

Its `/assets` build export supplies stable install icons and install-related head metadata. Bundle generation discovers this export; the generic web builder copies no named application icon itself.

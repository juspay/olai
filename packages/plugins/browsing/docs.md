# Browser tools for chat agents

The **browsing** plugin is on by default. Each new conversation, with any ACP
engine, receives a Playwright MCP server for browsing the web: navigation,
clicking, typing, page snapshots and screenshots. It runs headless Chromium
with an isolated in-memory profile. This browser is separate from the browser
you use to open olai.

The packaged `OLAI_BROWSER_MCP` points at the pinned Playwright MCP executable.
Its Nix wrapper supplies matching Chromium from the Nix store. Override it with
an absolute executable path, or set it to an empty string to omit browser tools.
An unset variable also omits the server. A non-executable file, failed or timed
out MCP handshake, or incompatible tool list produces a sentence in chat.
Each conversation probes again, so repairing the executable takes effect at
the next conversation. The panel distinguishes handing the server over from
an engine reporting that it connected.

Screenshots can reach the agent inline over MCP. File output uses private
scratch under `XDG_RUNTIME_DIR`, falling back to the system temporary directory;
it is never configured to use the vault or the agent's working directory.
This is a spill area, not durable storage. The plugin row owns it and removes
it when switched off or when olai stops. Switching on creates a new directory.
An engine session that outlives the row keeps its browser, but its later file
outputs have no durable storage guarantee.

The probe owns and terminates its disposable subprocess through its scope.
The engine's ACP session starts and ends the long-lived MCP server and browser;
olai has no process handle for them. Switching the plugin off withdraws its
registration for future conversations. It does not revoke the browser already
handed to an existing engine session.

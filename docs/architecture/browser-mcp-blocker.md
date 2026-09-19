# Browser MCP: blocked on a local artifact directory

Status: implementation stopped at the requested core-change checkpoint. The
browser plugin is not implemented or enabled by this change.

The browser MCP plan requires screenshots and downloads to land in a directory
under the plugin's `LocalState`, outside the vault and working directory. It also
requires stopping and explaining in the PR if a chat or core change is needed.

## The missing capability

[`LocalState`](../../packages/plugin-api/src/services.ts) exposes only `load` and
`save` for an opaque JSON record. It exposes neither a filesystem path nor a
directory acquisition operation. Its
[host implementation](../../packages/server/src/localState.ts) keeps the path
private and keys the record by plugin identity and canonical served directory.

`Env` supplies environment variables and an injectable appliance connection;
it does not supply the plugin's state directory. Deriving a separate path from
environment variables would duplicate host path policy and would not obtain
the requested capability through `LocalState`. Saving an arbitrary directory
path in the JSON record would not establish that it belongs under that state
location either.

The existing `SessionStart.ask` registration and ACP stdio-server handoff fit
the requested integration. The blocker is artifact storage, not chat routing.

## Proposed prerequisite

Extend the declared local-state service with an operation that supplies a
host-managed artifact directory scoped by plugin identity and served directory.
The host should create it with private permissions and report acquisition
failures. Keep the existing ordered JSON-record behavior intact. Test separate
plugins and serves, reacquisition after a toggle or restart, and creation
failure before implementing the browser row against that capability.

This directory must remain available after the browser plugin is disabled:
the plugin owns the registration for future conversations, while existing ACP
sessions may still be writing artifacts. Persistent artifacts should not be
deleted by the plugin activation's finalizer. Retention or explicit removal
needs a stated host policy, separate from process shutdown.

The probe's short-lived MCP child belongs to its probe scope and must be killed
and joined when that scope ends. The long-lived MCP server and Chromium process
belong to the engine's ACP session: the engine starts and ends them, and olai
holds no process handle. Disabling the row withdraws future handoffs; it cannot
terminate an engine-owned server already handed over.

## Packaging evidence and remaining validation

The current nixpkgs pin contains `playwright-mcp` version `0.0.76`. Its package
recipe wraps the executable with `PLAYWRIGHT_BROWSERS_PATH` set to
`playwright-driver.browsers`, defaults the browser to Chromium, and defaults to
isolation when no user-data directory is configured. No nixpkgs bump is needed
to obtain the package.

This finding comes from the pinned package recipe, not a binary smoke test.
Checking the real executable's help, the sandboxed `initialize` and `tools/list`
check, shared transport extraction, probe tests, browser workflows and remote
fast checks remain pending. No runtime code changed at this checkpoint.

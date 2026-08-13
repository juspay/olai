# Running olai

How to serve a directory and configure the server. The git story is
[git.md](git.md); the agent is [chat.md](chat.md); the format is
[format.md](format.md).

## `olai web`

```sh
nix run github:juspay/olai -- web path/to/outlines
```

or, in a clone:

```sh
just serve docs     # serves this repo's own roadmap, and opens on 127.0.0.1:7714
```

`olai web <dir> [--port] [--host]` reads the directory recursively, picking up
every `.jsonl` outline and every `.md` document, and serves them to a browser.
It does not descend into dot-directories or `node_modules` — a directory of
outlines is usually a git repository, and nothing anyone wrote is inside
`.git`. Defaults: port `7714`, host `127.0.0.1`.

It binds to loopback by default because the surface is unauthenticated: anyone
who can reach the port can read every outline under the directory — and, since
the keyboard editor arrived, change one.

The page it serves follows the disk — save a file, `git pull`, drop in a new
outline, and it updates in place — and a pill in its header is green only
while a server is actually answering; restart the server under an open tab
and the page says so and offers a reload. It reads on a phone and installs as
one (there is no offline mode, on purpose — a cached copy of an outline is a
copy that has stopped being true). A ⚙ in the header opens the preferences —
one of the fifteen named palettes, and whether pages open with finished work
shown — stored in the browser and sent nowhere; `⌘K` opens a command palette,
where the keyboard-shortcut list also lives.

### Behind a reverse proxy

Put it behind a reverse proxy or `tailscale serve` and the browser's origin
will not be the `Host` it forwards, so name the origins you are serving from
in `OLAI_ALLOWED_ORIGINS` (comma-separated); the websocket refuses the rest.

### Logging

It says what it is doing on stdout, one line per event, quietly: the address
it bound, the agent it started, and anything that went wrong. `--log-level
debug` turns on the rest, including everything the agent itself writes.

## As a user service (home-manager)

To keep it running as a user service (systemd on Linux, launchd on macOS), add
the flake input and enable the home-manager module. Create `dataDir` first —
`olai web` refuses a path that does not exist.

```nix
# flake.nix
inputs.olai.url = "github:juspay/olai";
```

```nix
# home.nix (a home-manager module)
{ config, inputs, ... }: {
  imports = [ inputs.olai.homeManagerModules.default ];
  services.olai = {
    enable = true;
    dataDir = "${config.home.homeDirectory}/outlines";
    # host = "127.0.0.1";  # default
    # port = 7714;         # default
  };
}
```

The module fills `package` from the flake for the host platform. The packaged
binary already bakes the browser bundle (`OLAI_DIST_DIR`), so the service
needs no ambient environment.

## `olai mcp`

Any MCP client — a coding agent in a terminal, working in the same directory —
gets the same closed tool list by launching olai:

```sh
claude mcp add olai -- olai mcp ~/outlines
```

`olai mcp <dir>` speaks MCP over its own stdin and stdout, so there is nothing
to bind, nothing to configure and nothing to authenticate: the client proved
who it is by being the process that started it. It needs no `olai web` running,
and it does not mind one that is — leave a tab open on that directory and it
follows the terminal's edits live. It gets the `commit` tool too, and
`--commit=off` turns that off ([git.md](git.md)).

There is no write CLI, and there never will be — no shell command adds a node
or marks one. `olai web` and `olai mcp` are the two ways of putting a write
surface in front of a directory: a page, or a pipe.

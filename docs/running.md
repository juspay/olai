# Running olai

How to serve a directory, keep the server running, and configure the pieces
around it. What the format itself means is [format.md](format.md); how the
pieces fit is [architecture.md](architecture.md).

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

## Commit modes

Writes land on disk and wait; committing them is a button — the pill in the
app header — or the agent's own `commit` tool. Two flags change that:

- `--commit=auto` is one commit per write, for a server with no browser in
  front of it.
- `--commit=off` (or `--no-commit`) is for a directory whose history is
  somebody else's job. The pill says so rather than vanishing, and nothing is
  ever `git init`ed on your behalf.

The pill reads `✓ committed · 12m ago` when everything is recorded, `no
commits yet` when olai has never committed in this directory, `4 uncommitted`
when something is waiting, and `no git here` / `commits off` when there is
nothing to record at all — those last two are settings rather than problems,
so they are dim and inert. If the repository is mid-merge, mid-rebase or on a
detached HEAD, the commit button says so and does nothing.

Every commit message starts with `olai`, so `git log --grep '^olai'` is the
audit view and `--invert-grep` gives you back your own history. Each commit
carries an `X-Olai-Writer` trailer saying which of you wrote it. A git failure
never fails a write — the bytes are on disk and you have already seen them —
but it is never silent either: the pill says `Git error` and hands you git's
own words.

## The chat agent

The panel's agent is the pinned Claude Code adapter, and it comes with olai:
`nix run`, the packaged binary and `just serve` all default to it, so there is
nothing to install and nothing to configure.

- `OLAI_ACP_AGENT` points at a different [ACP](https://agentclientprotocol.com)
  agent.
- Setting it to the empty string turns chat off — the panel then says there is
  no agent and which variable would give it one. The outlines are served the
  same either way.

The conversation is the agent's own session for that directory: close olai,
reopen it, and you are back in it — and `claude --resume` in a terminal
reaches the same conversations.

You can paste a picture into the box — a screenshot, a photo of a whiteboard —
and ask about it. The bytes go into a temporary directory belonging to that
conversation, never under the directory being served; the agent is handed the
path and reads the file itself, so nothing pasted can end up committed with
your outlines. The pictures go away when you start a new conversation or stop
the server.

### kolu

If the machine is running [kolu](https://kolu.dev) — terminals for coding
agents — the panel's agent gets kolu's terminals too, and there is nothing to
set up: every new conversation looks for the padi daemon this host answers on,
and hands the session `kolu mcp` when one is there. It is looked for rather
than assumed: olai starts the `kolu` it found and asks it to read something
only a running daemon can answer, because a `kolu` on a PATH is not always the
one this host is running.

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
`--commit=off` turns that off.

There is no write CLI, and there never will be — no shell command adds a node
or marks one. `olai web` and `olai mcp` are the two ways of putting a write
surface in front of a directory: a page, or a pipe.

## In the browser

- **Connection pill.** A pill in the app header is green only while a server
  is actually answering. Restart the server under an open tab and the page
  says the server it came from is gone and offers a reload.
- **Palettes.** Fifteen named palettes sit behind a pill in the app header,
  each chip painted in the palette it offers. The choice stays in the browser
  and is sent nowhere. There is no "system" setting on purpose — the page
  should not change under you after you have said what you wanted; the default
  is `chalk`, the one palette that promises AA contrast on everything it
  paints.
- **Phone / PWA.** It reads on a phone and installs as one: add it to a home
  screen and it opens in its own window under the olai mark. There is no
  offline mode, on purpose — a cached copy of an outline is a copy that has
  stopped being true.
- **⌘K** opens a command palette for navigation and panel toggles; the full
  keyboard-shortcut list is in the app under **Keyboard shortcuts**.

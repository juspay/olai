# Running olai

How to serve a directory and configure the server. The git story is [git.md](git.md); the agent is [chat.md](chat.md); the format is [format.md](format.md).

## `olai web`

```sh
nix run github:juspay/olai -- web path/to/outlines
```

or, in a clone:

```sh
just run            # the one brain: this repo's docs, on an OS-assigned port
just serve docs     # the same, plus a client-bundler watch for the edit loop
```

`olai web <dir> [--port] [--host]` reads the directory recursively, picking up every `.olai` outline and every `.md` document, and serves them to a browser. It does not descend into dot-directories or `node_modules` — a directory of outlines is usually a git repository, and nothing anyone wrote is inside `.git`. Defaults: port `0` (the OS picks one), host `127.0.0.1`. A fixed `--port` is a deploy's word — the home-manager module passes `7714` ("olai" on a phone keypad). `just run` / `just serve` write the bound URL to `.olai-dev/url` in this worktree, so a second checkout cannot squat the first, and neither can squat production.

If a directory that used to serve comes up EMPTY, its outlines predate the rename to `.olai`: [format.md](format.md) carries the one-line `git mv` to run on it. olai reads the one extension and migrates nothing for you.

It binds to loopback by default because the surface is unauthenticated: anyone who can reach the port can read every outline under the directory — and, since the keyboard editor arrived, change one.

The page it serves follows the disk — save a file, `git pull`, drop in a new outline, and it updates in place — and a pill in its header is green only while a server is actually answering; drop the connection and the app freezes under an overlay that says so, thawing by itself when the wire comes back; restart the server under an open tab and that overlay offers a reload, because nothing else recovers that one. It reads on a phone and installs as one (there is no offline mode, on purpose — a cached copy of an outline is a copy that has stopped being true). A ⚙ in the header (or, on a phone, at the foot of the directory drawer) opens the preferences — one of the named palettes, the typeface, how big the page is set, how much of a row is drawn by default, whether pages open with finished work shown, whether the sidebar's file tree draws the outlines olai names for itself (`_olai/`: the shelf, the inbox, the trash — hidden by default, each with a door of its own in that column), and the two git rows (whether what is waiting records itself once the edits stop, and whether a commit from here is pushed) — stored in the browser and sent nowhere; `⌘K` opens a command palette, where the keyboard-shortcut list also lives, where a zoomed node's own verbs are offered, and where `+ a line` captures that line to the directory's inbox without leaving the page ([docs/editing.md](editing.md)). Search has a box in the header and lives in that palette too — the same reading an agent's `search_nodes` gets, jump on Enter; on a phone the header's magnifier opens the palette ([docs/search.md](search.md)). It needs nothing installed.

### One olai per directory

A directory has one olai over it, and a second one refuses to boot:

```
$ olai web ~/notes
ERROR: VaultInUse: another olai is serving this directory (pid 48219) — one brain per vault
```

It is the pid of the server that already has it, so `ps 48219` says which one — and `kill` it, or open the tab it is already serving, whichever you meant. A symlinked spelling of the same directory is the same directory: the claim is on where the files actually are, not on how you typed it.

A refusal that names no pid means the same thing: the claim is the kernel's, and only the number — which olai will not print unless it names a process that is really there — was missing.

This is a refusal rather than a warning because two olai over one directory cannot be made safe. Writes are whole-file: each server stages a copy and renames it over the destination, so nothing is ever torn, and the second write erases the first wholesale with both reporting success. Validation is per-server, so two edits that are each valid alone put duplicate ids and dependency cycles on disk that neither would have accepted. And if commits are on, two `git add -A` runs interleave in one work tree.

The claim is an OS advisory lock (`flock`), held in `$XDG_RUNTIME_DIR/olai/` — or `/tmp/olai-$UID/` on a machine without one — and the KERNEL releases it when the process ends, however it ends. There is no stale lock to clear after a crash, nothing to delete before restarting, and no file left inside your notes directory. If a machine ever refuses to serve a directory nothing is serving, that is a bug and not a lock you should go and remove.

What it does not cover:

- **Another program editing the files** — your editor, `git pull`, an agent writing by hand. Those are the ordinary case, the page follows them, and they are not a second brain.
- **A second olai on ANOTHER MACHINE** over the same network share, which no advisory lock promises on both Linux and macOS.
- **A directory inside a directory.** `olai web ~/notes` and `olai web ~/notes/projects` are two different directories, so both start — and over the outlines they share, they are two brains with everything above back in play. Serve one or the other, not both.

### Behind a reverse proxy

Put it behind a reverse proxy or `tailscale serve` and the browser's origin will not be the `Host` it forwards, so name the origins you are serving from in `OLAI_ALLOWED_ORIGINS` (comma-separated); the websocket refuses the rest.

### Who is looking

A reverse proxy in front of olai can say who made the request. olai trusts **one configurable pair of header names** — a login, and optionally an email — and the header bar draws that person (a gravatar from the hashed email, generic silhouette when there is no email claim, and the login beside it or on hover). Direct access and a local `just run` inject nothing, and nothing is drawn.

Default wiring is `tailscale serve`'s `Tailscale-User-Login` for both (that header is the email). The same pair covers other proxies — one feature, not one per proxy:

| Proxy | login | email |
|---|---|---|
| `tailscale serve` (default) | `Tailscale-User-Login` | `Tailscale-User-Login` |
| Caddy + oauth2-proxy | `X-Auth-Request-User` | `X-Auth-Request-Email` |
| Caddy + caddy-security (`inject headers with claims`) | `X-Token-User-Nick` (or `-Name`) | `X-Token-User-Email` |
| Authelia / Pomerium | `Remote-User` | `Remote-Email` |

```sh
# Authelia in front, for example
OLAI_IDENTITY_LOGIN_HEADER=Remote-User
OLAI_IDENTITY_EMAIL_HEADER=Remote-Email
```

`OLAI_IDENTITY_LOGIN_HEADER` unset is `Tailscale-User-Login`. `OLAI_IDENTITY_EMAIL_HEADER` unset is the login header; **empty** is no email claim (generic gravatar). The same reading is the attribution a later capture door will record.

**Trust.** These headers are only meaningful when the proxy is the only way in: olai bound to loopback or the tailnet, **and the proxy stripping client-supplied copies of the same names**. Anything that can reach the port can send them — the same bargain the rest of the unauthenticated listener already takes. Do not expose this port to the internet.

### Logging

It says what it is doing on stdout, one line per event, quietly: the address it bound, the agent it started, and anything that went wrong. `--log-level debug` turns on the rest, including everything the agent itself writes.

A SIGINT or SIGTERM writes `olai web: received SIGTERM` (or `SIGINT`) to stderr before the process unwinds. Effect still treats the interrupt as a successful stop and exits 130 — the shipped user unit counts 130 as success so `systemctl stop` is not a failed unit, and on Linux `Restart=always` still brings a stray SIGTERM back (see [As a user service](#as-a-user-service-home-manager)). That one line is what lets a journal tell a signaled death from a deliberate stop.

## As a user service (home-manager)

To keep it running as a user service (systemd on Linux, launchd on macOS), add the flake input and enable the home-manager module. Create `dataDir` first — `olai web` refuses a path that does not exist.

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

The module fills `package` from the flake for the host platform. The packaged binary already bakes the browser bundle (`OLAI_DIST_DIR`), so the service needs no ambient environment.

On Linux the unit is `Restart=always` / `RestartSec=1s` / `SuccessExitStatus=130`. A stray `kill -TERM` of the main pid is a successful exit that systemd still brings back; a `systemctl --user stop olai` is a systemd stop, which `Restart=` never overrides. On macOS the agent is `KeepAlive.SuccessfulExit=false` and `Crashed=true` — a 130 exit already restarts there, because launchd treats non-zero as unsuccessful. The 2026-08-20 incident (an outside SIGTERM, `on-failure` + `SuccessExitStatus=130`, hours of dark ledger) is [the RCA](RCA/2026-08-20-olai-service-sigterm.md).

## Agents, over HTTP

Any MCP client — a coding agent in a terminal, working in the same directory — gets the same closed tool list by dialling the running server. There is no second process and no stdio face: `olai web` owns the store, and `/mcp` is how an agent that is not the panel's talks to it.

```json
{
  "mcpServers": {
    "olai": {
      "type": "http",
      "url": "http://127.0.0.1:7714/mcp"
    }
  }
}
```

`7714` is the production/deploy port: the home-manager module binds it, and `.mcp.json` names it, so an agent in this repo talks to the user service and never to a worktree's `just run`. Without that service, `.mcp.json` at 7714 points at nothing — `just run docs --port 7714` is how you make it hold (the recipe already forwards extra args). A worktree's server writes its own address to `.olai-dev/url`: the first line is the URL, the second is `pid=` of the process that wrote it. If that pid is gone the URL is stale — `curl` it before pointing an agent at *that* checkout (`…/mcp`). Requests from `127.0.0.1` do not need a bearer token; the chat still sends the one it was handed, which is accepted and ignored. A request that did not come from loopback is refused without that token.

Unattended agent runs need the server up. The user service is the one brain; `just run` is a worktree's own.

There is no write CLI, and there never will be — no shell command adds a node or marks one. The two write surfaces are a page and an HTTP POST at `/mcp`, and they are two clients of one server.

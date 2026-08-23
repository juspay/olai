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

The page it serves follows the disk — save a file, `git pull`, drop in a new outline, and it updates in place — and a pill in its header is green only while a server is actually answering; drop the connection and the app freezes under an overlay that says so, thawing by itself when the wire comes back; restart the server under an open tab and that overlay offers a reload, because nothing else recovers that one. It reads on a phone and installs as one (there is no offline mode, on purpose — a cached copy of an outline is a copy that has stopped being true). A ⚙ in the header (or, on a phone, at the foot of the directory drawer) opens the preferences — one of the named palettes, the typeface, how big the page is set, how much of a row is drawn by default, whether pages open with finished work shown, whether the sidebar's file tree draws the outlines olai names for itself (`_olai/`: the shelf, the inbox, the trash — hidden by default, each with a door of its own in that column), and the two git rows (whether what is waiting records itself once the edits stop, and whether a commit from here is pushed) — stored in the browser and sent nowhere, except that the two git rows can be [pinned by the server](#the-git-policy), which is the one thing on that panel an instance is allowed an opinion about; `⌘K` opens a command palette, where the keyboard-shortcut list also lives, where a zoomed node's own verbs are offered, and where `+ a line` captures that line to the directory's inbox without leaving the page ([docs/editing.md](editing.md)). Search has a box in the header and lives in that palette too — the same reading an agent's `search_nodes` gets, jump on Enter; on a phone the header's magnifier opens the palette ([docs/search.md](search.md)). It needs nothing installed.

### One olai per directory

A directory has one olai over it, and a second one refuses to boot:

```
$ olai web ~/notes
ERROR: VaultInUse: another olai is serving this directory (pid 48219) — one brain per vault
```

It is the pid of the server that already has it, so `ps 48219` says which one — and `kill` it, or open the tab it is already serving, whichever you meant. A symlinked spelling of the same directory is the same directory: the claim is on where the files actually are, not on how you typed it.

A refusal that names no pid means the same thing: the claim is the kernel's, and only the number — which olai will not print unless it names a process that is really there — was missing.

This is a refusal rather than a warning because two olai over one directory cannot be made safe. Writes are whole-file: each server stages a copy and renames it over the destination, so nothing is ever torn, and the second write erases the first wholesale with both reporting success. Validation is per-server, so two edits that are each valid alone put duplicate ids and dependency cycles on disk that neither would have accepted. And if commits are on, two `git add -A` runs interleave in one work tree.

The claim is an OS advisory lock (`flock`), held in `$XDG_RUNTIME_DIR/olai/` — or `/tmp/olai-$UID/` on a machine without one — and the KERNEL releases it when the process ends, however it ends. A graceful stop also unlinks the lock file; a crash cannot, and the next boot sweeps leftovers (a `.lock` whose pid is dead or whose served directory is gone, and the retired rendezvous `.sock` files of #175/#184). There is no stale lock to clear after a crash, nothing to delete before restarting, and no file left inside your notes directory. If a machine ever refuses to serve a directory nothing is serving, that is a bug and not a lock you should go and remove.

A server whose served directory disappears exits on its own. That is what stops a leftover `olai web` sitting on a `/tmp` scratch the tests already deleted.

What it does not cover:

- **Another program editing the files** — your editor, `git pull`, an agent writing by hand. Those are the ordinary case, the page follows them, and they are not a second brain.
- **A second olai on ANOTHER MACHINE** over the same network share, which no advisory lock promises on both Linux and macOS.
- **A directory inside a directory.** `olai web ~/notes` and `olai web ~/notes/projects` are two different directories, so both start — and over the outlines they share, they are two brains with everything above back in play. Serve one or the other, not both.

### Behind a reverse proxy

Put it behind a reverse proxy or `tailscale serve` and the browser's origin will not be the `Host` it forwards, so name the origins you are serving from in `OLAI_ALLOWED_ORIGINS` (comma-separated); the websocket refuses the rest.

### Who is looking

A reverse proxy in front of olai can say who made the request. olai trusts **one configurable family of header names** — a login, and optionally an email, a display name and a picture — and the header bar **always** draws who is looking as an icon, top right, in the same chip as prefs: **anonymous** when no login came (direct access, a local `just run`), the person when one did, or that the door failed. The words are the tooltip, and they say the display name with the login beside it (`Sridhar Ratnakumar (srid@github)`) — on a shared vault, which account this is is the whole question. Absence is a face, not a missing chip.

Default wiring is `tailscale serve`'s own four headers. **The login is not necessarily an email**: on a Google, Microsoft or Okta tailnet `Tailscale-User-Login` *is* the address, which is why the email claim defaults to the same header — but on a GitHub- or passkey-backed one it reads `srid@github`, which is Tailscale's spelling of that account and not an address anybody can hash. The same family covers other proxies — one feature, not one per proxy:

| Proxy | login | email | name | picture |
|---|---|---|---|---|
| `tailscale serve` (default) | `Tailscale-User-Login` | `Tailscale-User-Login` | `Tailscale-User-Name` | `Tailscale-User-Profile-Pic` |
| Caddy + oauth2-proxy | `X-Auth-Request-User` | `X-Auth-Request-Email` | `X-Auth-Request-Preferred-Username` | — (use a template) |
| Caddy + caddy-security (`inject headers with claims`) | `X-Token-User-Nick` (or `-Name`) | `X-Token-User-Email` | `X-Token-User-Name` | `X-Token-User-Picture`, where that claim is injected — otherwise a template |
| Authelia | `Remote-User` | `Remote-Email` | `Remote-Name` | — (use a template) |
| Pomerium (`jwt_claims_headers`) | `X-Pomerium-Claim-User` | `X-Pomerium-Claim-Email` | `X-Pomerium-Claim-Name` | `X-Pomerium-Claim-Picture`, where the operator mapped that claim — otherwise a template |

Pomerium's `pass_identity_headers` forwards `X-Pomerium-Jwt-Assertion`, which is a signed JWT and not a login; the unsigned `X-Pomerium-Claim-*` headers this family reads come from `jwt_claims_headers`, and each one is only there if that claim was mapped.

```sh
# Authelia in front, for example
OLAI_IDENTITY_LOGIN_HEADER=Remote-User
OLAI_IDENTITY_EMAIL_HEADER=Remote-Email
OLAI_IDENTITY_NAME_HEADER=Remote-Name
OLAI_IDENTITY_PICTURE_HEADER=            # Authelia sends none — empty is off,
                                         # and an unset name is one a client
                                         # could send (see Trust, below)
```

Each variable unset is the Tailscale name in the table's first row (`OLAI_IDENTITY_EMAIL_HEADER` unset is the *login* header, since that is what a Tailscale login often is); each one **empty** turns that claim off. The login is the only one that makes somebody present — the rest are claims about them, and any of them may be missing. The same reading is the attribution the capture door records.

#### The picture, and where it comes from

Four rungs, in order, and the first one that answers wins:

1. **The picture header**, when the proxy sends one — `tailscale serve` injects the IdP's own avatar, which is the best picture of a person anybody here has.
2. **An avatar URL template**, `OLAI_IDENTITY_AVATAR_TEMPLATE`, with `{login}` where the login goes. This is the answer for a proxy that hands over a *username*: GitHub serves every user's avatar, unauthenticated, at `https://github.com/<user>.png`, so a Caddy + GitHub-OAuth deployment (whose `X-Auth-Request-User` is the GitHub username) needs no API and no token.
3. **The gravatar of the email claim**, and only when that claim really looks like an address — which is what stops `srid@github` from hashing into a picture of nobody.
4. **Nothing**, which is the silhouette, drawn by the page itself with no request to anywhere.

```sh
# A GitHub-backed TAILNET: tailscale serve injects the picture header
# itself (rung 1), and the template is what pictures anybody it has no
# picture for.
OLAI_IDENTITY_AVATAR_TEMPLATE='https://github.com/{login}.png'
```

```sh
# Caddy + oauth2-proxy against GitHub, where the login IS the username.
# Turn the Tailscale defaults OFF: that proxy does not strip inbound
# `Tailscale-*` names, and a name olai still trusts is one a client can
# send — the picture one especially, since it becomes an <img src>.
OLAI_IDENTITY_LOGIN_HEADER=X-Auth-Request-User
OLAI_IDENTITY_EMAIL_HEADER=X-Auth-Request-Email
OLAI_IDENTITY_NAME_HEADER=X-Auth-Request-Preferred-Username
OLAI_IDENTITY_PICTURE_HEADER=
OLAI_IDENTITY_AVATAR_TEMPLATE='https://github.com/{login}.png'
```

The picture is a remote `<img>` on the app page, and **whose host that is belongs to whoever deployed this olai** — an IdP's avatar host, the template's host (`github.com` redirects to `avatars.githubusercontent.com`), or gravatar. None of them is knowable when the page is built, so the page's content policy admits `https:` images: still no `http:`, no `data:`, no wildcard, and the `src` can only ever be what this server answered (the chip reads it off the websocket upgrade; `GET /olai/who` is the same JSON for a share sheet or a script). Sealed `/media` pages carry their own, stricter, policy and are unaffected.

**Trust.** These headers are only meaningful when the proxy is the only way in: olai bound to loopback or the tailnet, **and the proxy stripping client-supplied copies of the same names**. That is the same bargain on the websocket upgrade as on `GET /olai/who` — a client dialling the listener directly can send the header itself, and the upgrade will hand it on as faithfully as a proxy's own. Anything that can reach the port can send them — the same bargain the rest of the unauthenticated listener already takes. Do not expose this port to the internet.

That rule covers **every name still in force, including the ones you did not configure**. Each variable left unset keeps its Tailscale default, so a serve that renames only the login and the email still trusts `Tailscale-User-Name` and `Tailscale-User-Profile-Pic` — and a proxy that is not `tailscale serve` usually passes inbound `Tailscale-*` headers straight through. The picture one is the sharp edge, because it becomes an `<img src>` the browser fetches: on any proxy but `tailscale serve`, **set `OLAI_IDENTITY_PICTURE_HEADER=` (and `OLAI_IDENTITY_NAME_HEADER=`) empty, or strip those names at the proxy** — the same as it must already do for the login.

### Logging

It says what it is doing on stdout, one line per event, quietly: the address it bound, the agents it detected, the chat's lifecycle (a conversation opened, a prompt sent, a turn that ended or failed, the agent process itself coming and going), and anything that went wrong.

Two knobs, both environment variables, both facts of the running instance rather than of a browser:

| variable | what it picks | default |
|---|---|---|
| `OLAI_LOG` | the face: `logfmt` or `pretty` | pretty on a TTY, logfmt everywhere a machine reads (piped, systemd, tests) |
| `OLAI_LOG_LEVEL` | the minimum level: `debug`, `info`, `warn`, `error` | unset — Effect's `--log-level` applies, default `info` |

**When `OLAI_LOG_LEVEL` is set, it wins.** When it is unset, `olai web --log-level warn` quiets Info, as Effect's CLI always did. A systemd unit cannot pass that flag without rewriting argv, which is why the env var exists. Setting both is env-wins, not a merge.

`OLAI_LOG_LEVEL=debug` turns on the rest, including everything the agent itself writes to its stderr — which is where opencode dumps JSON-RPC errors. A failed turn already surfaces that stderr at `warn`, so a silent send is diagnosable from the journal at the default level; debug is the live feed.

The home-manager module's `logLevel` option sets `OLAI_LOG_LEVEL` on the user unit:

```nix
services.olai.logLevel = "debug";   # debug | info | warn | error — omit and the process stays at info
```

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

**The one thing a user service does NOT inherit is your PATH**, and that is where agents live. Olai looks for the ones it knows when it starts — the pinned Claude Code adapter it ships with, and an `opencode` on its own search path — and a unit started by systemd sees neither your login shell nor your profile. So an `opencode` you can run in a terminal is not necessarily one this process can find, and `OLAI_AGENT_PATH` is how you say where to look:

```nix
  systemd.user.services.olai.Environment = [
    "OLAI_AGENT_PATH=${config.home.homeDirectory}/.nix-profile/bin"
  ];
```

Set, it REPLACES the search path rather than adding to it — including when it is set to the empty string, which is "look nowhere". The other variable is `OLAI_ACP_AGENT`: it points the Claude side at a different ACP executable, and setting it to the empty string turns the chat panel off entirely (nothing is probed, and the panel says so rather than disappearing). Both are [chat.md](chat.md)'s, which says what the panel does with each.

**And the agent olai spawns inherits olai's environment — not yours.** Finding an agent is only half of starting one. A chat agent is a child of this process, so the variables it reads are the ones the *unit* was given. An agent whose config resolves a provider key out of the environment (opencode's `"apiKey": "{env:JUSPAY_API_KEY}"` is the shape) finds nothing unless olai itself was started with that key — and what that looks like in the panel is nothing at all: the agent takes the prompt, answers that the turn is over, and streams no error anywhere. Olai names it rather than drawing it as an ordinary turn — a notice saying the agent ended the turn without saying anything and to check its provider key, with the banner left up ([chat.md](chat.md)). `environmentFile` is where the key goes (Linux only; launchd has no equivalent, and the module refuses the option there rather than quietly ignoring it):

```nix
  services.olai.environmentFile = "${config.home.homeDirectory}/.config/olai/env";
```

Keep that file out of the nix store and `chmod 600`, one `NAME=value` per line. It is read when the unit starts, so a new key needs `systemctl --user restart olai`.

On Linux the unit is `Restart=always` / `RestartSec=1s` / `SuccessExitStatus=130`. A stray `kill -TERM` of the main pid is a successful exit that systemd still brings back; a `systemctl --user stop olai` is a systemd stop, which `Restart=` never overrides. On macOS the agent is `KeepAlive.SuccessfulExit=false` and `Crashed=true` — a 130 exit already restarts there, because launchd treats non-zero as unsuccessful. The 2026-08-20 incident (an outside SIGTERM, `on-failure` + `SuccessExitStatus=130`, hours of dark ledger) is [the RCA](RCA/2026-08-20-olai-service-sigterm.md).

## The git policy

Whether what is waiting records itself, and whether a commit is pushed, are facts about the DIRECTORY ([git.md](git.md)) — the server's, the same in every browser, and remembered across restarts.

They used to be preferences of one BROWSER, stored there and sent nowhere, which is exactly right for one person on one machine and exactly wrong for everything else: whether a branch is pushed is not a thing one colleague's laptop gets to decide for everybody else, "whichever browser happened to have the toggle on" is not a policy, and a directory nobody had a tab open on recorded nothing at all.

So the two preference rows set this server's policy, through a procedure, and every tab draws that one answer. It is remembered under the XDG state directory — `$XDG_STATE_HOME/olai/git/<digest of the served path>.json` — keyed by the directory and owner-only. There is deliberately no settings file IN THE VAULT: a file there would travel with `git pull`, so a personal clone of a team's outlines would inherit the team's auto-push, which is exactly the accident this prevents. (Nothing else olai keeps for itself goes in the vault either — the one-brain lock is under `$XDG_RUNTIME_DIR`, for the same reason.)

**And an operator may take the rows away entirely**, which is what the flags are for: given, a flag pins that row read-only for everybody.

```
olai web ~/outlines --commit=auto --push=off
```

```nix
services.olai = {
  enable = true;
  dataDir = "${config.home.homeDirectory}/outlines";
  commit = "auto";   # off | manual | auto — omit and the rows stay live
  push = "off";      # off | auto          — omit and the rows stay live
};
```

**Giving a flag is what pins it.** With neither given — the default, and every single-user deployment — nothing about this is visible: the server commits manually and the two git rows are live in every browser, each of them setting this same server's policy. Given, the server tells every browser which flag it was started with, and that row is drawn in the pinned state, **read-only, naming the flag**: *Set by the server: `--commit=auto`.* Never hidden, and never overridable from a browser — a policy a reader cannot see is one they cannot ask anybody about, and the procedure behind the row refuses a pinned half rather than quietly doing nothing.

The two are independent, so pinning committing does not silently pin pushing. `--commit=manual` typed out loud is not the same as saying nothing, even though this server behaves identically either way: the first freezes the row for everybody, the second leaves it to whoever is looking. A flag wins over whatever was remembered for its half and leaves the other half exactly where a reader put it — so a server restarted without the flag hands the remembered choice back.

`--commit` is the same flag [git.md](git.md#modes) describes, with the same three modes; `--no-commit` is `--commit=off` and pins in the same way. `--commit=auto` is the quiet window: everything waiting records itself once writes stop arriving for fifteen seconds, with or without a browser in front of it. It is no longer one commit per write — that mode is retired, and the per-write commit with it.

**`--push` governs the SERVER**, which it did not use to. It is Auto-push — whether a settled commit is pushed to the branch's upstream — and it follows **every** commit olai makes here, whichever door made it: the Commit button, an agent's `commit` tool, and the window's own. So `olai web ~/outlines --commit=auto --push=auto` with no tab open anywhere really does record and share; before, it recorded and shared nothing, and the unpushed count grew with no way to find out why. One round trip per commit, which is affordable exactly because the window makes a burst of writes one commit. `--push` has two values and deliberately not three: a branch that is not pushed on its own is pushed by the Push button, so there is no third thing to be.

**A refused commit or push pauses the loop**, and that is runtime state rather than policy: git said no, and nothing starts the loop again on olai's own initiative. The one gesture that does is **Resume**, under the Git commit row, drawn only while the loop is actually stopped — on every deployment, pinned or not.

That pause is a fact about the DIRECTORY, held by the server. A reload does not clear it, a second tab does not clear it, and turning the row off and on again does not clear it; pressing Resume clears it for every reader at once. It used to live in the tab that made the attempt, which meant a reload was a silent retry, a second tab knew nothing about the stop, and a headless serve had no loop to stop.

**Restarting the process is the one thing that does clear it.** Nothing about a refusal is remembered — the file above holds the policy and nothing else — so a `systemctl restart`, a deploy or a crash brings up a server with no stop and no words. That is deliberate for the stop: a restart is an operator's act where a reload is not. It would be wrong for the WORDS on their own, because the unit restarts on its own and the count would go quiet again — so **a boot re-earns them**: with `--push=auto` and commits the upstream does not have, the server makes one push at startup (the same bare `git push`, never a force, never a pull) and whatever git answers is on the chip at once. With `--push=off`, with nothing to send, or on a branch with no upstream at all, a boot attempts nothing — a branch nobody has ever pushed is not a branch that is behind.

Theme, typeface, size, note density, finished work and hidden outlines are untouched by any of this. They are personal view choices, per browser, and there is nothing about them for a server to have an opinion on.

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

There is no write CLI, and there never will be — no shell command adds a node or marks one. The write surfaces are a page, an HTTP POST at `/mcp`, and the one-line capture door below; they are three clients of one server, over one ops layer.

## Quick capture, over HTTP

A thought that arrives while you are somewhere else — a phone, a terminal, a mail client on another machine — should cost five seconds and no context switch. `POST /capture` is that door: one line, into the directory's inbox, from anything that can make an HTTP request on the tailnet.

```sh
curl -X POST http://olai.your-tailnet.ts.net/capture \
  -H 'Tailscale-User-Login: you@example.com' \
  -H 'content-type: application/json' \
  -d '{"title":"look into the new cabinets","text":"the joinery place off Main","url":"https://example.com/cabinets"}'
```

```json
{"id":"a1b2c3","title":"look into the new cabinets","file":"_olai/Inbox.olai",
 "why":"waiting to be committed: writes accumulate under --commit=manual (the default) until the Commit button asks for one"}
```

**Four fields, and no target.** `title` is the row (required). `text` becomes the note. `url` goes under it as a link — a markdown autolink, so a scheme markdown would not have linked for itself still lands as a link; the characters a URI may not carry (`<`, `>`, a space) are percent-encoded on the way in, and everything else survives byte for byte, so an address you already encoded is not encoded twice. `props` are named facts the capture is born with, exactly `add_node`'s ([format.md](format.md#properties)). There is no way to say *where* — a capture lands at the top level of the inbox, and where it belongs is a decision you make in the app afterwards, which is what an inbox is for.

**It lands in the inbox the directory has**, wherever you keep one, and mints `_olai/Inbox.olai` when there is none — the same convention `⌘K` `+` follows, resolved on the server against the same reading the write is judged on ([editing.md](editing.md#quick-capture)). It is the same write as everything else: the same validation, the same all-or-none rename, the same `--commit` mode. A refused capture leaves nothing behind, not even the inbox it would have minted.

**And it arrives dated**, so it is on the day's journal page as well as in the inbox — which is the half a capture made while nobody was looking actually needs. A date with no mark is an *occurrence*: it is on the day, and it is never overdue ([format.md](format.md#status)). The stamp is the server's local time with its offset written out, so it names one instant — a phone several zones away capturing near midnight lands on the day the vault is on, not the day the phone is on.

### Auth is the tailnet; the CSRF gate is the content type

An identity header is **required**, and it is the same one the header chip reads (`who.get` off the upgrade; `GET /olai/who` for a door with no websocket) — `Tailscale-User-Login` by default, or whatever `OLAI_IDENTITY_LOGIN_HEADER` names, so a vault behind a different proxy configures it once and both doors follow. `tailscale serve` injects it in front of the process, so there is no token to mint, nothing secret to paste into a share sheet, and no client to re-issue when a key rotates. A request that carries no identity is refused, naming the header actually in force. The login is recorded on the captured node as a `captured-by` property, so `prop:captured-by=you@example.com` finds what you sent from your phone — and a client that tries to send that property itself is refused rather than quietly overruled.

What the header does **not** do is authenticate. It is a claim the transport in front makes, so anything that can reach the port can make it too — the same bargain the rest of the listener already takes. Put olai behind `tailscale serve`, or leave it on loopback. Do not expose this port to the internet.

**And it is not a CSRF gate.** This page used to say it was, and behind the very deployment it recommends the opposite is true: `tailscale serve` *strips* a client's `Tailscale-*` headers and injects its own, so a browser on your tailnet does not need to name the header — the proxy names it. A page on another site could otherwise have written into your vault with a request that carries nothing of its own, because `POST` with a safelisted `text/plain` body is a *CORS-simple* request: there is no preflight to fail, and CORS hides only the response, not the write.

So the gate is **`Content-Type: application/json`, required, and checked before the body is read**. That type is not CORS-safelisted, so a cross-origin `fetch` sending it must preflight — and the preflight is answered `404` with no `Access-Control-Allow-*`, so the real request never leaves the browser. The three types a browser *will* send without a preflight (`text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`), and no content type at all, are refused `415`. This costs a real client nothing: every recipe below already sends the header, because it is already sending JSON. A charset parameter is fine.

Beside it, a request whose `Sec-Fetch-Site` says it came from another site is refused `403`. That header is one a page cannot forge (it is a forbidden header name) and one a browser stamps on everything; `curl`, a Shortcut and a Raycast script send none at all, so its **absence** is never a refusal.

```
tailscale serve --bg 7714
```

Name the origin you serve from in `OLAI_ALLOWED_ORIGINS` while you are there, or the browser's websocket will be refused ([above](#behind-a-reverse-proxy)).

### Client recipes

None of these is a thing olai ships; each is a few lines somebody writes once.

**Mail.app, via Raycast or a script (macOS).** The point of the mail case is that there is no mail infrastructure in it: AppleScript asks Mail for the selected message, and what olai keeps is the *pointer*. The message stays in Mail; the vault holds the link, your comment, and enough of the sender and subject to find it again.

One script, because the AppleScript values have to reach the shell — `osascript` prints them, tab-separated, and `read` takes them apart:

```sh
#!/usr/bin/env bash
set -euo pipefail
OLAI=${OLAI:-http://olai.your-tailnet.ts.net}
comment=${1:-}   # whatever you want to say about it; Raycast passes an argument

IFS=$'\t' read -r mid subj who < <(osascript <<'APPLESCRIPT'
tell application "Mail"
  set m to item 1 of (get selection)
  return (message id of m) & tab & (subject of m) & tab & (sender of m)
end tell
APPLESCRIPT
)

curl -fsS -X POST "$OLAI/capture" \
  -H "Tailscale-User-Login: $(whoami)@example.com" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$subj" --arg c "$comment" --arg u "message://<$mid>" \
           --arg f "$who" --arg m "$mid" \
           '{title:$t, text:$c, url:$u, props:{from:$f, "message-id":$m}}')"
```

The `message://<Message-Id>` link **is** the attachment. Write it exactly like that — a `Message-Id` is conventionally in angle brackets, and the endpoint percent-encodes the characters a URI may not carry before it puts the address in the note. Clicking it in olai opens Mail at that message: the router hands any address that is not one of this app's to the browser, and the browser hands an unknown scheme to the OS.

Sending the `Message-Id` as a property is what makes de-duplication one query — `prop:message-id=<abc@mail>` before you POST, and you know whether you have captured this thread already ([search.md](search.md)).

**Known caveat:** `message:` links are solid on macOS. On iOS, third-party-composed ones do not always resolve. The subject and the sender in the capture are what keep it findable when the link does not open, which is why the recipe sends them rather than relying on the pointer alone.

**Apple Shortcuts (iOS and macOS share sheet).** A shortcut that accepts URLs and text, and ends in *Get Contents of URL* — `POST`, the two headers, a JSON body built from *Shortcut Input*. Put it on the share sheet and every app on the phone can capture. *Get Article using Safari Reader* in front of it gives a read-later pipeline: the article's text as the note, its URL as the pointer.

**Anything else, same endpoint.** A browser bookmarklet, an Android share via the installed PWA, a `curl` in a script that notices something. The `curl` above is the reference client; there is no SDK and there is not going to be one.

**Files are not in this door yet** — a photo or a PDF is a separate piece of work, because writing binary into the vault is a path olai does not have (only chat attachments, which land in a tmp directory, and `.md` documents). Capture the link to it for now.

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
{"id":"a1b2c3","title":"look into the new cabinets","file":"_olai/Inbox.olai","committed":false,
 "why":"waiting to be committed: writes accumulate under --commit=manual (the default) until the Commit button asks for one"}
```

**Four fields, and no target.** `title` is the row (required). `text` becomes the note. `url` goes under it as a link — a markdown autolink, so a scheme markdown would not have linked for itself still lands as a link; the characters a URI may not carry (`<`, `>`, a space) are percent-encoded on the way in, and everything else survives byte for byte, so an address you already encoded is not encoded twice. `props` are named facts the capture is born with, exactly `add_node`'s ([format.md](format.md#properties)). There is no way to say *where* — a capture lands at the top level of the inbox, and where it belongs is a decision you make in the app afterwards, which is what an inbox is for.

**It lands in the inbox the directory has**, wherever you keep one, and mints `_olai/Inbox.olai` when there is none — the same convention `⌘K` `+` follows, resolved on the server against the same reading the write is judged on ([editing.md](editing.md#quick-capture)). It is the same write as everything else: the same validation, the same all-or-none rename, the same `--commit` mode. A refused capture leaves nothing behind, not even the inbox it would have minted.

**And it arrives dated**, so it is on the day's journal page as well as in the inbox — which is the half a capture made while nobody was looking actually needs. A date with no mark is an *occurrence*: it is on the day, and it is never overdue ([format.md](format.md#status)). The stamp is the server's local time with its offset written out, so it names one instant — a phone several zones away capturing near midnight lands on the day the vault is on, not the day the phone is on.

### Auth is the tailnet, and the header is the whole of it

`Tailscale-User-Login` is **required**. `tailscale serve` injects it in front of the process, so there is no token to mint, nothing secret to paste into a share sheet, and no client to re-issue when a key rotates. The login is recorded on the captured node as a `captured-by` property, so `prop:captured-by=you@example.com` finds what you sent from your phone — and a client that tries to send that property itself is refused rather than quietly overruled.

Requiring a header is also what keeps a page you are reading from writing into your vault: a cross-origin `fetch` cannot set one without a preflight this server does not answer, and a form post cannot set one at all.

What it does **not** do is authenticate. The header is a claim the transport in front makes, so anything that can reach the port can make it too — the same bargain the rest of the listener already takes. Put olai behind `tailscale serve`, or leave it on loopback. Do not expose this port to the internet.

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

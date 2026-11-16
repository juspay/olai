# Point an agent at a running olai

An agent outside olai (a coding agent in a terminal, a script, a cron job)
talks to a running server over MCP at `/mcp`. It gets the same verbs the agent
panel's agents have. The panel's own agents are [chat.md](chat.md).

## There is one writer

`olai web` owns the directory and every write goes through it. The write
surfaces are a page and `/mcp`. There is no stdio face and no second process:
`olai surface` opens no directory, it speaks MCP to a running server and sends
the same verbs an agent sends.

## Configure an MCP client

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

`7714` is the deployment port: the home-manager module binds it, so an agent
configured this way talks to the user service ([deploying.md](deploying.md)).
A server started with `--port 0` announces its bound address on the `serving`
line, and a restart may land on a new port
([running.md](running.md#flags)).

A request from `127.0.0.1` needs no credential. The chat panel still sends the
bearer it was handed, which is accepted and ignored. A request from anywhere
else is refused without that token.

> Unattended agent runs need the server up. Whatever the agent is doing, it is
> a client of one running olai, and there is nothing to fall back on.

## Call a verb from a terminal

```sh
olai surface --url http://127.0.0.1:7714 outlines read a1b2c3
olai surface --url http://127.0.0.1:7714 search nodes --text 'is:todo prop:pr'
olai surface list --url http://127.0.0.1:7714   # every row, verb and readable member
```

Every verb an agent has is a verb here, behind the plugin that owns it:
`olai surface outlines read` is the agent's `outlines_read`, and
`olai surface markdown write` is `markdown_write`. A plugin that is switched
off has no subcommand at all.

`olai surface --help` is the documentation. It lists the plugins, grouped as
**Capture**, **Outlines and documents**, **Search**, **Files**, **The vault
itself** and **This face**. `olai surface <plugin> --help` lists that plugin's
verbs with an example each, and `olai surface <plugin> <verb> --help` gives one
verb's flags.

| Flag | What it does |
| --- | --- |
| `--url <server>` | the olai to call: the address a browser opens. Required on every call, with no default and no remembered directory |
| `--json` | print a write's whole record instead of its one line |

`--url` is on `list` too, although `list` dials nothing and answers off the
projection itself. The flag is uniform, so a script looping over the verbs does
not break on the one that would have refused it.

`watch` and `--follow` are not offered. The door answers one request with one
answer and pushes nothing, so there is no subscription to have. A page in a
browser is what watches a directory change.

### What you get back

A write prints one line: where it landed, and a link to the row it made. Every
other answer is JSON on stdout already. A refusal goes to stderr, also as JSON.

| Exit | Means |
| --- | --- |
| `0` | it worked |
| `1` | the server refused it, and said why on stderr |
| `2` | the command was wrong and never left this process |
| `3` | nothing is serving at `--url` |
| `130` | `Ctrl` + `C` |

### Calling it from somewhere else

Locally the server admits loopback with no credential. Off loopback, set
`$OLAI_TOKEN` to the server's bearer, which the client sends. It does not
configure the server's own token: the server mints that per process.

Through a reverse proxy, the login the proxy injects is the authentication,
exactly as it is for the page ([deploying.md](deploying.md)):

```sh
olai surface --url https://olai.example.ts.net capture add "look into the new cabinets"
```

`captured-by` is written from the identity the door has, and omitted when it
has none. So `prop:captured-by=srid@github` finds what you captured through the
tailnet. A caller cannot send it: a capture takes a title and a note, so there
is nowhere to put one.

## Capture a line from a terminal

`olai surface capture add` puts one line into the directory's inbox:

```sh
olai surface capture add "look into the new cabinets" \
  --text "the joinery place off Main" \
  --url http://127.0.0.1:7714
```

```
captured into /home/srid/vault — http://127.0.0.1:7714/_olai/Inbox.olai#a1b2c3
```

`title` is the row, required, and the one argument that is positional. `--text`
becomes the note. There is no way to say where it goes: a capture lands at the
top level of the inbox, which is what an inbox is for, and you file it in the
app afterwards.

It lands in the Inbox convention directly under `_olai/`, minted as
`_olai/Inbox.olai` when there is none — the same convention the palette's
**Capture to the Inbox** follows ([getting-around.md](getting-around.md)). It
is the same write as any other: the same validation, the same all-or-none
rename, the same git policy. A refused capture leaves nothing behind, not even
the inbox it would have minted.

It arrives dated, on the vault's own clock with its offset, so it is on the
day's journal page as well as in the inbox. The date and the capture's `todo`
mark compose into work you owe ([dates-and-status.md](dates-and-status.md)):
the row ticks that day's **Agenda** count when it lands, and shows as overdue
from the next morning.

## Client recipes

None of these is something olai ships; each is a few lines you write once.

### Capture the selected message in Mail.app

There is no mail service to deploy. AppleScript asks Mail for the selected
message, and olai keeps what you would look for later: the subject, the sender
and the `Message-Id`, in the note. `OLAI_URL` here is a variable of your own;
the flag is what the binary reads.

```sh
#!/usr/bin/env bash
set -euo pipefail
comment=${1:-}   # whatever you want to say about it; Raycast passes an argument
olai_url=${OLAI_URL:-https://olai.example.ts.net}

IFS=$'\t' read -r mid subj who < <(osascript <<'APPLESCRIPT'
tell application "Mail"
  set m to item 1 of (get selection)
  return (message id of m) & tab & (subject of m) & tab & (sender of m)
end tell
APPLESCRIPT
)

olai surface --url "$olai_url" capture add "$subj" \
  --text "$comment

from: $who
message-id: <$mid>
message://<$mid>"
```

The `message://<Message-Id>` line is the attachment, and it is in the note
because that is the one field a capture has for it. Clicking it in olai opens
Mail at that message: the router hands any address that is not this app's to
the browser, which hands an unknown scheme to the operating system. Write it
inside `<`…`>` so the note's markdown makes a link of it.

Finding the thread again is a text search for the `Message-Id`, which is in the
note ([search.md](search.md)):

```sh
olai surface --url http://127.0.0.1:7714 search nodes --text '"<abc@mail>"'
```

> `message:` links are solid on macOS. On iOS, ones composed by another app do
> not always resolve. The subject and the sender in the note are what keep the
> message findable when the link does not open.

### A phone

A phone cannot run this binary. Capture through the web page instead: the
palette's **Capture to the Inbox**, which is the same write
([getting-around.md](getting-around.md)). An MCP client on the phone is the
other way in.

### Anything else

A cron job, a script that noticed something, a shell function: the same verb.
`olai surface --help` lists every verb the server offers. There is no SDK;
`jq` is the client library.

Files are not in this door. A photo or a PDF has no path into the directory, so
capture a link to it in the note.

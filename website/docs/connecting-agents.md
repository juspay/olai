# Point an agent at a running olai

An agent outside olai talks to a running server over MCP at `/mcp`.[^outside]
It calls the same tools olai's own agents do.[^panel]

## Every write goes through the server

`olai web` owns the directory, and every write goes through it.[^writer]

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

`7714` is the port the home-manager module uses.[^port] A request from
`127.0.0.1`, this machine, needs no token.[^token]

> An agent working on its own needs the server running. Whatever it is doing,
> it is talking to one running olai, and there is nothing else for it to fall
> back on.

## Call one of olai's tools from a terminal

```sh
olai surface --url http://127.0.0.1:7714 outlines read a1b2c3
olai surface --url http://127.0.0.1:7714 search nodes --text 'is:todo prop:pr'
olai surface list --url http://127.0.0.1:7714   # every plugin, subcommand and value you can read
```

Each plugin brings its own subcommands, and every tool an agent can call is
one of them.[^verbs] `olai surface --help` lists them all.[^help]

| Flag | What it does |
| --- | --- |
| `--url <server>` | which olai to call: the address you would open in a browser. Required on every call, with no default |
| `--json` | print a write's whole record instead of its one line |

### What you get back

A write prints one line: where the row landed, and a link to it. Every other
answer is already JSON on stdout. A refusal goes to stderr, also as JSON.

| Exit | Means |
| --- | --- |
| `0` | it worked |
| `1` | the server refused it, and said why on stderr |
| `2` | the command was wrong and never left this process |
| `3` | nothing is serving at `--url` |
| `130` | `Ctrl` + `C` |

## Capture a line from a terminal

```sh
olai surface capture add "look into the new cabinets" \
  --text "the joinery place off Main" \
  --url http://127.0.0.1:7714
```

```
captured into /home/srid/vault — http://127.0.0.1:7714/_olai/Inbox.olai#a1b2c3
```

That line goes into the directory's inbox, the file where captured rows
land,[^capture] with the date the server's own clock gives it.[^dated]

## Write your own small clients

olai ships no scripts of this kind. Each one is a few lines you write
once.[^recipes]

[^outside]: An agent outside olai means a coding agent you run in a terminal,
    a script of your own, or a cron job.

[^panel]: olai's own agents are the ones you chat with in the page. What they
    are, and how you talk to them, are [chat.md](chat.md).

[^writer]: There are two ways in, the page and `/mcp`, and both go through the
    running server. There is no way in over stdio and no second process:
    `olai surface` opens no directory of its own, it speaks MCP to a running
    server, and it sends exactly what an agent sends.

[^port]: The home-manager module starts olai on port `7714`, so an agent
    configured this way talks to that user service
    ([deploying.md](deploying.md)). A server started with `--port 0` prints the
    address it got on the `serving` line, and a restart can land on a different
    port ([running.md](running.md#flags)).

[^token]: A conversation in the page sends the token it was given, which the
    server accepts and ignores. A request from any other address is refused
    unless it carries that token. Calling the server from another machine is
    the closed block at the foot of this page.

[^verbs]: `olai surface outlines read` is the tool an agent calls as
    `outlines_read`, and `olai surface markdown write` is `markdown_write`. A
    plugin that is switched off has no subcommand at all.

    There is no `watch` and no `--follow`. The server answers one request with
    one answer and sends nothing after that, so there is nothing to subscribe
    to. A page open in a browser is what watches a directory for changes.

[^help]: `olai surface --help` lists the plugins, in the groups **Capture**,
    **Outlines and documents**, **Search**, **Files**, **The vault itself** and
    **This face**. `olai surface <plugin> --help` lists that plugin's
    subcommands with an example each, and
    `olai surface <plugin> <verb> --help` gives one subcommand's flags.

    `--url` is on `list` as well, even though `list` calls no server and
    answers from what the command itself knows. The flag is the same
    everywhere, so a script that loops over the subcommands does not break on
    the one that would have refused it.

[^capture]: `title` is the row's text. It is required, and it is the only
    argument you give without a flag. `--text` becomes the note under the row.
    You cannot say where the row goes: a capture always lands at the top level
    of the inbox, and you file it in the app afterwards.

    The inbox is the file `_olai/Inbox.olai`, which olai creates when there is
    none. The palette's **Capture to the Inbox** writes to the same file
    ([getting-around.md](getting-around.md)).

[^dated]: A capture is an ordinary write: the same checks, the same
    all-or-nothing replacement of the file, the same git policy. A capture that
    is refused leaves nothing behind, not even the inbox file it would have
    created.

    The date the server writes carries its own time zone offset, so the row
    shows on that day's journal page as well as in the inbox. A capture also
    arrives with the mark **To do**, so the row counts towards that day's
    **Agenda** when it lands and reads as overdue from the next morning
    ([dates-and-status.md](dates-and-status.md)).

[^recipes]: A cron job, a script that noticed something, a shell function:
    each one calls the same subcommands, and `olai surface --help` lists every
    one the server offers. There is no SDK, and `jq` is all you need to read
    the answers. Files do not go through this door, so a photo or a PDF has no
    way in: capture a link to it in the note instead.

<details>
<summary>Calling olai from another machine</summary>

On the same machine, the server accepts a request from `127.0.0.1` with no
token at all. From anywhere else, set `$OLAI_TOKEN` to the server's token and
the client sends it. That variable does not tell the server which token to
use: the server makes a new one each time it starts.

Through a reverse proxy, the login the proxy adds is what identifies you,
exactly as it does for the page ([deploying.md](deploying.md)):

```sh
olai surface --url https://olai.example.ts.net capture add "look into the new cabinets"
```

olai writes the `captured-by` property from the identity it has, and leaves it
out when it has none. So a search for `prop:captured-by=srid@github` finds
what you captured through the tailnet. You cannot send that property yourself:
a capture takes a title and a note, and nothing else.

</details>

<details>
<summary>Capture the message selected in Mail.app</summary>

There is no mail service to set up for this. An AppleScript asks Mail for the
message you have selected, and the capture keeps what you would look for
later: the subject, the sender and the `Message-Id`, in the note. `OLAI_URL`
below is a variable of your own, and `--url` is what the olai command reads.

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

The `message://<Message-Id>` line stands in for the attachment, and it is in
the note because the note is the only place a capture has for it. Clicking it
in olai opens Mail at that message: olai hands any address that is not one of
its own to the browser, and the browser hands a scheme it does not know to the
operating system. Write the address inside `<`…`>` so that the note's markdown
turns it into a link.

To find the thread again, search for the `Message-Id` as text, since it is in
the note ([search.md](search.md)):

```sh
olai surface --url http://127.0.0.1:7714 search nodes --text '"<abc@mail>"'
```

> `message:` links work reliably on macOS. On iOS, a link composed by another
> app does not always open. The subject and the sender in the note are what
> keep the message findable when the link does not open.

</details>

<details>
<summary>Capturing from a phone</summary>

A phone cannot run the `olai` command. Capture through the web page instead,
with the palette's **Capture to the Inbox**, which makes exactly the same
write ([getting-around.md](getting-around.md)). An MCP client on the phone is
the other way in.

</details>

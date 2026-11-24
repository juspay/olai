# Serve a directory with olai web

`olai web <directory>` serves one directory of outlines to a browser.[^name]
This page is its flags, the dot in the header, and its log.[^new]

## Run it

```sh
nix run github:juspay/olai -- web ~/notes
```

olai reads the directory and every folder under it,[^read] and the page keeps
up with the files on disk.[^disk] A clone of olai's repository has `just`
recipes for developers.[^just]

## Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `<directory>` | required | the directory to serve |
| `--port` | `0`, which asks the operating system for a port | the `TCP` port to listen on |
| `--host` | `127.0.0.1` | the network interface to listen on |
| `--profile` | `web` | which set of plugins to start[^profile] |

Give `--port` a fixed number when you deploy olai.[^port]

> `--host` binds to `127.0.0.1`, your own machine, because olai asks for no
> password: anyone who can reach the port can read and change every outline it
> serves. Put a proxy in front to reach it from elsewhere
> ([deploying.md](deploying.md)).

## The coloured dot in the header

One dot in the header shows whether anything needs your attention.[^covers]
Click it for a list with one line per thing it reports on.[^popover]

| Colour | Means |
| --- | --- |
| green | all is well |
| amber | something wants attention[^amber] |
| red | something is broken: the server restarted, the page and the server are different versions, or a fault |

## When the connection drops

The page freezes behind a card, a box drawn over it, until the connection
returns.[^cards] Other cards ask you to click **Reload**.[^reload] The server's
log says why.[^why]

## Logging

The server writes one line per event to stdout.[^lines][^slow] Set how much it
writes, and in which format, on the top-level `olai` node of the settings file
`_olai/Settings.olai`:

```jsonl
{"id":"olai","ord":"a0","title":"olai","custom":{"log-level":"debug","log-format":"logfmt"}}
```

| Key | Values | Default |
| --- | --- | --- |
| `log-level` | `debug`, `info`, `warn`, `error` | `info` |
| `log-format` | `auto`, `logfmt`, `pretty` | `auto`, pretty on a terminal and logfmt elsewhere |

olai picks both up while it runs, with no restart.[^live]

[^name]: The page names itself after the computer it runs on: `olai [machine]`
    in the tab title, in the name in the header, and in the name of an
    installed app. Run olai on a laptop and on a server, and you can tell the
    two apart wherever you meet them. The name is the computer's hostname, and
    setting the `OLAI_HOSTNAME` variable replaces it.

[^new]: New to olai? Start at [start.md](start.md). How to stop the server,
    and what happens when you start a second olai over the same directory, are
    in the closed blocks at the foot of this page.

[^read]: An outline is a `.olai` file of rows that you can nest under one
    another. olai reads every outline and every `.md` document in the
    directory and in the folders under it. It does not look inside folders
    whose name starts with a dot, or inside `node_modules`, so nothing in
    `.git` is served. The directory must already exist: `olai web` refuses a
    path that does not.

[^disk]: Save a file in another program, run `git pull`, or copy a new outline
    into the directory, and the open page shows the change straight away. You
    install nothing in the browser.

[^just]: In a clone of olai's repository, running `just` lists the recipes
    developers use. `just run` serves this repository's own docs on a port the
    operating system picks. `just serve docs` does the same and also rebuilds
    the browser code as you edit it.

[^profile]: A profile is a named set of plugins to start. `--profile web`
    starts the browser page, the websocket that updates it and the MCP
    endpoint agents call. `--profile surface` opens the directory and MCP, with
    no browser files and no websocket. `--profile test-minimal` opens the
    directory and the part that reads its settings, and listens on no port.

    Which plugins run is not a flag: it is set in the directory's own settings
    file, `_olai/Settings.olai` ([settings.md](settings.md)), and so are the
    git policy and the log level.

[^port]: The home-manager module starts olai with port `7714`
    ([deploying.md](deploying.md)). With `--port 0`, the operating system picks
    the port, so a restart can land on a different one and you have to read the
    address off the `serving` line each time.

[^covers]: The dot reports on the connection to the server, on git's Commit
    row, and on each running integration, meaning a plugin that reports on
    another service it talks to. A line with nothing wrong and nothing
    running, such as `Not a git folder` or `No kolu`, stays quiet and never
    colours the dot. The dot's tooltip, which screen readers also read out,
    says `Status: all good` or `Status: <news> · <news>`.

[^amber]: The dot turns amber when writes are waiting to be committed, when a
    watcher has gone quiet, or when a connection is re-dialling.

[^popover]: Click the dot, or press `Tab` until you reach it and press `Enter`.
    The worst lines come first, red down to quiet, and the last two lines are
    how long the server has been running and a **Plugins** row. A plugin that
    is switched off has no line. On a phone the header has no dot: a banner
    under the bar carries the news, and the Preferences and Plugins rows sit at
    the foot of the sidebar drawer.

[^cards]: The card says `Connection lost` and then `Reconnecting…`. Wait, and
    the page starts working again on its own. The very first connection says
    `Connecting…` instead.

[^reload]: The card `The server restarted` / `Reload the page to keep working.`
    means a reload is the only way on. The card `Something went wrong on this
    page` / `Your files are safe. Reload to try again.` offers **Reload** and
    **Go home**, and hides the technical text in a closed `Details` block.

[^why]: Each browser tab sends the server what it saw of its connection, and
    the server logs each entry with `side=browser`. A `wire dropped` line names
    a `cause`, and carries a `tab` and a `dial` that match the server's own
    `tab disconnected` line for the same connection. The closed block at the
    foot of this page lists every cause.

[^lines]: The log says which address the server is listening on, which agents
    it found on this machine, and anything that went wrong. It also follows a
    chat: a conversation opening, a prompt sent, a turn that ended or failed,
    and the agent's own process starting and stopping. The closed block at the
    foot of this page says what one line holds.

[^slow]: A note shaped to be slow, such as a quote nested hundreds of levels
    deep, holds up the server while it is read. The log names, at the `warn`
    level, any file that took half a second or more to read.

[^live]: olai rereads both keys while it runs, so you never restart it. Until
    the directory is open, the server uses the defaults in the table above. You
    can also edit both in the **Server** section at the foot of the plugins
    panel, with the same controls as any other plugin setting
    ([settings.md](settings.md)).

<details>
<summary>One olai per directory</summary>

Only one server can serve a directory at a time. Start a second olai over the
same directory and it still shows its plugins panel, but the row for the
directory itself, called the vault row, refuses to open it:

```
$ olai web ~/notes
ERROR: VaultInUse: another olai is serving this directory (pid 48219) — one brain per vault
```

`48219` is the process id of the server that already has the directory, so
`ps 48219` tells you which one it is. Reaching the same directory through a
symlink is still the same directory, because olai claims the place the files
are. A refusal that names no process id means the same thing.

The claim is an advisory lock, a marker the operating system keeps for as long
as the process lives. olai puts it outside your notes, in
`$XDG_RUNTIME_DIR/olai/` or `/tmp/olai-$UID/`, and the kernel drops it when the
process ends. After a crash there is nothing to clean up, and no file is left
inside your directory.

Two things the lock does not stop:

- Another program writing the same files: your editor, `git pull`, an agent
  writing by hand. The page shows those writes like any other.
- Serving a directory that sits inside another one. `olai web ~/notes` and
  `olai web ~/notes/projects` count as two directories, so both servers start
  and both write the outlines they share. Serve one or the other.

A server that cannot claim the directory still serves its plugins panel and
its MCP endpoint. Its vault row reads **failed** and shows the sentence naming
the server that holds the directory, and every tool that needs the directory
disappears from the list of tools agents can call. Once the other server
stops, switch that row off and on again to retry.

</details>

<details>
<summary>Every line you see when you click the dot</summary>

- the connection to the server: `Connected`, `Connecting…`, `Reconnecting…`,
  `Partly connected`, which means some updates are not arriving, or
  `The server restarted`;
- git's Commit row, which opens the commit panel ([git.md](git.md));
- one row for each running integration;
- how long this server has been running, as in `Running for 2h`, with
  `Running since <instant>` on its tooltip;
- the **Plugins** row, which shuts that list and opens the plugins panel
  ([settings.md](settings.md)). `Escape` shuts that panel and puts the keyboard
  focus back on the dot.

</details>

<details>
<summary>What a log line holds, at each level and format</summary>

On a terminal olai keeps each line short: the fields sit inline, session
identifiers are shortened, and the directory's path appears only on a change
to the directory, a warning or an error. An error still carries its full chain
of causes, on indented lines below it.

When you pipe the output elsewhere, the logfmt format keeps the full path and
the full session annotations. At the `debug` level olai also logs the path and
arguments of every command it runs, the tool checks that succeeded, and
whatever an agent writes to its own stderr.

</details>

<details>
<summary>Why a connection dropped: every cause</summary>

A `wire dropped` line in the server's log has one of these as its `cause`:

| `cause` | What happened |
| --- | --- |
| `peer-closed` | the server or the network closed the connection; `code` and `means` say how |
| `frame-over-cap` | the server sent the tab a message over 16 MiB, more than a tab accepts; the server also logs `sent a frame larger than a tab accepts` |
| `half-open` | the connection stayed open but nothing came back, so the tab gave up on it after about 25 seconds |
| `roster-refresh` | olai reconnected because a plugin was switched on or off |
| `redial` | olai connected again with a new set of plugins |
| `unload` | the tab was closing |
| `severed` | the tab closed the connection for a reason only its connection code saw, such as a message it could not read; `heard` quotes what the page's updates were told |

- `roster-refresh`, `redial` and `unload` are ordinary, so they appear only at
  the `debug` level.
- A connection that keeps dropping the same way is logged in full the first
  three times and then every tenth time, with `streak` counting the drops.
- Other lines from the tab: `dial did not open`, `heartbeat gave up`,
  `connection-lost card shown` and `connection-lost card lifted`.

</details>

<details>
<summary>How to stop it, and the signals it refuses</summary>

`Ctrl` + `C` writes `olai web: received SIGINT` to stderr and exits with code
130, which the user service olai ships counts as a clean stop. That line is
how you tell, in the log, a server killed by a signal from one you stopped on
purpose.

On Linux olai obeys a `SIGTERM`, the polite request to shut down, only when it
comes from the service manager that started it, from the kernel telling it its
parent died, or from olai itself. It refuses every other one and says so on
stderr:

```
olai web: refused SIGTERM from pid N uid U (cmdline…)
```

The server keeps serving after a refusal, so a stray `pkill -f` does not take
it down. No process can refuse a `SIGKILL`, so `kill -9`, a service manager
running out of patience while stopping it, and the out-of-memory killer all
still end it. If olai cannot set this guard up, it says so once at startup and
`SIGTERM` works as it normally would.

olai stops with the program that started it only when that program asked for
it, by setting `OLAI_DIE_WITH_PARENT` to its own process id before starting
olai. That way a wrapper script can start olai and then exit: `olai web … &`
from a script that returns, `setsid`, or a double fork.

</details>

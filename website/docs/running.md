# Serve a directory

`olai web <directory>` serves one directory of outlines to a browser.[^name]
This page is its flags, its health dot and its log.[^new]

## Run it

```sh
nix run github:juspay/olai -- web ~/notes
```

The directory is read recursively,[^read] and the page follows the
disk.[^disk] A clone of the repository has developer recipes too.[^just]

## Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `<directory>` | required | the directory of outlines, read recursively |
| `--port` | `0`, which asks the OS for a port | the `TCP` port to listen on |
| `--host` | `127.0.0.1` | the interface to bind |
| `--profile` | `web` | which bundle of plugins to mount[^profile] |

A fixed port is a deployment's word.[^port]

> `--host` is loopback by default because the surface is unauthenticated:
> anyone who can reach the port can read every outline under the directory,
> and change one. Put a proxy in front to reach it from elsewhere
> ([deploying.md](deploying.md)).

## The health dot

One dot in the header covers everything that reports on the server.[^covers]

| Colour | Means |
| --- | --- |
| green | all is well |
| amber | writes waiting to be committed, a quiet watcher, a re-dialling connection |
| red | a restart under the tab, a version skew, a fault |

Click the dot for a popover with one row per readout.[^popover]

## When the connection drops

The page freezes under a card and thaws by itself when the connection
returns.[^cards] Two cards want a **Reload**.[^reload]

## Logging

The server says what it is doing on stdout, one line per event.[^lines] Set the
level and the format on the top-level `olai` node of `_olai/Settings.olai`:

```jsonl
{"id":"olai","ord":"a0","title":"olai","custom":{"log-level":"debug","log-format":"logfmt"}}
```

| Key | Values | Default |
| --- | --- | --- |
| `log-level` | `debug`, `info`, `warn`, `error` | `info` |
| `log-format` | `auto`, `logfmt`, `pretty` | `auto`, pretty on a terminal and logfmt elsewhere |

Both follow the file live.[^live]

[^name]: The page names itself after the machine: `olai [machine]` in the tab
    title, in the header's wordmark and in an installed app's name. Run olai on
    a laptop and on a server and the two are distinct everywhere you meet them.
    The name is the machine's hostname, and `OLAI_HOSTNAME` overrides it.

[^new]: New to olai? [start.md](start.md) serves a directory, writes a line
    into it and lets git record it. Stopping the server, and what one directory
    does with a second olai over it, are in the closed blocks at the foot of
    this page.

[^read]: The directory is read recursively: every `.olai` outline and every
    `.md` document. olai does not descend into dot-directories or
    `node_modules`, so nothing inside `.git` is served. The directory must
    already exist; `olai web` refuses a path that does not.

[^disk]: The page follows the disk. Save a file, `git pull`, or drop in a new
    outline, and the page updates in place. Nothing is installed in the
    browser.

[^just]: In a clone of the repository, `just` lists the developer recipes.
    `just run` serves this repository's docs on an OS-assigned port, and
    `just serve docs` does the same plus a client-bundler watch for the edit
    loop.

[^profile]: `--profile web` mounts the browser, the websocket and the MCP
    endpoint. `--profile surface` opens the directory and MCP without browser
    assets or a websocket. `--profile test-minimal` opens the directory and its
    settings reader with no listener. Which plugins run is not a flag: it is
    the directory's own policy, in `_olai/Settings.olai`
    ([settings.md](settings.md)), and so are the git policy and the log level.

[^port]: The home-manager module passes `7714`. With `--port 0`, a restart may
    land on a new port, so read the address off the `serving` line each time.

[^covers]: The health dot covers the connection, git's Commit row, and each
    running integration's readout. A readout with nothing wrong and nothing
    running, such as `Not a git folder` or `No kolu`, is quiet and never
    colours the dot. Its accessible name and tooltip say what is wrong in the
    readout's own words: `Status: all good`, or `Status: <news> · <news>`.

[^popover]: Click the dot, or Tab to it and press `Enter`. Rows stand worst
    first, red through quiet, with the uptime line and the **Plugins** row
    last. A plugin that is switched off has no row. A phone's header has no
    dot: it shows a banner under the bar when there is news, and the
    Preferences and Plugins doors are rows at the foot of the sidebar drawer.

[^cards]: The card says `Connection lost` / `Reconnecting…` while olai
    re-dials, and the page thaws on its own. The first connect says
    `Connecting…`.

[^reload]: `The server restarted` / `Reload the page to keep working.` is
    recovered by a reload and nothing else. `Something went wrong on this page`
    / `Your files are safe. Reload to try again.` offers **Reload** or **Go
    home**, with the technical text inside the closed `Details` disclosure.

[^lines]: The log names the address it bound, the agents it detected, and
    anything that went wrong. Chat's lifecycle is there too: a conversation
    opening, a prompt sent, a turn that ended or failed, and the agent process
    coming and going. What a line looks like is in the closed block at the foot
    of this page.

[^live]: Both keys follow the file live, with no restart. Before the directory
    is open, the process uses the defaults. The **Server** section at the foot
    of the plugins panel edits both with the same controls as any plugin
    setting ([settings.md](settings.md)).

<details>
<summary>One olai per directory</summary>

A directory has one active server over it. A second process keeps its plugins
panel, but its vault row refuses the directory:

```
$ olai web ~/notes
ERROR: VaultInUse: another olai is serving this directory (pid 48219) — one brain per vault
```

That is the pid of the server that already holds it, so `ps 48219` says which
one. A symlinked spelling of the same directory is the same directory: the
claim is on where the files are. A refusal naming no pid means the same thing.

The claim is an advisory lock held outside your notes, in
`$XDG_RUNTIME_DIR/olai/` or `/tmp/olai-$UID/`, and the kernel releases it when
the process ends. There is nothing to clean up after a crash and no file left
inside the directory.

Two things the lock does not cover:

- Another program editing the same files — your editor, `git pull`, an agent
  writing by hand. The page follows those.
- A directory inside a directory. `olai web ~/notes` and
  `olai web ~/notes/projects` are two directories, so both start and both write
  the outlines they share. Serve one or the other.

If another olai holds the directory, this process still serves its panel and
its MCP endpoint, with the vault row **failed** and the lock holder's sentence
on it. Vault-backed tools leave the catalog. Once the other server stops,
switch that row off and on to retry.

</details>

<details>
<summary>Every row of the health popover</summary>

- the connection: `Connected`, `Connecting…`, `Reconnecting…`,
  `Partly connected` (some updates are not arriving), or
  `The server restarted`;
- git's Commit row, which opens the commit panel ([git.md](git.md));
- each running integration's row;
- how long this server process has been running, `Running for 2h`, with
  `Running since <instant>` on its tip;
- the **Plugins** row, which shuts the popover and opens the plugins panel
  ([settings.md](settings.md)). `Escape` shuts the panel and puts the caret
  back on the dot.

</details>

<details>
<summary>What a log line carries, at each level and format</summary>

Terminal output is compact: inline fields, short session identifiers, and a
root path on directory changes, warnings and errors. Errors keep their full
causes on indented lines. Piped logfmt keeps the full root and session
annotations. At `debug` you also get command paths, arguments, successful tool
probes and the agent's stderr feed.

</details>

<details>
<summary>Stopping it, and the signals it refuses</summary>

`Ctrl` + `C` writes `olai web: received SIGINT` to stderr and exits 130, which
the shipped user service counts as success. That line is what lets a journal
tell a signalled death from a deliberate stop.

On Linux, a `SIGTERM` is honoured only from this process's supervisor, from the
kernel's parent-death signal, or from the process itself. Everything else is
refused and named on stderr:

```
olai web: refused SIGTERM from pid N uid U (cmdline…)
```

The server keeps serving through a refusal, so a stray `pkill -f` does not take
it down. A `SIGKILL` is uncatchable by any process, so `kill -9`, a stop
timeout's escalation and the out-of-memory killer still end it. If the guard
cannot arm, the server says so once at boot and `SIGTERM` keeps its default
handling.

A server stops with the process that spawned it only when that spawner asked
for it, by setting `OLAI_DIE_WITH_PARENT` to its own pid before the spawn. So a
wrapper can start olai and exit: `olai web … &` from a script that returns,
`setsid`, a double fork.

</details>

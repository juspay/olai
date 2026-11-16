# Serve a directory

`olai web <directory>` opens one directory of outlines and serves it to a
browser. This page is its flags, what the health dot in the header tells you,
and what the server writes to its log. New to olai? Start at
[start.md](start.md).

## Run it

```sh
nix run github:juspay/olai -- web ~/notes
```

In a clone of the repository, `just` lists the developer recipes:

```sh
just run            # this repo's docs, on an OS-assigned port
just serve docs     # the same, plus a client-bundler watch for the edit loop
```

The directory is read recursively: every `.olai` outline and every `.md`
document. olai does not descend into dot-directories or `node_modules`, so
nothing inside `.git` is served. The directory must already exist; `olai web`
refuses a path that does not.

The page follows the disk. Save a file, `git pull`, or drop in a new outline,
and the page updates in place. Nothing is installed in the browser.

## Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `<directory>` | required | the directory of outlines, read recursively |
| `--port` | `0`, which asks the OS for a port | the `TCP` port to listen on |
| `--host` | `127.0.0.1` | the interface to bind |
| `--profile` | `web` | which bundle of plugins to mount |

`--profile web` mounts the browser, the websocket and the MCP endpoint.
`--profile surface` opens the directory and MCP without browser assets or a
websocket. `--profile test-minimal` opens the directory and its settings reader
with no listener.

Which plugins run is not a flag. It is the directory's own policy, in
`_olai/Settings.olai` ([settings.md](settings.md)), and so are the git policy
and the log level.

> `--host` is loopback by default because the surface is unauthenticated:
> anyone who can reach the port can read every outline under the directory, and
> change one. To reach it from elsewhere, put a proxy in front
> ([deploying.md](deploying.md)).

A fixed port is a deployment's word: the home-manager module passes `7714`.
With `--port 0`, a restart may land on a new port, so read the address off the
`serving` line each time.

## One olai per directory

A directory has one active server over it. A second process keeps its plugins
panel, but its vault row refuses the directory:

```
$ olai web ~/notes
ERROR: VaultInUse: another olai is serving this directory (pid 48219) — one brain per vault
```

That is the pid of the server that already holds it, so `ps 48219` says which
one. A symlinked spelling of the same directory is the same directory: the
claim is on where the files are. A refusal naming no pid means the same thing.

The claim is an advisory lock held outside your notes, in `$XDG_RUNTIME_DIR/olai/`
or `/tmp/olai-$UID/`, and the kernel releases it when the process ends. There
is nothing to clean up after a crash and no file left inside the directory.

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

## What it calls itself

The page names itself after the machine: `olai [machine]` in the tab title, in
the header's wordmark and in an installed app's name. Run olai on a laptop and
on a server and the two are distinct everywhere you meet them. The name is the
machine's hostname, and `OLAI_HOSTNAME` overrides it.

## The health dot

One dot in the header covers everything that reports on the server: the
connection, git's Commit row, and each running integration's readout.

| Colour | Means |
| --- | --- |
| green | all is well |
| amber | something wants attention: writes waiting to be committed, a watcher gone quiet, a connection re-dialling |
| red | something is broken: the server restarted under the tab, a version skew, a fault |

A readout with nothing wrong and nothing running, such as `Not a git folder` or
`No kolu`, is quiet and never colours the dot. Its accessible name and tooltip
say what is wrong in the readout's own words: `Status: all good`, or
`Status: <news> · <news>`.

Click the dot, or Tab to it and press `Enter`, for a popover with one row per
readout. Rows stand worst first, red through quiet, with the uptime line and
the **Plugins** row last. A plugin that is switched off has no row.

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

A phone's header has no dot. It shows a banner under the bar when there is
news, and the Preferences and Plugins doors are rows at the foot of the sidebar
drawer.

## When the connection drops

The page freezes under a card saying `Connection lost` / `Reconnecting…`, and
thaws by itself when the connection returns. The first connect says
`Connecting…`.

| Card | What to do |
| --- | --- |
| `Connection lost` / `Reconnecting…` | wait; it thaws on its own |
| `The server restarted` / `Reload the page to keep working.` | press **Reload**: only a reload recovers that one |
| `Something went wrong on this page` / `Your files are safe. Reload to try again.` | press **Reload** or **Go home**; the technical text is inside the closed `Details` disclosure |

## Logging

The server says what it is doing on stdout, one line per event: the address it
bound, the agents it detected, and anything that went wrong. Chat's lifecycle
is there too: a conversation opening, a prompt sent, a turn that ended or
failed, and the agent process coming and going.

Terminal output is compact: inline fields, short session identifiers, and a
root path on directory changes, warnings and errors. Errors keep their full
causes on indented lines. Piped logfmt keeps the full root and session
annotations. At `debug` you also get command paths, arguments, successful tool
probes and the agent's stderr feed.

Set the policy on the top-level `olai` node of `_olai/Settings.olai`:

```jsonl
{"id":"olai","ord":"a0","title":"olai","custom":{"log-level":"debug","log-format":"logfmt"}}
```

| Key | Values | Default |
| --- | --- | --- |
| `log-level` | `debug`, `info`, `warn`, `error` | `info` |
| `log-format` | `auto`, `logfmt`, `pretty` | `auto`, which picks pretty on a terminal and logfmt elsewhere |

Both follow the file live, with no restart. Before the directory is open, the
process uses the defaults. The **Server** section at the foot of the plugins
panel edits both with the same controls as any plugin setting
([settings.md](settings.md)).

### Stopping it

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

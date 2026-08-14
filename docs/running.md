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
shown — stored in the browser and sent nowhere; `⌘K` opens a command palette, where
the keyboard-shortcut list also lives, where a zoomed node's own verbs are
offered, and where `+ a line` captures that line to the directory's inbox
without leaving the page ([docs/editing.md](editing.md)). Search has a box in
the header and lives in that palette too — the same reading an agent's `search_nodes`
gets, jump on Enter; on a phone the header's magnifier opens the palette, and a
note you remember the sense of but not the words of is found by meaning and
marked `≈` ([docs/search.md](search.md)). It needs nothing installed — the
model that does the finding is in the binary's own closure.

### The processes it starts

`olai web` is not the only process in your process list once it is running,
and both of the others are things it shipped rather than things it found:

- **the chat agent** — the pinned Claude Code adapter, started with the server
  and spoken to over stdio. `OLAI_ACP_AGENT` names it; the empty string is the
  off switch, and turns the chat panel off ([chat.md](chat.md)).
- **the embedder** — a `llama-server` from `pkgs.llama-cpp` reading
  `bge-small-en-v1.5`, which is what makes search-by-meaning work
  ([search.md](search.md)). It starts the FIRST TIME something needs
  embedding, not at boot, so a serve whose index is already up to date and
  whose reader never searches by meaning never starts one at all. It listens
  on a unix socket in `$XDG_RUNTIME_DIR` — no TCP port, nothing the network
  can reach — and stops when olai stops. If the child dies on its own, the
  next search starts a new one (no faster than once every 15 seconds, so a
  model server that cannot start does not get respawned on every keystroke).
  If olai itself is `kill -9`'d the child cannot be told to stop, so the next
  `olai` you start sweeps it up.

  **How much memory:** it depends on what has been embedded, not just on
  being up. Measured on x86_64-linux: **~30–66 MB shortly after it starts**
  (one reviewer's machine reported the low end, this one the high end), rising
  to **~158 MB** while indexing a corpus of 148 essay-length notes and staying
  there for the life of the process. About 54 MB of that is the memory-mapped
  weights, which the kernel can reclaim under pressure. `--ctx-size` does not
  move it — 512, 2048 and 8192 all measured the same.

### `olai mcp` starts the embedder too

The list above is written for `olai web`, but it is not a property of that
face. `olai mcp` — the stdio server an agent starts for itself — opens the
**same** index, so it lazily spawns an embedder of its own on the same terms.

That means a machine can hold **several at once**: one per running olai
process, including two over the same directory if `olai web` is up and an
agent starts `olai mcp` beside it. Nothing is shared between them, because
nothing about them is a singleton — each is a child of the process that
started it and dies with it. This is said out loud rather than left to be
discovered: the reason this feature was rebuilt at all is that an earlier
version left a model server running and did not mention it.

`OLAI_RECALL=off` turns the embedder off entirely, on either face: search goes
back to matching the letters you type, which is exactly what it did before,
and nothing reports a missing feature. `OLAI_EMBED_SERVER` and
`OLAI_EMBED_MODEL` name the two halves — a nix-built olai bakes both in, and
setting either to the empty string is the same off switch by another door.

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

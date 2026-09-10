# Running olai

How to serve a directory and configure the server. The git story is [git.md](git.md); the agent is [chat.md](chat.md); the format is [format.md](format.md).

## `olai web`

`olai web <directory>` accepts `--host`, `--port`, and `--profile`. These choices precede opening the vault. Policy and enablement live in `_olai/Settings.olai`; there are no git-policy or plugin-selection flags.

`--profile web` (the default) mounts the bundle's defaults, including browser, websocket and MCP transports. `--profile surface` opens the vault and MCP without browser assets or a websocket. The settings reader belongs to both profiles. `--profile test-minimal` opens the vault and its settings reader, with no listener. Profiles patch build enablement before any file is read.

Turning `mcp` off withdraws its endpoint and closes its protocol server. Changing `web-app` replaces asset routes without disconnecting existing sockets. Turning `ws` off drains its connections and removes browser control: restore its `on` property in the file to reconnect. A restart reads that same durable choice.

```sh
nix run github:juspay/olai -- web path/to/outlines
```

or, in a clone:

Run `just` to list developer recipes with a short description of each command.

```sh
just run            # the one brain: this repo's docs, on an OS-assigned port
just serve docs     # the same, plus a client-bundler watch for the edit loop
```

The flake lists [cache.nixos.asia/oss](https://cache.nixos.asia/oss) as a substituter, and a GitHub Actions job on every push builds every flake output on linux and darwin and pushes the closures there. `nix run github:juspay/olai` and a clone's `nix build` / `nix develop` should download rather than compile; if they compile, that commit has not been warmed yet.

In a clean, pushed development checkout, `just ci` builds the checkout's pinned Odu and runs the complete `check` graph on the Linux host pool. Odu owns the fan-out, E2E sharding, live progress, and GitHub status posting; `ODU_CI_TIMEOUT` overrides the 15-minute watch timeout.

Use `just typecheck-fast-remote` for typechecking, `just test-fast-remote` for
unit tests, or `just e2e-fast-remote` for browser tests through the same Odu
pipeline via `nix run .#odu`. These commands appear together in the `fast-remote`
help group. They snapshot the working tree, including uncommitted edits, new
non-ignored files and deletions; ignored files and `.ci/` are excluded. Each
worker receives the same content commit, recorded as `contentSha` alongside
the base `sha`. Fast checks never post GitHub statuses, even for clean trees;
use `just ci` for committed-HEAD CI attribution. An unchanged rerun has the
same `contentSha` and can reuse worker object caches. Each selects its existing CI leaf, including
its prerequisites, with up to six available slots. Their ten-minute watch timeouts
can be overridden with `ODU_TYPECHECK_REMOTE_TIMEOUT`, `ODU_TEST_REMOTE_TIMEOUT`
and `ODU_E2E_REMOTE_TIMEOUT`. The shared Odu service owns the run: Ctrl-C or
a timeout stops watching while remote work continues. Use
`nix run .#odu -- cancel --run <id>` to cancel the run explicitly, or
`nix run .#odu -- wait --run <id>` to resume watching.
CI also shards `typecheck` across up to six slots by workspace package; each
package still runs its complete check, including imported types. Ordinary local
`just typecheck` and `just test` remain unsharded. For local test logs, use
`just test > .test.log 2>&1` and inspect the saved output.

Unit-test shards place the longest estimated files first. The existing
`scripts/test-shard.sh` keeps rounded timings for the 16 slow files from the
passing `0342dac6c` run and estimates other files at 0.1s. Git determines which
files run; missing or stale timing hints affect balance, never coverage.

A worktree launch builds the pinned adapters and odu on demand (`nix build .#acp-agent`, `.#codex-agent`, `.#odu-bin`) and `just install` runs `npm ci` in `acp/`. Each of those prints the command on stderr before it starts; `npm ci` then logs every fetch (`--loglevel=http`) because `nix develop -c` is not a TTY and npm would otherwise sit silent until it finished.

`olai web <dir> [--port] [--host]` reads the directory recursively, picking up every `.olai` outline and every `.md` document, and serves them to a browser. It does not descend into dot-directories or `node_modules` — a directory of outlines is usually a git repository, and nothing anyone wrote is inside `.git`. Defaults: port `0` (the OS picks one), host `127.0.0.1`. A fixed `--port` is a deploy's word — the home-manager module passes `7714` ("olai" on a phone keypad). `--port 0` asks the OS every boot: a `just run` / `just serve` restart may land on a new port.

If a directory that used to serve comes up EMPTY, its outlines predate the rename to `.olai`: [format.md](format.md) carries the one-line `git mv` to run on it. olai reads the one extension and migrates nothing for you.

It binds to loopback by default because the surface is unauthenticated: anyone who can reach the port can read every outline under the directory — and, since the keyboard editor arrived, change one.

The page it serves follows the disk — save a file, `git pull`, drop in a new outline, and it updates in place — and a pill in its header is green only while a server is actually answering; drop the connection and the app freezes under an overlay that says so, thawing by itself when the wire comes back; restart the server under an open tab and that overlay offers a reload, because nothing else recovers that one. Beside the committed pill a quiet chip says how long THIS process has been up (`up 2h`, the start instant on the chip) — the server's start, ticked in the tab; the page that loads after that reload reads `up 12s` because it is a new page against a new process. It reads on a phone and installs as one (there is no offline mode, on purpose — a cached copy of an outline is a copy that has stopped being true; the one service worker an installed olai registers caches nothing and is there so the agent can tell you it is waiting on you). A ⚙ in the header (or, on a phone, at the foot of the directory drawer) opens the preferences — one of the named palettes, the typeface, how big the page is set, how much of a row is drawn by default, whether finished work is drawn — the panel's word is the default, hidden until somebody says otherwise, and a page says it beside its own filter — whether the agent stopping on a question reaches you when you are not looking and whether that makes a sound ([docs/chat.md](chat.md#when-it-is-waiting-on-you)), stored in the browser and sent nowhere. Git policy belongs to the vault and can be edited on the plugins panel. A `⧉` beside it (on a phone, another row in that same drawer) opens the plugins panel — which integrations this server is running, why each is in the state it is in, and a switch per row that moves the running serve ([below](#which-integrations-this-serve-runs)); `⌘K` opens a command palette, where the keyboard-shortcut list also lives, where a zoomed node's own verbs are offered, and where `+ a line` captures that line to the directory's inbox without leaving the page ([docs/editing.md](editing.md)). Search has a box in the header and lives in that palette too — the same reading an agent's `search_nodes` gets, jump on Enter; on a phone the header's magnifier opens the palette ([docs/search.md](search.md)). It needs nothing installed.

### One olai per directory

A directory has one active vault row over it. A second process keeps its panel available, but its vault row refuses the directory:

```
$ olai web ~/notes
ERROR: VaultInUse: another olai is serving this directory (pid 48219) — one brain per vault
```

It is the pid of the server that already has it, so `ps 48219` says which one — and `kill` it, or open the tab it is already serving, whichever you meant. A symlinked spelling of the same directory is the same directory: the claim is on where the files actually are, not on how you typed it.

A refusal that names no pid means the same thing: the claim is the kernel's, and only the number — which olai will not print unless it names a process that is really there — was missing.

This is a refusal rather than a warning because two olai over one directory cannot be made safe. Writes are whole-file: each server stages a copy and renames it over the destination, so nothing is ever torn, and the second write erases the first wholesale with both reporting success. Validation is per-server, so two edits that are each valid alone put duplicate ids and dependency cycles on disk that neither would have accepted. And if commits are on, two `git add -A` runs interleave in one work tree.

The claim is an OS advisory lock (`flock`), held in `$XDG_RUNTIME_DIR/olai/` — or `/tmp/olai-$UID/` on a machine without one — and the KERNEL releases it when the process ends, however it ends. A graceful stop also unlinks the lock file; a crash cannot, and the next boot sweeps leftovers (a `.lock` nothing holds, and the retired rendezvous `.sock` files of #175/#184 — `surface.sock` is skipped because reverted #352-era binaries still hold that name). A lock another olai is holding is never unlinked, even if its recorded root cannot be stat'd: that is the two-brains race. There is no stale lock to clear after a crash, nothing to delete before restarting, and no file left inside your notes directory. If a machine ever refuses to serve a directory nothing is serving, that is a bug and not a lock you should go and remove.

What it does not cover:

- **Another program editing the files** — your editor, `git pull`, an agent writing by hand. Those are the ordinary case, the page follows them, and they are not a second brain.
- **A second olai on ANOTHER MACHINE** over the same network share, which no advisory lock promises on both Linux and macOS.
- **A directory inside a directory.** `olai web ~/notes` and `olai web ~/notes/projects` are two different directories, so both start — and over the outlines they share, they are two brains with everything above back in play. Serve one or the other, not both.

### What it calls itself

The page names itself after the machine it is running on: `olai [machine]` — in the tab's title, in the header's wordmark, and in an installed app's name (`/manifest.webmanifest`, which is why it is served and not a static file). Run olai on a laptop and a NUC and the two are visually distinct everywhere a person meets them. The name is the machine's `os.hostname()`; `OLAI_HOSTNAME` overrides it, which is what a test harness pins — not a knob most deployments will want.

### Behind a reverse proxy

Put it behind a reverse proxy or `tailscale serve` and the browser's origin will not be the `Host` it forwards, so name the origins you are serving from in `OLAI_ALLOWED_ORIGINS` (comma-separated); the websocket refuses the rest.

### Who is looking

A reverse proxy in front of olai can say who made the request. olai trusts **one configurable family of header names** — a login, and optionally an email, a display name and a picture — and the header bar draws who is looking as an icon, top right, in the same chip as prefs: **anonymous** when no login came (direct access, a local `just run`), the person when one did, or that the door failed. The words are the tooltip, and they say the display name with the login beside it (`Sridhar Ratnakumar (srid@github)`) — on a shared vault, which account this is is the whole question. Absence is a face, not a missing chip.

All of that is a **plugin** — the `identity` row, on by default ([plugins/identity.md](plugins/identity.md)). A serve with `on: no` on its identity node reads no headers at all: every request is nobody, a capture records no `captured-by`, and there is no chip in the bar — not an anonymous one, an absent one. Header names are properties of the `identity` node in `_olai/Settings.olai`; edits reapply the row.

Default wiring is `tailscale serve`'s own four headers. **The login is not necessarily an email**: on a Google, Microsoft or Okta tailnet `Tailscale-User-Login` *is* the address, which is why the email claim defaults to the same header — but on a GitHub- or passkey-backed one it reads `srid@github`, which is Tailscale's spelling of that account and not an address anybody can hash. The same family covers other proxies — one feature, not one per proxy:

| Proxy | login | email | name | picture |
|---|---|---|---|---|
| `tailscale serve` (default) | `Tailscale-User-Login` | `Tailscale-User-Login` | `Tailscale-User-Name` | `Tailscale-User-Profile-Pic` |
| Caddy + oauth2-proxy | `X-Auth-Request-User` | `X-Auth-Request-Email` | `X-Auth-Request-Preferred-Username` | — (use a template) |
| Caddy + caddy-security (`inject headers with claims`) | `X-Token-User-Nick` (or `-Name`) | `X-Token-User-Email` | `X-Token-User-Name` | `X-Token-User-Picture`, where that claim is injected — otherwise a template |
| Authelia | `Remote-User` | `Remote-Email` | `Remote-Name` | — (use a template) |
| Pomerium (`jwt_claims_headers`) | `X-Pomerium-Claim-User` | `X-Pomerium-Claim-Email` | `X-Pomerium-Claim-Name` | `X-Pomerium-Claim-Picture`, where the operator mapped that claim — otherwise a template |

Pomerium's `pass_identity_headers` forwards `X-Pomerium-Jwt-Assertion`, which is a signed JWT and not a login; the unsigned `X-Pomerium-Claim-*` headers this family reads come from `jwt_claims_headers`, and each one is only there if that claim was mapped.

For Authelia, put this top-level namespace in `_olai/Settings.olai`:

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"login-header":"Remote-User","email-header":"Remote-Email","name-header":"Remote-Name","picture-header":""}}
```

Absent properties use the schema defaults. Blank `login-header` restores the default; blank `email-header` follows the configured login header. Blank `name-header` or `picture-header` disables that claim. The login makes somebody present; the other claims may be missing. A capture's `captured-by` is the login on that request. A direct loopback call with no proxy headers carries no attribution.

#### The picture, and where it comes from

Four rungs, in order, and the first one that answers wins:

1. **The picture header**, when the proxy sends one — `tailscale serve` injects the IdP's own avatar, which is the best picture of a person anybody here has.
2. **An avatar URL template**, `avatar-template` on the identity node, with `{login}` where the login goes. This is the answer for a proxy that hands over a *username*: GitHub serves every user's avatar, unauthenticated, at `https://github.com/<user>.png`, so a Caddy + GitHub-OAuth deployment (whose `X-Auth-Request-User` is the GitHub username) needs no API and no token.
3. **The gravatar of the email claim**, and only when that claim really looks like an address — which is what stops `srid@github` from hashing into a picture of nobody.
4. **Nothing**, which is the silhouette, drawn by the page itself with no request to anywhere.

A GitHub-backed tailnet can set `avatar-template: https://github.com/{login}.png` on the identity node. For Caddy + oauth2-proxy, configure all trusted names and disable the unused Tailscale picture header:

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"login-header":"X-Auth-Request-User","email-header":"X-Auth-Request-Email","name-header":"X-Auth-Request-Preferred-Username","picture-header":"","avatar-template":"https://github.com/{login}.png"}}
```

The picture is a remote `<img>` on the app page, and **whose host that is belongs to whoever deployed this olai** — an IdP's avatar host, the template's host (`github.com` redirects to `avatars.githubusercontent.com`), or gravatar. None of them is knowable when the page is built, so the page's content policy admits `https:` images: still no `http:`, no `data:`, no wildcard, and the `src` can only ever be what this server answered (the chip reads it off the websocket upgrade; `GET /olai/who` is the same JSON for a share sheet or a script). Sealed `/media` pages carry their own, stricter, policy and are unaffected.

**Trust.** These headers are only meaningful when the proxy is the only way in: olai bound to loopback or the tailnet, **and the proxy stripping client-supplied copies of the same names**. That is the same bargain on the websocket upgrade as on `GET /olai/who` — a client dialling the listener directly can send the header itself, and the upgrade will hand it on as faithfully as a proxy's own. Anything that can reach the port can send them — the same bargain the rest of the unauthenticated listener already takes. Do not expose this port to the internet.

That rule covers **every name still in force, including the ones you did not configure**. Each property left absent keeps its Tailscale default, so a serve that renames only the login and the email still trusts `Tailscale-User-Name` and `Tailscale-User-Profile-Pic` — and a proxy that is not `tailscale serve` usually passes inbound `Tailscale-*` headers straight through. The picture one is the sharp edge, because it becomes an `<img src>` the browser fetches: on any proxy but `tailscale serve`, **set `picture-header` (and `name-header`) empty, or strip those names at the proxy** — the same as it must already do for the login.

### Logging

It says what it is doing on stdout, one line per event, quietly: the address it bound, the agents it detected, the chat's lifecycle (a conversation opened, a prompt sent, a turn that ended or failed, the agent process itself coming and going), and anything that went wrong.

Terminal output is compact: inline fields, no fiber IDs, short session UUIDs, and a root path on directory changes and warnings/errors. Errors keep their full causes on indented lines. Piped logfmt retains full root/session annotations. Agent discovery lists names; command paths, arguments and successful tool probes are available at `debug`. The SIGTERM guard emits a short readiness marker on stderr.

Agent readiness and exit events carry a subprocess `pid`; lifecycle context includes `purpose` (`conversation` or `session list`) and `node` for a node-owned panel. An exit carries `expected=true` only when the app requested that subprocess's stop, with a specific `reason`: `agent switched`, `plugin disabled`, `session list complete`, `node scope handoff`, `idle eviction`, `capacity eviction`, or `shutdown` (`scope released` for acquisition cleanup). Unrequested exits say `process exited` or `process signaled`, with `expected=false` and the exit code or signal; this does not infer why the process chose to exit. Session context is captured before teardown clears it.

A conversation that opens, exits, and immediately opens again may be moving from the root panel into its owning node scope. The log now announces `moving conversation into node scope` before that handoff. Reopening supplies the node-scoped MCP credential; remembered node sessions route directly into their scope, and ordinary conversation changes on the same agent reuse its process.

Successful startup operations carry a rounded millisecond `duration`, measured with Effect v4's monotonic clock:

| event | measured interval | level |
|---|---|---|
| `chat agents detected` (or the no-agent result) | initial engine detection only; logged before chat startup | info |
| `chat agent ready` | subprocess startup through the ACP initialization handshake | info |
| `conversation opened` | new/load attempt, including tool probes and the ACP reply/replay; excludes process startup, later memory writes, model restoration and permission setup | info |
| tool probe result | that probe's own request, including a missing or not-running result | debug |

Kolu discovery only resolves its executable and forwards the socket setting; it does not launch an MCP process. A handed-over server is unconfirmed until the agent reports otherwise. Claude connection reports and Codex startup-failure events update the tool-server strip. Changed negative reports also produce `MCP server connection problem` warnings with the server and reason. Adapters without these reports leave status unconfirmed; daemon/tool errors remain visible in actual tool results.

Concurrent probe durations overlap; do not add them together. These are operation durations, not server uptime or a total time-to-interactive metric. Failed opens keep their existing failure logs and do not emit successful completion events.

At startup, chat reads the current vault before routing a remembered session. A session already assigned to a node opens directly with that node's tools, avoiding a second agent launch, session replay, and round of probes. A newly identified node can still require a `node scope handoff`. Optional tool configuration is collected afresh for each open. Kolu is resolved on PATH without a preflight MCP connection; odu retains its capability check.

Logging policy is on the top-level `olai` node of `_olai/Settings.olai`:

```jsonl
{"id":"olai","ord":"a0","title":"olai","custom":{"log-level":"debug","log-format":"logfmt"}}
```

`log-level` accepts `debug`, `info`, `warn`, or `error`, defaulting to `info`. Debug includes the agent's stderr feed; failed turns already report stderr at warn. `log-format` accepts `auto`, `logfmt`, or `pretty`; auto selects pretty on a TTY and logfmt elsewhere. Both follow revisions live, including existing callback emitters. Before the vault is available, the process uses defaults.

Expand **This serve** on `⧉` to edit Log level and Log format with the same controls as plugin settings. Both write the `olai` node and apply live without a restart. Hostname, host, bound port, allowed origins and bearer set/unset remain read-only, with their actual authors. The bearer value is never published there.

A SIGINT writes `olai web: received SIGINT` to stderr before the process unwinds. Effect still treats the interrupt as a successful stop and exits 130 — the shipped user unit counts 130 as success so `systemctl stop` is not a failed unit. That one line is what lets a journal tell a signaled death from a deliberate stop.

**A SIGTERM has a bouncer** (Linux — it is systemd's stop protocol; other platforms keep the plain disposition). The server catches it with `sigaction(2)` + `SA_SIGINFO`, which names the sender's pid and uid, and asks: is the sender this process's supervisor — the systemd user manager is the service's parent, and `systemctl stop|restart` is delivered as exactly that signal — or the kernel's parent-death answer to `PR_SET_PDEATHSIG`, which arrives with the DYING PARENT's pid (never si_pid 0 — measured), or the process itself? An honor also requires a kill-family si_code, which only the kernel can write — a `sigqueue`-supplied siginfo can claim any pid and is refused. Then TODAY'S shutdown runs, logged as `olai web: honoring SIGTERM from pid … uid … (…)` plus the `received SIGTERM` line above. **Everyone else is refused**: `olai web: refused SIGTERM from pid N uid U (cmdline…)` on stderr, and the server keeps serving — the pid and uid are recorded by the kernel at send time, so even a sender that exits instantly is named. Two limits are still the truth, said so the journal is never over-trusted: POSIX may coalesce standard signals queued faster than the drain polls them (25ms while the arm is young, 125ms once proven quiet), so a flood's line names the DELIVERY, not every sender; and a flood that outruns the refusal pipe drops records — that is counted and logged, and the dropped record can be the supervisor's stop, at which point the log line is honestly the guard's word rather than the kernel's. A stray `pkill -f` can use the right substring and the wrong fate: the 2026-08-29 incident (two agent-lane cleanups killed production in one morning) is [the RCA](https://github.com/juspay/oss.olai/blob/main/projects/olai/RCA/2026-08-29-production-sigterm.md). Two boundaries are by design: SIGKILL is uncatchable by any process — `kill -9`, TERM→KILL escalation after `TimeoutStopSec`, and the OOM killer are untouched — and root's TERM is refused like any other non-supervisor's, because nothing legitimate sends one. If the guard's machinery cannot arm (it compiles its handler — a few lines of C — with Bun's embedded compiler, and self-tests the round trip), the server says so once at boot and SIGTERM keeps its default handling.

**It does not stop because it was orphaned.** A server dies with its parent only when whoever spawned it *asked* to be died with, by setting `OLAI_DIE_WITH_PARENT` to its own pid before the spawn — the e2e harness, the process-boundary tests and the shell drivers in `packages/tests` do, because a runner that can be SIGKILLed needs a floor under its cleanup (a cancelled run used to leave a server per cancellation sitting on a `/tmp` directory that was already gone). Nothing else sets it, so **a daemonising wrapper can start olai and exit**: `olai web … &` from a script that returns, a recorder that starts a server and gets out of the way, a double fork, `setsid`. It was not always so. The guard read `getppid() == 1` as *I have been orphaned, so I should stop*, and a wrapper's whole job is to exit and leave the child running — so the child read PID 1 as its parent and terminated itself while perfectly healthy, which is how a demo recording lost its server mid-capture on 2026-08-23. The variable carries the spawner's pid rather than a bare yes because that pid is also the honest test for the one case the kernel's `PR_SET_PDEATHSIG` cannot cover — a parent that died before the signal was armed — and *the process that tied me to it is no longer my parent* is true whether the orphan landed on init or on a `PR_SET_CHILD_SUBREAPER` ancestor, where `getppid()` never reads 1 at all.

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

The module fills `package` from the flake for the host platform. The packaged binary already bakes the browser bundle (`OLAI_DIST_DIR`) and the pinned `odu` (put first on the server's own PATH, so the chat panel's CI probe resolves the build's binary and not a host's — [plugins/odu.md](plugins/odu.md)), so the service needs no ambient environment.

`OLAI_ODU_BIN` is the one knob over the last of those: it names a **directory** whose `odu` the serve puts first on its PATH instead of the pin — how you test a development odu against a packaged olai — and the empty string is the explicit off switch (the probe then answers from the ambient PATH, and a PATH with no `odu` draws the row under the roster — [chat.md](chat.md#when-a-tool-server-does-not-arrive)). The three adapter knobs beside it (`OLAI_ACP_AGENT`, `OLAI_ACP_CODEX`, `OLAI_ACP_PI`) name executable *files*; this one names the *directory* the way the pin's own `bin/` does.

**The one thing a user service does NOT inherit is your PATH**, and that is where some agents live. Olai looks for the ones it knows when it starts — the self-contained pinned Claude Code and Codex adapters, the pinned pi-acp adapter, and the agents on its own search path: an `opencode`, a `pi` — and a unit started by systemd sees neither your login shell nor your profile. So an `opencode` you can run in a terminal is not necessarily one this process can find, and `OLAI_AGENT_PATH` is how you say where to look:

```nix
  systemd.user.services.olai.Environment = [
    "OLAI_AGENT_PATH=${config.home.homeDirectory}/.nix-profile/bin"
  ];
```

Set, it REPLACES the search path rather than adding to it — including when it is set to the empty string, which is "look nowhere". The adapter variables are `OLAI_ACP_AGENT`, `OLAI_ACP_CODEX` and `OLAI_ACP_PI`; they point their rows at different ACP executables. An empty adapter path makes that engine unavailable; it does not switch off chat or suppress other engines. Use `on: no` on the chat node to remove the conversation. They are [chat.md](chat.md)'s, which says what the panel does with each.

**And the agent olai spawns inherits olai's environment — not yours.** Finding an agent is only half of starting one. A chat agent is a child of this process, so the variables it reads are the ones the *unit* was given. An agent whose config resolves a provider key out of the environment (opencode's `"apiKey": "{env:JUSPAY_API_KEY}"` is the shape) finds nothing unless olai itself was started with that key — and what that looks like in the panel is nothing at all: the agent takes the prompt, answers that the turn is over, and streams no error anywhere. Olai names it rather than drawing it as an ordinary turn — a notice saying the agent ended the turn without saying anything and to check its provider key, with the banner left up ([chat.md](chat.md)). `environmentFile` is where the key goes (Linux only; launchd has no equivalent, and the module refuses the option there rather than quietly ignoring it):

```nix
  services.olai.environmentFile = "${config.home.homeDirectory}/.config/olai/env";
```

Keep that file out of the nix store and `chmod 600`, one `NAME=value` per line. It is read when the unit starts, so a new key needs `systemctl --user restart olai`.

On Linux the unit is `Restart=always` / `RestartSec=1s` / `SuccessExitStatus=130`. Since the SIGTERM guard, a stray `kill -TERM` of the main pid is no longer an exit at all — it is refused and named in the journal (see Logging, above) — so `Restart=always` is what brings back the deaths that still happen: SIGKILL, the OOM killer, a crash. A `systemctl --user stop olai` is a systemd stop, which `Restart=` never overrides. On macOS the agent is `KeepAlive.SuccessfulExit=false` and `Crashed=true` — a 130 exit already restarts there, because launchd treats non-zero as unsuccessful. The 2026-08-20 incident (an outside SIGTERM, `on-failure` + `SuccessExitStatus=130`, hours of dark ledger) is [the RCA](https://github.com/juspay/oss.olai/blob/main/projects/olai/RCA/2026-08-20-olai-service-sigterm.md).

## The git policy

Whether writes record themselves and commits push is policy of the directory, shared by every browser. Set it on the `git` node in `_olai/Settings.olai`:

```jsonl
{"id":"git","ord":"a0","title":"git","custom":{"commit":"auto","push":"off"}}
```

`commit` is `off`, `manual` (default), or `auto`; `push` is `off` (default) or `auto`. They are independent. Auto-commit records everything waiting after fifteen quiet seconds, including writes made without a browser. Auto-push follows every commit olai makes, whether from the button, an agent, or the quiet window. See [git.md](git.md#modes).

Each plugin's `Config` schema declares its defaults, descriptions and controls. Expand the git row on the plugins panel to choose Commit and Push. Each control says `set in Settings.olai` or `default`; an explicit value equal to the default is still authored. **Use default** removes that property from the file. `GitState.policy` reports the decoded policy in force. Stale files under `$XDG_STATE_HOME/olai/git/` are inert.

Turning the git row off removes the ledger, pill and tools. Setting `commit: off` keeps a mounted ledger that has been told not to record.

**A refused commit or push pauses the loop**, and that is runtime state rather than policy: git said no, and nothing starts the loop again on olai's own initiative. The one gesture that does is **Resume**, on the commit panel, drawn only while the loop is actually stopped.

That pause is a fact about the DIRECTORY, held by the server. A reload does not clear it, a second tab does not clear it, and turning the row off and on again does not clear it; pressing Resume clears it for every reader at once. It used to live in the tab that made the attempt, which meant a reload was a silent retry, a second tab knew nothing about the stop, and a headless serve had no loop to stop.

**Restarting the process is the one thing that does clear it.** Nothing about a refusal is written down, so a `systemctl restart`, a deploy or a crash brings up a server with no stop and no words. That is deliberate for the stop: a restart is an operator's act where a reload is not. It would be wrong for the WORDS on their own, because the unit restarts on its own and the count would go quiet again — so **a boot re-earns them**: with `push: auto` and commits the upstream does not have, the server makes one push at startup (the same bare `git push`, never a force, never a pull) and whatever git answers is on the chip at once. With `push: off`, with nothing to send, or on a branch with no upstream at all, a boot attempts nothing — a branch nobody has ever pushed is not a branch that is behind.

Theme, typeface, size, note density and finished work are untouched by any of this. They are personal view choices, per browser, and there is nothing about them for a server to have an opinion on.

## Which integrations this serve runs

Olai is a bundle: its shell, content readers and editors, and integrations are plugins. The file says which run. The plugins panel — `⧉` in the header, or in the phone directory drawer — reads that choice and writes it when you press a switch. olai does not know the difference between the integrations themselves.

**Content and navigation are plugins too.** `outlines` and `markdown` own their readers and editors independently. `navigation` owns routes, focus, history and the palette; `layout` supplies the frame. `files`, `pins`, `capture` and `trash` contribute their own browsing and actions. Disabling `files` removes its browser while vault-owned file metadata remains available to open content. Disabling a content provider removes its handlers and UI; unrelated editors retain their state. `vault-plugins` owns source discovery, approval and compiled chunks, and disabling it unloads the definitions it owns. Approval write reservations remain in force while that policy is absent.

**The CONVERSATION is one** ([plugins/chat.md](plugins/chat.md)) — the panel, the transcript, the agents section, the door on an agent's row, *Ask agent* and the palette's `>`. It is on by default like the rest, and it is the row everything else on this list leans on: an engine, a doorbell and a mirror each name a door the chat row stands behind, so a serve that leaves chat out leaves those `waiting`, and the plugins panel says so per row.

**The LEDGER is one** ([plugins/git.md](plugins/git.md)) — the pill, the commit panel, and the quiet-window loop. It is on by default. A serve that leaves it out still writes; nobody records the writes, and there is no pill.

**The JOURNAL is one** ([plugins/journal.md](plugins/journal.md)) — the calendar, `/today`, day pages, Agenda and its owed badge. It is also on by default. Leaving `journal` out removes those routes and faces while leaving the `date` and `repeat` fields in your files untouched.

**The MATCHER is one** ([plugins/search.md](plugins/search.md)) — the index the server keeps, the walk that ranks and caps a query's hits, and the search box in the header. It is on by default. Leaving `search` out keeps the grammar, the `search_nodes` tool and every box a person types into, and answers every one of them with no hits and the reason, in words. The filter that narrows the page in front of you is not on this row and goes on working.

Beside them are the APPLIANCES — kolu ([plugins/kolu.md](plugins/kolu.md)), odu ([plugins/odu.md](plugins/odu.md)), Xyne Spaces ([plugins/xyne-spaces.md](plugins/xyne-spaces.md)) — and the ACP ENGINES the panel can seat: Claude Code ([plugins/claude.md](plugins/claude.md)), Codex ([plugins/codex.md](plugins/codex.md)), opencode ([plugins/opencode.md](plugins/opencode.md)) and pi ([plugins/pi.md](plugins/pi.md)).

Use one top-level node per row in `_olai/Settings.olai`. For example:

```jsonl
{"id":"spaces","ord":"a0","title":"xyne-spaces","custom":{"on":"yes"}}
{"id":"journal","ord":"a1","title":"journal","custom":{"on":"no"}}
{"id":"chat","ord":"a2","title":"chat","custom":{"idle-ms":"1200000"}}
```

`on: yes` enables a build opt-in row; `on: no` disables one. An absent choice uses the profile/build default. Selecting a tool the machine lacks leaves its row unavailable with the reason; it does not break unrelated rows. With no engine available chat explains the absence. Turning chat off removes the conversation and leaves its dependants waiting.

### Three settings doors

| door | contents | where it lives |
|---|---|---|
| vault | every policy and behaviour knob, including which rows run | `_olai/Settings.olai`, in git |
| env | credentials and machine resources | process environment, wrapper, or `environmentFile` |
| browser | how this tab reads | `⚙`, localStorage |
| memory (not a settings door) | private plugin records, named but never opened by the panel | `$XDG_STATE_HOME/olai/<plugin>/<hash>.json` |

Memory is a separate machine-local record, named below the panel and never opened there.

### Settings declarations

Each plugin's `Config` schema is the sole declaration of keys, defaults, validation and descriptions. `olai.yml` carries `id`, `name`, `section`, and optional `disabled`, `profiles`, `quiet` and `switchHint`; it carries no config block. The settings row reads the vault's revision, publishes a service, and owns no loader verbs. The composition root applies patches and waits for reconciliation. A changed config normally re-applies its row. A plugin may declare that it follows values live; Kolu does this for its `watch` child on the same revision, preserving its activation. It never reads `Kolu.olai`.

The reader selects `Settings.olai` by case-folded basename, shallowest path first, then path order. Missing file, node or leaf uses defaults. An invalid leaf defaults, warns once, and appears beneath its control with the file’s text and the schema’s message; a broken line defaults all rows and names the broken file on the panel. Repair restores the reading. Boot enables the vault and reader profile first, then folds the first policy reading into the remaining row patches before enabling them. A row the file disables never applies. There is no second disk reader before the vault lock.

Each row has a compact effective summary, such as `Commit: Manual · Push: Off — using defaults`, and a switch labelled `Enable git`. The summary follows schema order, shows at most four fields then `+N`, and counts invalid file values. Its hover names authored fields. Expand the disclosure to edit each leaf with its schema description and provenance: up to four choices use buttons, longer choices use a select, booleans use switches, and numbers and text use inputs. Numeric bounds and text-format hints come from the schema. Enter or blur saves an input; Escape reverts its draft. **Use default** removes the property, rather than writing a copy of the default.

The browser’s `plugins.configure({ name, key, value })` validates the value with the leaf’s schema before writing through the ordinary ops door. A dotted key targets its section child; a missing row or section is created with the write. `null` removes the leaf. The control waits for the resulting revision and reconciliation. Validation refusals appear at the control and leave the file unchanged. If the reader withdraws after an accepted write, the settlement refusal says that the file retains it. Two tabs use the last accepted edit; other revisions do not discard a draft being typed. These changes are ordinary ledger-visible edits and follow the directory’s commit policy.

Knob edits have no session fallback. An absent reader freezes controls with “Settings can be edited when the configuration reader is running”; a broken file freezes them with “Repair _olai/Settings.olai before changing settings” (using the selected file’s path). Reader-owner switches remain session-only for recovery, but their knobs use the same durable controls.

Environment readings follow the controls and stay read-only. Wrapper-provided executable paths are `·wrapper`; explicit resource inputs are `·env`, including explicit nix-store paths. Secrets show only set/unset. **Open settings node ↗** is the last line when the node exists, opening it in the outliner for direct editing. The first panel edit creates a missing node.

### Environment doors

| name | what it supplies |
|---|---|
| `OLAI_SPACES_URL` | Spaces origin |
| `OLAI_SPACES_TOKEN` | Spaces installed-app JWT; secret |
| `OLAI_AGENT_PATH` | engine search path; empty searches nowhere |
| `OLAI_ACP_AGENT`, `OLAI_ACP_CODEX`, `OLAI_ACP_PI` | executable paths, normally wrapper-provided |
| `OLAI_ODU_BIN` | directory prepended to the appliance's PATH |
| `PADI_SOCKET` | local Kolu socket path |
| `OLAI_ALLOWED_ORIGINS` | comma-separated browser origins |
| `OLAI_HOSTNAME` | machine label override |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and provider-specific keys | secrets inherited by agents |
| `OLAI_TOKEN` | bearer supplied to the terminal client, not the server |

The wrapper records which defaults it supplied in `OLAI_WRAPPER_DEFAULTS`; this is provenance metadata, not a configuration door. Explicit operator paths are never inferred from their spelling. Identity headers, chat `idle-ms`, and logging policy belong in the file.

### The switch, and how long it lasts

**The plugins panel has a switch on every row**, grouped by the section `olai.yml` names, with quiet groups (transports, this tab, pages) collapsed while they are healthy. A press on the heading opens one and the panel keeps that through roster redraws and the rebuild a switch causes; folding the group back up would make the walk unusable. Plugins written into the vault sit in **Defined here**; a pending definition is **Needs you** until somebody approves it. Pressing a switch moves the running serve. Turn kolu off and its Dock rows stop being drawn, its chip leaves the bar, its members leave the wire and the words it taught the vault go back to being ordinary text — no reload, no restart, and the page follows on its own. Turn it back on and all of it returns. A row that carries others, or that has a `switchHint`, asks before Off.

**A switch writes `on` to the file**, through the ordinary write door, then waits for the next revision and reconciliation. It creates a missing namespace while preserving siblings. The edit appears in the ledger and follows the directory's commit policy. A restart reads the file again.

The vault and settings-reader switches are session-only to keep their own recovery door available; their owners are derived from services, not hardcoded names. Their rows say so. When the reader is absent, one foot line says that switches are session-only. Applied patches stand when the reader withdraws; a returning vault publishes and patches again. A broken file must be repaired before a durable switch writes. The follower ignores `on` on both reader owners and warns once per row and file, so file policy cannot lock its own reader out. Their session switches can stop and reopen them without a disk edit.

**Every browser sees it**, because it is not this browser's setting. A flip made in one tab moves the roster the server publishes, and every other tab pointed at the same server follows it — the same standing as the connection dot, and the reason these rows are not on the preferences panel with the theme.

**There is no CLI verb for it**, deliberately. `olai surface` speaks to a running server, and a plugin flip is not one of the things it can ask for: enablement is authored in the outline or by a person at the panel. Nor is there a `--dump-config` — the panel *is* the table.

**An agent cannot touch it.** The verb is on the browser's face and no other, so nothing reachable over `/mcp` can turn a plugin off. An agent that could would be an agent that could turn off the thing watching it.

**Turning a row off takes its dependants with it, and the panel asks first.** The chat row stands behind four doors ([plugins/chat.md](plugins/chat.md)), so switching it off leaves every engine, every doorbell and the mirror `waiting` — each row naming the door it is short of. The confirm names those rows before Off moves. Switch chat back on and they re-start themselves; nothing has to be pressed twice, and a plugin that comes back is holding the same machine-local record it left.

A service can have only one provider. If two plugins offer the same service,
the second fails with a sentence naming both plugins and the service; the
existing provider keeps running.

**Stopping also reaches a plugin that is still starting.** The runtime
interrupts its Effect initialization, waits for dependent cleanup while the
provider's resources are still available, then releases its resources. A
required service disappearing leaves the plugin `waiting` with that service
named; when it returns the plugin starts again. Shutdown closes every plugin,
including one that declares no dependencies. Cancellation is cooperative:
synchronous JavaScript and uninterruptible Effect work must finish themselves.


### Machine-local state

Plugins have one machine-local door, `LocalState`. Core stores its opaque document outside the vault at `$XDG_STATE_HOME/olai/<plugin>/<hash>.json` (normally `~/.local/state/olai/<plugin>/<hash>.json`), where `hash` names the served directory's real path. A plugin never opens that path itself. Core keys the door with the plugin's own name and keeps one ordered write chain across plugin flips. A save completes when its file lands; a failed save is both logged and returned to the plugin so the gesture that caused it can say what did not stick without taking the serve down.

Chat's document has three sections in one JSON object: `memory` for the open agent/session/model, `wake` for scoped doorbells, and `heard` for teaching and last-line bookkeeping. Each section keeps its own cap and reading rules; one chat adapter serializes their read-modify-writes. Turning chat off and on therefore preserves the same snapshot, and a restart reads it from the same document. Xyne Spaces keeps its existing mirror snapshot under `xyne-spaces/<hash>.json`.

Old `hold/`, `wake/`, `heard/` and `mirror/` files are not read or migrated. Chat reads only the sections in its current document; an old unsectioned chat record supplies no saved conversation. The first save writes the current layout and leaves other old files inert.

### What being off means

**A serve with an integration off is not a degraded serve**, and the word is literal: the connection indicator stays green. Nothing is parked and nothing is half-wired — the integration's members are not on the wire at all, its tab half is never mounted so nothing subscribes to them, it hangs no chip in the bar, it probes for nothing, and the kinds it teaches the vault validate as ordinary text ([live-properties.md](live-properties.md)). The outline it would have owned is an ordinary outline. That is exactly the state a machine that never had the tool is already in, which is why it costs nothing to be true — and it is the state `olai surface` and every headless face already run in.

**And it is the same nothing whichever door turned it off.** A row disabled in the file and a row somebody switched off at the panel a minute ago are one state, not two: the plugin's registrations are undone as it goes — the words it taught, the doorbell it declared, the members it served, the seats it filled — so once teardown has finished what is left behind is absence rather than a disabled copy of anything. The vocabulary in particular follows the fibers rather than the boot: a kind whose plugin you just switched off stops being a kind on the running serve, and its values are read as the plain text any undeclared key already is.

The browser e2e lifecycle scenarios exercise the work after the switch: journal routes and calendar navigation, outline edits and palette search, chat replies, and committing edits made while git was disabled. They also enable journal and a chat engine that were absent at startup. Each checks recovery without reloading the page.

**The panel's row says which of seven states a plugin is in**, not just on or off. Running is the ordinary one, and it draws no sentence at all — the switch has already said it. The other six are all total absence and they differ in *why*: it was not asked for; this build ships it off until you name it (which is what `xyne-spaces` is, and the row names its build default); **a session-only switch**, used while the durable reader is unavailable; it was asked for and its **start failed** — in which case the row quotes what the plugin said, verbatim; it was asked for and is still waiting on something it needs; or — for a plugin the VAULT defines — it is waiting on YOU, which is the one absence whose answer is on this very panel (the source is drawn under the rows and the verb is beside it). Only the failure is a fault, and it is the one nothing else on screen would tell you about: an integration whose start failed draws nothing at all, exactly like one you turned off on purpose. The switch stays drawn on a row that failed, so a plugin whose start died on something you have since fixed can be told to try again.

**The vault can select rows.** A top-level node titled with the row id in `_olai/Settings.olai` can set `on: yes` or `on: no`. The reader publishes that choice and the serve reconciles it through Cordis. Agent writes cannot change `on`, including removing its effect by moving or trashing the node. Behaviour knobs remain writable through the ordinary agent door. The panel switch writes `on` through the ordinary write door and waits for the revision and row reconciliation. Restart reads that choice from the file. The vault and settings-reader switches stay session-only, so the panel cannot lock its own reader off durably. When either provider is unavailable, the foot says once that switches are session-only. A broken file must be repaired before a durable switch can write.


### Plugins the vault itself defines

A plugin can also arrive from the **served directory**, written by an agent while olai is running: a node with a `plugin` property whose two children carry the halves in their notes. The whole of it is [dynamic-plugins.md](dynamic-plugins.md); what belongs here is what it changes about this page.

**It is a row like any other, once it is up.** Same panel, same seven states, same switch, same containment when its `apply` throws, same `waiting` if it names a door nobody is behind. It sits under the built rows, because those are the ones that are the same on every machine.

**Nothing mounts until you approve it, with the source in front of you.** The panel draws both halves in full under the row and puts two buttons there — this version, or every later one. An approval names a **source version**, so a source edit puts the row back to waiting for you; and the code runs with this server's own authority, which is why a person approves it and an agent cannot approve its own.

**The approval is a property on the plugin's own node**, written through the ordinary write door. It travels with the vault, it is in the ledger like the source, and the definition’s own schema knobs survive alongside it. Those knobs are properties on the definition node; edits reapply its config without changing source approval. A stop, and the panel's switch on one of these rows, is still the instance's and still lasts as long as the serve.

**They may not take a built plugin's word.** A definition claiming `kolu` is a fault, named on the row, rather than an override: a definition must own a distinct name so it cannot replace the built provider’s ownership.

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

`7714` is the production/deploy port: the home-manager module binds it, and `.mcp.json` names it, so an agent in this repo talks to the user service and never to a worktree's `just run`. Without that service, `.mcp.json` at 7714 points at nothing — `just run docs --port 7714` is how you make it hold (the recipe already forwards extra args). A worktree's server announces the bound URL on the `serving` line; `--port 0` asks the OS every boot, so a restart may land on a new port. Requests from `127.0.0.1` do not need a bearer token; the chat still sends the one it was handed, which is accepted and ignored. A request that did not come from loopback is refused without that token.

Unattended agent runs need the server up. The user service is the one brain; `just run` is a worktree's own.

There is no second writer, and there never will be — one process opens the directory and every write goes through it. The write surfaces are a page and `/mcp`; a terminal is a client of the second one, not a third door. `olai surface` opens no directory — it speaks MCP to a running `olai web` and sends the same verbs an agent sends.

## Quick capture, from a terminal

A thought that arrives while you are somewhere else — a terminal, a mail client, a script that noticed something — should cost five seconds and no context switch. `olai surface capture add` is that door: one line, into the directory's inbox.

```sh
olai surface capture add "look into the new cabinets" \
  --text "the joinery place off Main" \
  --url http://127.0.0.1:7714
```

```
captured into /home/srid/vault — http://127.0.0.1:7714/_olai/Inbox.olai#a1b2c3
```

**A title and a note, and that is all it takes.** `title` is the row (required, and the one argument that is positional); `--text` becomes the note. There is no way to say *where* — a capture lands at the top level of the inbox, and where it belongs is a decision you make in the app afterwards, which is what an inbox is for. It carried a `--url` link field and a repeatable `--props k=v` once; both are gone for now, and `--url` means the server.

**One line, and `--json` for the rest.** What a write prints is where it landed and the address of the row it made — the two things a person does something with. `--json` prints the whole record instead: the id, the file, the revision, why a commit is or is not waiting, and the `root` and `url` of the vault that answered. The flag decides and nothing else does, so a script gets the same answer in a pipe, in a CI log, and in front of you.

**`--url` is required, on every call, with nothing underneath it.** No default, no environment variable, no remembered vault. That is the feature: an earlier design walked to a per-user socket path both ends agreed on because neither chose it, and a capture meant for one vault landed in another and answered exactly like a capture that had not. If you want a short spelling, make it an alias — then it is visibly your own choice.

**It lands in the inbox the directory has**, wherever you keep one, and mints `_olai/Inbox.olai` when there is none — the same convention `⌘K` `+` follows, resolved on the server against the same reading the write is judged on ([editing.md](editing.md#quick-capture)). It is the same write as everything else: the same validation, the same all-or-none rename, the same git policy. A refused capture leaves nothing behind, not even the inbox it would have minted.

**And it arrives dated**, so it is on the day's journal page as well as in the inbox — which is the half a capture made while nobody was looking actually needs. The stamp is written by the server, with its offset, so it names one instant on the vault's own clock. **A date AND the capture's born `todo` mark compose into due work** ([format.md](format.md#days)) — not an occurrence: the capture ticks that day's **Agenda** count when it lands, and from the next morning it shows **overdue**. Ruled 2026-08-29, keeping the composition deliberate: a capture you still owe is owed. If you do not owe it, the row is one `done` or one cleared date away from being off that list.

### `olai surface --help` is the documentation

Every verb an agent has is a verb here, with the same arguments and the same answers, behind the ROW that owns it: `olai surface outlines read` is the agent's `outlines_read`, and `olai surface markdown write` is `markdown_write`. One rule on both faces — a row names its verbs relative to itself and composition puts the row in front — spelled in the separator each face has, so a row that is switched off has no subcommand at all. `olai surface --help` lists the rows, `olai surface <row> --help` its verbs grouped by what they do with an example each, and `olai surface <row> <verb> --help` gives that verb's own flags. There is no separate page for it, deliberately: a page beside a binary is a page that goes stale, and the help is what you always have to hand.

```sh
olai surface --url http://127.0.0.1:7714 outlines get outlines _olai/Inbox.olai
olai surface --url http://127.0.0.1:7714 search nodes --text 'is:todo prop:pr'
olai surface list --url http://127.0.0.1:7714   # every row, verb and readable member
```

`--url` is on `list` too, and `list` is the one verb that dials nothing — it answers off the projection itself. The flag is uniform rather than clever: every command takes it, so a script looping over the verbs does not break on the one that would have refused it.

A write prints one line — where it landed, and a link to the row — and `--json` prints the whole record instead; every other answer is JSON already. A refusal goes to stderr, also as JSON, on exit 1. Exit 2 is a command that was wrong and never left the process, 3 is nothing serving at `--url`, 130 is Ctrl-C. There is no SDK and there is not going to be one — `jq` is the client library.

`watch` and `--follow` are not offered. The door this speaks to answers one request with one answer and pushes nothing, so there is no subscription to have; a page in a browser is what watches this vault change.

`OLAI_TOKEN` is a credential supplied to the `olai surface` client. It does not configure the server's bearer: the server mints that bearer per process.

### It is `/mcp`, and the auth is `/mcp`'s

`olai surface` is not a second face. It speaks MCP over HTTP to the same `/mcp` an agent uses, on the same listener, admitted by the same rule — so who may call what is one decision with one place to read it, and nothing was widened for a terminal to exist.

That rule is the one [Agents, over HTTP](#agents-over-http) describes: a request from `127.0.0.1` needs no credential, and one from anywhere else needs the server's bearer token, which you give this client as `$OLAI_TOKEN`. **Remotely, the reverse proxy in front is the authentication** — `tailscale serve`, Caddy with an auth proxy, Authelia — exactly as it is for the page:

```sh
olai surface --url https://olai.example.ts.net capture add "look into the new cabinets"
```

`captured-by` is written from **the identity the door has**, and omitted when it has none. Behind a proxy that is the login it injects (`Tailscale-User-Login` and the family beside it, [Who is looking](#who-is-looking)); on a direct loopback call there is no identity at all, so the capture simply carries no attribution rather than a made-up one. So `prop:captured-by=srid@github` finds what you captured through the tailnet. A caller cannot send it: a capture takes a title and a note, so there is nowhere to put one.

**`POST /capture` is gone.** It was ~550 lines re-deriving, for one verb, what the tool table gives every verb — a body schema, an identity rule, a CSRF gate, a status table and its own writer — and it existed only because `/mcp`'s per-process bearer left a terminal no way in. `capture_add` is one entry in that table now, so what an agent calls and what a terminal calls are one line of code. A phone captures through the web page (`⌘K` `+` on the tailnet) or through an MCP client.

### Client recipes

None of these is a thing olai ships; each is a few lines somebody writes once.

**Mail.app, via Raycast or a script (macOS).** The point of the mail case is that there is no mail service to deploy: AppleScript asks Mail for the selected message, and what olai keeps is what you would look for later — the subject, who it is from, and the `Message-Id`, in the note.

One script, because the AppleScript values have to reach the shell — `osascript` prints them, tab-separated, and `read` takes them apart. `OLAI_URL` is the vault you are capturing into; it is a variable of your own, and the flag is what the binary reads:

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

The `message://<Message-Id>` line **is** the attachment, and it is in the note because that is the one field a capture has for it. Clicking it in olai opens Mail at that message: the router hands any address that is not one of this app's to the browser, and the browser hands an unknown scheme to the OS — as long as the note's markdown made a link of it, which for a scheme GFM does not autolink means writing it inside `<`…`>` yourself.

Finding a thread again is `olai surface --url … search nodes --text '"<abc@mail>"'` — the `Message-Id` is in the note, so the text search reaches it ([search.md](search.md)). It was a property once, which made that an exact-match query; a note is what there is now.

**Known caveat:** `message:` links are solid on macOS. On iOS, third-party-composed ones do not always resolve. The subject and the sender in the note are what keep it findable when the link does not open, which is why the recipe writes them rather than relying on the pointer alone.

**A phone.** There is no door for one, and that is a decision rather than a gap: a phone cannot run this binary. Capture through the web page instead: `⌘K` then `+` on the tailnet, which is the same write ([editing.md](editing.md#quick-capture)). An MCP client on the phone is the other way in.

**Anything else, same verb.** A cron job, a script that notices something, a shell function. `olai surface --help` lists every verb the server offers.

**Files are not in this door yet** — a photo or a PDF is a separate piece of work, because writing binary into the vault is a path olai does not have (only chat attachments, which land in a tmp directory, and `.md` documents). Capture a link to it in the note for now.

The plugins panel includes a **vault** switch. Turning it off clears the served files and stops plugins that need the vault; reads and writes refuse until it is turned on again. The panel and enabled transports remain available. Turning it back on opens a fresh store from disk. This infrastructure switch lasts only for the current serve.

If another olai holds the directory, this process still serves its panel and MCP endpoint: the vault row is **failed**, with the lock holder's sentence, and vault-backed tools and resources leave the MCP catalog; direct calls to absent capabilities are refused. After the other owner stops, turn the failed vault row off and on to retry. A root that is not a directory likewise fails only the vault row.

The vault row’s `Config` schema declares `format` with default `olai`. The bundle selects the row without a config block:

```yaml
- id: vault
  name: olai-plugin-vault/server
```

The plugins panel derives its Format control and `Format: Olai` summary from that schema. The row’s `Config` schema validates the choice before acquiring the directory; unsupported values fail that row. Only `olai` is supported now. This makes the codec selection the place for a future Org implementation, without adding Org or migrating any files today. A different storage backend would instead be another provider behind `Directory`. The write gate is created and released with the vault row; without that row, there is no gate.

### Browser shell selection

The web defaults include `ui-renderer`, `navigation`, `layout`, `sidebar`, `preferences`, and `theme`. The first three supply the normal shell; content providers such as `outlines` and `markdown` render files. `files` supplies browsing and creation; `pins`, `capture`, and `trash` add their controls. `preferences` owns browser choices and `theme` their appearance. Enablement is authored in the file. Surface and test-minimal profiles omit browser rows. A browser row selected by the host is not proof it activated in a tab.

If a browser plugin fails to load, its row in the plugins panel shows the error
and offers **Retry browser activation**. Successfully running browser plugins
keep their state. If startup cannot mount a shell, **Retry browser startup**
appears in the startup error view and retries the host's selection. Neither
retry changes the server's configured selection.

`plugin-inspector` owns the plugins panel; excluding it removes that UI without
stopping host management. Its state survives shell replacement, while disabling
the inspector itself clears its panel and source-reading history.

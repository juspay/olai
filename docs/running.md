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

The flake lists [cache.nixos.asia/oss](https://cache.nixos.asia/oss) as a substituter, and a GitHub Actions job on every push builds every flake output on linux and darwin and pushes the closures there. `nix run github:juspay/olai` and a clone's `nix build` / `nix develop` should download rather than compile; if they compile, that commit has not been warmed yet.

In a clean, pushed development checkout, `just ci` builds the checkout's pinned Odu and runs the complete `check` graph on the Linux host pool. Odu owns the fan-out, E2E sharding, live progress, and GitHub status posting; `ODU_CI_TIMEOUT` overrides the 15-minute wall-clock backstop.

A worktree launch builds the pinned adapters and odu on demand (`nix build .#acp-agent`, `.#codex-agent`, `.#odu-bin`) and `just install` runs `npm ci` in `acp/`. Each of those prints the command on stderr before it starts; `npm ci` then logs every fetch (`--loglevel=http`) because `nix develop -c` is not a TTY and npm would otherwise sit silent until it finished.

`olai web <dir> [--port] [--host]` reads the directory recursively, picking up every `.olai` outline and every `.md` document, and serves them to a browser. It does not descend into dot-directories or `node_modules` — a directory of outlines is usually a git repository, and nothing anyone wrote is inside `.git`. Defaults: port `0` (the OS picks one), host `127.0.0.1`. A fixed `--port` is a deploy's word — the home-manager module passes `7714` ("olai" on a phone keypad). `--port 0` asks the OS every boot: a `just run` / `just serve` restart may land on a new port.

If a directory that used to serve comes up EMPTY, its outlines predate the rename to `.olai`: [format.md](format.md) carries the one-line `git mv` to run on it. olai reads the one extension and migrates nothing for you.

It binds to loopback by default because the surface is unauthenticated: anyone who can reach the port can read every outline under the directory — and, since the keyboard editor arrived, change one.

The page it serves follows the disk — save a file, `git pull`, drop in a new outline, and it updates in place — and a pill in its header is green only while a server is actually answering; drop the connection and the app freezes under an overlay that says so, thawing by itself when the wire comes back; restart the server under an open tab and that overlay offers a reload, because nothing else recovers that one. Beside the committed pill a quiet chip says how long THIS process has been up (`up 2h`, the start instant on the chip) — the server's start, ticked in the tab; the page that loads after that reload reads `up 12s` because it is a new page against a new process. It reads on a phone and installs as one (there is no offline mode, on purpose — a cached copy of an outline is a copy that has stopped being true; the one service worker an installed olai registers caches nothing and is there so the agent can tell you it is waiting on you). A ⚙ in the header (or, on a phone, at the foot of the directory drawer) opens the preferences — one of the named palettes, the typeface, how big the page is set, how much of a row is drawn by default, whether finished work is drawn — the panel's word is the default, hidden until somebody says otherwise, and a page says it beside its own filter — whether the agent stopping on a question reaches you when you are not looking and whether that makes a sound ([docs/chat.md](chat.md#when-it-is-waiting-on-you)), and the two git rows (whether what is waiting records itself once the edits stop, and whether a commit from here is pushed) — stored in the browser and sent nowhere, except that the two git rows are [the instance's policy](#the-git-policy), always read-only. A `⧉` beside it (on a phone, another row in that same drawer) opens the plugins panel — which integrations this server is running, why each is in the state it is in, and a switch per row that moves the running serve ([below](#which-integrations-this-serve-runs)); `⌘K` opens a command palette, where the keyboard-shortcut list also lives, where a zoomed node's own verbs are offered, and where `+ a line` captures that line to the directory's inbox without leaving the page ([docs/editing.md](editing.md)). Search has a box in the header and lives in that palette too — the same reading an agent's `search_nodes` gets, jump on Enter; on a phone the header's magnifier opens the palette ([docs/search.md](search.md)). It needs nothing installed.

### One olai per directory

A directory has one olai over it, and a second one refuses to boot:

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

Each variable unset is the Tailscale name in the table's first row (`OLAI_IDENTITY_EMAIL_HEADER` unset is the *login* header, since that is what a Tailscale login often is); each one **empty** turns that claim off. The login is the only one that makes somebody present — the rest are claims about them, and any of them may be missing. That reading is the chip's. A capture's `captured-by` is the login these same headers name, on whichever request took it — and nobody at all on a direct loopback call, where there is no proxy to name anybody (below).

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

Set, it REPLACES the search path rather than adding to it — including when it is set to the empty string, which is "look nowhere". The adapter variables are `OLAI_ACP_AGENT`, `OLAI_ACP_CODEX` and `OLAI_ACP_PI`; they point their rows at different ACP executables. Empty Codex or pi values omit that row, while empty `OLAI_ACP_AGENT` turns the chat panel off entirely (nothing is probed, and the panel says so rather than disappearing). They are [chat.md](chat.md)'s, which says what the panel does with each.

**And the agent olai spawns inherits olai's environment — not yours.** Finding an agent is only half of starting one. A chat agent is a child of this process, so the variables it reads are the ones the *unit* was given. An agent whose config resolves a provider key out of the environment (opencode's `"apiKey": "{env:JUSPAY_API_KEY}"` is the shape) finds nothing unless olai itself was started with that key — and what that looks like in the panel is nothing at all: the agent takes the prompt, answers that the turn is over, and streams no error anywhere. Olai names it rather than drawing it as an ordinary turn — a notice saying the agent ended the turn without saying anything and to check its provider key, with the banner left up ([chat.md](chat.md)). `environmentFile` is where the key goes (Linux only; launchd has no equivalent, and the module refuses the option there rather than quietly ignoring it):

```nix
  services.olai.environmentFile = "${config.home.homeDirectory}/.config/olai/env";
```

Keep that file out of the nix store and `chmod 600`, one `NAME=value` per line. It is read when the unit starts, so a new key needs `systemctl --user restart olai`.

On Linux the unit is `Restart=always` / `RestartSec=1s` / `SuccessExitStatus=130`. Since the SIGTERM guard, a stray `kill -TERM` of the main pid is no longer an exit at all — it is refused and named in the journal (see Logging, above) — so `Restart=always` is what brings back the deaths that still happen: SIGKILL, the OOM killer, a crash. A `systemctl --user stop olai` is a systemd stop, which `Restart=` never overrides. On macOS the agent is `KeepAlive.SuccessfulExit=false` and `Crashed=true` — a 130 exit already restarts there, because launchd treats non-zero as unsuccessful. The 2026-08-20 incident (an outside SIGTERM, `on-failure` + `SuccessExitStatus=130`, hours of dark ledger) is [the RCA](https://github.com/juspay/oss.olai/blob/main/projects/olai/RCA/2026-08-20-olai-service-sigterm.md).

## The git policy

Whether what is waiting records itself, and whether a commit is pushed, are facts about the DIRECTORY ([git.md](git.md)) — the instance's, the same in every browser, always read-only. There is no runtime door.

The policy comes from exactly two sources: the CLI flags (`--commit` / `--push`, surfaced through the nix home-manager module) and the built-in defaults (`manual` / `off`). Stale files under `$XDG_STATE_HOME/olai/git/` from an older olai are inert.

```
olai web ~/outlines --commit=auto --push=off
```

```nix
services.olai = {
  enable = true;
  dataDir = "${config.home.homeDirectory}/outlines";
  commit = "auto";   # off | manual | auto — omit and the built-in default applies
  push = "off";      # off | auto          — omit and the built-in default applies
};
```

**Giving a flag sets the instance's policy; omitting it uses the built-in default.** Either way the two git rows are read-only, the same in every browser. Given, the server tells every browser which flag it was started with: *Set by the server: `--commit=auto`.* Omitted, the row names the built-in default. Never hidden — a policy a reader cannot see is one they cannot ask anybody about.

The two are independent, so setting committing does not silently set pushing. `--commit=manual` typed out loud is not the same as saying nothing, even though this server behaves identically either way: the first names the flag under the row, the second is the built-in default.

`--commit` is the same flag [git.md](git.md#modes) describes, with the same three modes; `--no-commit` is `--commit=off` and names the flag in the same way. `--commit=auto` is the quiet window: everything waiting records itself once writes stop arriving for fifteen seconds, with or without a browser in front of it. It is no longer one commit per write — that mode is retired, and the per-write commit with it.

**`--push` governs the SERVER**, which it did not use to. It is Auto-push — whether a settled commit is pushed to the branch's upstream — and it follows **every** commit olai makes here, whichever door made it: the Commit button, an agent's `commit` tool, and the window's own. So `olai web ~/outlines --commit=auto --push=auto` with no tab open anywhere really does record and share; before, it recorded and shared nothing, and the unpushed count grew with no way to find out why. One round trip per commit, which is affordable exactly because the window makes a burst of writes one commit. `--push` has two values and deliberately not three: a branch that is not pushed on its own is pushed by the Push button, so there is no third thing to be.

**A refused commit or push pauses the loop**, and that is runtime state rather than policy: git said no, and nothing starts the loop again on olai's own initiative. The one gesture that does is **Resume**, under the Git commit row, drawn only while the loop is actually stopped — on every deployment, pinned or not.

That pause is a fact about the DIRECTORY, held by the server. A reload does not clear it, a second tab does not clear it, and turning the row off and on again does not clear it; pressing Resume clears it for every reader at once. It used to live in the tab that made the attempt, which meant a reload was a silent retry, a second tab knew nothing about the stop, and a headless serve had no loop to stop.

**Restarting the process is the one thing that does clear it.** Nothing about a refusal is written down, so a `systemctl restart`, a deploy or a crash brings up a server with no stop and no words. That is deliberate for the stop: a restart is an operator's act where a reload is not. It would be wrong for the WORDS on their own, because the unit restarts on its own and the count would go quiet again — so **a boot re-earns them**: with `--push=auto` and commits the upstream does not have, the server makes one push at startup (the same bare `git push`, never a force, never a pull) and whatever git answers is on the chip at once. With `--push=off`, with nothing to send, or on a branch with no upstream at all, a boot attempts nothing — a branch nobody has ever pushed is not a branch that is behind.

Theme, typeface, size, note density and finished work are untouched by any of this. They are personal view choices, per browser, and there is nothing about them for a server to have an opinion on.

## Which integrations this serve runs

Almost everything olai does beyond reading and writing your outlines is a plugin. There are two doors onto which of them are running, and they answer two different questions: `--plugins` says what a serve COMES UP with, and the plugins panel — `⧉` in the header, or a row at the foot of the directory drawer on a phone — turns one on or off *while it runs*. olai does not know the difference between the integrations themselves.

**The CONVERSATION is one** ([plugins/chat.md](plugins/chat.md)) — the panel, the transcript, the agents section, the door on an agent's row, *Ask agent* and the palette's `>`. It is on by default like the rest, and it is the row everything else on this list leans on: an engine, a doorbell and a mirror each name a door the chat row stands behind, so a serve that leaves chat out leaves those `waiting`, and the plugins panel says so per row.

**The JOURNAL is one** ([plugins/journal.md](plugins/journal.md)) — the calendar, `/today`, day pages, Agenda and its owed badge. It is also on by default. Leaving `journal` out removes those routes and faces while leaving the `date` and `repeat` fields in your files untouched.

Beside it are the APPLIANCES — kolu ([plugins/kolu.md](plugins/kolu.md)), odu ([plugins/odu.md](plugins/odu.md)), Xyne Spaces ([plugins/xyne-spaces.md](plugins/xyne-spaces.md)) — and the ACP ENGINES the panel can seat: Claude Code ([plugins/claude.md](plugins/claude.md)), Codex ([plugins/codex.md](plugins/codex.md)), opencode ([plugins/opencode.md](plugins/opencode.md)) and pi ([plugins/pi.md](plugins/pi.md)).

```
olai web ~/outlines --plugins=odu                        # odu only — and no panel at all
olai web ~/outlines --plugins=journal,chat,claude,kolu,odu # journal, a conversation, one engine and the appliances
olai web ~/outlines --plugins=chat,codex,opencode,pi     # no Claude row, no probe for one
olai web ~/outlines --plugins=                          # none
```

**Naming no engine leaves the panel with no agent**, and that is the flag doing exactly what it says rather than a trap: an engine is a row like any other, so a serve that composed none has nothing to talk to. The panel still DRAWS — it says this serve has no agent engine, and that every one of them is a plugin that is on by default — because a capability that is silently absent cannot be told apart from one that is broken.

**Naming no CHAT leaves no panel**, which is the sharper version of the same sentence: the row is not disabled, it is absent, and with it go the members, the seats and the four doors the other plugins name. If what you meant was "odu, and chat as usual", name `chat` and the engines you want beside it. `OLAI_ACP_AGENT=""` is still the other way to turn chat off — the whole panel, whatever the flag says — and it is the one to reach for when the answer is *not this time* rather than *not on this instance*.

...and the same thing where a machine is actually configured, because a policy
you set by hand on the command line is a policy you set once and forget:

```nix
  services.olai.plugins = [ "odu" ];              # odu only — and no panel at all
  services.olai.plugins = [ "chat" "claude" "kolu" "odu" ];
  services.olai.plugins = [ ];                    # none
  # omit it entirely                              — the built-in default
```

**Where a serve STARTS is the operator's**, which is why it is a CLI flag and a home-manager option — the two doors an instance's opening position is set through in this repo, exactly as `commit` and `push` are — rather than an env var. An env var names a resource to reach (`OLAI_ACP_AGENT`); this names what the instance comes up running, and that belongs on the `--help` page beside the other policies, where it can be read without knowing it exists.

**Omitting the flag is not the same as writing an empty one.** No flag means the built-in default (every row but `xyne-spaces`, which is opt-in and must be named); `--plugins=` with nothing after it means none, and the panel's row says which of the two you did. The nix option keeps the same three answers apart: omitted is `null`, none is `[ ]`. A name the build does not have is refused at startup, naming the words it does have — a typo is never a silently disabled integration.

### The switch, and how long it lasts

**The plugins panel has a switch on every row**, and pressing it moves the running serve. Turn kolu off and its Dock rows stop being drawn, its chip leaves the bar, its members leave the wire and the words it taught the vault go back to being ordinary text — no reload, no restart, and the page follows on its own. Turn it back on and all of it returns.

**A flip lasts as long as this serve, and is written nowhere.** There is no settings file, `olai.yml` is not edited, and nothing lands in `$XDG_STATE_HOME`. A restart comes back to what the flag, the nix option and the build's own rows say — which is the whole of why the switch is safe to have: the answer to *what does this machine run* stays the one thing an operator set, and the switch is what you reach for to find out what something is doing, or to make it stop until you have looked.

**It follows the flag rather than replacing it.** Nothing about `--plugins` changed: it is still what a serve starts with, still what nix passes, still refused at startup for a name the build does not have. What the switch adds is the ability to change your mind without stopping the server — and the panel goes on naming, at its foot, exactly what this serve was started with, so what is on screen never stops being traceable to what somebody typed. It is said once for the panel rather than under every row, because under a given flag it is the same sentence about every one of them.

**It goes both ways, including against the flag.** A row the flag left out, and a row this build ships off until you ask for it, can be switched *on* from the panel — the flag and the row's own default write the same `disabled` field, and the switch writes that field too, so there is no state the panel can reach that a flag could not have started you in. That is the one thing to reach for when you started a serve with `--plugins=kolu` and then wanted the conversation after all.

**Every browser sees it**, because it is not this browser's setting. A flip made in one tab moves the roster the server publishes, and every other tab pointed at the same server follows it — the same standing as the connection dot, and the reason these rows are not on the preferences panel with the theme.

**There is no CLI verb for it**, deliberately. `olai surface` speaks to a running server, and a plugin flip is not one of the things it can ask for: what the instance runs is either the operator's opening position or a person's decision in front of the panel, and a third way to say it from a shell script would be a fourth place for the answer to live. Nor is there a `--dump-config` — the panel *is* the table.

**An agent cannot touch it.** The verb is on the browser's face and no other, so nothing reachable over `/mcp` can turn a plugin off. An agent that could would be an agent that could turn off the thing watching it.

**Turning a row off takes its dependants with it, and the panel says so.** The chat row stands behind four doors ([plugins/chat.md](plugins/chat.md)), so switching it off leaves every engine, every doorbell and the mirror `waiting` — each row naming the door it is short of. Switch chat back on and they re-start themselves; nothing has to be pressed twice, and a plugin that comes back is holding the same machine-local record it left.

### Machine-local state

Plugins have one machine-local door, `LocalState`. Core stores its opaque document outside the vault at `$XDG_STATE_HOME/olai/<plugin>/<hash>.json` (normally `~/.local/state/olai/<plugin>/<hash>.json`), where `hash` names the served directory's real path. A plugin never opens that path itself. Core keys the door with the plugin's own name and keeps one ordered write chain across plugin flips. A save completes when its file lands; a failed save is both logged and returned to the plugin so the gesture that caused it can say what did not stick without taking the serve down.

Chat's document has three sections in one JSON object: `memory` for the open agent/session/model, `wake` for scoped doorbells, and `heard` for teaching and last-line bookkeeping. Each section keeps its own cap and reading rules; one chat adapter serializes their read-modify-writes. Turning chat off and on therefore preserves the same snapshot, and a restart reads it from the same document. Xyne Spaces keeps its existing mirror snapshot under `xyne-spaces/<hash>.json`.

An upgrade reads the previous paths once. The first save migrates `hold/<hash>.<plugin>.json`; for chat it also folds `chat/<hash>.json`, `wake/<hash>.json`, and `heard/<hash>.json` into the new three-section document. Xyne Spaces additionally adopts its older `mirror/<hash>.json` snapshot, including queued posts. The old files are left in place but inert, and the migration is logged.

### What being off means

**A serve with an integration off is not a degraded serve**, and the word is literal: the connection indicator stays green. Nothing is parked and nothing is half-wired — the integration's members are not on the wire at all, its tab half is never mounted so nothing subscribes to them, it hangs no chip in the bar, it probes for nothing, and the kinds it teaches the vault validate as ordinary text ([live-properties.md](live-properties.md)). The outline it would have owned is an ordinary outline. That is exactly the state a machine that never had the tool is already in, which is why it costs nothing to be true — and it is the state `olai surface` and every headless face already run in.

**And it is the same nothing whichever door turned it off.** A row the flag never named and a row somebody switched off at the panel a minute ago are one state, not two: the plugin's registrations are undone as it goes — the words it taught, the doorbell it declared, the members it served, the seats it filled — so what is left behind is absence rather than a disabled copy of anything. The vocabulary in particular follows the fibers rather than the boot: a kind whose plugin you just switched off stops being a kind on the running serve, and its values are read as the plain text any undeclared key already is.

**The panel's row says which of six states a plugin is in**, not just on or off. Running is the ordinary one, and it draws no sentence at all — the switch has already said it. The other five are all total absence and they differ in *why*: it was not asked for; this build ships it off until you name it (which is what `xyne-spaces` is, and the row names the flag value that turns it on); **you switched it off here**, which is the one that undoes itself and the only one a restart alone would clear; it was asked for and its **start failed** — in which case the row quotes what the plugin said, verbatim; or it was asked for and is still waiting on something it needs. Only the failure is a fault, and it is the one nothing else on screen would tell you about: an integration whose start failed draws nothing at all, exactly like one you turned off on purpose. The switch stays drawn on a row that failed, so a plugin whose start died on something you have since fixed can be told to try again.

**A vault cannot switch one off**, deliberately. A served directory says how an integration should BEHAVE — `_olai/Kolu.olai` is the vault's file and travels with it — but a directory that could decide which tools the machine serving it runs would be the vault deciding something about the host. The switch is a PERSON's, in front of the panel, and it is why that distinction survives having one at all: what moved is who may ask, not what may be written down.

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

A thought that arrives while you are somewhere else — a terminal, a mail client, a script that noticed something — should cost five seconds and no context switch. `olai surface capture` is that door: one line, into the directory's inbox.

```sh
olai surface capture "look into the new cabinets" \
  --text "the joinery place off Main" \
  --url http://127.0.0.1:7714
```

```
captured into /home/srid/vault — http://127.0.0.1:7714/_olai/Inbox.olai#a1b2c3
```

**A title and a note, and that is all it takes.** `title` is the row (required, and the one argument that is positional); `--text` becomes the note. There is no way to say *where* — a capture lands at the top level of the inbox, and where it belongs is a decision you make in the app afterwards, which is what an inbox is for. It carried a `--url` link field and a repeatable `--props k=v` once; both are gone for now, and `--url` means the server.

**One line, and `--json` for the rest.** What a write prints is where it landed and the address of the row it made — the two things a person does something with. `--json` prints the whole record instead: the id, the file, the revision, why a commit is or is not waiting, and the `root` and `url` of the vault that answered. The flag decides and nothing else does, so a script gets the same answer in a pipe, in a CI log, and in front of you.

**`--url` is required, on every call, with nothing underneath it.** No default, no environment variable, no remembered vault. That is the feature: an earlier design walked to a per-user socket path both ends agreed on because neither chose it, and a capture meant for one vault landed in another and answered exactly like a capture that had not. If you want a short spelling, make it an alias — then it is visibly your own choice.

**It lands in the inbox the directory has**, wherever you keep one, and mints `_olai/Inbox.olai` when there is none — the same convention `⌘K` `+` follows, resolved on the server against the same reading the write is judged on ([editing.md](editing.md#quick-capture)). It is the same write as everything else: the same validation, the same all-or-none rename, the same `--commit` mode. A refused capture leaves nothing behind, not even the inbox it would have minted.

**And it arrives dated**, so it is on the day's journal page as well as in the inbox — which is the half a capture made while nobody was looking actually needs. The stamp is written by the server, with its offset, so it names one instant on the vault's own clock. **A date AND the capture's born `todo` mark compose into due work** ([format.md](format.md#days)) — not an occurrence: the capture ticks that day's **Agenda** count when it lands, and from the next morning it shows **overdue**. Ruled 2026-08-29, keeping the composition deliberate: a capture you still owe is owed. If you do not owe it, the row is one `done` or one cleared date away from being off that list.

### `olai surface --help` is the documentation

Every verb an agent has is a verb here, under the same name, with the same arguments and the same answers. `olai surface --help` lists them grouped by what they do, with an example each, and `olai surface <verb> --help` gives that verb's own flags. There is no separate page for it, deliberately: a page beside a binary is a page that goes stale, and the help is what you always have to hand.

```sh
olai surface --url http://127.0.0.1:7714 get outlines _olai/Inbox.olai
olai surface --url http://127.0.0.1:7714 search_nodes --text 'is:todo prop:pr'
olai surface list --url http://127.0.0.1:7714   # every verb and readable member
```

`--url` is on `list` too, and `list` is the one verb that dials nothing — it answers off the projection itself. The flag is uniform rather than clever: every command takes it, so a script looping over the verbs does not break on the one that would have refused it.

A write prints one line — where it landed, and a link to the row — and `--json` prints the whole record instead; every other answer is JSON already. A refusal goes to stderr, also as JSON, on exit 1. Exit 2 is a command that was wrong and never left the process, 3 is nothing serving at `--url`, 130 is Ctrl-C. There is no SDK and there is not going to be one — `jq` is the client library.

`watch` and `--follow` are not offered. The door this speaks to answers one request with one answer and pushes nothing, so there is no subscription to have; a page in a browser is what watches this vault change.

### It is `/mcp`, and the auth is `/mcp`'s

`olai surface` is not a second face. It speaks MCP over HTTP to the same `/mcp` an agent uses, on the same listener, admitted by the same rule — so who may call what is one decision with one place to read it, and nothing was widened for a terminal to exist.

That rule is the one [Agents, over HTTP](#agents-over-http) describes: a request from `127.0.0.1` needs no credential, and one from anywhere else needs the server's bearer token, which you give this client as `$OLAI_TOKEN`. **Remotely, the reverse proxy in front is the authentication** — `tailscale serve`, Caddy with an auth proxy, Authelia — exactly as it is for the page:

```sh
olai surface --url https://olai.example.ts.net capture "look into the new cabinets"
```

`captured-by` is written from **the identity the door has**, and omitted when it has none. Behind a proxy that is the login it injects (`Tailscale-User-Login` and the family beside it, [Who is looking](#who-is-looking)); on a direct loopback call there is no identity at all, so the capture simply carries no attribution rather than a made-up one. So `prop:captured-by=srid@github` finds what you captured through the tailnet. A caller cannot send it: a capture takes a title and a note, so there is nowhere to put one.

**`POST /capture` is gone.** It was ~550 lines re-deriving, for one verb, what the tool table gives every verb — a body schema, an identity rule, a CSRF gate, a status table and its own writer — and it existed only because `/mcp`'s per-process bearer left a terminal no way in. `capture` is one entry in that table now, so what an agent calls and what a terminal calls are one line of code. A phone captures through the web page (`⌘K` `+` on the tailnet) or through an MCP client.

### Client recipes

None of these is a thing olai ships; each is a few lines somebody writes once.

**Mail.app, via Raycast or a script (macOS).** The point of the mail case is that there is no mail infrastructure in it: AppleScript asks Mail for the selected message, and what olai keeps is what you would look for later — the subject, who it is from, and the `Message-Id`, in the note.

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

olai surface --url "$olai_url" capture "$subj" \
  --text "$comment

from: $who
message-id: <$mid>
message://<$mid>"
```

The `message://<Message-Id>` line **is** the attachment, and it is in the note because that is the one field a capture has for it. Clicking it in olai opens Mail at that message: the router hands any address that is not one of this app's to the browser, and the browser hands an unknown scheme to the OS — as long as the note's markdown made a link of it, which for a scheme GFM does not autolink means writing it inside `<`…`>` yourself.

Finding a thread again is `olai surface --url … search_nodes --text '"<abc@mail>"'` — the `Message-Id` is in the note, so the text search reaches it ([search.md](search.md)). It was a property once, which made that an exact-match query; a note is what there is now.

**Known caveat:** `message:` links are solid on macOS. On iOS, third-party-composed ones do not always resolve. The subject and the sender in the note are what keep it findable when the link does not open, which is why the recipe writes them rather than relying on the pointer alone.

**A phone.** There is no door for one, and that is a decision rather than a gap: a phone cannot run this binary. Capture through the web page instead: `⌘K` then `+` on the tailnet, which is the same write ([editing.md](editing.md#quick-capture)). An MCP client on the phone is the other way in.

**Anything else, same verb.** A cron job, a script that notices something, a shell function. `olai surface --help` lists every verb the server offers.

**Files are not in this door yet** — a photo or a PDF is a separate piece of work, because writing binary into the vault is a path olai does not have (only chat attachments, which land in a tmp directory, and `.md` documents). Capture a link to it in the note for now.

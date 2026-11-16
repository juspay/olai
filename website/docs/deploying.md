# Keep olai running

How to run olai as a user service, put a reverse proxy in front of it, and let
that proxy tell olai who is looking. The flags themselves are
[running.md](running.md); what each plugin does is [settings.md](settings.md).

## As a user service with home-manager

Add the flake input and enable the module. Create `dataDir` first: `olai web`
refuses a path that does not exist. The unit is systemd on Linux and launchd on
macOS.

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
binary bakes in the browser bundle, the pinned `odu` and the pinned `himalaya`,
so the service needs no ambient environment.

## Tell the service where your agents are

A user service does not inherit your login shell's `PATH`, and that is where
some agents live. The agents olai looks for at startup are the pinned Claude
Code, Codex and pi adapters, plus an `opencode`, a `pi` or an `omp` on its own
search path. So an `opencode` you can run in a terminal is not necessarily one
the unit can find.

The module's option is the one to reach for:

```nix
  services.olai.agents = [ pkgs.opencode ];
```

Non-empty, the unit starts with `OLAI_AGENT_PATH` set to those packages' `bin`
directories, on systemd and launchd alike. Empty, which is the default, the
variable is not set and olai falls back to the service's own `PATH`. For a
directory that is not a package, set the variable yourself:

```nix
  systemd.user.services.olai.Environment = [
    "OLAI_AGENT_PATH=${config.home.homeDirectory}/.nix-profile/bin"
  ];
```

Set by either door, `OLAI_AGENT_PATH` replaces the search path rather than
adding to it, including when it is empty, which means look nowhere.

## Give it the keys an agent needs

An agent olai starts is a child of this process, so it reads the variables the
unit was given, not yours. An agent whose config resolves a provider key out of
the environment finds nothing unless olai itself was started with that key.
What you see then depends on how loudly that agent fails ([chat.md](chat.md)).

```nix
  services.olai.environmentFile = "${config.home.homeDirectory}/.config/olai/env";
```

Keep that file out of the nix store and `chmod 600` it, one `NAME=value` per
line. It is read when the unit starts, so a new key needs
`systemctl --user restart olai`. The option is Linux only: launchd has no
equivalent, and the module refuses it on macOS rather than ignoring it.

Which variables olai itself reads is in [settings.md](settings.md).

## What restarts it

On Linux the unit is `Restart=always`, `RestartSec=1s`,
`SuccessExitStatus=130`. A stray `kill -TERM` of the main pid is refused and
named in the journal ([running.md](running.md#logging)), so `Restart=always`
covers the deaths that remain: a `SIGKILL`, the out-of-memory killer, a crash.
A `systemctl --user stop olai` is a stop, which `Restart=` never overrides. On
macOS the agent sets `KeepAlive.SuccessfulExit=false` and `Crashed=true`.

## The same launch configuration without home-manager

Use `olai.lib.webArgs` to build the same command the service runs:

```nix
# in the deployment's flake, with olai as an input
argv = olai.lib.webArgs {
  package = olai.packages.${pkgs.stdenv.hostPlatform.system}.olai;
  dataDir = "/notes";   # required; a string, not a Nix path
  host = "0.0.0.0";     # default: olai.lib.defaultHost (127.0.0.1)
  port = 7714;          # default: olai.lib.defaultPort
};
# [ "/nix/store/…/bin/olai" "web" "/notes" "--port" "7714" "--host" "0.0.0.0" ]
```

The list is execv's, so a directory with spaces stays one argument. Escape it
with `lib.escapeShellArgs` only where a supervisor parses a command line.

## Behind a reverse proxy

Put olai behind a reverse proxy or `tailscale serve` and the browser's origin
is not the `Host` the proxy forwards. Name the origins you serve from in
`OLAI_ALLOWED_ORIGINS`, comma-separated. The websocket refuses the rest.

## Who is looking

A proxy in front of olai can say who made the request. olai trusts one
configurable family of header names: a login, and optionally an email, a
display name and a picture. The header bar draws the person as a face, top
right, beside the Preferences gear.

| What arrived | The face says |
| --- | --- |
| no login, as on direct loopback access | **anonymous** |
| a login | that person, with the display name and the login on the tooltip, as in `Sridhar Ratnakumar (srid@github)` |
| a failed read | that the door failed |

All of this is the `identity` plugin, on by default
([plugins/identity.md](plugins/identity.md)). With `on: no` on its node, olai
reads no headers at all: every request is nobody, a capture records no
`captured-by`, and there is no face in the bar. Header names are properties of
the `identity` node in `_olai/Settings.olai`, and an edit reapplies the plugin.

### Which headers to trust

The defaults are `tailscale serve`'s own four. The login is not necessarily an
email: on a Google, Microsoft or Okta tailnet `Tailscale-User-Login` is the
address, which is why the email claim defaults to the same header. On a GitHub-
or passkey-backed one it reads `srid@github`, which no one can hash.

| Proxy | login | email | name | picture |
|---|---|---|---|---|
| `tailscale serve` (default) | `Tailscale-User-Login` | `Tailscale-User-Login` | `Tailscale-User-Name` | `Tailscale-User-Profile-Pic` |
| Caddy + oauth2-proxy | `X-Auth-Request-User` | `X-Auth-Request-Email` | `X-Auth-Request-Preferred-Username` | — (use a template) |
| Caddy + caddy-security | `X-Token-User-Nick` (or `-Name`) | `X-Token-User-Email` | `X-Token-User-Name` | `X-Token-User-Picture`, where that claim is injected |
| Authelia | `Remote-User` | `Remote-Email` | `Remote-Name` | — (use a template) |
| Pomerium | `X-Pomerium-Claim-User` | `X-Pomerium-Claim-Email` | `X-Pomerium-Claim-Name` | `X-Pomerium-Claim-Picture`, where the operator mapped it |

Pomerium's `pass_identity_headers` forwards a signed JWT, which is not a login.
The unsigned `X-Pomerium-Claim-*` headers this family reads come from
`jwt_claims_headers`, and each is there only if that claim was mapped.

For Authelia, put this top-level namespace in `_olai/Settings.olai`:

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"login-header":"Remote-User","email-header":"Remote-Email","name-header":"Remote-Name","picture-header":""}}
```

Absent properties use the schema defaults. A blank `login-header` restores the
default, a blank `email-header` follows the configured login header, and a
blank `name-header` or `picture-header` disables that claim. The login makes
somebody present; the other claims may be missing.

### The picture

Four rungs, in order, and the first that answers wins.

| Rung | Where the picture comes from |
| --- | --- |
| the picture header | what the proxy sends, such as the avatar `tailscale serve` injects from the identity provider |
| `avatar-template` | a URL on the identity node with `{login}` where the login goes, as in `https://github.com/{login}.png` |
| gravatar | the email claim, and only when it really looks like an address |
| nothing | the silhouette, drawn by the page with no request to anywhere |

For Caddy and oauth2-proxy, name every trusted header and switch off the unused
Tailscale picture header:

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"login-header":"X-Auth-Request-User","email-header":"X-Auth-Request-Email","name-header":"X-Auth-Request-Preferred-Username","picture-header":"","avatar-template":"https://github.com/{login}.png"}}
```

The picture is a remote image on the app page, so the page's content policy
admits `https:` images: no `http:`, no `data:`, no wildcard, and the address
can only be what this server answered. `GET /olai/who` returns the same JSON
for a script.

### What the headers are worth

Every name still in force is trusted, including the ones you did not configure.
A deployment that renames only the login and the email still trusts
`Tailscale-User-Name` and `Tailscale-User-Profile-Pic`, and a proxy that is not
`tailscale serve` usually passes inbound `Tailscale-*` headers straight
through. The picture one is sharp, because the browser fetches it.

> On any proxy but `tailscale serve`, set `picture-header` and `name-header`
> empty, or strip those names at the proxy, as it must already do for the
> login.

> These headers mean something only when the proxy is the only way in: olai
> bound to loopback or to the tailnet, and the proxy stripping client-supplied
> copies of the same names. Anything that can reach the port can send them. Do
> not expose this port to the internet.

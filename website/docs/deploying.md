# Keep olai running in the background

Run olai as a user service your computer starts for you, put a reverse proxy
in front of it, and let that proxy say who each request is from.[^pages]

## As a user service with home-manager

Add olai to your flake's inputs and switch the module on.[^dirs] The service
runs under systemd on Linux and launchd on macOS.[^package]

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

## Tell the service where your agents are

A user service does not get your login shell's `PATH`, where some agents are
installed, so olai may not find them.[^agents] Name them as packages and the
module puts them on olai's search path:

```nix
  services.olai.agents = [ pkgs.opencode ];
```

`OLAI_AGENT_PATH` replaces olai's search path rather than adding to it.[^pathvar]

## Give it the keys an agent needs

An agent olai starts is a child process of olai, so it gets the environment
variables the service was started with, not those in your shell.[^keys]
Point the service at a file of them:

```nix
  services.olai.environmentFile = "${config.home.homeDirectory}/.config/olai/env";
```

Keep that file out of the nix store, and `chmod 600` it so only you can read
it.[^envfile]

## Behind a reverse proxy

A reverse proxy is a server that sits in front of olai and passes requests on.
Behind one, name the origins you serve olai from in `OLAI_ALLOWED_ORIGINS`,
separated by commas.[^origins]

## Show who made the request

A proxy in front of olai can add headers that carry the login of the person
who made the request.[^identity] olai shows a small face at the top right of
the header bar, beside the Preferences gear.[^trust]

| What arrived | The face says |
| --- | --- |
| no login, as when you open olai on your own machine | `Not signed in` |
| a login | that person, with their display name and login on the tooltip |
| headers olai could not read | `Couldn't check who you are` |

[^pages]: The flags of `olai web` are [running.md](running.md), and what each
    plugin does is [settings.md](settings.md).

[^dirs]: Create the directory you name in `dataDir` first: `olai web` refuses
    a path that does not exist.

[^package]: The module picks the olai build for your platform out of the
    flake, so you do not set `package` yourself. That build carries the
    browser files, a fixed version of `odu` and a fixed version of `himalaya`
    inside it, so the service needs nothing else installed on the machine.

[^agents]: At startup olai looks for the fixed Claude Code, Codex and pi
    adapters it ships with, and for an `opencode`, a `pi` or an `omp` on its
    own search path. So an `opencode` that you can run in a terminal is not
    necessarily one the service can find.

[^pathvar]: When you list packages in `services.olai.agents`, the module
    starts olai with `OLAI_AGENT_PATH` set to those packages' `bin`
    directories, on systemd and on launchd alike. When you list none, which is
    the default, it does not set the variable and olai searches the service's
    own `PATH`. However it is set, the variable replaces the search path, so
    setting it to nothing means olai looks nowhere. To add a plain directory,
    see the closed block at the foot of this page.

[^keys]: Some agents read a provider's API key from an environment variable.
    Such an agent finds nothing unless olai itself was started with that key.
    What you see then depends on how clearly that agent reports the failure
    ([chat.md](chat.md)).

[^envfile]: The environment file holds one `NAME=value` per line. The service
    reads it when it starts, so after adding a key you run
    `systemctl --user restart olai`. The option works on Linux only: launchd
    has nothing equivalent, and on macOS the module refuses the option rather
    than ignoring it. [settings.md](settings.md) lists the variables olai
    itself reads.

[^origins]: The browser's origin behind a proxy is not the `Host` the proxy
    forwards to olai, which is why you list the origins yourself.
    `tailscale serve` counts as a reverse proxy here too. The websocket, which
    carries every update to the open page, refuses a request whose origin is
    not in the list.

[^identity]: olai reads a set of header names you can configure: one for the
    login, and optionally one each for an email address, a display name and a
    picture. The `identity` plugin does this, and it is on by default
    ([plugins/identity.md](plugins/identity.md)). Put `on: no` on its node and
    olai reads no headers at all: every request is from nobody, a captured row
    records no `captured-by` property, and the header bar shows no face.

[^trust]: The tooltip reads `Sridhar Ratnakumar (srid@github)`. You set the
    header names as properties of the `identity` node in `_olai/Settings.olai`,
    and olai restarts the plugin when you change them. A script can ask for the
    same answer as JSON with `GET /olai/who`.

<details>
<summary>What restarts it after it dies</summary>

On Linux the service is set to `Restart=always`, `RestartSec=1s`,
`SuccessExitStatus=130`. olai refuses a stray `kill -TERM` of its main process
and says so in the journal ([running.md](running.md#logging)). So
`Restart=always` covers the deaths that are left: a `SIGKILL`, the
out-of-memory killer, a crash. `systemctl --user stop olai` is a deliberate
stop, and `Restart=` never overrides one of those. On macOS the launchd agent
sets `KeepAlive.SuccessfulExit=false` and `Crashed=true`, which restarts olai
after a failure or a crash.

</details>

<details>
<summary>Setting the agent path by hand, and starting olai without home-manager</summary>

To put a plain directory on olai's search path, rather than a package, set the
variable yourself:

```nix
  systemd.user.services.olai.Environment = [
    "OLAI_AGENT_PATH=${config.home.homeDirectory}/.nix-profile/bin"
  ];
```

To start olai from your own deployment, use `olai.lib.webArgs`, which builds
the same command the service runs:

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

The result is a list of arguments, passed straight to the program, so a
directory whose name has spaces in it stays one argument. Quote it with
`lib.escapeShellArgs` only where a supervisor reads a command line as text.

</details>

<details>
<summary>Which headers to trust, where the picture comes from, and what the headers are worth</summary>

### Which headers to trust

The default four header names are the ones `tailscale serve` sends. The login
is not always an email address: on a tailnet backed by Google, Microsoft or
Okta, `Tailscale-User-Login` holds the address, which is why olai reads the
email from the same header by default. On a tailnet backed by GitHub or a
passkey it holds something like `srid@github`, which is not an address and has
no gravatar behind it.

| Proxy | login | email | name | picture |
|---|---|---|---|---|
| `tailscale serve` (default) | `Tailscale-User-Login` | `Tailscale-User-Login` | `Tailscale-User-Name` | `Tailscale-User-Profile-Pic` |
| Caddy + oauth2-proxy | `X-Auth-Request-User` | `X-Auth-Request-Email` | `X-Auth-Request-Preferred-Username` | — (use a template) |
| Caddy + caddy-security | `X-Token-User-Nick` (or `-Name`) | `X-Token-User-Email` | `X-Token-User-Name` | `X-Token-User-Picture`, where that claim is injected |
| Authelia | `Remote-User` | `Remote-Email` | `Remote-Name` | — (use a template) |
| Pomerium | `X-Pomerium-Claim-User` | `X-Pomerium-Claim-Email` | `X-Pomerium-Claim-Name` | `X-Pomerium-Claim-Picture`, where the operator mapped it |

Pomerium's `pass_identity_headers` forwards a signed JWT, which is not a
login. The `X-Pomerium-Claim-*` headers in the table are unsigned, come from
Pomerium's `jwt_claims_headers` setting, and arrive only for the claims the
operator mapped there.

For Authelia, put this top-level node in `_olai/Settings.olai`:

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"login-header":"Remote-User","email-header":"Remote-Email","name-header":"Remote-Name","picture-header":""}}
```

A property you leave out keeps its default. A blank `login-header` restores
the default name, a blank `email-header` makes olai read the email from the
login header, and a blank `name-header` or `picture-header` switches that
claim off. The login is what makes somebody present; the display name, email
and picture can all be missing.

### Where the picture comes from

olai tries these four in order, and the first that answers wins.

| Tried | Where the picture comes from |
| --- | --- |
| the picture header | what the proxy sends, such as the avatar `tailscale serve` takes from the identity provider |
| `avatar-template` | an address on the identity node with `{login}` where the login goes, as in `https://github.com/{login}.png` |
| gravatar | looked up from the email, and only when the email really looks like an address |
| nothing | the grey silhouette, drawn by the page without asking anywhere for an image |

For Caddy with oauth2-proxy, name every header you trust and blank the
Tailscale picture header, which that proxy does not send:

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"login-header":"X-Auth-Request-User","email-header":"X-Auth-Request-Email","name-header":"X-Auth-Request-Preferred-Username","picture-header":"","avatar-template":"https://github.com/{login}.png"}}
```

The picture is an image fetched from another site, so the page's content
policy allows images over `https:` only: no `http:`, no `data:` images, no
wildcard, and the address has to be one this server named.

### What the headers are worth

olai trusts every header name that is still in force, including the ones you
did not configure. A deployment that renames only the login and the email
still trusts `Tailscale-User-Name` and `Tailscale-User-Profile-Pic`, and a
proxy other than `tailscale serve` usually passes incoming `Tailscale-*`
headers straight through. The picture header is the dangerous one, because the
browser fetches whatever address it carries.

> On any proxy other than `tailscale serve`, leave `picture-header` and
> `name-header` empty, or have the proxy delete those header names from
> incoming requests, as it must already do for the login header.

> These headers mean something only when the proxy is the only way in: olai
> listening on loopback or on the tailnet, and the proxy deleting any copies
> of these headers a client sent itself. Anything that can reach the port can
> send them, so do not expose this port to the internet.

</details>

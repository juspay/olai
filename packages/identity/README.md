# @olai/identity — who this request is, and what they look like

A login the reverse proxy injected, or nobody. One configurable FAMILY of trusted header names (login + optional email, display name and picture); the same family covers `tailscale serve`, Caddy+OAuth, Authelia (`Remote-User` / `Remote-Email` / `Remote-Name`) and Pomerium (`X-Pomerium-Claim-*`) — one feature, not one per proxy. Pomerium's `X-Pomerium-Jwt-Assertion` is a JWT, not a login.

**The login is not necessarily an email.** On a Google/Microsoft/Okta tailnet `Tailscale-User-Login` *is* the address, which is why the email claim defaults to the same header. On a GitHub- or passkey-backed one it reads `srid@github` — Tailscale's own spelling of that account, correct to display and not an address. So WHICH picture a person wears is a LADDER rather than a hash.

This package is the PERSON as a value. It is not a cell (a cell is one value for the process), it is not HTTP, and it is not a surface member. `identityOf` is the one reading; `headerNamesOf` is the allowlist `serveSurfaceApp` takes (unique, because login and email often share a name). `GET /olai/who` is `@olai/server`'s HTTP door over that reading; `who.get` is the tab's door, answered from the upgrade. The path and JSON live in `@olai/surface`, the way `/media` does. `POST /capture` calls the same function on its own request rather than growing a second parse.

| file | what it owns |
|---|---|
| `identity.ts` | the person: `identityOf`, the one reading — a function of the header names it is HANDED and the headers a request arrived with; `headerNamesOf`, the unique allowlist the upgrade takes |
| `picture.ts` | the LADDER: the picture header, an avatar URL template (`{login}`), the gravatar of a claim that really is an address (`looksLikeEmail`), or none |
| `gravatar.ts` | one rung of it: MD5 of an email address |
| `config.ts` | THE ENVIRONMENT EDGE: the whole `OLAI_IDENTITY_*` family (four header names, one avatar template) read into one value, once, for the composition root. Nothing else here touches `process.env`, which is what lets the two files above be functions of their arguments |

No dependencies. Putting the reading in `@olai/server` would make every other caller import the composition root.

**The ladder is walked server-side.** The browser is handed a picture URL or `null` (plus the display name), never a header name or a template: what a page must not know is how this deployment is wired. A `null` is the silhouette the chip draws itself, with no request to anywhere.

**Trust.** These headers are only meaningful when the proxy is the only way in: olai bound to loopback or the tailnet, **and the proxy stripping client-supplied copies of the same names** — every name still in force, including the ones nobody configured, since an unset variable keeps its Tailscale default and the picture one becomes an `<img src>` the browser fetches. Anything that can reach the port can send them. Documented beside the config in [`docs/running.md`](../../docs/running.md), which also says why the app page's image policy admits `https:` rather than a list of origins nobody can know at build time.

The live wire sees it: `serveSurfaceApp` takes the names `headerNamesOf` returns as `upgradeHeaders`, and the per-connection services read identity off `connection.headers`. `GET /olai/who` stays for a share sheet and a script, which have no websocket.

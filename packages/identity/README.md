# @olai/identity — who this request is

A login the reverse proxy injected, or nobody. One configurable pair of trusted header names (login + optional email); the same pair covers `tailscale serve`, Caddy+OAuth and Authelia/Pomerium — one feature, not one per proxy.

This package is the PERSON as a value. It is not a cell (a cell is one value for the process), it is not HTTP, and it is not a surface member. `GET /olai/who` is `@olai/server`'s door over `identityOf`; the path and JSON live in `@olai/surface`, the way `/media` does. A later `POST /capture` calls the same function on its own request rather than growing a second parse.

| file | what it owns |
|---|---|
| `identity.ts` | the person: `identityOf` the one reading, `identityHeaders` the names (default `Tailscale-User-Login` for both) |
| `gravatar.ts` | the picture: MD5 of the email claim, generic silhouette when there is none |

No dependencies. Putting the reading in `@olai/server` would make every other caller import the composition root.

**Trust.** These headers are only meaningful when the proxy is the only way in: olai bound to loopback or the tailnet, **and the proxy stripping client-supplied copies of the same names**. Anything that can reach the port can send them. Documented beside the config in [`docs/running.md`](../../docs/running.md).

The websocket cannot see it today: kolu's `serveSurfaceApp` owns the upgrade and does not hand request headers to the app.

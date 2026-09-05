# olai-plugin-identity — who this request is, and what they look like

A login the reverse proxy injected, or nobody. One configurable FAMILY of trusted header names (login + optional email, display name and picture); the same family covers `tailscale serve`, Caddy+OAuth, Authelia (`Remote-User` / `Remote-Email` / `Remote-Name`) and Pomerium (`X-Pomerium-Claim-*`) — one feature, not one per proxy. Pomerium's `X-Pomerium-Jwt-Assertion` is a JWT, not a login.

**The login is not necessarily an email.** On a Google/Microsoft/Okta tailnet `Tailscale-User-Login` *is* the address, which is why the email claim defaults to the same header. On a GitHub- or passkey-backed one it reads `srid@github` — Tailscale's own spelling of that account, correct to display and not an address. So WHICH picture a person wears is a LADDER rather than a hash.

It was `@olai/identity`, a general leaf under the composition root. It is a ROW now: core defines an `Identity` door (`@olai/plugin-api` — the header names to trust, and the reading over them) and does not stand behind it; this plugin does, from its own `apply`. What a serve without this row is, is what a loopback serve behind no proxy always was — **every request is nobody** — which is why the absence needs no mode of its own. The user page is [`docs.md`](docs.md), served at `docs/plugins/identity.md`.

## The three doors it is read through, none of them here

`who.get` (the tab's, answered per connection from the upgrade headers), `GET /olai/who` (a share sheet, a script — anything with no websocket), and `/mcp` (a capture's `captured-by`, per request, so a capture from a terminal or an agent behind a proxy is attributable at all — and attributable to nobody, honestly, when there is no proxy in front to name anybody). All three are `@olai/server`'s, and they read this row's `Identity`. **This row composes no sibling surface**, because who is looking is one value per CONNECTION and the connection is core's; a surface here would be a second door onto a value this half never holds.

| file | what it owns |
|---|---|
| `src/index.ts` | the plugin's word, and the whole of the root door: no surface, and why |
| `src/server.ts` | the row: read the `OLAI_IDENTITY_*` family once, stand behind `Identity` |
| `src/who/identity.ts` | the person: `identityOf`, the one reading — a function of the header names it is HANDED and the headers a request arrived with; `headerNamesOf`, the unique allowlist the upgrade takes |
| `src/who/picture.ts` | the LADDER: the picture header, an avatar URL template (`{login}`), the gravatar of a claim that really is an address (`looksLikeEmail`), or none |
| `src/who/gravatar.ts` | one rung of it: MD5 of an email address |
| `src/who/config.ts` | THE ENVIRONMENT EDGE: the whole `OLAI_IDENTITY_*` family (four header names, one avatar template) read into one value, once, out of what `Env` hands the row. Nothing here touches `process.env`, which is what lets every fold be a function of its arguments — and what lets a test state a deployment instead of arranging one |
| `src/who/reading.ts` | the two folds joined: headers in, a person with the picture ALREADY RESOLVED out. This is what the door hands over |
| `src/browser.tsx` | the browser half: one face, in the shell's `app.viewer` seat |
| `src/browser/Who.tsx` | the chip — four faces (asking, anonymous, the person, a failed door), the words in the tooltip |
| `src/person.ts` | how a person is asked for and DRAWN in this tab (one `who.get` for the whole page, the words, the silhouette) — the door the chat row's transcript reads, so the header and the transcript cannot disagree about who is looking |

`src/who/` has no dependency at all beyond `@olai/plugin-api`'s door types (`node:crypto` is a builtin), which is what lets the e2e suite import it for two names without pulling a runtime into a cucumber process.

**The ladder is walked server-side.** The browser is handed a picture URL or `null` (plus the display name), never a header name or a template: what a page must not know is how this deployment is wired. A `null` is the silhouette the chip draws itself, with no request to anywhere.

**Trust.** These headers are only meaningful when the proxy is the only way in: olai bound to loopback or the tailnet, **and the proxy stripping client-supplied copies of the same names** — every name still in force, including the ones nobody configured, since an unset variable keeps its Tailscale default and the picture one becomes an `<img src>` the browser fetches. Anything that can reach the port can send them. Documented beside the config in [`docs/running.md`](../../../docs/running.md), which also says why the app page's image policy admits `https:` rather than a list of origins nobody can know at build time.

**No seam left, and the one that was there was the socket's.** The headers a websocket may carry were fixed when the port bound, so a serve that came up without this row and switched it on at the panel answered the two HTTP doors immediately while an open tab stayed anonymous until the process restarted. [juspay/kolu#2229](https://github.com/juspay/kolu/pull/2229) made the allowlist a thunk read at each accept: core asks this row for the names on every upgrade, so a switched-on row is named by the redial the roster change causes. Off was always immediate. `@olai/plugin-api`'s `Identity` argues the shape; `docs.md` says what a bad name costs and where it is refused.

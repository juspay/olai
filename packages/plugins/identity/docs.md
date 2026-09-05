# Who is looking

Identity is a plugin. Everything about who the person in front of a request is — the trusted header names, the picture ladder that decides what they wear, and the chip in the top right of the bar — arrives with one row in the build's plugin list. A serve that does not name that row is a serve on which **every request is nobody**.

What identity *does* has its own page: [running.md](../running.md#who-is-looking) is the deployment — which headers, which proxy, what to strip. This page is about the row.

## What turns it on

Nothing. It is on by default, like chat and git. Two things take it away, and they answer two different questions.

`--plugins` decides what a serve **comes up with**:

```
olai web ~/outlines                                    # the chip, as always
olai web ~/outlines --plugins=chat,git,claude          # every request is nobody
```

The plugins panel — `⧉` in the header — turns it off and on **while the serve runs**, and that lasts as long as the process: a restart comes back to the flag. Switched off at the panel, the chip leaves while you are watching, `who.get` starts answering nobody, and a capture taken from that moment on records no `captured-by`.

**Either way, nothing pretends.** There is no chip in the bar — not an anonymous one, an absent one — and no request anywhere is attributed to anybody. That is the same state a loopback `olai web` behind no proxy has always been in, which is why the absence needs no mode of its own: nothing is invented when nobody says who is looking, whether that is because the proxy sent nothing or because there is no reading mounted to read it.

**Nothing needs a restart.** For one release it did, and only in one place: the headers a socket may carry were fixed when the port bound, so a serve that came up *without* this row and then switched it on at the panel answered `GET /olai/who` and attributed `/mcp` writes immediately, while the chip in an open tab stayed anonymous until the process was restarted. That seam is closed ([juspay/kolu#2229](https://github.com/juspay/kolu/pull/2229)): the allowlist is asked of this row at each upgrade, so the tab redials when the row mounts and comes back as whoever the proxy says you are. Off and on are both immediate now, on every door.

**A header name that is not one still stops the boot.** `OLAI_IDENTITY_LOGIN_HEADER="Remote User"` — a name no HTTP request can carry, because of the space — refuses the serve on the way up, saying so in as many words. That is deliberate and it is checked where the serve starts rather than where the socket is accepted: an allowlist read per upgrade cannot refuse a *socket* for a bad name (one row's typo must not take everybody else's connection down), so a serve that came up with one would otherwise have gone on answering, with nobody ever named and the reason only in the log. Switch the row **on** with a name like that and there is no boot left to refuse: those connections are served with nobody named, and each one says why in the log.

## The config

The header names and the avatar template are the **operator's environment**, not this row's `config:` — `OLAI_IDENTITY_LOGIN_HEADER` and the four beside it, documented in [running.md](../running.md#who-is-looking). They say how the reverse proxy in front is wired, which is set where that proxy is: in the unit that starts olai, beside `OLAI_LOG`. A row's `config:` is what a *command line* said (`--commit` on the git row), and asking an operator to spell their proxy's headers a second time in `olai.yml` would be one deployment fact with two authors.

They are read once, when the row's `apply` runs — so what a process was started with is what it serves.

## On the wire

Nothing, and the absence is the design. Who is looking is one value per **connection**, and the connection is core's: the login arrives on the upgrade, so the answer is minted where the socket is accepted and read back through core's own `who.get` — one procedure on the browser face, answered per connection. `GET /olai/who` stays beside it for a share sheet and a script, which have no websocket. A sibling surface here would be a second door onto a value this row never holds.

What the row stands behind is the `Identity` door (`@olai/plugin-api`): the header names to trust, and the reading over them. Core reads it in three places — the upgrade, the HTTP door, and the `/mcp` route that attributes a capture — and knows a login, a name and a picture URL, already settled. It does not know a header name, a template, or that a picture is resolved down a ladder at all.

## Where it hangs in the tab

| seat | what the shell keeps | what identity brings |
| --- | --- | --- |
| `app.viewer` | the last seat in the bar — top right, and the one seat a phone keeps | the chip, its four faces, and every word in them |

There is one seat and one occupant: two chips answering "who am I" in one bar is not an answer, so a second row claiming it is refused by name at the moment it registers.

The chat panel draws the same person over each run of their own messages, wearing the same picture, through this row's `./person` door — one ask for the whole tab, so a header saying one thing about who is looking and a transcript saying another cannot happen. With the row off, that face falls back to the silhouette, the way it does behind a proxy that names nobody.

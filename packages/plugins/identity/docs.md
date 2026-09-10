# Who is looking

Identity is a plugin. Everything about who the person in front of a request is — the trusted header names, the picture ladder that decides what they wear, and the chip in the top right of the bar — arrives with one row in the build's plugin list. A serve that does not name that row is a serve on which **every request is nobody**.

What identity *does* has its own page: [running.md](../running.md#who-is-looking) is the deployment — which headers, which proxy, what to strip. This page is about the row.

## What turns it on

The `identity` row is on by default. Set `on: no` on its top-level node in `_olai/Settings.olai`, or use its switch on `⧉`. The switch writes the same property and restart reads it again.

```jsonl
{"id":"identity","ord":"a0","title":"identity","custom":{"on":"no"}}
```

**Either way, nothing pretends.** There is no chip in the bar — not an anonymous one, an absent one — and no request anywhere is attributed to anybody. That is the same state a loopback `olai web` behind no proxy has always been in, which is why the absence needs no mode of its own: nothing is invented when nobody says who is looking, whether that is because the proxy sent nothing or because there is no reading mounted to read it.

**Nothing needs a restart.** For one release it did, and only in one place: the headers a socket may carry were fixed when the port bound, so a serve that came up *without* this row and then switched it on at the panel answered `GET /olai/who` and attributed `/mcp` writes immediately, while the chip in an open tab stayed anonymous until the process was restarted. That seam is closed ([juspay/kolu#2229](https://github.com/juspay/kolu/pull/2229)): the allowlist is asked of this row at each upgrade, so the tab redials when the row mounts and comes back as whoever the proxy says you are. Off and on are both immediate now, on every door.

**Header names must be valid HTTP names.** A name containing a space cannot be used by a request. An invalid configured family is refused by the identity reading, with its reason; it cannot grant identity to a connection. The proxy must strip client-supplied copies of every trusted header, including default names that remain configured.

## The config

The row's `Config` schema declares header names and avatar template with defaults and descriptions. These are properties on the `identity` node in `_olai/Settings.olai`. Blank `login-header` uses the default; blank `email-header` follows that login header. Blank `name-header` or `picture-header` disables the corresponding claim; blank `avatar-template` disables that picture source. A file edit re-applies the row. Header environment adapters are removed. See [running.md](../running.md#who-is-looking) for proxy examples and the trust boundary.

## On the wire

Nothing, and the absence is the design. Who is looking is one value per **connection**, and the connection is core's: the login arrives on the upgrade, so the answer is minted where the socket is accepted and read back through core's own `who.get` — one procedure on the browser face, answered per connection. `GET /olai/who` stays beside it for a share sheet and a script, which have no websocket. A sibling surface here would be a second door onto a value this row never holds.

What the row stands behind is the `Identity` door (`@olai/plugin-api`): the header names to trust, and the reading over them. Core reads it in three places — the upgrade, the HTTP door, and the `/mcp` route that attributes a capture — and knows a login, a name and a picture URL, already settled. It does not know a header name, a template, or that a picture is resolved down a ladder at all.

## Where it hangs in the tab

| seat | who declares it, and what they keep | what identity brings |
| --- | --- | --- |
| `app.viewer` | `layout` — the last seat in the bar — top right, and the one seat a phone keeps | the chip, its four faces, and every word in them |

There is one seat and one occupant: two chips answering "who am I" in one bar is not an answer, so a second row claiming it is refused by name at the moment it registers.

The browser half offers `identity.viewer`: one scoped resource over `who.get`, the name formatter and the user icon. Its header chip and chat's transcript speaker share that reading. Chat's speaker component names the key in `needs`; with identity off it reads **waiting for identity.viewer** in the plugins panel while the conversation keeps its anonymous silhouette. Re-enabling identity creates a fresh resource and restores the person's name and picture without reloading the page.

The resource follows the connection epoch and closes with the identity provider. The server half declares its browser service words through `Offers.browser`, so `plugins.inspect` lists the key with `half: "browser"` and `availability: "declared"`. That advertises a contract, not a claim about any particular tab's state.

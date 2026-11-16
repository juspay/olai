# identity

Says who the person behind a request is, from the login a reverse proxy puts on it. It draws the chip in the top right of the bar and records `captured-by` on a capture. [../deploying.md](../deploying.md) is the proxy side.

## What turns it off

The row is on by default. Set `on: no` on the `identity` node in `_olai/Settings.olai`, or use its switch, **Identity** under **Notes** on the plugins panel ([../settings.md](../settings.md)).

With it off, every request is nobody: there is no chip in the bar at all, no capture carries `captured-by`, and nothing anywhere is attributed to anybody. That is also what a loopback serve with no proxy in front is.

Both directions take effect at once, with no restart. An open tab redials when the row mounts and comes back as whoever the proxy says you are.

## The chip in the bar

| What it says | When |
| --- | --- |
| **Checking who you are…** | the answer has not arrived yet |
| the person's name with their login beside it, or the login alone when the proxy sent no name | a login arrived |
| **Not signed in** | nobody is named on this request |
| **Couldn't check who you are** | the reading failed |

## Settings

Properties on the `identity` node.

| Key | Default | What it does |
| --- | --- | --- |
| `login-header` | `Tailscale-User-Login` | The header trusted for the login. Blank uses the default |
| `email-header` | blank | The header trusted for the email claim. Blank follows the login header |
| `name-header` | `Tailscale-User-Name` | The header trusted for the display name. Blank leaves the login as the name |
| `picture-header` | `Tailscale-User-Profile-Pic` | The header trusted for a picture. Blank disables that source |
| `avatar-template` | blank | A picture address containing `{login}`, such as `https://github.com/{login}.png`. Blank disables that source |

Editing any of them re-applies the row; the next request is read with the new names.

## Which picture a person wears

Four rungs, asked in order, each only when the one above it had nothing:

1. the picture header the proxy sent;
2. your `avatar-template`, with the login in place of `{login}`;
3. the gravatar of the email claim, and only when that claim really is an address;
4. nothing, which the chip draws as its own silhouette.

A rung that is not an `https:` address is not a picture, and the ladder goes on to the next rung rather than drawing a broken one.

## What it refuses

A trusted header name must be a valid HTTP header name, so a name with a space in it is refused along with the rest of the configured family, with its reason, and that family grants identity to no connection.

> Your proxy must strip client-supplied copies of every trusted header, including the default names that stay configured. Anything that reaches olai with one is whoever it says it is.

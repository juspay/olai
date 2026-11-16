# identity: who is making a request

The `identity` plugin says who is making a request, by reading the login that a reverse proxy in front of olai adds to it.[^what]

## What turns it off

The plugin is on by default. Set `on: no` on the `identity` row in `_olai/Settings.olai`, or use its switch, **Identity** under **Notes** in the plugins panel ([../settings.md](../settings.md)).

With it off, olai treats every request as coming from nobody.[^nobody] Switching it off and switching it on both take effect at once, with no restart.[^redial]

## What the header says about you

A small label in the top right of the header says who olai thinks you are.

| What it says | When |
| --- | --- |
| **Checking who you are…** | the answer has not arrived yet |
| the person's name with their login beside it, or the login alone when the proxy sent no name | a login arrived |
| **Not signed in** | nobody is named on this request |
| **Couldn't check who you are** | the reading failed |

## Where your picture comes from

olai tries four sources in order, and tries the next one only when the one above it gave nothing:[^rung]

1. the picture header the proxy sent;
2. your `avatar-template` setting, with your login written in place of `{login}`;
3. the gravatar of the email address the proxy sent, and only when that really is an address;
4. nothing, and then the label draws a plain silhouette.

## What it refuses

A header name you tell olai to trust has to be a valid HTTP header name.[^refused]

> Your proxy must remove any copy of a trusted header that a client sent, including the default names you leave configured. Anyone who reaches olai carrying one of those headers is whoever the header says they are.

[^what]: What this plugin draws and records: the label in the top right of the header, and the `captured-by` property on a captured row. How you put a proxy in front of olai and have it sign people in is in [../deploying.md](../deploying.md).

[^nobody]: With the plugin off there is no label in the header at all, no captured row carries `captured-by`, and nothing anywhere is attributed to anybody. That is also what you get from a serve on loopback with no proxy in front of it.

[^redial]: When the plugin starts, an open tab reconnects and comes back as whoever the proxy says you are.

[^rung]: A source that gives an address which is not an `https:` address does not count as a picture. olai goes on to the next source rather than drawing a broken picture.

[^refused]: If a header name you configured is not valid, one with a space in it for instance, olai refuses it together with the other header names configured beside it and says why. No connection is then given an identity.

<details>
<summary>Every setting on the identity row</summary>

Properties on the `identity` row of `_olai/Settings.olai`. Editing any of them applies the plugin again, and the next request is read with the new header names.

| Key | Default | What it does |
| --- | --- | --- |
| `login-header` | `Tailscale-User-Login` | The header trusted for the login. Blank uses the default |
| `email-header` | blank | The header trusted for the email address. Blank follows the login header |
| `name-header` | `Tailscale-User-Name` | The header trusted for the display name. Blank leaves the login as the name |
| `picture-header` | `Tailscale-User-Profile-Pic` | The header trusted for a picture. Blank switches that source off |
| `avatar-template` | blank | A picture address containing `{login}`, such as `https://github.com/{login}.png`. Blank switches that source off |

</details>

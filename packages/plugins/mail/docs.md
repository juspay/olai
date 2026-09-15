# Gmail in olai

Process a mailbox where you already think: **in a conversation, in the context of the vault**. A thread enters olai the way a terminal or a CI run does — Gmail stays the record of the mail, the vault records what was decided about it, and the verbs live in the conversation.

The backend is [Himalaya](https://github.com/pimalaya/himalaya) ≥ 2.1.0, whose `[gmail]` account speaks Gmail's REST API with one OAuth 2.0 bearer token. The plugin is named **`mail`**, not `gmail`: the kind and the tools carry the plugin's word, so Himalaya's IMAP and JMAP backends can arrive later without a rename.

**This page describes what is here today: the row, the pinned binary, and connecting an account.** The read tools, the `mail-thread` property, the write verbs and the mail doorbell are the next four steps of the same plan; none of them exists yet, and nothing on this page is a promise about their shape.

## Himalaya comes from the Nix build

There is no `which himalaya`, no PATH probe and no "bring your own Himalaya". The pinned revision in `npins/sources.json` is built into the packaged `olai` and handed to the plugin as one absolute path (`OLAI_HIMALAYA`), which the wrapper bakes and the panel reports as `·wrapper`.

A serve whose environment carries no such path is not broken by an accident — it was not started from the Nix build. The row says so in a sentence naming `nix run`, the packaged binary and the home-manager unit, and that is the whole diagnosis.

## Connecting an account

One step happens outside olai: **create an OAuth client** in Google Cloud Console with the type *Web application*, and register the redirect URI this serve will use. The row tells you the string — it is `https://<where you reach this olai>/_olai/mail/oauth`, and it is drawn under the Connect button.

Then set the two doors in the environment (`environmentFile` for the systemd unit, or the shell for `just serve`):

- `OLAI_MAIL_OAUTH_CLIENT` — the client id;
- `OLAI_MAIL_OAUTH_SECRET` — the client secret, marked secret in the panel: it shows `set` or `unset` and never the value.

Switch the `mail` row on (it is **off by default**, like every plugin that needs a credential) and press **Connect Gmail**. That opens Google in a new tab. Approve the mailbox you want this serve to read, and the callback lands back on this serve, which exchanges the code, asks Gmail who you are, and reports it.

The scope requested is `https://www.googleapis.com/auth/gmail.modify` — read, labels, archive, trash and untrash. It does **not** cover permanent delete, which needs the full `https://mail.google.com/` scope; permanent delete is deliberately not offered rather than widening every account's consent for it.

**One account per serve.** The property values that name a thread carry the account, so a second mailbox is an addition rather than a migration.

## What the row and the pill say

The header pill has three states, so a person can tell *nothing is configured* from *something is wrong*:

- `● mail you@gmail.com` — Himalaya answers for that address;
- `● no mail` (dim) — no account is connected;
- `● mail fault` (alarm) — with the reason in the tooltip: Google's own error word on a refused refresh, the two unset doors, or the missing Nix build.

The panel row carries the same reading plus the verbs. It is filed under **Needs you** exactly when a press can do something about it — Connect when there is no account and the doors are set, Reconnect or Disconnect after a fault. A serve missing the credential doors is not asking: the answer there is an operator's, not a button's.

### What a fault means, and what heals it

Two very different things are drawn as `● mail fault`, and the sentence says which:

- **a verdict** — Google refused the grant (`invalid_grant` and its family), the environment is missing a door, the pinned binary is not there, or the binary answered something this plugin cannot read. Nothing heals these by waiting: a person presses Reconnect, or an operator sets the door and restarts.
- **a wait** — Google was unreachable, answered 5xx, or the mailbox did not answer in time. The refresh token is still good, so the serve KEEPS it and retries on a doubling backoff (30 s, up to ten minutes). While that is happening the row says what failed and the pill carries the words; the serve heals itself, and nobody is asked to consent again. **The pill stays `connected`** for as long as the access token it is replacing is still live — the refresh starts five minutes before it expires — because a `gmail` call would answer in that window; the reading drops to `fault` only once there is no live token to fall back on (a boot whose first refresh never landed, or a token that has since expired).

A fault whose press cannot work (no pinned binary, or a `OLAI_MAIL_GOOGLE` that names something other than loopback) draws **no button at all** — the row explains itself and waits for an operator.

### Two places the row deliberately differs from the photograph

The row's own sentence is drawn from the account cell, and two details are not the prototype's:

- **the fault arm prints the reason VERBATIM** — Google's own `invalid_grant`, the sentence naming the two unset doors, the Nix-build line, or `— retrying` — rather than composing a sentence around it. A fault here is one of several different things (see above), and a composed sentence would have to name a mailbox for all of them, some of which have no mailbox to name;
- **the redirect URI is drawn beside Connect**, which the prototype does not show. It is the one step in the whole design that happens outside olai (creating the OAuth client and registering that URI in Google Cloud Console), and it is only knowable once a page has said where it is — so it is drawn where the button is rather than left to a doc.

## Where the credentials live, and where they do not

Olai never reads or writes `~/.config/himalaya`. What it keeps:

- **the refresh token** in olai's own memory record, `$XDG_STATE_HOME/olai/mail/<hash>.json` — one file per served directory, written 0600, named but never opened by the panel. This is the only thing that has to survive a restart;
- **the access token** in a generated config inside a `mkdtemp` directory of the running process, rewritten whenever the token is refreshed and removed when the row is switched off. The plugin hands that file to the pinned binary with `-c` and nothing else on the machine sees it;
- **the pending authorization** in memory only: a `state` and a PKCE verifier, single-use, good for ten minutes.

Access tokens are refreshed by olai, five minutes before they expire, so a call never has to fail once before it can succeed. **Disconnect** revokes the grant at Google and forgets the record; the access token on disk goes with the generated config when the row's scope closes.

## Deliberately not here

- **Sending and drafts.** No compose, no send, no drafts.
- **Permanent delete** — the scope above, and no verb for it even behind a knob.
- **A second account**, IMAP and JMAP, and an inbox digest over unfiled mail: additive later, none of them shaping what is here.
- **Any way to run this against a Himalaya the Nix build did not pin.**

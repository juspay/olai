# Gmail

Read and act on Gmail in an olai conversation, with your vault as the context. Gmail stays the record of the mail; the vault records what you decided about it.

Turn the `mail` plugin on, connect an account, and ask an agent to read threads, archive, move mail to Trash, apply labels mark it read, or draft a reply. The connection survives restarts. Live thread properties on nodes and waking on new mail are still to come.

Olai talks to Gmail through [Himalaya](https://github.com/pimalaya/himalaya), which is built into every olai release. There is nothing to install. The plugin is called `mail` rather than `gmail` because Himalaya also speaks IMAP and JMAP, and a second kind of mailbox should not need a rename.

## Before you start

You need a Google OAuth client. This is the one step that happens outside olai, and Google offers no way around it.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project. Then **enable the Gmail API** for it: **APIs & Services → Library**, search for *Gmail API*, press **Enable**. A project without it lets you finish every step below and then refuses the first mailbox call with HTTP 403.
2. Configure the consent screen. Google will not let you create a client until this is done. Under **Google Auth Platform** (older consoles call it **OAuth consent screen**), fill in **Branding** with an app name such as `olai`, your email as the support address and as the developer contact, and set **Audience** to **External**. Leave the publishing status as *Testing*; olai is your own app and does not need verification.
3. Still under **Audience**, add your own Google account as a **test user**. In *Testing* status only listed users can approve the app, and a missing entry shows up later as Google refusing the sign-in.
4. Under **Clients** (or **APIs & Services → Credentials**), create an **OAuth client ID** of type **Web application**.
5. Add one **Authorised redirect URI**: the address you reach olai at, followed by `/_olai/mail/oauth`. For example `https://olai.example.net/_olai/mail/oauth`. Olai shows you the exact string on the `mail` row once the plugin is on, so you can copy it from there. Leave **Authorised JavaScript origins** empty; olai completes the sign-in on the server, not from browser scripts.

Google gives you a client ID and a client secret. Put both in the environment olai runs with:

```
OLAI_MAIL_OAUTH_CLIENT=1234567890-abc.apps.googleusercontent.com
OLAI_MAIL_OAUTH_SECRET=GOCSPX-…
```

For the home-manager service that is the `environmentFile` ([running.md](../running.md#environment-doors)). For `just serve`, export them in your shell first. The plugins panel shows whether each one is set; it never shows the secret's value.

## Connecting

1. Open the plugins panel (**⧉** in the header) and switch **mail** on. It is off by default because it needs these credentials.
2. The row moves to **Needs you** and shows a **Connect Gmail** button, with the redirect URI to register above it. If the two environment variables are missing, the row says so instead and shows no button; set them and restart.
3. Press **Connect Gmail**. Google opens in a new tab. Choose the mailbox and approve.
4. Google sends you back to olai. The tab says *Connected as you@gmail.com* and can be closed.

The header now shows `● mail you@gmail.com`, and the row shows the address, how many messages the mailbox holds, when the token was last refreshed, and the permission granted.

Olai asks Google for the `gmail.modify` permission. That covers reading, labelling, archiving, moving to and from Trash, and drafts. The permission technically allows sending too, but olai exposes no send command. It does not cover permanent deletion, and olai will not ask for it. One mailbox per olai.

## What the header pill means

| Pill | Meaning |
| --- | --- |
| `● mail you@gmail.com` | Connected. Hover for details. |
| `● no mail` | No account is connected. Connect one from the plugins panel. |
| `● mail fault` | Something needs attention. The tooltip and the row say what. |

The pill is drawn only while the plugin is on.

## When something goes wrong

The `mail` row in the plugins panel always says what happened in plain words. Most faults fall into two kinds.

**Google or the network was briefly unavailable.** Olai keeps your connection and retries by itself, first after thirty seconds and then at longer intervals up to ten minutes. While the previous token is still valid the pill stays `connected` and the row adds what it is retrying. If the outage outlasts the token, the pill shows `mail fault` until the retry succeeds. You do not need to do anything.

**The Gmail API is not enabled.** The row shows Google's sentence *Gmail API has not been used in project … before or it is disabled*, with a link. Open the link, press **Enable**, and wait. Olai treats this as a temporary condition and keeps retrying, so the row heals within a few minutes with no further press.

**Google no longer accepts the connection.** The row shows Google's own reason, most often `invalid_grant`, which means the permission was revoked from your Google account or expired through disuse. Press **Reconnect** and approve again.

A few faults cannot be fixed with a button, and the row shows none:

- `OLAI_MAIL_OAUTH_CLIENT` or `OLAI_MAIL_OAUTH_SECRET` is not set. Set them and restart olai.
- Olai was started without the built-in Himalaya. This happens only when olai is run outside its Nix build. Use `nix run`, the packaged binary, or the home-manager service.
- `OLAI_MAIL_GOOGLE` is set to something other than a loopback address. This variable exists for olai's own tests and should not be set in a deployment.

If the redirect back to olai fails, the page Google sends you to explains why. The usual causes are a redirect URI that does not match what you registered in Google Cloud, or a Connect that was started more than ten minutes earlier. Press **Connect Gmail** again.

## Disconnecting

Press **Disconnect** on the row. Olai revokes the permission at Google, forgets the stored token, and the pill returns to `no mail`. Switching the plugin off keeps the stored token but stops using it; switching it back on reconnects without asking you again.

## What olai stores

- **A refresh token**, in olai's own state directory at `$XDG_STATE_HOME/olai/mail/`, one file per served directory, readable only by your user. This is what survives a restart.
- **A short-lived access token**, in a temporary config file that olai regenerates every time it refreshes the token and deletes when the plugin is switched off. Olai refreshes it five minutes before it expires.

Nothing is written into your vault, and olai never reads or changes your own `~/.config/himalaya` if you have one.

## Not included

- Sending mail.
- Permanent deletion of messages.
- More than one mailbox, or mailboxes other than Gmail.
- Using a Himalaya other than the one built into olai.

## Asking an agent about your mail

The mail tools are available in every conversation under **olai ✓**. Try:

- “What came in since yesterday? Check the vault for the projects involved.”
- “Read the Nix meetup thread, including its HTML message.”
- “Archive the newsletters and mark the invoice thread read.”
- “Label that thread waiting, then record what we decided in the project node.”
- “Save the invoice attachment so you can read it.”
- “Draft a reply to Ravi about the Nix meetup saying I will be there.”

Search accepts Gmail's usual syntax, including `from:`, `newer_than:1d`, `is:unread`, `has:attachment` and `label:`. Label names are the ones Gmail shows you, such as `waiting`; system labels use names such as `INBOX` and `UNREAD`. Olai uses existing labels and does not create new ones.

Archive removes a thread from the inbox. Trash moves it to Gmail's own Trash, and the agent can restore it. Olai never permanently deletes mail and cannot send mail. olai writes drafts; you send them. A write refused before it is sent changes nothing; if Gmail accepts a write but its follow-up read fails, the reply says the outcome needs checking.

Drafts land in Gmail Drafts for you to review and send. They are plain text only, with no attachments, at most 50 recipients and a 256 KiB body. Replies default to the last sender (Reply-To when present); ask explicitly for copy recipients for reply-all. Updating a draft replaces its complete contents, recipients and subject. The temporary message file is private and removed as soon as the call ends. No reconnect is needed for an existing account.

A thread reply includes plain text and raw HTML where present, with each capped at 64 KiB and a notice when cut. Attachments are listed first, so the agent can check their size before downloading. Files up to 50 MB land in a private mail temporary directory under the serve's runtime directory (or system temporary directory), outside the vault. The agent reads them with its file tools. Switching mail off removes those files; download them again if needed.

If Gmail returns a label ID that its label list no longer names, reads refresh
that list once and show the raw ID if it is still unknown. A missing label name
you ask to add or remove still refuses the write. An attachment that disappears
after reading a thread is reported as a missing attachment on that message.
Attachment stories round KiB sizes to one decimal place.

## Waking an agent when mail arrives

Open your triage agent's conversation and turn **wake on new mail** on in its strip. Connect Gmail in the plugins panel. New inbox mail then wakes that conversation with a digest: sender, subject, date, thread id, unread status and a short preview. A busy conversation receives one combined digest when its turn finishes. Each conversation starts with the switch off; only a person can turn it on.

The first check starts from now, without replaying the inbox. Switch the wake off to stop; turning it back on starts from then. Restarts resume the saved position. If Gmail's history has expired, the watcher starts from now again without replaying the gap. Use `mail_inbox` whenever you want the current inbox, including any mail missed during that gap. Digests show at most 50 threads and say how many more arrived.

Checks default to every two minutes. In `_olai/Settings.olai`, give the `mail` node a `poll` property such as `30s` or `2m`. Changes take effect live. An invalid value warns and uses `2m`. No opted-in conversation means no mailbox polling.

For an `Inbox` agent, paste this charter into its note:

```text
Help me reach inbox zero.
For each arrival, search my vault for the sender, project and earlier decisions.
Read the thread if its preview is not enough.
Propose one action per thread and wait for my yes.
When agreed, record the outcome as a todo or note with a Gmail URL.
Then archive, label or mark the thread as agreed.
Draft replies for me to send; never send mail.
```

Use `https://mail.google.com/mail/u/0/#all/<thread id>` as the todo's `url`. The watcher supplies facts; your charter decides what the agent does with them. The switch is a browser-only choice. An agent can edit a node's properties, but those edits cannot subscribe a conversation to mail.

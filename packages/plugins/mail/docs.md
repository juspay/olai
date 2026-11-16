# Gmail

Read and act on Gmail inside an olai conversation. An agent reads, searches, labels, archives and drafts; olai never sends mail.[^scope]

olai talks to Gmail through [Himalaya](https://github.com/pimalaya/himalaya), which every release carries, so there is nothing to install.[^himalaya]

## Register a Google OAuth client

Google needs an OAuth client of type **Web application**, the one step outside olai, with your account as a test user.[^console] Its redirect address is where you reach olai, followed by `/_olai/mail/oauth`.[^redirect]

Put the client id and secret in olai's environment.[^env]

```
OLAI_MAIL_OAUTH_CLIENT=1234567890-abc.apps.googleusercontent.com
OLAI_MAIL_OAUTH_SECRET=GOCSPX-…
```

## Connect an account

1. Switch **mail** on in the **Plugins** panel.[^off]
2. Press **Connect Gmail** on the row, now under **Needs attention**.[^button]
3. Choose the mailbox in the Google tab and approve.[^grant]
4. Google sends you back. The row then reads `Connected as you@gmail.com`.[^connected]

| Row in the health popover | What it means |
| --- | --- |
| `Mail you@gmail.com` | Connected. Hover for details. |
| `No mail` | No account is connected. Connect one from the plugins panel. |
| `Mail error` | Something needs attention. The tip and the row say what. |

## When something goes wrong

The `mail` row always says what happened in plain words. A brief outage heals itself.[^retry] Otherwise the row asks you to enable the Gmail API,[^api] press **Reconnect**,[^grantfail] or connect again.[^return] Three faults have no button at all.[^nobutton]

## The tools an agent gets

The tools arrive in every conversation under **olai ✓**, listed in the closed block below. Gmail query syntax passes through untouched.[^query] Nothing here deletes mail permanently, and nothing sends it.[^writes] A draft is plain text with files attached.[^draft]

## Waking an agent when mail arrives

Open the conversation you want woken and turn **Alert on new mail** on in its strip. New inbox mail then wakes it with a digest.[^digest] The first check starts from now.[^resume] Checks run every two minutes.[^poll]

[^scope]: Gmail stays the record; your directory records what you decided. An agent can read and search threads, archive them, move them to Trash, label them, mark them read, and write drafts with files attached.

[^himalaya]: The plugin is called `mail` rather than `gmail` because Himalaya also speaks `IMAP` and `JMAP`. `OLAI_HIMALAYA` names the binary this build runs, and the packaged olai bakes it onto the wrapper.

[^console]: Registering the client takes five steps in Google Cloud Console, written out in the closed block at the foot of this page. They enable the Gmail API, fill in the consent screen, add you as a test user, create the client, and give it its redirect address. Google offers no way around them, and hands you a client ID and a client secret at the end.

[^redirect]: The redirect address looks like `https://olai.example.com/_olai/mail/oauth`, and the `mail` row shows you the exact string once the plugin is on. Register it as the one **Authorised redirect URI**. Leave **Authorised JavaScript origins** empty, because olai completes the sign-in on the server.

[^env]: The two variables are `OLAI_MAIL_OAUTH_CLIENT`, the Google OAuth client id for this serve, and `OLAI_MAIL_OAUTH_SECRET`, the client secret that goes with it. The secret is shown in the panel only as whether it is set. For the home-manager service that is the `environmentFile`; for `just serve`, export them in your shell first ([settings](../settings.md)). Two further variables are in the closed block at the foot of this page.

[^off]: mail is off by default, because it needs those credentials. The plugins panel opens from the **Plugins** row at the foot of the header's health-dot popover.

[^button]: The **Connect Gmail** button stands on the `mail` row, with the redirect address to register above it. With the two variables unset, the row says so and shows no button; set them and restart. Pressing it opens Google in a new tab.

[^grant]: olai asks Google for `gmail.modify`, which covers reading, labelling, archiving, moving to and from Trash, and drafts. It technically allows sending, and olai exposes no way to send. It does not cover permanent deletion, and olai will not ask for it. One mailbox per olai.

[^connected]: The connected row also shows the mailbox's size, how long ago the token was refreshed, and the permission granted. A fault turns the health dot red, a connected mailbox whose token is being retried turns it amber, and no account at all leaves it alone. The row is drawn only while the plugin is on.

    Press **Disconnect** on the row to revoke the permission at Google and forget the stored token; the readout returns to `No mail`. Switching the plugin off keeps the token but stops using it, and switching it back on reconnects without asking you again.

[^retry]: A brief outage at Google or on the network keeps your connection: olai retries by itself after thirty seconds, doubling up to ten minutes. While the old token is still valid the readout stays connected and the row adds what it is retrying. If the outage outlasts the token, the readout shows `Mail error` until a retry succeeds. There is nothing for you to do.

[^api]: With the Gmail API not enabled, the row shows Google's sentence, *Gmail API has not been used in project … before or it is disabled*, with a link. Open it, press **Enable**, and wait: olai keeps retrying, so the row heals within a few minutes.

[^grantfail]: When Google stops accepting the connection, the row shows Google's own reason, most often `invalid_grant`, meaning the permission was revoked or expired through disuse. Press **Reconnect** and approve again.

[^return]: If the return from Google fails, the page it sends you to says why. The usual causes are a redirect address that does not match the one you registered, or a connect begun more than ten minutes earlier. Press **Connect Gmail** again.

[^nobutton]: Three faults carry no button, because no press can fix them: `OLAI_MAIL_OAUTH_CLIENT` or `OLAI_MAIL_OAUTH_SECRET` unset, an olai started without its built-in Himalaya, which happens only outside the Nix build, and `OLAI_MAIL_GOOGLE` set to something that is not a loopback address.

[^query]: Gmail query syntax reaches Gmail as you wrote it, including `from:`, `newer_than:1d`, `is:unread`, `has:attachment` and `label:`. Label names are the ones Gmail shows, such as `waiting`, and system labels use `INBOX`, `UNREAD`, `STARRED` and `IMPORTANT`. olai uses existing labels and creates none.

[^writes]: A write refused before it is sent changes nothing. Where Gmail accepts a write but the follow-up read fails, the reply says the outcome needs checking. A label ID that Gmail's label list does not name refreshes that list once, then shows the raw ID. A name you ask to add or remove that does not exist refuses the write. An attachment that disappears between reading a thread and fetching it is reported as missing on that message.

[^draft]: A draft's body is plain text only, at most 256 KiB, with at most 50 recipients. It carries at most ten files, none over 25 MB and 25 MB in all, which is Gmail's own ceiling. Which paths are attachable, how a reply picks its recipients, and what an update replaces are in the closed block at the foot of this page.

[^digest]: A digest names the sender, subject, date, thread id, unread status and a short preview. A busy conversation gets one combined digest when its turn finishes. A digest shows at most 50 threads and says how many others arrived. Each conversation starts with the switch off, and only a person can turn it on: an agent can edit a node's properties, but those edits cannot subscribe a conversation to mail.

[^resume]: The first check starts from now and does not replay the inbox. Switching the wake off stops it; turning it back on starts from then, and restarts resume the saved position. If Gmail's history has expired, the watcher starts from now again. Use `mail_inbox` for anything missed.

[^poll]: The `poll` setting says how often olai checks for new mail: `2m` by default, and any positive duration with a unit, such as `30s`. Give the `mail` node that property in `_olai/Settings.olai`, or set it under the mail heading in the Preferences panel. Changes take effect live, an invalid value warns and falls back to `2m`, and no opted-in conversation means no polling at all.

<details>
<summary>Registering the OAuth client, step by step</summary>

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project, then enable the Gmail API for it: **APIs & Services → Library**, search for *Gmail API*, press **Enable**. A project without it lets you finish every step below and then refuses the first mailbox call with HTTP 403.
2. Configure the consent screen; Google will not let you create a client first. Under **Google Auth Platform**, which older consoles call **OAuth consent screen**, fill in **Branding** with an app name such as `olai`, your email as the support address and as the developer contact, and set **Audience** to **External**. Leave the publishing status as *Testing*.
3. Still under **Audience**, add your own Google account as a **test user**. In *Testing* status only listed users can approve the app, and a missing entry shows up later as Google refusing the sign-in.
4. Under **Clients**, or **APIs & Services → Credentials**, create an **OAuth client ID** of type **Web application**.
5. Add one **Authorised redirect URI**: the address you reach olai at, followed by `/_olai/mail/oauth`.

</details>

<details>
<summary>Every environment variable mail reads</summary>

| Environment variable | What it says |
| --- | --- |
| `OLAI_MAIL_OAUTH_CLIENT` | The Google OAuth client id, of type Web application, for this serve. |
| `OLAI_MAIL_OAUTH_SECRET` | The client secret that goes with it. A secret, so the panel shows only whether it is set. |
| `OLAI_HIMALAYA` | The Himalaya binary this build runs. The packaged olai bakes it onto the wrapper. |
| `OLAI_MAIL_GOOGLE` | The Google origin this serve talks to. Loopback only, for olai's own tests, and unset in every deployment. |

</details>

<details>
<summary>Every tool, one line each</summary>

| Tool | What it does |
| --- | --- |
| `mail_inbox` | Lists inbox threads, 1 to 50 at a time, 20 by default, optionally unread only. |
| `mail_search` | Searches threads by Gmail query, optionally including spam and trash. |
| `mail_thread` | Reads a thread's messages, plain text and raw HTML, each capped at 64 KiB. Lists attachments without fetching them. |
| `mail_attachment` | Saves one attachment, up to 50 MB, in mail's temporary directory. |
| `mail_archive` | Removes a thread from the inbox. |
| `mail_trash` | Moves a thread to Gmail's Trash. |
| `mail_untrash` | Restores a thread from Trash. |
| `mail_label` | Adds or removes existing labels by name, 1 to 10 each way. |
| `mail_read` | Marks a thread read or unread. |
| `mail_draft` | Writes a draft in Gmail Drafts for you to review and send. |
| `mail_draft_update` | Replaces a draft's whole contents. |

</details>

<details>
<summary>What a draft may carry, and what an update replaces</summary>

Replies default to the last message's Reply-To or From recipients, or to its To recipients where you sent it. A thread naming no recipient makes olai ask you for `to`. Ask explicitly for copy recipients when you want a reply to all, and pass the same thread again to keep a reply draft threaded.

Any absolute path this serve can read is attachable: files you dropped into the conversation, files saved by `mail_attachment`, and files in your directory. A path that is missing, unreadable, not a file, too big, or that would land two files under one name refuses the whole draft before anything reaches Gmail.

Updating a draft replaces its recipients, subject, body and attachments entirely, so omitted attachments are dropped. Downloaded attachments live outside your directory, under the serve's runtime directory, and switching mail off removes them.

</details>

<details>
<summary>What olai keeps on disk</summary>

- A refresh token, under `$XDG_STATE_HOME/olai/mail/`, one file per served directory, readable only by your user. This is what survives a restart.
- A short-lived access token, in a temporary config file that olai rewrites on each refresh and deletes when the plugin is switched off. olai refreshes it five minutes before it expires.

Nothing is written into your directory, and olai never reads or changes your own `~/.config/himalaya`.

</details>

<details>
<summary>A charter for an inbox agent</summary>

Paste this into the agent's note:

```text
Help me reach inbox zero.
For each arrival, search my vault for the sender, project and earlier decisions.
Read the thread if its preview is not enough.
Propose one action per thread and wait for my yes.
When agreed, record the outcome as a todo or note with a Gmail URL.
Then archive, label or mark the thread as agreed.
Draft replies for me to send; never send mail.
```

Use `https://mail.google.com/mail/u/0/#all/<thread id>` as the row's `url`. The watcher supplies facts; your charter decides what the agent does with them.

</details>

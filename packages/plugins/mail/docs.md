# Gmail

Read and act on your Gmail inside an olai conversation, which is one chat with an agent. olai itself never sends mail.[^scope]

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
2. Press **Connect Gmail** on the `mail` line, now under **Needs attention**.[^button]
3. Choose the mailbox in the Google tab and approve.[^grant]
4. Google sends you back. The line then reads `Connected as you@gmail.com`.[^connected]

| Health dot line | What it means |
| --- | --- |
| `Mail you@gmail.com` | Connected. Hover for details. |
| `No mail` | No account is connected. Connect one from the plugins panel. |
| `Mail error` | Something needs attention. The tip and the line say what. |

## When something goes wrong

The `mail` line in the **Plugins** panel says what happened. A brief outage heals itself.[^retry] Otherwise the line asks you to enable the Gmail API,[^api] press **Reconnect**,[^grantfail] or connect again.[^return] Three faults have no button.[^nobutton]

## The tools an agent gets

Every conversation gets the tools under **olai ✓**, listed below. Gmail's search syntax reaches Gmail unchanged.[^query] Nothing here deletes mail for good, and nothing sends it.[^writes] A draft is plain text with files attached.[^draft] One call can change up to 50 threads.[^bulk]

## Waking an agent when mail arrives

Open the conversation you want woken and turn **Alert on new mail** on.[^switch] New mail in the inbox then wakes it with a summary.[^digest] The first check starts from now.[^resume] Checks run every two minutes.[^poll]

[^scope]: Gmail keeps your mail; the directory olai serves keeps what you decided about it. An agent can read and search threads, archive them, move them to Trash, label them, mark them read, and write drafts with files attached.

[^himalaya]: The plugin is called `mail` rather than `gmail` because Himalaya also speaks `IMAP` and `JMAP`. `OLAI_HIMALAYA` names the Himalaya program this build runs, and the wrapper that starts the packaged olai sets it to the one olai ships.

[^console]: Registering the client takes five steps in Google Cloud Console, written out in the closed block at the foot of this page. They enable the Gmail API, fill in the consent screen, add you as a test user, create the client, and give it its redirect address. Google offers no way around them, and hands you a client ID and a client secret at the end.

[^redirect]: The redirect address looks like `https://olai.example.com/_olai/mail/oauth`, and the `mail` line in the **Plugins** panel shows you the exact string once the plugin is on. Register it as the one **Authorised redirect URI**. Leave **Authorised JavaScript origins** empty, because olai completes the sign-in on the server.

[^env]: The two variables are `OLAI_MAIL_OAUTH_CLIENT`, the Google OAuth client id for this olai server, and `OLAI_MAIL_OAUTH_SECRET`, the client secret that goes with it. The panel shows only whether the secret is set, not its value. For the home-manager service that is the `environmentFile`; for `just serve`, export them in your shell first ([settings](../settings.md)). Two further variables are in the closed block at the foot of this page.

[^off]: mail is off by default, because it needs those credentials. The plugins panel opens from the **Plugins** entry at the foot of the list that the header's health dot opens.

[^button]: The **Connect Gmail** button stands on the `mail` line, with the redirect address to register above it. With the two variables unset, the line says so and shows no button; set them and restart. Pressing the button opens Google in a new tab.

[^grant]: olai asks Google for `gmail.modify`, which covers reading, labelling, archiving, moving to and from Trash, and drafts. It technically allows sending, and olai exposes no way to send. It does not cover permanent deletion, and olai will not ask for it. One mailbox per olai.

[^connected]: The connected line also shows the mailbox's size, how long ago the token was refreshed, and the permission granted. A fault turns the health dot red, a connected mailbox whose token is being retried turns it amber, and no account at all leaves it alone. The line is drawn only while the plugin is on.

    Press **Disconnect** on the line to withdraw the permission at Google and forget the stored token; the health dot's line returns to `No mail`. Switching the plugin off keeps the token but stops using it, and switching it back on reconnects without asking you again.

[^retry]: A brief outage at Google or on the network keeps your connection: olai retries by itself after thirty seconds, doubling the wait up to ten minutes. While the old token is still valid the health dot's line stays connected, and the `mail` line adds what it is retrying. If the outage outlasts the token, the health dot's line shows `Mail error` until a retry succeeds. There is nothing for you to do.

[^api]: With the Gmail API not enabled, the line shows Google's sentence, *Gmail API has not been used in project … before or it is disabled*, with a link. Open it, press **Enable**, and wait: olai keeps retrying, so the line clears within a few minutes.

[^grantfail]: When Google stops accepting the connection, the line shows Google's own reason, most often `invalid_grant`, which means the permission was withdrawn or expired through disuse. Press **Reconnect** and approve again.

[^return]: If the return from Google fails, the page it sends you to says why. The usual causes are a redirect address that does not match the one you registered, or a connection begun more than ten minutes earlier. Press **Connect Gmail** again.

[^nobutton]: Three faults carry no button, because no press can fix them: `OLAI_MAIL_OAUTH_CLIENT` or `OLAI_MAIL_OAUTH_SECRET` unset, an olai started without its built-in Himalaya, which happens only outside the Nix build, and `OLAI_MAIL_GOOGLE` set to something that is not a loopback address.

[^query]: Gmail query syntax reaches Gmail as you wrote it, including `from:`, `newer_than:1d`, `is:unread`, `has:attachment` and `label:`. Label names are the ones Gmail shows, such as `waiting`, and system labels use `INBOX`, `UNREAD`, `STARRED` and `IMPORTANT`. olai uses existing labels and creates none.

[^writes]: A write refused before it is sent changes nothing. Where Gmail accepts a write but the follow-up read fails, the reply says the outcome needs checking. A label ID that Gmail's label list does not name refreshes that list once, then shows the raw ID. A name you ask to add or remove that does not exist refuses the write. An attachment that disappears between reading a thread and fetching it is reported as missing on that message.

[^draft]: A draft's body is plain text only, at most 256 KiB, with at most 50 recipients. It carries at most ten files, none over 25 MB and 25 MB in all, which is Gmail's own ceiling. Which paths are attachable, how a reply picks its recipients, and what an update replaces are in the closed block at the foot of this page.

[^bulk]: `mail_bulk` archives, moves to Trash, restores, marks or labels up to 50 threads in one call. Threads named by ID change at once. For threads named by a Gmail query, the first call changes nothing: it lists what matches, with a short preview, and returns a code. The agent shows you that preview, then calls again with the code, refused if the matches changed meanwhile.

    The reply lists every thread with what happened to it: applied, unchanged, failed or skipped. A failure that is not about one thread, such as Gmail's rate limit, stops the run and says why.

[^switch]: The **Alert on new mail** switch stands in the conversation's own strip of switches. Each conversation starts with it off, and only a person can turn it on: an agent can edit the properties on a row, one line of an outline, but those edits cannot subscribe a conversation to mail.

[^digest]: The summary names each thread's sender, subject, date, thread id and unread status, with a short preview. A conversation that is busy gets one combined summary when its turn finishes. A summary shows at most 50 threads and says how many others arrived.

[^resume]: The first check starts from the moment you switch the alert on, and does not go back over the inbox. Switching the alert off stops the checks; turning it back on starts from that moment, and a restart carries on from where olai had got to. If Gmail's record of what changed has expired, olai starts from now again. Use `mail_inbox` for anything missed.

[^poll]: The `poll` setting says how often olai checks for new mail: `2m` by default, and any positive length of time with a unit, such as `30s`. Give the `mail` entry that property in `_olai/Settings.olai`, or set it under the mail heading in the Preferences panel. Changes take effect at once, an invalid value warns and falls back to `2m`, and no conversation with the alert on means no checking at all.

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
| `OLAI_MAIL_OAUTH_CLIENT` | The Google OAuth client id, of type Web application, for this olai server. |
| `OLAI_MAIL_OAUTH_SECRET` | The client secret that goes with it. A secret, so the panel shows only whether it is set. |
| `OLAI_HIMALAYA` | The Himalaya program this build runs. The wrapper that starts the packaged olai sets it to the one olai ships. |
| `OLAI_MAIL_GOOGLE` | The Google address this olai server talks to. Loopback only, for olai's own tests, and unset in every deployment. |

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
| `mail_bulk` | Archives, moves to Trash, restores, marks or labels up to 50 threads in one call, named by ID or by a Gmail query. A query is previewed first. |
| `mail_draft` | Writes a draft in Gmail Drafts for you to review and send. |
| `mail_draft_update` | Replaces a draft's whole contents. |

</details>

<details>
<summary>What a draft may carry, and what an update replaces</summary>

Replies default to the last message's Reply-To or From recipients, or to its To recipients where you sent it. A thread naming no recipient makes olai ask you for `to`. Ask explicitly for copy recipients when you want a reply to all, and pass the same thread again to keep a reply draft threaded.

A draft can attach any absolute path this olai server can read: files you dropped into the conversation, files saved by `mail_attachment`, and files in your directory. A path that is missing, unreadable, not a file, too big, or that would land two files under one name refuses the whole draft before anything reaches Gmail.

Updating a draft replaces its recipients, subject, body and attachments entirely, so omitted attachments are dropped. Downloaded attachments live outside your directory, under the server's own runtime directory, and switching mail off removes them.

</details>

<details>
<summary>What olai keeps on disk</summary>

- A refresh token, under `$XDG_STATE_HOME/olai/mail/`, one file per served directory, readable only by your user. This is what survives a restart.
- A short-lived access token, in a temporary config file that olai rewrites on each refresh and deletes when the plugin is switched off. olai refreshes it five minutes before it expires.

Nothing is written into your directory, and olai never reads or changes your own `~/.config/himalaya`.

</details>

<details>
<summary>Instructions for an inbox agent</summary>

Paste this into the agent's note:

```text
Help me reach inbox zero.
For each arrival, search my vault for the sender, project and earlier decisions.
Read the thread if its preview is not enough.
Propose one action per thread and wait for my yes.
When agreed, record the outcome as a todo or note with a Gmail URL.
Then archive, label or mark the thread as agreed.
For a change to many threads by query, show me its preview and wait for my yes.
Draft replies for me to send; never send mail.
```

Use `https://mail.google.com/mail/u/0/#all/<thread id>` as the row's `url`. The alert on new mail supplies the facts; these instructions decide what the agent does with them.

</details>

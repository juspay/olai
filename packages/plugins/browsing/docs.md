# Your browser, shared with your agents

The **browsing** plugin is on by default. olai runs **one real Chromium per
served directory**, headless, with a profile of its own that persists across
restarts. Every new conversation, with any ACP engine, is handed a Playwright
MCP server attached to that Chromium, so agents navigate, click, type, read
snapshots and take screenshots in **your** browser. The **`/browser`** page
shows its tabs live and lets you use them by hand.

That is the point: sign in to a site once in the pane, and every agent
conversation afterwards is signed in too. The browser is yours; the agents
are guests in it.

## The pane

Open it from the **Browser** row in the bar's health popover, from the palette
(**Open browser**), or from the **browser** chip on a conversation's tool
roster, which links here. `/browser` shows the first tab; `/browser/<id>` is
one tab's own address, so a tab can sit in a pane of its own (Alt opens it to
the right, as any link does) and its page title is the pane's title.

- **Start.** Nothing launches until something asks: the first conversation
  that probes for browser tools, or **Start** in the pane. The banner says
  whether the browser is not running, starting, or stopped with the reason.
- **Tabs.** The strip lists every open page, yours and the agents'. **+** opens
  a new tab and goes to it; **×** closes one.
- **Address bar.** Shows the tab's live URL; type a URL and press Enter to go
  there. Words that are not a URL are searched on **DuckDuckGo**
  (`https://duckduckgo.com/?q=…`) — the one place the pane sends what you
  typed to a third party, and only because you pressed Enter on it.
- **The page.** A live picture of the tab. Press, drag and scroll on it as on a
  page. Click it and **keys go to the page** — the line under it says so — and
  pasting sends the clipboard's text. **Esc** gives the keys back to olai.
- **Forget sign-ins.** Asks first, then stops the browser and deletes its
  profile: every cookie, saved login and site storage it held. The next start
  is a fresh browser.

The picture is the browser's own screencast of that tab, so a pane that nobody
is looking at costs nothing: the screencast starts when the first pane opens on
a tab and stops when the last one closes. Several panes on one tab share it,
and panes on different tabs each stay live: every tab is kept painting even
when another is in front, so watching an agent's tab never freezes yours.

This is the one live face in olai that writes back to what it shows. A
terminal pane is read-only because the terminal is the agent's hand; this
browser is **yours**, so your hand is on it, and the agents keep their own
Playwright for theirs.

## Where it lives, and who owns it

`OLAI_BROWSER_CHROMIUM` names the Chromium executable. The packaged olai
points it at the full Chromium from the same pinned Playwright browsers bundle
the MCP's wrapper uses (not the headless shell, which real sign-in flows
tolerate less well). Set it to another absolute executable to override it.

The profile is at `$XDG_STATE_HOME/olai/browsing/<digest>/profile` (by default
`~/.local/state/olai/…`), one per served directory, created owner-only. Its
cookies are encrypted with a key Chromium keeps in the profile rather than in
the OS secret store (GNOME Keyring, the macOS Keychain), because olai runs it
as a service with nobody there to answer a Keychain prompt; the profile
directory's owner-only mode is what protects them at rest. It
survives olai restarting. olai removes it when you **Forget sign-ins**, and
when the served directory itself no longer exists.

**The plugin row owns the browser.** olai launches it, keeps it for the life of
the serve, and stops it — SIGTERM, a short grace, then SIGKILL, its helper
processes with it — when the row is switched off or olai stops. olai speaks to
it over Chromium's DevTools pipe, so even an olai that crashes or is killed
outright takes the browser with it rather than leaving one running with your
profile. A browser that crashes is reported in the pane, and the next
conversation or **Start** launches it again.

### When the container is the sandbox

By default Chromium runs inside its own sandbox, which needs unprivileged user
namespaces or a setuid helper. Some hosts have neither: Ubuntu 23.10+ under its
AppArmor default, and hardened containers — a Kubernetes pod with seccomp
`RuntimeDefault`, every capability dropped and no privilege escalation. There
Chromium will not start. The pane and chat both say why, in Chromium's own
words (`No usable sandbox!`), and name the switch below.

`OLAI_BROWSER_CHROMIUM_SANDBOX` says what Chromium's sandbox is:

- `chromium` (the default; unset or empty means the same): Chromium's own.
- `container`: the container is the boundary, so Chromium launches without
  its own (`--no-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage`).

olai never chooses `container` for you or tries to detect such a host. Any
other value fails the launch with a sentence naming the two words. That
includes `on`/`off`, `yes`/`no` and `true`/`false`, on purpose: YAML 1.1
reads all six as booleans, so in a Kubernetes manifest an unquoted `off`
becomes `false`, the env entry is rejected, and the variable never reaches
the pod. The two words above need no quoting anywhere.

**What you give up.** Chromium's sandbox is what stands between a hostile
web page and the process running it. Without it, a page that exploits a
renderer bug runs with olai's own user and everything that user can reach —
your vault, this browser's signed-in profile, the agents' tools. Turn it off
only where something else is the boundary: a container or VM that holds
nothing but this olai and its data. That is the trade the isolated handoff made
silently before olai ran its own browser: Playwright launches Chromium with
`--no-sandbox` by default. Here you make it explicitly, and only for this one
browser.

The package's hermetic Nix check launches with the same flags, because a build
sandbox has no user namespaces either; that browser holds no profile and visits
only loopback.

**Switching the row off revokes the browser from running conversations.**
Their MCP servers were attached to this browser, and it is gone; a
conversation started after the row is back on is attached to the new one.
Switching it off also withdraws browser tools from future conversations and
removes the pane.

## How conversations attach

Each conversation, olai first asks the MCP executable (`OLAI_BROWSER_MCP`, the
pinned Playwright MCP by default) for its tool list in a disposable process
that launches no browser. Only a compatible answer launches the browser, and
the conversation is then handed the same executable with `--cdp-endpoint`
naming the browser's DevTools socket. The Playwright MCP opens its own pages
in the browser's default context — your cookies and storage — so its tabs
appear in the pane's strip. Its `browser_close` lets go of the browser; it
does not close it, and the pages it opened stay open until you close them.

The pinned MCP's Nix wrapper would otherwise ask for an isolated in-memory
context, a cookie jar of its own; olai hands it `PLAYWRIGHT_MCP_USER_DATA_DIR`
(the profile above) and `PLAYWRIGHT_MCP_ISOLATED=false` so it uses yours.

An unset or empty `OLAI_BROWSER_MCP` omits browser tools. A non-executable
file, a failed or timed-out MCP handshake, an incompatible tool list, or a
browser that cannot start produces a sentence in chat. Each conversation
probes again, so a repair takes effect at the next conversation.

**Without a browser of olai's.** An empty `OLAI_BROWSER_CHROMIUM` gives each
conversation what it had before this plugin owned a browser: a headless,
isolated, in-memory browser its MCP launches for itself, sharing nothing and
keeping nothing. The pane then says why there is nothing to show.

## Files the agents write

Screenshots can reach the agent inline over MCP. File output uses private
scratch under `XDG_RUNTIME_DIR`, falling back to the system temporary directory;
each conversation gets a distinct 0700 subdirectory, and failed probes create
none. These paths prevent accidental mixing of artifacts; they are not a
sandbox against agents running as the same OS user. Scratch is never the vault
or the agent's working directory, it is not durable storage, and the row
removes it when switched off or when olai stops.

## What this means for safety

**Agents browse with your real sessions.** Anything you are signed in to in
this browser, every agent conversation can use — read your mail, post as you,
spend in a shop — with the same permissions you have there. Sign in only to
what you want agents to act on.

**Web pages are untrusted input.** A page can contain instructions written to
redirect an agent, and here that agent holds both your signed-in browser and
permission to write to your vault. Review what agents do accordingly.

To take this away: **Forget sign-ins** empties the browser; setting
`OLAI_BROWSER_CHROMIUM` to an empty string gives conversations isolated,
sessionless browsers again; turning **browsing** off in the plugins panel, or
setting `OLAI_BROWSER_MCP` to an empty string, removes web tools altogether.

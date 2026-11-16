# Your browser, shared with your agents

olai runs one real Chromium per served directory, headless, with a profile of its own. Every conversation is handed browser tools attached to that Chromium, and the **Browser** page shows its tabs live for you to use by hand. Sign in to a site once and every agent is signed in too.

This plugin is on by default.

## Open the browser page

Reach it from the **Browser** door in the sidebar, the **Browser** row in the header's health popover, the palette's **Open browser**, or the **browser** chip on a conversation's tool roster. The door's dot speaks only when something needs saying, such as a failed launch.

`/browser` shows the first tab, and `/browser/<id>` is one tab's own address, so a tab can sit in a pane of its own and its page title is the pane's title.

| On the page | What it does |
| --- | --- |
| **Start** | Launches the browser. Nothing launches until something asks: this button, or the first conversation that probes for browser tools. |
| the tab strip | Lists every open page, yours and the agents'. **New tab** opens one and goes to it; the close control shuts one. |
| **Address** | Shows the tab's live URL. Type one and press `Enter` to go there. |
| the page | A live picture of the tab. Click, drag and scroll on it. |
| **Forget sign-ins** | Asks first, then stops the browser and deletes its profile. |

Words that are not a URL are searched on DuckDuckGo, at `https://duckduckgo.com/?q=…`, which is the one place the page sends what you typed to a third party. The address box stays an ordinary text box, so `example.com` is something you can type, and nothing in it is capitalized, autocorrected or spell-checked.

Click the picture and keys go to the page: the line under it reads `Keys go to the page. Press Esc to give them back.`, and pasting sends the clipboard's text. `Esc` gives the keys back to olai. **Forget sign-ins** deletes every cookie, saved login and site storage the profile held, and the next start is a fresh browser.

The banner says what the browser is doing: `The browser is not running.`, `Starting the browser…`, or the reason it stopped. A tab that has closed under you reads `This tab is no longer open.`

## How big the page is

The browser starts at 1280×800. From then on the page's viewport follows the box the pane draws it in, within 320×240 and 3840×2160 CSS pixels. Resizing a split or turning a phone lays the page out again at that size, so the picture fills the pane one to one.

Each tab is sized on its own. Two panes on two tabs each get their own size; two panes on one tab share it, and the one that changed last wins. An agent's page is resized only while a pane shows it, and otherwise keeps the size its own tools left it at.

While a pane is changing size, the picture still shows the old layout until a frame at the new size arrives, so a press in that moment is ignored rather than landing somewhere you did not point.

The picture is the browser's own screencast, so a pane nobody is looking at costs nothing: the screencast starts when the first pane opens on a tab and stops when the last one closes. A hidden pane counts as closed, whether its tab is in the background or its column is folded away. It keeps its last picture, watches nothing, and its size does not steer the page. Every tab keeps painting while another is in front.

The pane is yours to type in. The agents hold their own browser tools for theirs.

## What olai runs, and where it keeps it

| Environment variable | What it says |
| --- | --- |
| `OLAI_BROWSER_CHROMIUM` | The absolute Chromium executable olai runs. Empty gives each conversation an isolated browser instead. |
| `OLAI_BROWSER_MCP` | The absolute Playwright MCP executable. Empty withdraws browser tools. |
| `OLAI_BROWSER_CHROMIUM_SANDBOX` | What that Chromium's sandbox is: `chromium` or `container`. |

The packaged olai points `OLAI_BROWSER_CHROMIUM` at the full Chromium from the same pinned Playwright browsers bundle its MCP wrapper uses, rather than the headless shell, which real sign-in flows tolerate less well. Set it to another absolute executable to override it.

olai does not announce headless. Every page sees the user agent a headed Chrome of the same version sends on the same operating system, read from the executable's own `--version`, and it never claims to be another browser.

The profile lives at `$XDG_STATE_HOME/olai/browsing/<digest>/profile`, by default under `~/.local/state`, one per served directory, created owner-only. The profile survives a restart. olai removes it when you press **Forget sign-ins**, and when the served directory stops existing.

Its cookies are encrypted with a key Chromium keeps in the profile rather than in the system secret store, because olai runs it as a service with nobody there to answer a prompt. The directory's owner-only mode is what protects them at rest.

## Who owns the browser

olai launches it, keeps it for the life of the serve, and stops it when the plugin row is switched off or olai stops. Stopping is `SIGTERM`, a short grace, then `SIGKILL`, taking its helper processes with it. olai speaks to it over Chromium's DevTools pipe, so an olai that crashes or is killed takes the browser with it. A browser that crashes is reported on the page, and the next conversation or **Start** launches it again.

This plugin reads no settings of its own beyond `on`. Set `on: no` on the `browsing` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)). Switching the row off revokes the browser from running conversations, withdraws browser tools from future ones, and removes the page. A conversation started after the row is back on is attached to the new browser.

## When the container is the sandbox

Chromium's own sandbox needs unprivileged user namespaces or a setuid helper. Some hosts have neither: Ubuntu 23.10 and later under their AppArmor default, and hardened containers such as a Kubernetes pod with seccomp `RuntimeDefault`, every capability dropped and no privilege escalation. There Chromium will not start, and both the page and chat say so in Chromium's own words, `No usable sandbox!`, naming the switch.

`OLAI_BROWSER_CHROMIUM_SANDBOX` takes two words:

- `chromium`, the default, which unset or empty also means: Chromium keeps its own sandbox.
- `container`: the container is the boundary, so Chromium launches with `--no-sandbox`, `--disable-gpu` and `--disable-dev-shm-usage`.

olai never chooses `container` for you and never tries to detect such a host. Any other value fails the launch with a sentence naming the two words. That includes `on`, `off`, `yes`, `no`, `true` and `false`, on purpose: YAML 1.1 reads all six as booleans, so in a Kubernetes manifest an unquoted `off` becomes `false`, the entry is rejected, and the variable never reaches the pod. The two words above need no quoting anywhere.

> Chromium's sandbox is what stands between a hostile web page and the process running it. Without it, a page that exploits a renderer bug runs as olai's own user, reaching your directory, this browser's signed-in profile and the agents' tools. Set `container` only where a container or virtual machine holds nothing but this olai.

## How a conversation attaches

Each conversation, olai first asks the executable `OLAI_BROWSER_MCP` names, the pinned Playwright MCP by default, for its tool list in a disposable process that launches no browser. Only a compatible answer launches the browser. The conversation is then handed that same executable with `--cdp-endpoint` naming the browser's DevTools socket.

Its tools open pages in the browser's default context, your cookies and storage, so their tabs appear in the strip. Its `browser_close` lets go of the browser rather than closing it, and the pages it opened stay open until you close them.

olai hands the MCP `PLAYWRIGHT_MCP_USER_DATA_DIR`, the profile above, and `PLAYWRIGHT_MCP_ISOLATED=false`, so it uses your browser rather than a cookie jar of its own.

An unset or empty `OLAI_BROWSER_MCP` omits browser tools altogether. A non-executable file, a failed or timed-out handshake, an incompatible tool list, or a browser that cannot start each produce a sentence in the conversation. Every conversation probes again, so a repair takes effect at the next one.

An empty `OLAI_BROWSER_CHROMIUM` gives each conversation a headless, isolated, in-memory browser that its own MCP launches, sharing nothing and keeping nothing. The page then says why there is nothing to show.

Screenshots can reach the agent inline. File output goes to private scratch under `XDG_RUNTIME_DIR`, falling back to the system temporary directory, with a distinct `0700` subdirectory per conversation and none for a failed probe. Those paths keep artefacts from mixing; they are not a sandbox against agents running as the same user. Scratch is never your directory and never durable, and the row removes it when it is switched off or olai stops.

## What this means for safety

Agents browse with your real sessions. Anything you are signed in to here, every conversation can use: read your mail, post as you, spend in a shop, with the permissions you have. Sign in only to what you want agents to act on.

Web pages are untrusted input. A page can carry instructions written to redirect an agent, and that agent holds both your signed-in browser and permission to write to your directory. Review what agents do accordingly.

To take it away: **Forget sign-ins** empties the browser, an empty `OLAI_BROWSER_CHROMIUM` gives conversations isolated, sessionless browsers, and switching **browsing** off in the plugins panel ([settings](../settings.md)) or emptying `OLAI_BROWSER_MCP` removes web tools entirely.

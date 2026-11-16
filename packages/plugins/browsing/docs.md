# Your browser, shared with your agents

olai runs one real Chromium per served directory, with no window on screen and a profile of its own.[^tools]

Sign in to a site once and every agent is signed in too.

## Open the browser page

Click **Browser** in the sidebar.[^doors] `/browser` shows the first tab; `/browser/<id>` is one tab's address.[^pane]

| On the page | What it does |
| --- | --- |
| **Start** | Launches the browser[^attach] |
| the tab strip | Every open page, yours and the agents' |
| **Address** | The tab's live URL; type one here |
| the page | A live picture, to click, drag and scroll on[^size] |
| **Forget sign-ins** | Asks first, then stops the browser and deletes its profile |

Words that are not a URL go to DuckDuckGo.[^search] Click the picture and your keystrokes go to the page.[^keys] A banner says what the browser is doing.[^banner] The picture is a live video stream, sized per tab.[^cast][^pertab]

## What olai runs, and where it keeps it

Three environment variables name the Chromium and the Playwright MCP this serve runs.[^env] The profile sits under `$XDG_STATE_HOME/olai/browsing/`, one per served directory.[^profile] A web page cannot tell this Chromium has no window.[^agent]

## Running Chromium without its own sandbox

`OLAI_BROWSER_CHROMIUM_SANDBOX` takes `chromium`, the default, which keeps Chromium's own sandbox, or `container`, which runs it with `--no-sandbox`.[^words] Some hosts give that sandbox nothing to build on.[^nosandbox] Weigh what it protects first.[^risk]

## What this means for safety

Treat every web page as untrusted: it can carry instructions aimed at your agent.[^injection] You can take the browser away.[^away]

> Agents browse with your real sessions. Anything you are signed in to here, every conversation can use: read your mail, post as you, spend in a shop, with the permissions you have. Sign in only to what you want agents to act on.

[^tools]: Every conversation is handed browser tools attached to that one Chromium, and the **Browser** page shows its tabs live for you to use by hand. The page is yours to type in, and the agents use their own tools for theirs. The plugin is on by default. How a conversation gets hold of the browser is in the closed block at the foot of this page.

[^doors]: You can also open it from the **Browser** row in the health popover in the header, from the palette's **Open browser**, and from the **browser** chip on a conversation's list of tools. The dot on the sidebar row speaks only when something needs saying, such as a failed launch.

[^pane]: Because a tab has an address of its own, it can sit in a pane of its own, and its page title is the pane's title.

[^search]: Words that are not a URL go to DuckDuckGo, at `https://duckduckgo.com/?q=…`, which is the one place this page sends what you typed to a third party. The address box stays an ordinary text box, so you can type `example.com` into it, and nothing in it is capitalized, autocorrected or spell-checked.

[^keys]: Type a URL in **Address** and press `Enter` to go there. While your keystrokes go to the page, the line under it reads `Keys go to the page. Press Esc to give them back.`, and pasting sends the clipboard's text. `Esc` gives the keys back to olai. In the strip, **New tab** opens a page and goes to it, and the close control shuts one.

[^banner]: The banner reads `The browser is not running.`, `Starting the browser…`, or the reason it stopped. A tab that has closed while you were looking at it reads `This tab is no longer open.`

[^size]: The browser starts at 1280×800, and from then on the page is laid out to fit the pane it is drawn in, within 320×240 and 3840×2160 CSS pixels. Resizing a split or turning a phone lays the page out again at the new size, so the picture fills the pane one to one.

    While a pane is changing size, the picture still shows the old layout until a frame at the new size arrives, so a click in that moment is ignored rather than landing somewhere you did not point.

[^cast]: The picture is a live video stream from the browser. The stream starts when the first pane opens on a tab and stops when the last one closes, so a pane nobody is looking at costs nothing. A hidden pane counts as closed, whether its tab is in the background or its column is folded away. It keeps its last picture, watches nothing, and its size does not change the page. Every tab keeps painting while another is in front.

[^pertab]: Each tab is sized on its own. Two panes on two tabs each get their own size. Two panes on one tab share one size, and the one that changed last wins. An agent's page is resized only while a pane shows it, and otherwise keeps the size the agent's own tools left it at.

[^attach]: Nothing launches until something asks for it: the **Start** button, or the first conversation that checks for browser tools. Who owns the browser after that, and how a conversation connects to it, are in the closed blocks at the foot of this page.

[^env]: `OLAI_BROWSER_CHROMIUM` is the absolute path of the Chromium executable olai runs. The packaged olai points it at the full Chromium from the same pinned Playwright browsers bundle its MCP wrapper uses, rather than the headless shell, which real sign-in flows tolerate less well. Set it to another absolute path to override it. All three variables are in the closed block at the foot of this page.

[^profile]: The profile lives at `$XDG_STATE_HOME/olai/browsing/<digest>/profile`, by default under `~/.local/state`, and only your user can read it. It survives a restart. olai removes it when you press **Forget sign-ins**, and when the served directory stops existing. Chromium encrypts its cookies with a key it keeps inside the profile rather than in the system secret store, because olai runs it as a service with nobody there to answer a prompt. That owner-only permission is what protects them on disk.

[^agent]: Every page sees the user agent that a Chrome of the same version, with a window, sends on the same operating system. olai reads the version from the executable's own `--version`, and never claims to be another browser.

[^words]: `container` means the container around olai is the boundary, and it also adds `--disable-gpu` and `--disable-dev-shm-usage`. An unset or empty value means `chromium`. olai never chooses `container` for you and never tries to detect such a host. Any other value fails the launch with a sentence naming the two words.

    That includes `on`, `off`, `yes`, `no`, `true` and `false`, on purpose: YAML 1.1 reads all six as booleans, so in a Kubernetes manifest an unquoted `off` becomes `false`, the entry is rejected, and the variable never reaches the pod. The two words above need no quoting anywhere.

[^nosandbox]: Chromium's own sandbox needs unprivileged user namespaces or a setuid helper. Some hosts have neither: Ubuntu 23.10 and later under their AppArmor default, and hardened containers such as a Kubernetes pod with seccomp `RuntimeDefault`, every capability dropped and no privilege escalation. There Chromium will not start, and both the page and chat say so in Chromium's own words, `No usable sandbox!`, naming the switch.

[^risk]: Chromium's sandbox is what stands between a hostile web page and the process running it. Without it, a page that exploits a bug in Chromium runs as olai's own user, reaching your directory, this signed-in profile and the agents' tools. Set `container` only where a container or virtual machine holds nothing but this olai.

[^injection]: A page can carry instructions written to redirect an agent, and that agent holds both your signed-in browser and permission to write to your directory. Review what agents do accordingly.

[^away]: Pressing **Forget sign-ins** empties the browser. An empty `OLAI_BROWSER_CHROMIUM` gives each conversation its own browser, signed in to nothing. Switching **browsing** off in the plugins panel ([settings](../settings.md)), or emptying `OLAI_BROWSER_MCP`, removes browser tools entirely.

<details>
<summary>Every environment variable browsing reads</summary>

| Environment variable | What it says |
| --- | --- |
| `OLAI_BROWSER_CHROMIUM` | The absolute path of the Chromium executable olai runs. Empty gives each conversation a browser of its own instead. |
| `OLAI_BROWSER_MCP` | The absolute path of the Playwright MCP executable. Empty withdraws browser tools. |
| `OLAI_BROWSER_CHROMIUM_SANDBOX` | What that Chromium's sandbox is: `chromium` or `container`. |

</details>

<details>
<summary>Who owns the browser</summary>

olai launches it, keeps it for as long as the serve runs, and stops it when the plugin is switched off or olai stops. Stopping is `SIGTERM`, a short grace period, then `SIGKILL`, taking its helper processes with it. olai speaks to it over Chromium's DevTools pipe, so an olai that crashes or is killed takes the browser with it. A browser that crashes is reported on the page, and the next conversation, or **Start**, launches it again.

Pressing **Forget sign-ins** deletes every cookie, saved login and site storage the profile held, and the next start is a fresh browser.

This plugin reads no settings of its own beyond `on`. Set `on: no` on the `browsing` node in `_olai/Settings.olai`, or use its switch in the plugins panel ([settings](../settings.md)). Switching it off takes the browser away from running conversations, withdraws browser tools from later ones, and removes the page. A conversation started after it is back on is attached to the new browser.

</details>

<details>
<summary>How a conversation connects to the browser</summary>

For each conversation, olai first asks the executable `OLAI_BROWSER_MCP` names, the pinned Playwright MCP by default, for its list of tools, in a throwaway process that launches no browser. Only an answer olai can work with launches the browser. The conversation is then handed that same executable with `--cdp-endpoint` naming the browser's DevTools socket.

Its tools open pages in the browser's default profile, with your cookies and storage, so their tabs appear in the strip. Its `browser_close` lets go of the browser rather than closing it, and the pages it opened stay open until you close them.

olai hands the MCP `PLAYWRIGHT_MCP_USER_DATA_DIR`, the profile above, and `PLAYWRIGHT_MCP_ISOLATED=false`, so it uses your browser rather than a cookie jar of its own.

An unset or empty `OLAI_BROWSER_MCP` leaves browser tools out altogether. A file that is not executable, a failed or timed-out handshake, a list of tools olai cannot work with, or a browser that cannot start each produce a sentence in the conversation. Every conversation checks again, so a repair takes effect at the next one.

An empty `OLAI_BROWSER_CHROMIUM` gives each conversation a browser of its own, with no window, sharing nothing and keeping nothing, launched by its own MCP. The page then says why there is nothing to show.

Screenshots can reach the agent in the conversation itself. Files the tools write go to private scratch space under `XDG_RUNTIME_DIR`, falling back to the system temporary directory, with a separate `0700` subdirectory per conversation and none for a check that failed.

Those paths keep one conversation's files from mixing with another's; they are not a sandbox against agents running as the same user. Scratch space is never your directory and never kept, and the plugin removes it when it is switched off or olai stops.

</details>

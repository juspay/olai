# pi, as a chat agent

pi needs two parts: the `pi` program you install, and a helper program called an adapter, which comes with olai. Put `pi` on the server's search path.[^pinned]

## What olai runs

olai offers pi as **Pi**. It starts pi through the adapter, and tells the adapter which `pi` to run.[^handed] Its switch is on the **Plugins** panel.[^off] For what a conversation is, read [talking to an agent](../chat.md).

## How olai's tools reach pi

pi cannot reach MCP servers on its own, so the adapter loads a small extension into each conversation's `pi`, and pi then offers olai's tools like its own.[^bridge] No permission question comes back to you: pi decides them by its own settings.[^permissions]

## Sending a message while it works

A message you send while pi is working waits its turn: pi answers *Queued message (position n).* and replies when the running reply ends. There is no way to interrupt pi mid-reply,[^steering] and no mode that turns its permission questions off.[^bypass]

## What you see while it answers

Opening a conversation shows pi's own startup banner, once.[^banner] Shell output arrives under the line for that command with its exit status, and an edit is shown in full, as a diff with `path:line` locations. An error during a reply can leave nothing on screen.[^silent] Saved conversations are listed fifty at a time.[^stored] Memory between conversations is off unless you add a package yourself.[^memory]

## Signing in, and when pi does not appear

You sign in and configure pi in a terminal; olai draws no sign-in.[^login] If either part is missing, the **Plugins** panel says which, and what to do about it.[^missing]

[^pinned]: The adapter and the extension that gives pi olai's tools both come with olai, at fixed versions. The `pi` program is yours to install, from <https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent>.

    | What | Version |
    | --- | --- |
    | `pi-acp` | 0.0.33 |
    | the `pi` these readings were taken against | 0.84.2 |

[^handed]: olai sets `PI_ACP_PI_COMMAND` when it starts the adapter, to the `pi` olai itself found. Left alone, the adapter would look the word `pi` up on its own parent's search path, which is olai's rather than your shell's. If you point `OLAI_ACP_PI` at an adapter of your own, that adapter decides how pi is wired up, and it need not include the extension olai ships.

[^off]: A plugin switched off stops looking for pi and takes away everything it draws. Switch it off either by putting `on: no` on the `pi` node in `_olai/Settings.olai`, or with its switch on the **Plugins** panel, the list of olai's parts ([choosing what runs](../settings.md)).

[^bridge]: The extension carries that conversation's MCP servers in its environment, and pi's own extension interface registers them as ordinary pi tools. They answer to the same names the other agents use, `olai_*` and `kolu_*`.

[^permissions]: Which actions need permission is pi's own setting, just as each other agent's permissions are its own. The strip of servers lists every server olai handed over, and no tick appears beside a server to say it is connected.

[^steering]: pi offers no way to interrupt a reply in progress. The `_session/steering` method does not exist here, and the `/steering` entry in pi's own slash menu is about how pi delivers messages, not about interrupting.

[^bypass]: Asking for `session/set_mode "bypassPermissions"` is refused, because the modes pi offers are its thinking levels rather than permission settings.

[^banner]: The startup banner carries pi's version, any update notice, and the context and skills it loaded. pi then sends the same text again as an ordinary message. A program that draws no banner would show it that way, and olai drops the second copy, matching it on the exact text the banner carried.

[^silent]: Some errors leave nothing to show: when pi cannot reach the model provider, the reply ends with no text, no tool lines and no usage figures, so all you see is olai saying the reply was silent.

[^stored]: pi lists saved conversations fifty at a time. olai sends no limit and does not ask for the next page, so a directory with more than fifty saved pi conversations shows the newest fifty and leaves out the rest.

[^memory]: pi's memory across conversations comes from packages it loads from its own configuration, and olai installs none. The rows under the node the chat hangs from are the conversation's only memory.

[^login]: The one sign-in method the adapter offers is its own `pi-acp --terminal-login`, which you run in a terminal. A `pi` that is not signed in refuses to open a conversation, with `-32000 "Authentication required"`, which the panel shows as a refused conversation you can open again.

[^missing]: An agent that cannot be started is not offered anywhere a chat begins, and the **Plugins** panel files it under **Needs you**, with the reason. Install `pi` where the server can see it, then switch the plugin off and on to look again; an environment change needs a restart.

    | What is missing | What the panel says |
    | --- | --- |
    | `OLAI_ACP_PI` is unset or empty | *OLAI_ACP_PI is unset or empty — start olai with the wrapper that carries the pinned pi adapter* |
    | no `pi` on the search path that will run | *put `pi` on this server's `PATH` — the adapter for it comes with olai*, with a link to pi |

<details>
<summary>Every variable olai reads or sets</summary>

| Variable | What it does |
| --- | --- |
| `OLAI_ACP_PI` | the command line olai runs as the adapter. The wrapper sets it to the build olai ships unless you set it first |
| `OLAI_AGENT_PATH` | the directories olai looks in for `pi`. If you set it, it replaces the search path rather than adding to it |
| `PI_ACP_PI_COMMAND` | olai sets it when it starts the adapter, to the `pi` olai itself found |
| `PI_ACP_MCP_EXTENSION` | the wrapper sets it to the extension that gives pi olai's tools |

</details>

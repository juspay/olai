# opencode, in the chat panel

The ACP engine olai **finds**. Put [opencode](https://opencode.ai) on this server's PATH and the panel offers it; take it off and the row is gone. Olai ships no pin for it, bakes nothing in, and has no override variable of its own — the way to point olai at a different build is to put that build on the search path, which is the same gesture as installing it.

This page is one engine's own account of itself. What a conversation IS — how you choose an agent, what a turn looks like, which conversation you come back to, what the servers strip says — is the same for every engine and is [chat.md](../chat.md).

## How olai finds it

A probe for a runnable `opencode` on the **agent search path**, spawned as `opencode acp --cwd <the served directory>`.

`--cwd` on the command line rather than the child's own working directory, because opencode reads it for *which sessions this directory has* as well as for where to run: its `session/list` ignores the `cwd` a request carries, so the one on the command line is the only one it hears.

**Olai's PATH is not your shell's.** Run as a systemd user service (the home-manager unit) olai inherits neither your profile nor your login shell, so an `opencode` you can run in a terminal is not necessarily one this process can see. `OLAI_AGENT_PATH` is where to say otherwise; set, it REPLACES the search path rather than adding to it.

Turning this row off is `--plugins`: `olai web --plugins=chat,claude` serves a panel with no opencode row and no probe for one. It is one row of `olai.yml` like any other plugin.

## What is only true of this wire

Every reading was captured live against **opencode 1.17.9**. Each is safe to lose in one direction only — an agent that says none of it matches nothing, and what happens then is that **a person is asked**.

- **`_meta` never appears on any frame.** So the two questions the Claude wire answers out of one corner have to be answered some other way or not at all.
- **the tool's name is the head of the call id** (`bash:0`, `olaiprobe_ping:0`), which is also the key a permission request arrives under. The `title` is display text and moves over a call's life, so it is never what a row is named by.
- **MCP tools are `<server>_<tool>`**, not `mcp__server__tool` — so the auto-allow rule gets a spelling of its own, and it is the one thing about this engine that must not be written loosely.
- **there is no bypass mode.** `session/set_mode "bypassPermissions"` is refused; the modes are `build` and `plan`. Unattended auto-approval for opencode lives in its own `opencode.json`, outside ACP — olai answers what it is asked and never widens what it answers.
- **opencode cannot be INTERRUPTED.** `_session/steering` does not exist on this wire, so the composer simply does not draw the gesture. Sending is otherwise identical: the message goes at once and opencode answers one prompt at a time, in order.
- **its subagents carry no attribution**, so a fan-out draws flat — every call in one column — rather than in lanes. Nothing guesses at whose a call was.
- **its picker offers the ids it reports**, so the header names a model with the picker's own label and needs no alias arithmetic.

## Where to get it

<https://opencode.ai>, then make sure it is on the PATH the olai **server** has.

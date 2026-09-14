# Oh My Pi, in the chat panel

The ACP engine olai **finds**. Put [`omp`](https://github.com/can1357/oh-my-pi) on this server's PATH and the panel offers it; take it off and the row is gone. Olai ships no pin for it, bakes nothing in, and has no override variable of its own — the way to point olai at a different build is to put that build on the search path, which is the same gesture as installing it.

omp ships its own ACP server (`omp acp`) and its own MCP client, so this row is the opencode shape: one probe, no adapter, no patches and no bridge.

This page is one engine's own account of itself. What a conversation IS — how you choose an agent, what a turn looks like, which conversation you come back to, what the servers strip says — is the same for every engine and is [chat.md](../chat.md).

## How olai finds it

A probe for a runnable `omp` on the **agent search path**, spawned as `omp --approval-mode yolo acp`.

**The served directory is the child's own working directory.** Unlike opencode, nothing here is said on the command line about where the conversation is: omp reads the directory it was started in, and its `session/new` and `session/list` take an absolute `cwd` of their own.

**The row is autonomous, and that is the command line rather than a mode.** `--approval-mode yolo` is a launch flag that omp forwards to its `acp` subcommand, and it is what skips omp's ACP permission gate — for everything but `bash`, `edit`, `delete` and `move`, none of which are olai's tools. There is no bypass *mode* to ask for on this wire: omp's ACP modes are `default` and `plan`, and `session/set_mode "bypassPermissions"` is refused. A per-tool `tools.approval` policy in your own omp settings can still narrow what `yolo` covers — olai answers what it is asked and never widens what it answers.

**Olai's PATH is not your shell's.** Run as a systemd user service (the home-manager unit) olai inherits neither your profile nor your login shell, so an `omp` you can run in a terminal is not necessarily one this process can see. `OLAI_AGENT_PATH` is where to say otherwise; set, it REPLACES the search path rather than adding to it.

Turn this row off with `on: no` on the `omp` node in `_olai/Settings.olai`, or its durable switch on `⧉`. The row stops probing and its browser contribution is withdrawn.

## What is only true of this wire

Every reading was captured live against **omp 18.1.21**. Each is safe to lose in one direction only — an agent that says none of it matches nothing, and what happens then is that **a person is asked**.

- **a mid-turn message REPLACES the turn.** This is the one engine olai talks to where sending while it is working does not queue. omp cancels the turn in flight and runs what you just sent: the first turn ends *cancelled* — the same row a person gets when they press stop — and the second is answered. To omp this is steering-by-default, and it advertises no ACP way to interrupt precisely because a send already is one. So the composer promises nothing about a message sent mid-turn, and this sentence is the promise instead.
- **olai's MCP tools are called through omp's own `write`.** With omp's default `tools.xdev` on, `mcp__olai_outlines_done` is not announced as itself: the call you see is a `write` whose `rawInput.path` is `xd://mcp__olai_outlines_done`, and the tool's answer comes back nested inside that `write`'s result. Olai reads the path to know which of its own tools a call is, which is what puts the friendly name, the outline and the story on the row. It is harmless because the path is minted by the agent rather than written by the model, and because nothing about it decides a permission: it is the same tool with the same mediated write at the far end. A session configured with `tools.xdev: false` dispatches them top-level instead, and olai reads that shape too.
- **a permission question about one of olai's tools is YOURS to answer on this wire.** Not because the tool is unknown, but because the call's own name is: omp's gate correlates the request with the `write` that carries it, so the only name olai has is `write` — and a tool it cannot positively name is one it asks about rather than one it quietly allows ([chat.md](../chat.md)). `--approval-mode yolo` means this almost never comes up for olai's tools (a per-tool `tools.approval` policy of yours is what would raise it), and asking is the direction that cannot be wrong.
- **there is no interruption to offer.** `_session/steering` is answered `-32603 "Unknown ACP ext method"`, so no interrupting button is drawn — see the busy-send note above for what a plain send does here.
- **the tool's name is the head of the call id** (`write:0`, `bash:3`), which is also the key a permission request arrives under. The `title` is the model's own intent sentence and moves over a call's life, so it is never what a row is named by.
- **`_meta` never appears on any frame**, so nothing about a call is remembered from a frame either: a call nobody named is a call you are asked about.
- **its stored list is one page.** `session/list` answers newest-first with a cursor; olai sends no limit and follows no cursor, so a directory with more than fifty stored omp conversations draws the newest page and loses the rest. Its rows carry a real **message count** under `_meta`, so the picker's note says how long a stored conversation is.
- **the picker offers the ids it reports.** A model's value is its `provider/id` (`litellm/kimi-k3`) and the picker's own label is what the header shows, so there is no alias arithmetic to do.
- **omp loads your own configuration into the same session, and olai draws no row for it.** Servers, extensions and skills from your `~/.omp` are yours and are set up somewhere olai never looks — the servers strip lists what *olai* handed over, which is exactly as complete as it says it is.
- **a server that will not connect fails the conversation open.** omp reports nothing per server over ACP, so a session whose MCP server is unreachable fails `session/new` outright rather than coming up with one row marked broken; the servers strip stays at *handed* for every row, always.
- **its fan-outs draw flat.** Nothing on an omp frame says which call spawned an agent, so every call is drawn in one column rather than in lanes. That is the direction this is safe to be wrong in.

Screenshots, both from a real conversation against **omp 18.1.21** through this panel: [a read drawn as olai's own tool](../images/omp/omp-olai-read.png) — `outlines_read`'s friendly title, the outline it touched, and the reply read out of the `write` it was dispatched through — and [a mid-turn send replacing the turn](../images/omp/omp-busy-send.png) — the first row *cancelled*, the second answered, and the panel idle rather than wedged.

## Where to get it

<https://github.com/can1357/oh-my-pi>, then make sure `omp` is on the PATH the olai **server** has.

Its declared MCP prefix is `mcp__<server>_<tool>`; for display only, the leg reads the `xd://` path a `write` carries, or that name when the session dispatches top-level, and reads the reply out of `details.xdev.inner.rawContent[0].text` — the innermost text of the `write` that wrapped the call.

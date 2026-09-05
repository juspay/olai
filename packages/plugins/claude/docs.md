# Claude Code, in the chat panel

The ACP engine olai **ships**. Every documented way of starting olai — `nix run`, the packaged binary, `just serve` — bakes a pinned [Claude Code](https://claude.com/claude-code) ACP adapter into the wrapper, so a fresh install has a working chat panel with nothing to install and nothing to configure.

This page is one engine's own account of itself. What a conversation IS — how you choose an agent, what a turn looks like, which conversation you come back to, what the servers strip says — is the same for every engine and is [chat.md](../chat.md).

## How olai finds it

Not on your `PATH`, and deliberately: the adapter is a wrapper inside the nix store, and `OLAI_ACP_AGENT` is the whole of this row's door.

- **unset** → the pinned adapter, wherever one has been baked in. This is the ordinary case.
- **set to a command** → that is the agent, pinned default ignored. Point it at your own build, or at a different ACP agent entirely: the override has always meant *read this the way you read Claude Code*, and it still does.
- **set to the EMPTY string** → chat off. Not "no Claude row" — the **whole panel**, nothing probed, no roster at all. It survives the wrapper (an empty value is still a value), which is what makes it the explicit off switch. That reading is core's rather than this engine's, and it is why the variable is spelled where both can see it.

Turning this row off without turning chat off is `--plugins`: `olai web --plugins=chat,opencode,pi` serves a panel with no Claude row, no probe for one, and no mark for one anywhere. It is one row of `olai.yml` like any other plugin ([the plugins panel](../running.md) draws it with the same five states).

## What is only true of this wire

Each of these is a bet on the pinned adapter, and every one of them is safe to lose in one direction only — an agent that says none of it matches nothing, and what happens then is that **a person is asked**. Nothing is ever approved by failing to recognise something.

- **it names its tools in a `_meta` corner**, and stamps a subagent's calls with the id of the `Agent`/`Task` call that spawned them. That stamp is what draws a fan-out in lanes rather than flat, and what puts a subagent's permission question in that subagent's name.
- **`mcp__<server>__<tool>`** is what it calls the tools an MCP server contributes. That spelling is the whole of the auto-allow rule: a call to one of the servers olai handed this session is allowed without asking, and everything else is a person's.
- **it has a bypass mode** (`bypassPermissions`), asked for once per session. A refusal costs one round trip per tool call and nothing else.
- **it takes a message INTO a running turn** — the interrupt gesture the composer offers — and it advertises that it holds a prompt sent while it is busy. Both are read off the handshake rather than assumed.
- **it forwards its wrapped CLI's own `init`**, which carries two facts the protocol has no place for: the model a turn is actually running on, and what the CLI says about its connection to each MCP server of this conversation. That second one is why a server's row can move from *handed* to a tick.
- **its model picker offers ALIASES** (`sonnet`, `opus[1m]`) where the CLI reports concrete ids (`claude-sonnet-5`). Bridging those two vocabularies is this engine's own arithmetic, so the header can say "Sonnet" beside a turn running `claude-sonnet-5` — and never claim a context window the model never stated.
- **its `session/list` says how many messages a conversation holds**, and — for a conversation a `/clear` left behind — which conversation replaced it.

## The adapter, and its patches

`nix/acp-agent.nix` builds the pinned adapter from a committed lockfile: nothing is fetched at build time and no `npx` runs at start. Two patches ride that pin and both live in this plugin's own directory ([`acp/patches/`](https://github.com/juspay/olai/tree/master/packages/plugins/claude/acp/patches)):

- **background tasks are visible** — the adapter drops the frames that say a call armed a background task, so the strip above the transcript could not draw one;
- **`session/list` carries its `_meta`** — the count and the superseded-by pointer the picker's rows draw.

A version bump makes the patches FAIL rather than silently drop the behaviour, which is the auditable direction.

## Where to get it

It comes with olai: every documented way of starting it bakes the pinned adapter in, so there is nothing to install for this row.

The panel says which of three things happened when there is no agent, so you should not have to guess — but for this row in particular, *not found* means the start went round every documented path (the packaged binary, `just serve`, the home-manager unit). *Chat is switched off* means `OLAI_ACP_AGENT` is set to the empty string. And *this serve has no agent engine* means `--plugins` named none of them, which turns this row off along with the rest.

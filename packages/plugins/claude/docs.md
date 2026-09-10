# Claude Code, in the chat panel

The ACP engine olai **ships**. Every documented way of starting olai — `nix run`, the packaged binary, `just serve` — bakes a pinned [Claude Code](https://claude.com/claude-code) ACP adapter into the wrapper, so a fresh install has a working chat panel with nothing to install and nothing to configure.

This page is one engine's own account of itself. What a conversation IS — how you choose an agent, what a turn looks like, which conversation you come back to, what the servers strip says — is the same for every engine and is [chat.md](../chat.md).

## How olai finds it

The packaged adapter is a wrapper inside the nix store. `OLAI_ACP_AGENT` supplies an explicit command; otherwise the row uses its packaged/search-path discovery.

- **unset** → the pinned adapter, wherever one has been baked in. This is the ordinary case.
- **set to a command** → that is the agent, pinned default ignored. Point it at your own build, or at a different ACP agent entirely: the override has always meant *read this the way you read Claude Code*, and it still does.
- **empty or unset without a packaged command** → search for a matching executable on `OLAI_AGENT_PATH` (or `PATH`). No matching executable leaves this engine unavailable. Enablement remains the vault’s decision.

Turn this row off with `on: no` on the `claude` node in `_olai/Settings.olai`, or its durable switch on `⧉`. The row stops probing and its browser contribution is withdrawn.

## What is only true of this wire

Each of these is a bet on the pinned adapter, and every one of them is safe to lose in one direction only — an agent that says none of it matches nothing, and what happens then is that **a person is asked**. Nothing is ever approved by failing to recognise something.

- **it names its tools in a `_meta` corner**, and stamps a subagent's calls with the id of the `Agent`/`Task` call that spawned them. That stamp is what draws a fan-out in lanes rather than flat, and what puts a subagent's permission question in that subagent's name.
- **`mcp__<server>__<tool>`** is what it calls the tools an MCP server contributes. That spelling is the whole of the auto-allow rule: a call to one of the servers olai handed this session is allowed without asking, and everything else is a person's.
- **it prefers bypass mode** (`bypassPermissions`) on every new or loaded session. Unlike Codex, Claude does not require selection to succeed: a refusal adds a notice and opening continues with the adapter's existing mode and Olai's `allowedWithoutAsking` backstop. The pinned adapter omits bypass mode under root unless `IS_SANDBOX` is set. Olai does not change that environment or host permissions; unrecognized permission requests still go to the person.
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

The panel distinguishes an unavailable executable from a serve with no enabled engine. An empty adapter path affects this row only; turn the chat row off in the settings file to remove the conversation.

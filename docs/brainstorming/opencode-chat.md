# Opencode in the chat panel

Status: brainstorm, ruled with the human 2026-08-21. Facts below were verified live against opencode **1.17.9** on this machine (Opus spike agent; driver scripts and raw frame logs in the session scratchpad). Uncommitted on purpose until the human blesses it.

## Goal

The chat panel can run **opencode** beside the Claude adapter. Each conversation is bound to **one** agent, chosen when the chat is created. Several agents inside one conversation (group chat) is **out of scope, permanently** (ruled).

## Rulings (the human, 2026-08-21)

- **Roster is auto-detected on the backend**: probe PATH for each known agent (`which opencode`, …). No agents found → the UI says so and tells the reader how to install one.
- **Every new chat asks** which agent. No remembered default.
- **Header shows the agent's icon and name** (bundled brand icons, generic fallback), beside the model.
- **Every PR is self-sufficient**: no unused code, nothing deferred.
- **Auth is not olai's problem**: an installed opencode is already authed (verified here). A broken one surfaces through the existing unstartable path.

## What the spike verified (`opencode acp --cwd <dir>`)

Plain ACP over stdio (ndjson JSON-RPC). Each fact, with its olai consequence:

- **Capabilities**: `loadSession`, session list/fork/resume/close, MCP http+sse+stdio all accepted via `session/new`'s `mcpServers` — a real stdio MCP server was handed in and its tool called. → olai's ops handing works unchanged.
- **`_meta` never appears on any frame.** → The Claude leg's `toolNameIn` / `parentToolUseIn` / `spawnedIn` all answer null. Safe direction (everything falls to asking a person) — but unusable as-is.
- **The programmatic tool name is the `toolCallId` prefix**: `bash:0`, `olaiprobe_ping:0`. → The opencode leg reads names there. It is also the only key correlating a permission request to its announcement.
- **MCP tools are named `<server>_<tool>`**, not `mcp__server__tool`. → The auto-allow rule gets a per-leg spelling. `_` is a weak separator; watch for collisions with builtin names.
- **No bypass mode.** Modes are only `build` and `plan`; `session/set_mode "bypassPermissions"` is refused (`-32602`). Auto-approve lives in opencode's own config file (`opencode.json` `"permission"`), outside ACP. → olai relies on answering permission requests. Their options are **allow-first** (`allow_once` / `allow_always` / `reject_once`) — never assume the first option is the refusal.
- **Announcement precedes the permission request**, correlated by `toolCallId`. → Matches the shape olai already relies on.
- **`session/list` works but ignores `cwd`** — it returns every session on the machine. → The existing client-side directory filter is mandatory, and sufficient.
- **Model is only in `configOptions`** (`id:"model"`, 24 options here; current model `litellm/kimi-k3`). Changes come back **in the method response, never as a pushed update** (no `config_option_update`, no `current_mode_update`). → The model picker works; read responses, expect no notifications.
- **No `_session/steering`** (`-32601`). → Mid-turn messages queue instead of steering; the composer must say so.
- **Subagents carry no parent attribution** (a `task` tool, kind `think`, nothing naming the parent on its frames). → No lanes for opencode; a fan-out renders flat. Acceptable.
- **Rough edges olai must survive** (any of these can bite today's client):
  - Duplicate byte-identical `tool_call_update` frames.
  - `title` mutates over a call's life: tool name → prose description → back to the tool name on failure. The stable name is the `toolCallId` prefix.
  - `session/prompt` can error with `-32603` instead of answering a stopReason (reproduced: plan mode is broken in this install — the next prompt after switching fails until switched back to build).
  - `session/load` replays **collapsed** final frames plus `user_message_chunk`.
  - Expected errors are also dumped to stderr — stderr is not a health signal.
- Thought chunks are extremely chatty (27 for a one-word answer). olai drops thoughts today, so this costs parsing only.

## Design

### The agent dimension

- A **known-agents table** on the server: id, how to detect (PATH probe), how to spawn (`opencode acp --cwd …`; Claude = the nix-baked adapter as today), which interpret leg, which icon.
- **`interpret.ts` splits into legs** behind one interface: `claude` (today's file, meaning unchanged) and `opencode` (name from `toolCallId` prefix; auto-allow prefix `<server>_`; no steering; config read from responses). The fail-safe rule stays word for word: **nothing is ever approved by failing to recognize it.**
- **One subprocess per agent**, started when a conversation needs it. A conversation records its agent; the remembered-session note (`memory.ts`) records agent + session together.

### UX

- **New chat**: the picker, always — icons + names. Empty roster → the install instructions, not an empty list.
- **Header**: agent icon + name + model (model from `configOptions` currentValue).
- **Degradations said, never silent**: no steering → the composer notes that mid-turn messages queue for this agent; no lanes for opencode's subagents; anything an agent doesn't offer simply isn't drawn — but where the reader would *expect* behavior (steering), the absence is stated.

## PRs — each self-sufficient, no unused code

1. **Generic ACP hardening.** Correct for any agent and valuable alone, pinned by the existing scripted-agent e2e harness: idempotent application of duplicate `tool_call_update`s; stop treating `title` as stable (derive a frame's name once); survive a `session/prompt` that errors; tolerate collapsed replay. Ships and stands on its own.
2. **The agent dimension.** Roster detection + per-conversation agent + the always-ask picker + header identity and icons + the opencode interpret leg + its permission spelling + the said-degradations. One PR because each piece is dead without the others; PR 1 exists to shrink it. An **opencode-shaped scripted agent** joins the e2e suite (allow-first options, `toolCallId` names, no `_meta`, duplicates, `-32603`) beside the existing one.

## Noted, not olai's work

- Opencode bugs seen in this install, worth reporting upstream: switching to **plan mode breaks the session** (`-32603` on the next prompt until switched back); the **`task` tool fails** (`no such column: replacement_seq`).
- Unattended auto-approve for opencode would be its own `opencode.json`, not ACP. V1 respects whatever the user configured and answers asks in the UI.

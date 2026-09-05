# Codex, in the chat panel

The ACP engine olai **ships**. `nix run`, the packaged binary, `just serve` and `just run` all carry a pinned [codex-acp](https://github.com/agentclientprotocol/codex-acp) adapter and the matching Codex executable, so the Codex row needs nothing from the server's PATH.

This page records what is specific to this engine. The shared conversation model, MCP servers and session picker are documented in [chat.md](../chat.md).

## How olai finds it

`OLAI_ACP_CODEX` names the ACP adapter for this row. The packaged wrapper sets it to the Nix-built `codex-acp`; the development recipes resolve the same derivation. Set it to another command line to test another adapter, or to the empty string to omit only the Codex row.

The adapter itself wraps the Codex app server. The plugin's `acp/` directory owns both its npm lock and Nix derivation, including the matching native Codex executable supplied through `CODEX_PATH`, so neither half drifts to an ambient install. This pin is separate from the patched Claude/Pi adapter bundle: their release clocks and platform rules do not force one another to rebuild. Authentication and Codex configuration continue to use Codex's own normal files and environment.

Turning this row off is also possible through the plugin roster: `olai web --plugins=claude,opencode,pi` mounts no Codex server half, performs no probe and loads no Codex browser chunk.

## What is only true of this wire

- **Codex supports interruption.** The adapter advertises `_session/steering`; the composer offers the gesture only when that positive advertisement is present. Both `injected` and `startedNewTurn` mean the adapter consumed the message, so neither is sent a second time as an ordinary prompt.
- **Olai does not select full-access mode.** The adapter's `agent-full-access` mode disables approvals and grants unrestricted host access. This plugin leaves the adapter's default mode in place.
- **Unknown tool identity is never an approval.** The adapter displays MCP titles such as `mcp.server.tool`, but the ACP fields olai uses for its approval boundary carry an opaque call id and no stable server/tool name. Codex permission requests therefore remain questions for the person instead of being inferred from display text.
- **Subagent activity is flat for now.** Codex exposes thread-oriented collaboration metadata, not the unambiguous spawning-call relationship olai's lanes require. The calls remain visible without guessed parentage.
- **The header also exposes advertised session settings**, such as reasoning effort and collaboration mode. Live ACP plans appear below it, and terminal-output metadata streams command output into its tool row with an exit status.
- **Press the model name to switch models.** While the conversation is idle, the header offers the adapter's model options and applies the selection through ACP's `session/set_config_option`. Codex's adapter does not implement a `/model` slash command. The `model` option uses exact model ids, and the confirmed choice survives a restart of the conversation.
- **No prompt queue is promised.** Codex advertises steering, not ordinary busy-turn prompt queueing, so the composer makes no queueing claim on its behalf.

## Where to get it

The adapter and CLI are already in olai's Nix closure. Codex product and sign-in documentation lives at <https://developers.openai.com/codex>.

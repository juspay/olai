# pi, in the chat panel

The engine that is **both halves at once**: an adapter olai ships pinned, and an agent your machine has to have. Put [`pi`](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) on this server's PATH and the panel offers it; the ACP bridge that drives it comes with olai.

This page is one engine's own account of itself. What a conversation IS — how you choose an agent, what a turn looks like, which conversation you come back to, what the servers strip says — is the same for every engine and is [chat.md](../chat.md).

## How olai finds it

Two probes, and either one missing is no row at all — the picker's promise is that a row it draws is an agent this machine has, and a bridge with no `pi` behind it would fail at every conversation open.

- **the adapter** is `svkozak/pi-acp`, pinned and baked into the packaged binary's wrapper beside the Claude Code one. `OLAI_ACP_PI` names it, and that variable is this row's whole door. A floating `npx -y pi-acp` is never run: the npm world would hand back a different build every day, and the wire facts this engine is written against are one revision's.
- **the agent** is a runnable `pi` on the **agent search path**. The one the probe found is handed to the adapter as its own `PI_ACP_PI_COMMAND`, so the `pi` the row runs is the `pi` the probe found — without that, the adapter's own lookup would resolve the word against a third path, its child's, which is olai's and not your shell's. `OLAI_AGENT_PATH` is where to say where to look.

Turning this row off is `--plugins`, like any other plugin's row in `olai.yml`.

## What is only true of this wire

Every reading was captured live against **pi-acp 0.0.33** driving **pi 0.84.2**. Each is safe to lose in one direction only — what is not recognised is asked about.

- **the tool's name is the head of the call id** (`bash:0`, `edit:1`), exactly as on the opencode wire and for the same reason: nothing on a frame says it, and the id is minted once and never moves.
- **there is no bypass mode and no interruption.** `session/set_mode "bypassPermissions"` is refused (the modes are the thinking levels), and `_session/steering` does not exist. The `/steering` in pi's own slash menu is about pi's message delivery, not the ACP extension of the same name — one collision of vocabularies, and the reason the gesture is not drawn.
- **a mid-turn message QUEUES, visibly.** The adapter accepts it, announces *Queued message (position n).* and answers the request when its turn comes. That is a characteristic rather than a gap.
- **the session's open DOUBLES its banner.** `session/new` answers with a startup block for editors — pi's version, an update nag, the context and skills it loaded — and then emits the same text as an ordinary message so that clients drawing no such block still show it. The panel drops the double, matched on the exact text the open's own answer carried. It matters because a first turn whose only content would have been the banner is a **silent** turn, and the panel names silent turns.
- **olai's tools reach pi through the pin's own bridge.** pi's harness has no MCP client of its own, and its adapter wraps the harness's remote-control drive rather than its config — so the servers a session is handed would have gone nowhere without something loading them INTO the agent. The pinned adapter does that: it spawns each conversation's pi with a bridge extension loaded and the session's servers in its environment, and pi's own extension API registers them as ordinary tools. The `olai_*` / `kolu_*` names the other agents use are the names its rows answer by.
- **so no permission question comes back over ACP.** A tool's spelling of *ours* is pi's own; pi's settings govern what it may do, the way the other agents' govern theirs. The servers strip's rows stand at **handed** and there is no per-server tick to move them.
- **the stored list is one page.** `session/list` answers in pages of fifty, newest first; olai sends no limit and follows no cursor, so a directory with more than fifty stored pi conversations draws the newest page and loses the rest.
- **bash output streams under its tool row**, using the adapter's terminal metadata, and remains readable with its exit status. Edits draw fully, as diffs with `path:line` locations.

## The adapter, and its patch

`nix/acp-agent.nix` builds the pinned adapter from a committed lockfile. One patch and one bundled extension ride that pin, and both live in this plugin's own directory ([`acp/`](https://github.com/juspay/olai/tree/master/packages/plugins/pi/acp)): the patch makes the adapter spawn each session's pi with the bridge loaded and the session's MCP servers passed along, and the extension is what turns them into pi's own tools. A version bump makes the patch FAIL rather than silently drop the behaviour.

An adapter olai did not build — the `OLAI_ACP_PI` override lane — answers for the wiring it actually carries, which is the conversation every engine has with its adapter.

## Where to get it

The agent: <https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent>, then make sure `pi` is on the PATH the olai **server** has. The adapter comes with olai.

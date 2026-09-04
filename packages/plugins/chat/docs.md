# The conversation

The chat panel is a plugin. Everything about talking to an agent inside olai — the panel on the right, the transcript, the composer, the wake strip, the agents section in the sidebar, the door on an agent's row, *Ask agent* on a row's `•••` and `>` in the command palette — arrives with one row in the build's plugin list, and a serve that does not name that row has none of it.

What the panel *does* has its own page: [chat.md](../chat.md) is the feature, and nothing on it changed. This page is about the row.

## What turns it on

Nothing. It is on by default, like the appliances and the engines, and `--plugins` is the only thing that takes it away:

```
olai web ~/outlines                                  # the panel, as always
olai web ~/outlines --plugins=kolu,odu               # the outliner alone
olai web ~/outlines --plugins=chat,claude            # a conversation and one engine
```

**Naming no chat leaves an outliner**, and that is the flag doing exactly what it says. There is no panel, no `surface/chat/` on the wire, no `>` in the palette, no agents section and no door on any row — not a disabled version of any of them, an absent one.

## What waits on it

Every plugin that could reach a conversation names one of the four doors this row stands behind:

| door | what it is | who names it |
| --- | --- | --- |
| `agents` | which ACP engines this build can seat | [claude](claude.md), [codex](codex.md), [opencode](opencode.md), [pi](pi.md) |
| `deliveries` | where a doorbell may ring | [kolu](kolu.md), [odu](odu.md) |
| `session-start` | what to ask this host when a conversation opens | kolu, odu |
| `watching` | what a plugin that mirrors a conversation is told | [xyne-spaces](xyne-spaces.md) |

So **a serve with no chat row leaves all of them `waiting`**, and the plugins panel says so per row, on whose account. That is not a failure and it is not silent: a plugin holding a door that nobody offers is a plugin that has not started, which is a legitimate state the runtime resolves the moment the door arrives.

If what you meant was "odu, and chat as usual", name chat beside it. The flag is a list of everything this serve runs, not a list of the extras.

## The property a node agent carries

A node becomes a **node agent** by carrying a property whose kind is `chat-agent-session`. Its value names the engine, and after a colon the conversation:

```
chat-agent-session: claude                     a node agent with no session yet
chat-agent-session: claude:0f3c8d21-…          ...and one that is bound
```

The subtree under that node is that agent's memory, and the write fence keeps it there: an agent writes strictly inside its own subtree and asks its ancestor for anything above.

### An existing vault needs one row

Before this became a plugin, the key was `agent-session` — a bare word core owned. It is a plugin's kind now, composed the way every plugin's kind is (`<plugin>-<kind>`), so a vault written by an older olai carries a key nothing claims.

**One row in `_olai/Properties.olai` keeps it working:**

```json
{"title":"agent-session","custom":{"type":"chat-agent-session"}}
```

olai never writes that row for you. A tool that edited your declarations file to keep its own feature working would be your vault's judgement overruled by a release — so what olai does instead is say so, in its own column: while your board holds bindings under the bare key and nothing declares it, the **Agents** section draws the row to paste. That is exactly when the section has nothing else to draw, because the roster is the query over the declared key — so an agent that has stopped appearing explains itself in the place you went looking for it.

It is not a validator finding, and that is deliberate: a finding breaks the file it is filed on, the only honest file for this one is your declarations page, and a notice that darkened the page it was asking you to edit — refusing every other write to it until you pasted the row — cost more than the thing it was about. Declaring the key `text` instead says the column is prose, and stops it being said.

You can also simply rename the key to `chat-agent-session`, which needs no declaration at all — a kind claims the key equal to its own composed word.

## Where it hangs in the tab

The shell declares the seats and the plugin brings the faces. That split is worth knowing if you are reading the code rather than using it:

| seat | what the shell keeps | what chat brings |
| --- | --- | --- |
| `app.panel` | the width the page reserves, the open/closed preference, the drag handle | the dock, the mobile sheet, the minimized strip, the wake strip |
| `app.header` | where in the bar cluster a readout sits | the toggle, and what it says about a waiting question |
| `sidebar.section` | the region and its place above the shelf | the agents roster |
| `outline.row.door` | where under a property run a door is drawn | the agent's row, drawn only where there is one |
| `outline.row.action` | the menu's order and its dividers | *Ask agent*, and one *Start an agent session* per installed engine |
| `app.command` | the palette's box, its prefix strip, where a refusal is drawn | `>`, and what it sends |
| `app.mount` | the fold that wraps the page | one roster subscription for the whole tab |

Two slots go the other way — chat is the *reader*. An engine plugin hangs its install sentence on `engine.install` and any plugin hangs the mark its delivered sentences wear on `delivery.mark`; the panel draws both, and composes no word of either.

## On the wire

Chat's members compose as a sibling, under its own key:

```
surface/chat/state/get                 where the conversation stands
surface/chat/agents/get                the node-agent roster
surface/chat/transcript/deltas         the conversation
surface/chat/saying/deltas             the row still being said
surface/chat/conversation/send         …and the fourteen verbs
```

**The MCP face is unchanged.** Not one chat member was ever on it: an agent talking to this store reads the vault through `surface://` and the ops tools, and the conversation is the human's session at the other end of that. So no client's tool names or URIs moved, and `--plugins=chat` changes nothing an agent can see.

## Turning it off is not the same as turning the agent off

Two switches, two meanings:

- `--plugins=` without `chat` is **this instance has no conversation**. The panel is not built, the members are not served, and the tab draws an outliner.
- `OLAI_ACP_AGENT=""` is **not this time**. The row is there, the panel draws, and it says the agent is switched off — which is what you want when the answer is *not right now* rather than *not on this machine*.

The second is the one to reach for by habit. The first is a deployment's word.

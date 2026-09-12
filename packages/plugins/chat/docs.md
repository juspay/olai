# The conversation

The chat panel is a plugin. Everything about talking to an agent inside olai — the panel on the right, the transcript, the composer, the wake strip, the agents section in the sidebar, the door on an agent's row, *Ask agent* on a row's `•••` and `>` in the command palette — arrives with one row in the build's plugin list, and a serve that does not name that row has none of it.

What the panel *does* has its own page: [chat.md](../chat.md) is the feature, and nothing on it changed. This page is about the row.

## What turns it on

Nothing. It is on by default, like the appliances and the engines. Two things take it away, and they answer two different questions.

Set `on: no` on the `chat` node in `_olai/Settings.olai`, or use its switch in `⧉`. The switch writes that same property and the choice survives restart. Turning the row back on restores its services and browser contribution.

**Either way you are left with an outliner**, and it is an absence rather than a disabled version of anything. There is no panel, no `surface/chat/` on the wire, no `>` in the palette, no agents section and no door on any row. Switched off at the panel, that absence arrives while you are watching: the members leave the wire, the tab redials, and the outliner is what is left.

## What waits on it

Every plugin that could reach a conversation names one of the five doors this row stands behind:

| door | what it is | who names it |
| --- | --- | --- |
| `agents` | which ACP engines this build can seat | [claude](claude.md), [codex](codex.md), [opencode](opencode.md), [pi](pi.md) |
| `deliveries` | where a doorbell may ring | [kolu](kolu.md), [odu](odu.md) |
| `session-start` | what to ask this host when a conversation opens | kolu, odu |
| `chat.seating` | the durable nodes, engines and sessions over one vault reading | xyne-spaces |
| `watching` | what a plugin that mirrors a conversation is told | [xyne-spaces](xyne-spaces.md) |

So **a serve with no chat row leaves all of them `waiting`**, and the plugins panel says so per row, on whose account. That is not a failure and it is not silent: a plugin holding a door that nobody offers is a plugin that has not started, which is a legitimate state the runtime resolves the moment the door arrives.

Enable the chat row alongside any tenant that needs its services. Each namespace’s `on` property controls that row; unspecified rows retain their profile and build defaults.

## The property a node agent carries

A node becomes a **node agent** by carrying a property whose kind is `chat-agent-session`. Its value names the engine, and after a colon the conversation:

```
chat-agent-session: claude                     a node agent with no session yet
chat-agent-session: claude:0f3c8d21-…          ...and one that is bound
```

The subtree under that node is that agent's memory — its home, its history, its doorbells. Writes reach the vault.

### Keeping it on a column of your own name

A kind claims the key equal to its own composed word, so `chat-agent-session` needs no declaration at all. To keep bindings under some other column — `agent-session`, say, which is the bare word core owned before chat became a plugin — **declare that key as this kind, with one row in `_olai/Properties.olai`:**

```json
{"title":"agent-session","custom":{"type":"chat-agent-session"}}
```

olai never writes that row for you, and it never reads an undeclared column as a binding either. A plugin may only ever declare a key carrying its own name, which is what makes enabling a plugin unable to take over a column you have been using for something of your own — a bare `agent-session` is a word any vault might mean something else by. Your board says which column it means; a release does not decide for you. Renaming the key to `chat-agent-session` works just as well and needs no row.

## Where it hangs in the tab

Each seat is declared by the plugin that owns the place it is in, and chat brings the face. That split is worth knowing if you are reading the code rather than using it:

| seat | who declares it, and what they keep | what chat brings |
| --- | --- | --- |
| `app.panel` | `layout` — the width the page reserves, the open/closed preference, the drag handle | the dock, the mobile sheet, the minimized strip, the wake strip |
| `app.header` | `layout` — where in the bar cluster a readout sits | the toggle, and what it says about a waiting question |
| `sidebar.section` | `sidebar` — the region and its place above the shelf | the agents roster |
| `outline.row.aside` | `outlines` — beside progress, before the date on rows and zoomed titles | the agent standing, or a hover/focus start gesture with engine choice |
| `outline.row.fold` | `outlines` — under the door, before the note on ordinary rows | the unfolded conversation (reserved) |
| `outline.page.head` | `outlines` — under the title, above the zoomed property drawer | the agent line (reserved) |
| `outline.page.foot` | `outlines` — after the children on the zoomed page | the conversation and composer (reserved) |
| `outline.row.action` | `outlines` — the menu's order and its dividers | *Ask agent*, and one *Start an agent session* per installed engine |
| `app.command` | `navigation` — the palette's box, its prefix strip, where a refusal is drawn | `>`, and what it sends |

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

**The MCP face is unchanged.** Not one chat member was ever on it: an agent talking to this store reads the vault through `surface://` and the ops tools, and the conversation is the human's session at the other end of that. So no client's tool names or URIs moved, and turning chat off changes no agent tool name.

## Turning it off is not the same as turning the agent off

Two switches, two meanings:

- **Turning the row off** — `on: no` on its settings node, or the durable panel switch — removes the conversation, its members and its browser contributions.
- An empty adapter path makes only that engine unavailable. It is not a conversation off switch; the other enabled engines are still discovered.

The second is the one to reach for by habit. The first is a deployment's word, or a person deciding this serve should stop being a chat for a while.

The browser activation owns one agent roster and conversation reading. Its panel, header, sidebar and row-door contributions provide that same roster only to their own children; row commands close over the scoped reading. Chat no longer wraps the application to provide state, so switching it off leaves surviving outline and document editor instances intact. Agent-list callbacks from a departed activation cannot trigger another lookup.

Chat's `attention` component names `alerts.channel` and owns the conversation
fold, watching listeners, cross-tab beat and question press subscription. It
releases them and clears its badge claim when it leaves. The [alerts row](alerts.md)
owns permission, notification listeners, preferences, audio and badge devices.
With that row absent, attention waits; the conversation, forms and header toggle
continue to work.

Session settings close and remain disabled while a send is awaiting acceptance,
including before the server's working-state update arrives. The pending count
belongs to this browser activation and clears when each send settles. An idle
panel with an unacknowledged send does not establish that its new turn finished;
sequential browser workflows wait for both acceptance and idle.

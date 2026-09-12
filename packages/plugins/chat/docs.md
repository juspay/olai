# The conversation

Chat contributes conversations to outline rows and zoomed node pages, plus the
standing/start aside, Needs you and Recent, an Agents palette adapter, and the
Ask agent and `>` gestures. These faces arrive with chat's plugin row and leave
with it. [chat.md](../chat.md) describes the workflows; this page describes their
ownership.

## What turns it on

Nothing. It is on by default, like the appliances and the engines. Two things take it away, and they answer two different questions.

Set `on: no` on the `chat` node in `_olai/Settings.olai`, or use its switch in `⧉`. The switch writes that same property and the choice survives restart. Turning the row back on restores its services and browser contribution.

Disabling chat removes its wire members, folds, page faces, standings, sidebar
regions, palette adapter and `>` command. Surviving outline and document editors
retain their instances. Enabling it restores the scoped contributions.

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

| Seat | Owner and placement | Chat contribution |
| --- | --- | --- |
| `sidebar.section` | sidebar's regions | Needs you and Recent; each Recent row puts its standing dot before its age |
| `outline.row.placement` | outlines' kind-keyed chip placement | `{inRows: false}` for session properties; ordinary zoomed drawer retained |
| `outline.row.aside` | outlines, beside progress before the date | standing or hover/focus start pill |
| `outline.row.fold` | outlines, after row content and before children | bounded conversation, agent line and composer |
| `outline.page.head` | outlines, under title above property drawer | agent line |
| `outline.page.foot` | outlines, after the zoomed subtree | unbounded conversation and composer, or a plain-node composer |
| `outline.row.action` | outlines' row menu | Ask agent and Start an agent session |
| `app.command` | navigation's text-command grammar | `>` with nearest-ancestor targeting |
| `paletteAdapters` | navigation's scoped adapter registry, via renderer slots | all agents and new chat, with engine choices |

Chat no longer contributes `app.panel` or `app.header` and names no layout shell
service. Its four node faces are registered under `AgentsProvider`, reading one
activation-owned roster. Outlines owns rendering placement and row lifetimes;
chat owns each conversation reading. A page's head and foot lease one owner
keyed by pane and node. Last release disposes that owner; a different pane keeps
its own. Conversation UI state is keyed by engine/session within the activation,
so drafts, refusals, question state and dismissed completions do not leak across
conversations.

Chat also declares `engine.install` and `delivery.mark`. The fold registration
owns these shared child locations once; page faces consume the same locations.
Reverse withdrawal removes page consumers before the fold's location owner.
An engine contributes its installation sentence and a delivering plugin its
mark; chat renders these contributions without inventing either.

Optional dependencies remain in separate scoped components. Navigation and its
existing palette control supply route changes and choice reset on dismissal;
outline references supply focused-row context; the search reading supplies
completions. Ask agent's server lookup does not require search. Removing an
optional provider releases its held service, and reconnection holds the new
instance. Pending callbacks cannot navigate a later chat activation.

## On the wire

Chat owns engine and agent-roster cells and a session revision for history
invalidation. State, transcript deltas and streaming prose are conversation-keyed
streams taking the exact engine/session pair. Sends, attachments, settings,
questions and retries carry their conversation identity; stale scope tokens
refuse rather than acting on another conversation. Multiple browser readers
share the server's conversation scope. A server restart reopens each retained
reading and replays its transcript.

`conversation.newChat` ensures Chats, mints a child through Ops as `filer`, starts
its node session, and returns the node id. The browser resolves its current
location through the existing node lookup before navigating and unfolding.
Free-floating new/choose/load procedures and the dock's global selection are
retired. History changes the fold's local visiting pair without editing the
node binding. `conversation.sessions` remains the stored-history listing.

The filer belongs to chat's server scope. Capture registers its Inbox path in
the vault-owned registry; chat reads absence immediately and never names a
capture service. Filing runs only at boot, session revisions, registry arrival,
and settled node-agent turns (the latter ask only their already-running engine).
Withdrawal interrupts its work and releases subscriptions.

The MCP face remains the existing vault tools and surface resources; browser
conversation controls do not become agent tools. Node credentials retain the
reserved-key refusal and their session-owned cleanup.

## Turning it off is not the same as turning the agent off

Two switches, two meanings:

- **Turning the row off** — `on: no` on its settings node, or the durable panel switch — removes the conversation, its members and its browser contributions.
- An empty adapter path makes only that engine unavailable. It is not a conversation off switch; the other enabled engines are still discovered.

The second is the one to reach for by habit. The first is a deployment's word, or a person deciding this serve should stop being a chat for a while.

Chat's browser activation owns the roster, fold state, visiting pairs and the
conversation UI cache. Each rendered fold owns its subscriptions; each page
shares one reading between head and foot. Releasing one leaves other readers
and ongoing work alone. The new-chat action is shared by the sidebar and palette
for one pending creation at a time and is disposed with the activation.

Chat's attention component names `alerts.channel` and owns its scoped watching,
cross-tab beat and question subscriptions. It clears its badge claim on release.
Alerts owns notification, audio and badge devices; chat owns the Alerts and
Alert sound preference controls and their storage observers. Without the alerts
channel, attention waits while conversations and forms continue working. Reveal
is identity-free and opens the first Needs you agent; no waiting agent means no
new fold.

Session settings close while a send awaits acceptance, even before the server's
working update. The pending count belongs to that conversation reading and
clears as its sends settle. Sequential workflows wait for both acceptance and
idle, rather than treating a stale idle frame as a completed turn.


The zoomed agent page has one scroller per pane. Its breadcrumb, title and agent
line stay at the top; the composer stays at the bottom with safe-area clearance.
Memory and transcript share the pane scroll. Opening follows the newest line;
new output follows only while the reader remains at the bottom. Row folds keep
their own bounded transcript scroller.

Filing clears a conversation's previous manual wake picks. Trashing a node or
its parent releases its live agent scope. Agent cleanup closes the protocol and
stops the whole child process group, escalating when it ignores termination,
before joining pending requests. Opening a ninth held agent reports the capacity
refusal in its conversation, with an explicit retry.


Attention multiplexes watched-node identities over one activation-owned browser
channel and one set of visibility listeners. Closing that activation releases
all listeners and heartbeat claims. Fold openness is keyed by the outline
record, so a mirror and its target open independently; their conversations
still share the server reading keyed by engine and session.

Filing and new-session binding share a server-owned permit. A live Chats
container is reused wherever it was moved or renamed. A trashed or non-regular
reserved record stays untouched; the next free `chats-N` id becomes the live
container, reused by retries and new chat. Each completed filing write records
assignment before cancellation can pass its completion boundary.

Already-filed conversations from older builds have their inherited wake picks
cleared once at startup. A marker in chat's existing local heard record prevents
later restarts from clearing deliberate new wake choices. A failed cleanup is
logged and retried, without starting an engine.

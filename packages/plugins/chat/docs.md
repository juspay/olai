# The conversation

Chat contributes conversations to outline rows and zoomed node pages, plus the
standing/start aside, Needs you and Chats, an Agents palette adapter, and the
carry and `>` gestures. These faces arrive with chat's plugin row and leave
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
| `agents` | which ACP engines this build can seat | [claude](claude.md), [codex](codex.md), [opencode](opencode.md), [pi](pi.md), [omp](omp.md) |
| `deliveries` | where a doorbell may ring | [kolu](kolu.md), [odu](odu.md), [mail](mail.md) |
| `session-start` | what to ask this host when a conversation opens | kolu, odu |
| `chat.seating` | the durable nodes, engines and sessions over one vault reading | xyne-spaces |
| `watching` | what a plugin that mirrors a conversation is told | [xyne-spaces](xyne-spaces.md) |

In the browser, the row publishes its roster as `chat.state`. The static door
`olai-plugin-chat/attention` names it (`chatState`) with a narrow shape — the
rows and the tab-local folds — and carries `isCurrent`, the predicate the Chats
section lights a row with, and `NEEDS_YOU_DOT`, the one paint of a standing
another row draws. The rest of a standing's look and the sidebar's ordering stay
in chat's browser modules. The tabs row's `attention`
component names it to put a dot on a tab whose page is a conversation that needs
you. The door holds no live value.

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
| `sidebar.section` | sidebar's regions | Needs you and Chats; the Chats heading carries a `+` (New chat) that opens the shared draft page without creating anything; each Chats row puts its standing dot before its age |
| `outline.row.placement` | outlines' kind-keyed chip placement | `{inRows: false}` for session properties; ordinary zoomed drawer retained |
| `outline.row.aside` | outlines, after the row's date and repeat pills | a bound row's standing, always; otherwise the start pill, only while an agent is available (on phones only on the tapped or focused row) |
| `outline.row.fold` | outlines, after row content and before children | bounded conversation, agent line and composer |
| `outline.page.head` | outlines, under title above property drawer | agent line |
| `outline.page.foot` | outlines, after the zoomed subtree | unbounded conversation and composer, or a plain-node composer |
| `outline.row.action` | outlines' row menu | Start an agent on a plain row; Fresh start and Close the agent on a row with an agent. Start and Fresh start are one entry each — the verb with one available agent, a submenu of available agents with several, absent with none; Close the agent is always offered |
| `app.route` | navigation's route grammar and page face | `/new-chat`, a local draft page with no vault page or conversation subscription |
| `app.command` | navigation's text-command grammar | `>` with nearest-ancestor targeting, or a draft on New chat with Here/default visible |
| `paletteAdapters` | navigation's scoped adapter registry, via renderer slots | all agents, and New chat opening the shared page while an engine is available |

Chat no longer contributes `app.panel` or `app.header` and names no layout shell
service. Its four node faces are registered under `AgentsProvider`, reading one
activation-owned roster. Outlines owns rendering placement and row lifetimes;
chat owns each conversation reading. A page's head and foot lease one owner
keyed by pane and node. Last release disposes that owner; a different pane keeps
its own. Conversation UI state is keyed by engine/session within the activation,
so drafts, refusals, question state and dismissed completions do not leak across
conversations.

Chat declares `delivery.mark` and `conversation.wake`. The fold registration
owns these shared child locations once; page faces consume the same locations.
Reverse withdrawal removes page consumers before the fold's location owner.
Engine absence is data on the roster, not a separate browser slot. One
`EngineAbsence` component draws its mark and reason in the no-agent face, node
composer and engine-owned inspector row. The agent menu (`EngineMenu`) draws
only available engines; with none it says “No agent is set up” and, through the
optional `plugins` component below, offers **Open plugins** on the row that
explains (the first enabled engine that is not here, else chat's own row). Chat's declared browser `chat.engines` service
supplies `row(engine): PluginsRowFace`, built over one activation-owned standing
index. The static `olai-plugin-chat/browser-engines` door contains only its tag
and interface. Each engine defines its own `row` component and registers the
supplied face under its own identity. The component waits for chat and the
inspector slot, and withdraws before chat releases its renderer.
The activation-owned roster publishes `only` beside `engines` and `standings`:
exactly one startable engine, irrespective of missing siblings. Outline start and fresh start read that same memo. New chat uses the first
available engine in bundle order in its composer select. Fresh start
uses it only to decide whether to open a menu; its direct request always names
the node's current engine.

Optional dependencies remain in separate scoped components. Navigation supplies
route changes; the retired palette engine chooser no longer holds palette control;
outline references supply focused-row context; the search reading supplies
completions. The `plugins` component needs the inspector's declared
`plugin-inspector.configuration` service and holds its `open` in a
component-owned holder (`src/browser/plugins-door.ts`) for that activation only;
while the inspector is off the component waits and the agent menu draws no
**Open plugins** action. The `>` ancestor lookup does not require search. Removing an
optional provider releases its held service, and reconnection holds the new
instance. Pending callbacks cannot navigate a later chat activation.

## On the wire

Chat owns engine and agent-roster cells and a session revision for history
invalidation. State, transcript deltas and streaming prose are conversation-keyed
streams taking the exact engine/session pair. Sends, attachments, settings,
questions, retries and the sign-in trio all carry their conversation identity;
stale scope tokens refuse rather than acting on another conversation. Multiple browser readers
share the server's conversation scope. A server restart reopens each retained
reading and replays its transcript.

`conversation.newChat` takes the engine, title and nullable parent (null means
the current Inbox's Chats container). Under the existing creation permit it
normalizes the title with the shared 60-character rule and refuses an empty
title before any write, then validates an explicit parent or ensures Chats on demand with the Inbox recheck,
mints a child through Ops as `filer`, and starts its session. Its result carries
the node, session pair or auth-pending null, and any start refusal. Returning a
minted plain node on refusal lets the browser land its draft there for retry.
`conversation.locations` accepts filter/limit plus bounded exact id and parent
lookups. It returns at most 20 filter matches plus those lookups, ancestor titles
and the current default container id, independently of optional search. The
outline-path set is built once per query; machinery under `_olai` is excluded
except Inbox. The picker caps Suggested and Recent at five and removes the
default container from Recent. `startAgentSession.expectPlain` checks the
On-mode precondition atomically under the binding permit.
There are no free-floating new/choose/load procedures and no global
conversation selection. History changes the fold's local visiting pair without editing the
node binding. `conversation.sessions` remains the stored-history listing.

The filer belongs to chat's server scope. Capture registers its Inbox path in
the vault-owned registry; chat reads absence immediately and never names a
capture service. Filing runs only at boot, session revisions, registry arrival,
and settled node-agent turns (the latter ask only their already-running engine).
Withdrawal interrupts its work and releases subscriptions.

The MCP face remains the existing vault tools and surface resources; browser
conversation controls do not become agent tools. What chat adds to that face is
one paragraph, not a verb: its sibling entry carries a `charter` — that a person
reads the agent's answer in the panel beside the outline, that a backticked id
in prose is pressable and a fenced one is a quotation, that a link to an app
address is followed in place — which the MCP row composes into `initialize`'s
`instructions` while this row is standing and drops when it is not
(`src/charter.ts` argues each sentence; [mcp.md](mcp.md), "What `initialize`
says", is the composition). Node credentials retain the
reserved-key refusal and their session-owned cleanup.

## Turning it off is not the same as turning the agent off

Two switches, two meanings:

- **Turning the row off** — `on: no` on its settings node, or the durable panel switch — removes the conversation, its members and its browser contributions.
- An empty adapter path makes only that engine unavailable. It is not a conversation off switch; the other enabled engines are still discovered.

The second is the one to reach for by habit. The first is a deployment's word, or a person deciding this serve should stop being a chat for a while.

Chat's browser activation owns the roster, fold state, visiting pairs and the
conversation UI cache. Each rendered fold owns its subscriptions; each page
shares one reading between head and foot. Releasing one leaves other readers
and ongoing work alone. The New chat route, draft, selected destination, engine choice and pending send
belong to the browser activation, shared by sidebar and palette. The route uses
navigation’s `local: true` route contract: no request, page reading, or narrowing.
The route supplies its tab title/breadcrumb and its local face. The renderer
draws that face without fabricating an outline, so every reading consumer sees
no file or node. It acquires no vault page or conversation until Send.
The mounted picker owns its read-only location query and optional search reading,
its shortlist policy and key handling in one module (`location-picker.ts`);
leaving releases those while the draft remains. The hand-off of a sent draft —
the arrivals, and the watches that return them — is one module (`handoff.ts`),
and what a chosen location means on the wire is another (`destination.ts`). The
activation publishes
reactive arrivals; existing and newly mounted page sessions atomically take
them once. A page then owns delivery and keeps refused text on disposal. An
untaken arrival is reclaimed when the focused route leaves its node or its
reading becomes unavailable/put away: words return to the session’s kept draft,
or to New chat when no session exists. Departure during startup applies the
same rule unless the destination is already focused. Every release clears the
pending permit. Activation cleanup releases arrivals and invalidates late
callbacks; no callback navigates a rebuilt owner. Picker keyboard handling shares
the completion’s list keys, cursor and topmost dismissal ownership.

Chat's attention component names `alerts.channel` and owns its scoped watching,
cross-tab beat and question subscriptions. It clears its badge claim on release.
Alerts owns notification, audio and badge devices, and the Alerts and Sound
preference switches with their storage. Without the alerts
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

The page and inline fold use the same owner-scoped `createNodeConversation`
hook for history resolution, reading acquisition, and question tracking. Page
opening drafts and fold visibility stay with their respective owners. The
sidebar and palette compose their presentation with the same focus action;
route selection cannot drift from returning to the current session and unfolding.
The subagent shelf inherits page scroll mode, so it adds no scroller to a node
page; inline shelves retain a bounded scroll.

New-chat creation refreshes the roster from Ops’ committed reading before
seating the new node: the revision notification used for display can still be
queued after the write returns.

The host supplies `Landings` once per app. Chat holds an activation scope and each
conversation registers its own receiver for its component lifetime. Transcript
rows carry the chat-owned static `/carry` text contract. Receivers arm their own
nodes or use their mounted composer's rewrite function to insert a quote or path.
Withdrawing the activation releases its receivers and cancels component gestures.

Transcript source extraction (`chat/carried.ts`) is independent of the receiving
composer's formatting and caret policy (`chat/insertion.ts`). Each mounted
composer owns its insertion callback; shared conversation state does not choose
which pane receives focus. Pointer and hold mechanics use the same component-owned
`@olai/web/client/lifting.ts` primitive as outline rows and sidebar files.

### Wake controls

| Door | Owner | Contract |
| --- | --- | --- |
| `conversation.wake` | Chat's conversation strip | One face per plugin, given its opaque pick, browser-only setter, waiting count and conversation address |

Kolu and odu draw their file pickers; mail draws its switch. Chat does not inspect a pick. It persists at most 32 choices, rejects agent writes, and revokes queued deliveries when a choice is cleared or replaced.

Delivery-only plugins receive node conversation addresses from `Deliveries.scopes()` with `pick: null`. Those recipients expire when the node binding changes; they expose no file or subtree. Registered wake plugins receive only explicit conversation picks.

Fresh Start asks before replacing the current conversation, on both the agent
line and the row menu. The agent line owns its confirmation state and disarms
it when the bound node/engine/session changes. Row actions carry an optional
static confirmation sentence through the outlines slot contract; the existing
row menu owns that question and its dismissal. Session work still runs through
the chat wire service and retains its existing ownership and cleanup.

Location queries depend on the ordered recent ids, not activity-only roster
updates. Superseded replies are ignored; a successful retry clears a prior
query refusal. Sidebar opening refusals use the shared timed SaidLine below
the Chats heading.

/**
 * THE CONVERSATION'S TEST IDS — every id this plugin's faces wear, behind one
 * door.
 *
 * ## Why they are here, which is the same line every other tenant's are drawn on
 *
 * The ids split by RENDERER, and that is the only line that holds once a face
 * lives in another package: a scenario asserting on the transcript, the
 * composer, the wake strip or the sidebar's agents roster is asserting on THIS
 * package's output, and an id it could only reach through `@olai/web` would be
 * a suite reading one package's DOM through another package's door. The kolu
 * and odu tables were the first two drawn on it; this one is the third and by
 * far the widest, because the chat panel is the largest face olai has.
 *
 * They came out of `@olai/web`'s own table in one move, values UNCHANGED — a
 * testid is a promise to a scenario, and a relocation that also renamed would
 * have made every red line in the suite ambiguous between the two edits. The
 * app's table records their departure the way it records kolu's `padi*` and
 * odu's `ci*`.
 *
 * ## ONE LITERAL, so the collision instruments kolu needs are not here
 *
 * `packages/plugins/kolu/src/testids.ts` carries a pair of type-level
 * assertions, and the reason is a SPREAD: it merges two halves, and a spread
 * resolves a collision silently in favour of whichever was written last. This
 * table is one object literal, so both halves of that hazard are already
 * covered and copying the assertions across would be an instrument with nothing
 * to measure:
 *
 *   - a duplicate KEY in one literal is a `tsc` error naming it, which is the
 *     diagnostic kolu's assertion exists precisely because it does NOT get;
 *   - a duplicate VALUE — two keys resolving to one `[data-testid=…]`, which is
 *     a selector matching two different components — is caught by
 *     `packages/bundle/src/testids.test.ts`, whose value sweep keys one `Map`
 *     across every table and therefore sees a clash INSIDE a table as readily
 *     as one between two.
 *
 * The day this file grows a `...spread` of its own is the day it owes kolu's
 * two assertions, and that sentence is the whole of what is being deferred.
 *
 * ## NAMES ONLY, and that is a graph claim rather than a style one
 *
 * This module imports nothing and must not. `packages/tests` runs under a
 * cucumber process with no browser in it, and a testid door that pulled a
 * COMPONENT would put SolidJS on the graph of a suite that only wanted a
 * string — and, one hop on, `@olai/web`'s `wire.ts`, which dials at module
 * scope and throws without a `location`. That is not hypothetical: it is the
 * boot death `@olai/tests`' own import fence was written after, and it started
 * with a step reaching into `chat/Transcript.tsx` for a constant. That
 * package's own import sweep is what holds this end; the emptiness above the
 * `export` is what holds this one.
 *
 * ## Why a `data-testid` is worth a module at all
 *
 * It is a contract between two packages that never import each other, and the
 * way that contract normally breaks is silent: someone renames an attribute,
 * the selector still compiles, and a scenario fails thirty seconds later with a
 * timeout that says nothing about why. Declaring them once and importing them
 * on both sides makes a rename a type error.
 *
 * ## What stayed behind in `@olai/web`, and why exactly one thing did
 *
 * `panelResize` — the drag handle on the dock's left edge — is drawn by
 * `@olai/web`'s `client/layout/Handle.tsx`, beside the sidebar's handle and off
 * the same stored width. It is chrome about the COLUMN rather than about the
 * conversation in it, nothing in this package draws it, and the rule for what
 * moves is the renderer and not the word in the name. So it is the one `chat*`
 * id the app's table still holds, and its comment there says so.
 */

export const TESTID = {
  // ── the sidebar's agents roster, and the door on an agent's row ───────
  /** The AGENTS section of the sidebar — the roster, which is the query
   *  `prop:agent-session`. Drawn only when the directory has a node agent, on the
   *  shelf's rule exactly: an empty roster is nothing at all rather than an
   *  empty box, so its presence is the fact a scenario asserts. */
  agentRoster: "agent-roster",
  /** One node agent on it. `data-agent` is the NODE's own id and
   *  `data-standing` is how it stands — the two facts a scenario needs, and
   *  neither is readable off a colour (`./browser/agents/roster.ts`'s `SAID`). */
  agentRow: "agent-row",
  /** How many questions that agent's conversation is waiting on you to answer.
   *  Hidden at zero, which is where every agent but the open one is. */
  agentWaiting: "agent-waiting",
  /** The DOOR under an agent-carrying outline row: what that agent is, and one
   *  line of what it last said. `data-agent` is the node's id, as on the roster
   *  row, so one scenario can press either. */
  agentDoor: "agent-door",
  /** The door's one line of the agent's latest message. Absent until olai has
   *  heard one, which is a door drawn without it rather than an empty line. */
  agentSaid: "agent-said",
  /** Why a press on a roster row did nothing — a property naming a
   *  conversation that agent no longer has (another machine's session, one the
   *  agent has forgotten) is the case a person has to be able to read, because
   *  only rewriting the property can fix it. */
  agentRefused: "agent-refused",
  /** The panel header's NODE name — the node agent this conversation belongs
   *  to, drawn first and pressable. Absent on every conversation no node
   *  claims, which is nearly all of them. */
  chatNode: "chat-node",

  // ── migration: the chats no node claims ──────────────────────────────
  /** The roster's LAST row: every conversation in this directory that no node
   *  agent claims, with how many. Drawn only where there is one — a directory
   *  whose chats are all assigned ends the section at its agents, and one with
   *  neither draws no section at all. */
  agentUnassigned: "agent-unassigned",
  /** ... and the count on it, which is the news the row carries. */
  agentUnassignedCount: "agent-unassigned-count",
  /** The panel body that row opens: those conversations, grouped by whose they
   *  are, each with the gesture that gives it a node. */
  unassignedPanel: "unassigned-panel",
  /** One of them. `data-session-id` and `data-agent` are the pair that names a
   *  conversation anywhere in this app. */
  unassignedChat: "unassigned-chat",
  /** The gesture on that row: *assign to node…*, which opens the search under
   *  it. */
  unassignedAssign: "unassigned-assign",
  /** The way out, back to the conversation the panel was in. The list is a
   *  place a person went, and it stays up across an assignment because moving
   *  several chats is one job. */
  unassignedDone: "unassigned-done",
  /** The sentence a list with nothing left in it draws — and the claim that
   *  must not be made where an agent could not be asked, which is why a
   *  scenario can name it. */
  unassignedEmpty: "unassigned-empty",
  /** What an assignment said — the node it landed on, or why it did not.
   *  A node already talking through a conversation is the refusal a person has
   *  to be able to read. */
  unassignedSaid: "unassigned-said",
  /** The node search under an open *assign to node…* — the shared shortlist
   *  (`@olai/web`'s `search/Shortlist.tsx`), with this door's own words. */
  assignSearch: "assign-search",
  /** One node it found. */
  assignHit: "assign-hit",
  /** Where that node lives, on its row. */
  assignHitPlace: "assign-hit-place",
  /** ... and a property the query matched on it. */
  assignHitProp: "assign-hit-prop",
  /** Why a hit cannot be taken: it is already talking through a conversation,
   *  and one agent has one current session. */
  assignRefused: "assign-refused",
  /** Why the SEARCH itself answered nothing, in the grammar's own words. */
  assignSearchFailed: "assign-search-failed",
  /** The panel header's session detail, on a conversation a node agent owns:
   *  the conversations it has had before this one. `data-count` is how many. */
  chatPastSessions: "chat-past-sessions",
  /** One of those past conversations, pressable like any other stored chat. */
  chatPastSession: "chat-past-session",
  /** *Fresh session* — a new conversation for this node agent, and the label
   *  saying what happens to the one it replaces. */
  chatFreshSession: "chat-fresh-session",
  /** ... and why one did not happen: an engine this machine does not have, an
   *  agent that would not start, a record the ops layer will not write. */
  chatFreshSaid: "chat-fresh-said",

  // ── the panel itself: the toggle, the dock, the two minimized faces ──
  /** The header's agent toggle on desktop. Always on screen there;
   *  `aria-pressed` says whether the panel is open, `data-busy` whether a
   *  turn is running (including while open). Absent on a phone, where the
   *  thumb strip is the door. */
  chatToggle: "chat-toggle",
  /** The open panel (desktop dock or mobile sheet). Its `data-status` carries
   *  the cell's own state — `booting` / `idle` / `thinking` / `gone` — so a
   *  scenario waits on the state rather than on a spinner's styling.
   *  `data-layout` is `dock` or `sheet`; `data-snap` is the mobile snap. */
  chatPanel: "chat-panel",
  /** Desktop minimized chat: bottom-right pill with last agent message. */
  chatPill: "chat-pill",
  /** Mobile minimized chat: strip above the thumb. */
  chatStrip: "chat-strip",
  /** Truncated last-message text inside the pill or strip. */
  chatPillText: "chat-pill-text",
  /** Mobile bottom-sheet host (scrim + sheet). */
  chatSheet: "chat-sheet",
  chatSheetScrim: "chat-sheet-scrim",
  chatSheetHandle: "chat-sheet-handle",

  // ── the panel's header, and the conversation drawn under it ───────
  chatTitle: "chat-title",
  chatModel: "chat-model",
  /** WHO this conversation is with, beside the model — the agent's name, with
   *  its mark in front of it. `data-agent` is the id, so a scenario can say
   *  which agent without reading a brand name off the screen. */
  chatAgent: "chat-agent",
  /** The mark itself. Its own id because "the header shows the agent's ICON"
   *  is half the ruling, and a name with no mark passes an assertion about the
   *  name. `data-mark` says which one was drawn — the agent's own, or the
   *  generic one an agent olai has no mark for gets. */
  chatAgentMark: "chat-agent-mark",
  /** WHO IS TALKING, over the first row of their run in the transcript — a mark
   *  and a name ({@link ./browser/chat/Speaker.tsx}). `data-speaker` is which of the
   *  three parties (`human`, `agent`, `plugin`) and `data-speaker-name` is what
   *  the panel called them, so a scenario can assert that a plugin's doorbell
   *  is not drawn as the person whose lane it travelled down without reading a
   *  picture or a glyph.
   *
   *  ONCE PER RUN, deliberately: a face is drawn where a speaker's stretch of
   *  rows BEGINS, so a scenario counting these is counting turns rather than
   *  messages ({@link ./browser/chat/speakers.ts} holds the rule). Absent from the
   *  shelf that previews one agent's calls, where the head already names it. */
  chatSpeaker: "chat-speaker",
  /** A PLUGIN's mark, on such a face. Its own id beside `chatAgentMark` because
   *  the two come from different places and only one of them is olai's: this
   *  shape is contributed by the plugin's own manifest (`@olai/plugin-api`'s
   *  `PluginMark`). `data-mark` says which was drawn — the plugin's own, by
   *  name, or the `generic` a plugin that hangs none gets. */
  chatPluginMark: "chat-plugin-mark",
  /** The picker: which agent this conversation is with. Drawn in the
   *  transcript's place when the panel is asking, and over it when `+ new`
   *  does the asking. */
  chatChoose: "chat-choose",
  /** One agent to choose. `data-agent` is its id. */
  chatChooseAgent: "chat-choose-agent",
  /** The way out of the picker when a conversation is already open and `+ new`
   *  put it there. Absent when the panel is asking because it HAS no
   *  conversation: there is nothing to go back to. */
  chatChooseCancel: "chat-choose-cancel",
  /** How full the context is (`22k/1M`), beside the model. Absent until the
   *  agent has reported some — a conversation that has spent nothing says
   *  `0/…`, so an absent line means nothing was said rather than nothing spent. */
  chatUsage: "chat-usage",
  chatNew: "chat-new",
  /** Drawn beside the model while a turn is running. Beside, not instead:
   *  what it runs on and whether it is running are two facts. */
  chatWorking: "chat-working",
  /** The strip between the transcript and the box while the panel is busy —
   *  a turn running, or an agent starting. Its WORDS are the assertion: the
   *  header's `chatWorking` says the same fact in the chrome, and this says it
   *  where a person who has just pressed enter is looking. */
  chatBusy: "chat-busy",
  /** The header's SESSIONS pill: this node agent's own conversations, and the
   *  fresh one that ends the current one. Drawn only where the panel's
   *  conversation belongs to a node agent — the `chats` list that stood here
   *  retired into the sidebar's story (`./browser/chat/NodeSessions.tsx`). */
  chatSessions: "chat-sessions",
  /** ... and the list it opens. */
  chatSessionList: "chat-session-list",
  /** ONE STORED CONVERSATION, wherever conversations are listed
   *  (`./browser/chat/Conversation.tsx`): a row of Unassigned, or one of a node agent's
   *  past sessions. `data-session-id` and `data-agent` are the pair that names
   *  one, and `data-current` says whether it is the one the panel is in. */
  chatSession: "chat-session",
  /** The line under such a row that says WHICH conversation replaced this
   *  one — with a `data-successor` of its id, because the successor need not
   *  be on the screen (it is drawn only when it is), and the sentence alone
   *  would be a claim nothing could pick out of two sharing a title. */
  chatSessionSuperseded: "chat-session-superseded",
  /** The heading over one agent's rows in the unassigned list. Drawn only where
   *  more than one agent has conversations here — one agent is a heading over
   *  the whole list. */
  chatSessionAgent: "chat-session-agent",
  /** One agent in that list that could not be asked what it has stored, with
   *  its reason. Its OWN name and not the whole call's refusal
   *  (`chatSessionsRefused`): "the list could not be fetched" and "one of
   *  several agents is broken" are two states, and the second leaves every
   *  other agent's conversations on the screen. */
  chatSessionUnreachable: "chat-session-unreachable",
  /** The strip under the header: which MCP servers this conversation has, and
   *  how each one stands. Absent — not empty — only where there is no
   *  conversation to have any. One `chatServer` inside it per server. */
  chatRoster: "chat-roster",
  /** One server on that strip. `data-server` is its name and `data-standing`
   *  is how it stands (`connected`, `handed`, `unattached`, `missing`) — the
   *  state as DATA, because the mark beside the name is styling and a scenario
   *  that asserted a glyph would be asserting a decision about pixels. */
  chatServer: "chat-server",
  /** The line saying the list is not the whole of what the agent can reach.
   *  Its own id because it is the honesty of the whole strip: olai lists what
   *  it handed over, and an agent's own servers are configured where olai
   *  cannot see them. */
  chatRosterOwn: "chat-roster-own",
  /** The part of that strip that names the servers this conversation does NOT
   *  have, in sentences. Absent — not empty — on a conversation that got
   *  everything. One `chatMissingServer` inside it per server. */
  chatMissing: "chat-missing",
  /** One such server. `data-server` is its name; the reason is the
   *  `chatMissingWhy` inside it. */
  chatMissingServer: "chat-missing-server",
  /** Why it is not here, in the server's, the probe's or the agent's own
   *  words. Its own id because it is the half the whole feature exists for: a
   *  strip that named the server and not the reason would be the log line
   *  again, on screen. */
  chatMissingWhy: "chat-missing-why",
  chatTranscript: "chat-transcript",
  /** The panel saying a dragged file would land HERE: drawn over the
   *  transcript and the composer while a drag carrying files is over them,
   *  and gone the moment it is not. */
  chatDrop: "chat-drop",
  /** Drawn in the transcript's place when this machine has no agent at all —
   *  none installed, or chat switched off. The panel is NOT hidden in that
   *  state: this is what it says instead, and it says how to install one. */
  chatNoAgent: "chat-no-agent",
  /** One agent it tells you how to install. `data-agent` is its id. */
  chatInstall: "chat-install",
  /** Drawn in the transcript's place when the agent is RUNNING and would not
   *  open a conversation. The panel's third body, and the one that is about a
   *  live agent: `chatNoAgent` is a capability that is switched off, this is
   *  one that said no. */
  chatUnopened: "chat-unopened",
  /** The agent's own words for that refusal — its own id because it is the
   *  half the face exists for, the way `chatMissingWhy` is. */
  chatUnopenedWhy: "chat-unopened-why",
  /** ...and the one thing that can change it: try opening it again. */
  chatReopen: "chat-reopen",
  /** The agent's finished prose, rendered as markdown. Its own name rather
   *  than a node note's: they are two different things on the page. */
  chatSaid: "chat-said",
  /** What YOU typed, quoted verbatim. Its own name rather than the agent's
   *  `chatSaid`: they are two different things on the page, and a scenario
   *  that asks "did I say this" should not have to filter the agent's prose. */
  chatMine: "chat-mine",
  /** What a MACHINE said in the human's lane — a plugin's doorbell putting a
   *  sentence into the conversation (`@olai/plugin-api`'s `Deliveries`). It is a
   *  `user` row like `chatMine` and deliberately not drawn as one: full width
   *  and left-aligned, with `data-rang-by` naming which plugin rang. It carries
   *  no `chatResend`, ever — re-sending a derivation that has stopped being true
   *  is the one outcome the doorbell exists to prevent, and the thing that
   *  derived it rings again by itself. Absent on a replayed conversation, where
   *  the row comes back out of message chunks with no mark on it and the
   *  sentence's own opening line is the whole of the attribution. */
  chatRang: "chat-rang",
  /** The label a machine's row opens with: the attribution line the PLUGIN
   *  wrote, drawn as a byline rather than as the first line of the paragraph
   *  ({@link ./browser/chat/byline.ts}). Its own id so a scenario can assert the face
   *  is there — a name over the words — without asserting the plugin's
   *  wording, which is the plugin's to change. Absent, deliberately, on a body
   *  that carries no such line: nothing here composes one. It is also the
   *  FOLDED FACE of the row — the one line drawn before anybody presses — and
   *  sits BESIDE `chatRangFold` rather than inside it: the line is a line, and
   *  the chevron at its head is the control. It may carry a pressable id of its
   *  own, which is why (ruled, human 2026-08-31). */
  chatRangByline: "chat-rang-byline",
  /** The control that opens a machine's row, and shuts it again — a disclosure
   *  chevron at the head of the essence line, carrying `aria-expanded` the way
   *  `chatToolFold` does ({@link ./browser/chat/rang.ts} for why the row folds at all).
   *
   *  IT USED TO BE THE WHOLE LINE, and stopped being one when a plugin began
   *  naming the node it rang about in that line: a reference inside a button is
   *  a press with two meanings. So the id is pressable and the chevron is the
   *  fold, which is what a scenario now presses to open the row.
   *
   *  ABSENT on a body with no essence line to fold to: that row is one
   *  paragraph and already whole, and a control that hides words behind a label
   *  nobody wrote is the one thing this fold must not become. */
  chatRangFold: "chat-rang-fold",
  /** What the fold holds back: the account under the essence line — the
   *  terminal id, the derivation, the standing set, the how-to-stop line. Not
   *  in the page until the row is open, which is what lets a scenario assert
   *  the FOLD (gone, then there after the press) without asserting a single
   *  word the plugin wrote. Always present on a row that does not fold. */
  chatRangBody: "chat-rang-body",
  /** One row. `data-kind` is which of the six it is, and `data-entry-id` is
   *  its transcript key — which is what a lane names when it says which agent
   *  a call was made inside (`chatLane`), so it is a handle scenarios reach
   *  for rather than an internal. */
  chatEntry: "chat-entry",
  /** A question the agent asked, as a form. `data-asking` is whether it is
   *  still waiting, `data-how` how it ended once it is not. */
  chatAsk: "chat-ask",
  /** One field of that form; `data-field` is the schema property it answers. */
  chatAskField: "chat-ask-field",
  /** One tappable option; `data-value` is what travels back, `aria-pressed`
   *  whether it is picked. */
  chatAskChoice: "chat-ask-choice",
  /** A box to type in: a `text`/`number` field, or the "other" companion of a
   *  question that offers one. */
  chatAskText: "chat-ask-text",
  chatAskSubmit: "chat-ask-submit",
  chatAskDismiss: "chat-ask-dismiss",
  /** What became of a question, once it stopped waiting. */
  chatAskOutcome: "chat-ask-outcome",
  /** A tool call's row; `data-tool-status` is the agent's own status. */
  chatTool: "chat-tool",
  /** The line that opens a tool call. Named rather than found as "the button
   *  in the frame": the frame also draws what the call CHANGED, and the node
   *  an olai write was about is a control there too. */
  chatToolFold: "chat-tool-fold",
  chatToolDetail: "chat-tool-detail",
  /** What a call is SAYING as it runs — the protocol's incremental content,
   *  drawn above the arguments because it is the live half. */
  chatToolProgress: "chat-tool-progress",
  /** A spawned agent's REPORT, in the fold of the call that sent it out.
   *  The one place that agent's own words appear; they never occupy the
   *  column. */
  chatToolReport: "chat-tool-report",
  /** Where it is working: the follow-along file locations, on the line. */
  chatToolLocations: "chat-tool-locations",
  /** HOW LONG it has been running, on the same line — drawn only once a call
   *  the wire still calls running has outlasted the panel's quiet threshold,
   *  and only while the CONVERSATION is live, so a dead agent's sticky
   *  `pending` never keeps a clock counting.
   *
   *  It names the DURATION and not the readout around it: the separator that
   *  sets it off from the locations and the words a screen reader hears are
   *  outside, so what a scenario reads back is the number the rule decided.
   *  That number ticks, which is why a scenario asserts that a duration is
   *  drawn and that it GROWS, rather than which one it is. */
  chatToolElapsed: "chat-tool-elapsed",
  /** A row a SUBAGENT is responsible for, in the lane it is drawn in.
   *  `data-lane` is the transcript key of the `Agent` frame it belongs to —
   *  the same key the row itself carries as `data-entry-id` — so a scenario
   *  can assert WHICH agent, and find that agent's own frame to measure the
   *  indent against. */
  chatLane: "chat-lane",
  /** The lane naming itself — drawn once where a stretch of one agent's work
   *  opens, never on every call it makes. */
  chatLaneLabel: "chat-lane-label",
  /** WHO a call sent out, on the line of the call that sent them.
   *  `data-spawn-kind` is the agent's own word for the kind of agent it
   *  started, or the bare category when the spawn named none — which is what a
   *  scenario asserts, since the visible text is the same string and reading it
   *  off the attribute keeps the claim about the fact rather than about the
   *  layout. */
  chatSpawn: "chat-spawn",
  /** A spawned agent that has not stopped: what it is doing, on the rail that
   *  drops out of the frame which started it — drawn from the spawn itself
   *  rather than from the first call the agent makes. `data-lane` is that
   *  frame's transcript key, the same key `chatLane` uses, so a scenario can
   *  say WHICH agent is still going. It names the WORDS rather than the rail
   *  around them, because the words are what a reader sees inset and the
   *  rail's own box starts at the row's left edge. Absent the moment the call
   *  completes or fails. */
  chatSpawnWorking: "chat-spawn-working",
  /** THE DOOR onto a spawned agent's own calls, under the row that sent it —
   *  the durable half of reaching them, since the strip carries an agent only
   *  while it is out. Its text is how many calls are behind it
   *  (`./browser/chat/door.ts`), `data-lane` is the spawning frame's
   *  transcript key (the same key `chatLane` and `chatSpawnWorking` use) and
   *  `aria-expanded` says whether it is the open one. Absent on every row that
   *  spawned nobody, and on a spawn nobody has heard from yet. */
  chatLaneDoor: "chat-lane-door",
  /** THE SHELF one agent's calls are read in, between the strip above the
   *  scroll and the transcript — never over either, so the conversation is
   *  still readable underneath and the composer is never covered. `data-row` is
   *  the spawning frame's transcript key. Absent whenever nothing is open,
   *  which is nearly always. */
  chatPreview: "chat-preview",
  /** Its head: the agent it is about, by the name the spawning row carries.
   *  `data-spawn-kind` is the kind of agent, when the spawn named one. */
  chatPreviewOf: "chat-preview-of",
  /** ... and the notice at its head saying the turn is blocked on a QUESTION,
   *  which is the one thing in this box that is not about the agent. A form is
   *  never drawn in here — it stays in the conversation, where a decision
   *  belongs — so this is what keeps `docs/chat.md`'s promise that a form
   *  arrives where a reader is already looking: pressing it closes the shelf
   *  and raises the same ask the attention banner does. Absent whenever nothing
   *  is waiting. */
  chatPreviewAsked: "chat-preview-asked",
  /** ... and what it says when the agent has not called anything yet — which is
   *  the whole of the stretch a fan-out is watched through, and an honest thing
   *  to say rather than an empty box. */
  chatPreviewNothing: "chat-preview-nothing",
  /** WHAT a call left running in the background, on the line of the call that
   *  armed it: the description the task was armed with. `data-task` is the
   *  harness's own id for the task, so a scenario asserts the FACT rather than
   *  the sentence around it. Absent on every call that armed nothing, and on a
   *  task nobody described. */
  chatArmed: "chat-armed",
  /** THE STRIP under the header naming what is still running in the background,
   *  drawn only while something is. Above the scroll, so it is readable from
   *  wherever the reader is — which is the half a row at its birth position
   *  cannot serve. */
  chatWatching: "chat-watching",
  /** One thing on it. `data-row` is the transcript key of the call that armed
   *  the task or sent the agent — the same key that row carries as
   *  `data-entry-id` — so a scenario can say the strip and the record are one
   *  thing named twice. `data-kind` is which of the two it is (`agent` /
   *  `task`), because they are drawn on one strip and only one of them is a
   *  door: an agent entry is a BUTTON that opens that agent's own calls, and a
   *  task entry is not pressable, since a task's events are on no wire olai can
   *  reach. `aria-pressed` on an agent entry says whether its shelf is the one
   *  open. */
  chatWatchingTask: "chat-watching-task",
  /** ... and how long it has been out, in the same words the row's own readout
   *  uses. It names the DURATION alone, so what a scenario reads back is the
   *  number rather than the sentence around it. */
  chatWatchingFor: "chat-watching-for",
  /** THE STRIP under that one: what this conversation WAKES ON. One line per
   *  running plugin that declares a doorbell (`@olai/surface`'s `BuiltPlugin`'s
   *  `wake`), saying in that plugin's own words what the wake is on and which
   *  file a person pointed it at. Absent where there is no conversation to be
   *  scoped, which is the roster strip's own rule. */
  chatWake: "chat-wake",
  /** One plugin's control on it: the trigger that opens the file list, wearing
   *  the picked file's name or `off`. `data-plugin` is WHOSE doorbell and
   *  `data-file` is the file or `off` — the state as DATA, because the words
   *  around it are the plugin's sentence and a scenario asserting those would be
   *  asserting somebody else's vocabulary. `aria-expanded` says whether the list
   *  is up. */
  chatWakePicker: "chat-wake-picker",
  /** The list it opens, hung from the strip's own box. */
  chatWakeList: "chat-wake-list",
  /** Where a person types to narrow that list, which a vault of any size needs
   *  and a list of conversations does not (an agent's conversations are tens; a
   *  directory's files are thousands). */
  chatWakeQuery: "chat-wake-query",
  /** One offered file in it; `data-file` is the path a press would scope this
   *  conversation to. */
  chatWakeFile: "chat-wake-file",
  /** ... and the way back OFF, which is the same verb with no file. Drawn only
   *  where there is something to clear, because a doorbell that is already off
   *  has nothing to turn off. */
  chatWakeClear: "chat-wake-clear",
  /** How many of that plugin's sentences this end is holding for this
   *  conversation and has not let in yet. Drawn only while it is holding
   *  something — the panel's rule is that the alternative to holding words out
   *  of sight is not dropping them, it is showing them. The NUMERAL is core's,
   *  in `data-waiting`; the noun beside it is the plugin's own word for what is
   *  waiting, so a scenario reads the count and not the sentence. */
  chatWakeWaiting: "chat-wake-waiting",
  /** THE FAULT: this doorbell is not watching the file it names, so the row
   *  draws this beside the picker instead of a live answer. Its presence IS the
   *  fault — quiet-and-fine and quiet-because-broken are indistinguishable on
   *  every other channel, and a picker still naming a file nothing will ever
   *  read would be the control asserting something untrue. `data-fault` is WHY
   *  in core's own two words (`gone` for a file that is not served any more,
   *  `unwatchable` for one that is and is not a kind this doorbell reads) and
   *  `data-file` is the path it is about, so a scenario reads the state as data
   *  rather than out of the sentence beside it. The way to fix it — picking
   *  another file — is still on the row ({@link chatWakePicker}). */
  chatWakeFault: "chat-wake-fault",
  /** ... and how that task ENDED, in the harness's own word — `completed`,
   *  `failed`, `killed`, `stopped`, of which ACP's own status can spell only
   *  two. Drawn only once the task has ended, which is what makes its presence
   *  the death itself; `data-ended` carries the word. */
  chatArmedEnded: "chat-armed-ended",
  /** A background task that has not ended: the rail that drops out of the frame
   *  which armed it, saying it is still out there. The sibling of
   *  `chatSpawnWorking` and drawn as the same rail — `data-lane` is the armed
   *  frame's transcript key. Absent the moment the harness reports the task's
   *  end, and absent for an abandoned call whose agent died. */
  chatArmedStill: "chat-armed-still",
  /** One file the call REWROTE, drawn as a trimmed line diff. `data-path` is
   *  the file (root-relative when it is under the served directory) and
   *  `data-expanded` says whether the trim has been opened. */
  chatDiff: "chat-diff",
  /** One row of that diff. `data-kind` is `add` / `remove` / `same` / `gap` —
   *  the fact, never the colour it is painted in, which is the whole subject
   *  and so the last thing to assert on. */
  chatDiffLine: "chat-diff-line",
  /** The line-number column of that row. Its own name because a wrapped line
   *  must leave this column where it is — a continuation that slides under
   *  the numbers is a row that no longer reads as a diff. */
  chatDiffGutter: "chat-diff-gutter",
  /** The `+` / `−` / blank marker, the other column that must not wrap. */
  chatDiffMark: "chat-diff-mark",
  /** The line's text. This is the only part of the row that may wrap. */
  chatDiffText: "chat-diff-text",
  /** The control that opens a trimmed diff in place, and shuts it again. */
  chatDiffExpand: "chat-diff-expand",
  /** One OUTLINE the call rewrote — its own name, because the whole claim is
   *  that this is never the row above: a `.olai` is one line per node, so it
   *  is drawn as node changes and there is no text diff of one anywhere.
   *  `data-path` is the file, `data-expanded` whether the trim has been
   *  opened. */
  chatOutlineDiff: "chat-outline-diff",
  /** One node inside it, in the Commit panel's own words. `data-sort` is the
   *  format's classification, `data-node-id` which node. */
  chatOutlineChange: "chat-outline-change",
  /** ... or the sentence that replaces those rows when one side of the file
   *  does not parse. Still never a text diff — an outline nothing can read is
   *  news, not a reason to fall back to lines. */
  chatOutlineUnreadable: "chat-outline-unreadable",
  /** Said in a diff's header when the two texts were too far apart to line up
   *  line by line: every row below is a change, so a trimmed view shows the
   *  top of the old file rather than an edit. */
  chatDiffWholesale: "chat-diff-wholesale",
  /** What an olai WRITE did, in the commit panel's own words — never a diff.
   *  `data-sort` is the format's classification (`done`, `noted`, `moved`, …),
   *  or `unchanged` for a write that moved no record. */
  chatWrote: "chat-wrote",
  /** What the rollup noticed about that write. Advice on a write that LANDED,
   *  never a reason anything failed — the transcript's own copy of the aside a
   *  keystroke already gets under its row. */
  chatNudge: "chat-nudge",
  /** The composer PROMISING that what you send now waits its turn at the
   *  agent and is got to when the running turn is over — drawn while a turn is
   *  running, and only for an agent that advertised the queue it is a promise
   *  about. */
  chatQueues: "chat-queues",
  /** A refused write, with its structured detail drawn out. */
  chatRefusal: "chat-refusal",
  /** What the last VERB refused — an empty send, a turn already running. */
  chatRefused: "chat-refused",
  /** Why the conversations could not be LISTED AT ALL — the whole ask not
   *  landing, as against one agent that could not be asked
   *  (`chatSessionUnreachable`). Its OWN answer rather than the panel's
   *  `chatRefused`, because a refusal that resolved to an empty list used to be
   *  drawn as "no stored conversations", which is a claim about somebody's
   *  disk. Drawn in the unassigned list, which is where the conversations
   *  are. */
  chatSessionsRefused: "chat-sessions-refused",
  /** What went wrong where nobody was waiting: a boot, a dead agent. */
  chatTrouble: "chat-trouble",
  /** The message box. On a name `@`, `data-asked` is WHICH query the NODE
   *  half has answered — the list itself is not drawn when that answer is
   *  empty (`./browser/chat/Composer.tsx`'s `open` is `rows().length > 0`), so the wait
   *  lives here. */
  chatInput: "chat-input",
  /** On a `user` row the agent has not started on: it went out while a turn
   *  was running and is waiting its turn there. Not a delivery — nothing has
   *  failed — so it is its own strip, and it goes away when the agent takes
   *  the message up. */
  chatQueued: "chat-queued",
  /** On a `user` row that did not land: the strip saying WHICH way it did not,
   *  in `data-delivery` — `refused`, which carries the button that tries
   *  again, or `unanswered`, which deliberately carries none. The words stay in
   *  the bubble above it either way. */
  chatDelivery: "chat-delivery",
  chatResend: "chat-resend",
  /** The composer saying the turn is stopped on YOU: the agent asked something
   *  and is waiting for the form above to be answered. */
  chatWaiting: "chat-waiting",
  chatSend: "chat-send",
  /** The other send: put these words INTO the turn the agent is running. Drawn
   *  only while there is a turn to interrupt and only for an agent that said it
   *  takes one — the visible door onto Alt+Enter, which is the same gesture. */
  chatInterrupt: "chat-interrupt",
  chatCancel: "chat-cancel",
  /** The pictures on a message — pending in the composer, or sent, on the row.
   *  Each one is a `chatAttachment` carrying its file name in `data-name`. */
  chatAttachments: "chat-attachments",
  chatAttachment: "chat-attachment",
  /** Drawn only in the tab that sent the picture, out of the Blob it still
   *  has. Every other tab has the name and nothing to draw. */
  chatAttachmentPreview: "chat-attachment-preview",
  /** How big a NON-picture attachment is, beside its name. A PDF has no
   *  thumbnail worth drawing, and the size is what a name does not carry.
   *  Drawn only by the tab that attached it, for the same reason the preview
   *  is: it is the only one holding the bytes. */
  chatAttachmentSize: "chat-attachment-size",
  chatAttachmentRemove: "chat-attachment-remove",
  /** The nodes a message is ABOUT — armed in the composer, or sent, on the row.
   *  Each one is a `chatContextChip` carrying its node id in `data-node`. */
  chatContext: "chat-context",
  chatContextChip: "chat-context-chip",
  /** Take an armed node back off before the message goes. */
  chatContextRemove: "chat-context-remove",
  /** A node NAMED in the panel and pressable: a context chip, or the node an
   *  olai write was about. Carries the id in `data-node-ref`, which is the same
   *  attribute the ids in the agent's own prose are marked with — one selector
   *  for every reference, however it got there (`./browser/chat/refs.ts`). */
  chatNodeRef: "chat-node-ref",
  /** The file picker beside the input — a phone has no Ctrl+V. */
  chatAttachButton: "chat-attach",
  /** The camera's door beside the `+` — the second entry a phone gets
   *  (`./browser/chat/camera.ts`). Its input carries `capture="environment"`, which is
   *  what makes a phone's browser open the camera itself. Drawn ONLY where
   *  the primary pointer is coarse: on a desktop the attribute is ignored
   *  and the button would open a file dialog, so it is ABSENT there —
   *  which is the fact a scenario on a desktop asserts. */
  chatCameraButton: "chat-camera",
  /** The button that opens the WHOLE command list. Drawn only when the agent
   *  offers commands. */
  chatCommands: "chat-commands",
  /** The shortlist over the message box: the agent's commands under a `/`, what
   *  the served directory holds under an `@`. `data-kind` says which of the two
   *  — `command` or `name` — so a scenario names the list rather than guessing
   *  from what is in it. On a name list, `data-asked` is WHICH query the NODE
   *  half answers (the files are local and up at once); absent while that half
   *  has not answered. The same attribute is on the box (`chatInput`), because
   *  a trigger whose query matches nothing draws no list. */
  chatCompletion: "chat-completion",
  /** One row of it. `data-value` is the command's name, the file's path or the
   *  node's id — what taking the row is about, and what it writes into the
   *  message; `data-active` is which one Enter would take. */
  chatCompletionRow: "chat-completion-row",
  /** The word over the first row of a block, when a list holds two kinds of row
   *  — `files` and `nodes` under an `@`, on `data-section`. A label rather than
   *  a row: the arrows never land on it. */
  chatCompletionSection: "chat-completion-section",
  /** The `@` list's node half saying it could not be asked — a failed call, not
   *  a word that named nothing. Its own line, never the send's refusal
   *  (`./browser/chat/Composer.tsx`). */
  chatNamingFailure: "chat-naming-failure",
  /** The transcript saying the ids in it could not be looked up — the same kind
   *  of line one door over, about the other call the panel makes. The words are
   *  still there; what is missing is which of the backticks are pressable. Once
   *  for the pane, because one call carries every message's ids
   *  (`@olai/web`'s `client/declared.ts`). */
  chatRefsFailure: "chat-refs-failure",
} as const

/**
 * ONE OF THEM, as a closed union.
 *
 * `@olai/web`'s `selector` already takes an id from either table, so this is
 * not what keeps a typo out of a selector. It is here for the one shape inside
 * this package that takes a testid as a VALUE: a row of the conversation list
 * is drawn under the list's own name by default and under the node agent's
 * where the row is one of ITS past sessions ({@link ./browser/chat/Conversation.tsx}),
 * so the prop is an id rather than a boolean about which list is asking.
 *
 * It used to be `@olai/web`'s `TestId`, which was true while these names lived
 * in that table and is now a prop that would accept `sidebar` and refuse
 * `chat-session`. Neither table's union is the other's, and this is the one
 * that names what this package draws.
 */
export type ChatTestId = (typeof TESTID)[keyof typeof TESTID]

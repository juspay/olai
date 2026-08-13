/**
 * The names the browser tests find things by.
 *
 * A `data-testid` is a contract between two packages that never import each
 * other, and the way that contract normally breaks is silent: someone renames
 * an attribute, the selector still compiles, and a scenario fails thirty
 * seconds later with a timeout that says nothing about why. Declaring them
 * here and importing them on both sides makes a rename a type error.
 */

export const TESTID = {
  /** The app header: wordmark, connection, agent, preferences. Always drawn —
   *  it is chrome about the APP, and every shape of the app (including the
   *  error report) gets it. */
  appHeader: "app-header",
  /** The row of pills inside it that are about the APP — the connection, the
   *  Commit pill, the agent toggle, the preferences trigger. Its own name because the
   *  CONTENTS of that row are a claim: `one-git-indicator` was two chips
   *  answering one question, and the only way to hold that shut is to count
   *  what is in the row rather than to look for the chip that was removed. */
  appChrome: "app-chrome",
  /** The sidebar itself. Always drawn when the set loaded — which is what
   *  makes it, rather than anything inside it, the sign that the app has
   *  committed to a shape. On a phone the BODY starts collapsed behind the
   *  burger; the nav stays attached so a settle probe does not have to open it. */
  sidebar: "sidebar",
  /** The burger, below 48rem only: lives in the header, opens the directory
   *  drawer (calendar + file tree). */
  sidebarToggle: "sidebar-toggle",
  /** Everything the burger / open column reveals — the month and the file
   *  tree. App chrome is not in here; it lives in the header. */
  sidebarBody: "sidebar-body",
  /** Mobile drawer scrim. Absent on desktop and when the drawer is shut. */
  sidebarScrim: "sidebar-scrim",
  /** Desktop: collapse the full sidebar to the icon rail. */
  sidebarCollapse: "sidebar-collapse",
  /** Desktop: expand the icon rail back to the full sidebar. */
  sidebarExpand: "sidebar-expand",
  /** Desktop icon rail — minimized-with-signal face of the sidebar. */
  sidebarRail: "sidebar-rail",
  /** Drag handle on the open sidebar's right edge. */
  sidebarResize: "sidebar-resize",
  /** Rail icon: jump to today. */
  railCalendar: "rail-calendar",
  /** Rail icon: open outlines / home. */
  railOutlines: "rail-outlines",
  /** Rail icon: open the directory (documents). */
  railDocs: "rail-docs",
  /** The sidebar's file tree: every outline and document under the folders
   *  they live in. Still named `outline-list` because that is the contract the
   *  browser tests already assert on for "the directory is listed", and a
   *  rename for its own sake would be a second spelling of the same fact. */
  outlineList: "outline-list",
  outlineLink: "outline-link",
  outlineTree: "outline-tree",
  node: "node",
  nodeTitle: "node-title",
  tag: "tag",
  /** The date pill on a row, wherever one is drawn. `data-occasion` says which
   *  of the node's dates it is; `data-overdue` says whether the node is late on
   *  it — a `data-` fact in both directions, never the tone it is painted,
   *  because an OCCURRENCE never turning amber is as much of the promise as an
   *  overdue task doing so. */
  date: "date",
  /** The rollup badge — `3/5` of the tasks under a node. An annotation beside
   *  the title, never the node's own mark, which is the checkbox. */
  progress: "progress",
  desc: "desc",
  toggle: "toggle",
  /** The `•••` trigger left of the collapse triangle. Hover-reveal on a
   *  pointer device; always drawn on a phone. */
  nodeMenu: "node-menu",
  /** The open menu panel (portaled). */
  nodeMenuPanel: "node-menu-panel",
  /** One item inside that panel — including the two buttons the confirm below
   *  offers, which are menu items in the same box. `data-action` names the
   *  verb (`cancel`, for the way out of a confirm). */
  nodeMenuItem: "node-menu-item",
  /** The question the panel puts where its list was, before the one verb that
   *  takes a branch away. Its text names the row and how much goes with it. */
  nodeMenuConfirm: "node-menu-confirm",
  /** What the last-chosen action had to say, beside the `•••` for a few
   *  seconds. Two moods, and `data-tone` says which: `alarm` for a refusal —
   *  the ops layer's own words, or a clipboard the browser would not give (any
   *  LAN reader on plain http) — and `aside` for a nudge from a write that
   *  landed. */
  nodeMenuSaid: "node-menu-said",
  /** One folder in the sidebar's file tree. `data-path` is the root-relative
   *  path, `data-collapsed` says whether its children are hidden. */
  fileDir: "file-dir",
  /** The fold control on a folder. Its own name rather than the outline
   *  tree's `toggle`, so a scenario that folds a folder never has to say
   *  which of the two trees it meant. */
  fileDirToggle: "file-dir-toggle",
  /** One document entry in the file tree. There is no second list: documents
   *  sit under the same folders as outlines. */
  documentLink: "document-link",
  /** One document, as a page. `data-file` is which. */
  documentPage: "document-page",
  /** The link inside a node's `doc` reference — the way from a node to its
   *  document's own page. Its own name rather than the sidebar's, so a
   *  selector never has to say which of the two it meant. */
  docLink: "doc-link",
  /** A node's `doc`, wherever the node is drawn: the reference, carrying the
   *  RESOLVED path as `data-doc`, and `data-inline` for the zoomed page that
   *  draws the whole document rather than a line of it. */
  docRef: "doc-ref",
  /** A node held up by an `after` edge, wherever the node is drawn: the mark
   *  column's waiting glyph on a row or a day entry, the named row of blockers
   *  on the node's own page. Absent — not empty — on a node with nothing in
   *  its way. WHETHER a node is blocked, and by what, is `data-blocked` on the
   *  node itself; this is the affordance that says so on screen. */
  blocked: "blocked",
  /** This app's own hover tip, which replaced the platform's `title` on the
   *  one control whose sentence is too long for it: what it says is also the
   *  control's `aria-label`, so nothing here is hover-only. */
  tip: "tip",
  /** A node's free cross-references (`see`), wherever the node is drawn. */
  seeRefs: "see-refs",
  /** One link from a node to another node, in any of those rows. Which
   *  RELATION it came from is the row it is in, so this name is the same for
   *  `see` and for `blocked by`; the target id rides `data-ref` on a child
   *  span (titles change under a live page; ids do not) — and the blocked pill
   *  carries that span too, being a link to the first blocker. */
  nodeRef: "node-ref",
  /** The document itself, rendered — on its own page, or inline under the node
   *  that attaches it. */
  documentBody: "document-body",
  /** A document's table of contents, above its body. A `<details>`, so whether
   *  it is open is the element's own `open` property and not a second flag —
   *  and ABSENT on a document with fewer than two headings, which is what makes
   *  "a note never gets one" assertable. */
  toc: "toc",
  /** A `![](…)` this app will not draw — a remote host, a `data:`, an `.svg`,
   *  or the ordinary case, a filename with a typo in it. Drawn WHERE THE
   *  PICTURE WOULD HAVE BEEN and naming the `src` that was written, because
   *  the alternative (which this replaced) is a page with a hole in it that
   *  neither the person who wrote the typo nor the agent asked about it can
   *  see. The written `src` also rides `data-src`. */
  undrawnPicture: "undrawn-picture",
  /** One line of it: a link to a heading in the same page. Its `href` is the
   *  fragment, which is the whole claim — the id it names is the one the
   *  rendered heading carries. */
  tocLink: "toc-link",
  /** One chip of the theme strip, which lives in the preferences panel's Theme
   *  row. `data-value` is the theme it offers, `aria-pressed` says whether it
   *  is the one in force — never the colour it is painted, which is the whole
   *  subject here and so the last thing to assert on.
   *
   *  What the DEFAULT theme is and where a pick is stored are not attributes on
   *  anything: the browser tests import those from `theme/palettes.ts` the same
   *  way they import these names, which is a type error rather than a timeout
   *  when one is renamed — and markup that exists only to be read back by a
   *  test is markup every reader ships. */
  themeChip: "theme-chip",

  // ── preferences ──────────────────────────────────────────────────────
  /** The header's one way into the preferences, and the only door there is:
   *  the theme pill that used to sit beside it retired into the panel behind
   *  this, so a scenario reaching a theme chip comes through here. */
  prefsTrigger: "prefs-trigger",
  /** The panel it opens (portalled out of the header). */
  prefsPanel: "prefs-panel",
  /** One preference on it; `data-pref` is which — `theme`, `done`. */
  prefsRow: "prefs-row",
  /** That row's hint: what the choice IN FORCE means, re-read whenever the
   *  control moves. Its own name because it is the half of a settings row that
   *  is easiest to let go stale, and a hint describing a state the app is not
   *  in is worse than no hint at all. */
  prefsHint: "prefs-hint",
  /** One segment of a two-or-three-way choice. `data-value` is what it picks,
   *  `aria-pressed` whether it is the one in force. */
  prefsChoice: "prefs-choice",
  /** What every row on the panel has in common, said once: these belong to this
   *  browser and reach no server. */
  prefsScope: "prefs-scope",
  /** A row's own LINE: the controls in its gutter and the title beside them,
   *  and nothing belonging to a row nested under it. Rows nest, so "this
   *  node's checkbox" needs a handle on the line rather than on the subtree —
   *  without one, the absence of a box has to be asked of markup shape. */
  nodeGutter: "node-gutter",
  /** The bullet on every row: the link to that node's own page. */
  zoom: "zoom",
  /** The status box beside that bullet: checked for done, half for doing,
   *  EMPTY for todo — and NOTHING carrying this testid on a node with no mark,
   *  which is how a bullet is told from an unstarted task. Display-only — the
   *  mark is toggled from the row's editor — so the glyph is the assertion. */
  checkbox: "checkbox",
  // ── the row editor ───────────────────────────────────────────────────
  /** The caret in a row's title: an `<input>` standing exactly where the title
   *  span was. Present only while that row is being typed in — a page with no
   *  editor open carries none of these at all. */
  titleEditor: "title-editor",
  /** The same for a note: a plain textarea under the row, opened with
   *  `Shift+Enter`, whose rendering comes back when it closes. */
  descEditor: "desc-editor",
  /** A row that does not exist yet — the editor standing where `Enter` will
   *  put one. It becomes a node when it has a title and is committed, so a
   *  scenario that finds one has found a DRAFT and not a write. */
  newRow: "new-row",
  /** What the last commit was refused with, under the row it was typed in.
   *  `data-kind` is the refusal's own tag. Its presence is the promise that a
   *  refused write is visible; the draft beside it is the promise that nothing
   *  typed was lost. */
  editRefusal: "edit-refusal",
  /** The opposite mood, in the same place: a write that LANDED, with something
   *  the rollup noticed — the last task under a parent going done, a branch
   *  ticked over unfinished ones. Advice, never a reason anything failed, and
   *  the next keystroke takes it away. */
  editNudge: "edit-nudge",
  /** What ⌘Z / ⌘⇧Z had to say — pinned under the header rather than under a
   *  row, because an undo is pressed with no draft open and the row it was
   *  about may be gone. `data-tone` is which mood: `alarm` for a refusal (the
   *  reason the key did nothing), `aside` for a remark about one that landed. */
  undoSaid: "undo-said",
  /** The way in on a page with no rows: an outline that holds nothing, a
   *  zoomed node with nothing under it. */
  startLine: "start-line",
  /** The keyboard reference, opened from the palette: what every key this app
   *  answers does, drawn from the same table the matchers live beside. */
  shortcuts: "shortcuts",
  /** One line of it. */
  shortcut: "shortcut",

  /** The heading of a zoomed page — carries the CANONICAL node's id, which is
   *  what makes "a mirror lands on the node itself" an assertion. */
  zoomTitle: "zoom-title",
  breadcrumbs: "breadcrumbs",
  crumb: "crumb",
  /** The month in the sidebar. Its `data-month` is the month on screen, which
   *  paging moves and nothing else does. */
  calendar: "calendar",
  /** One day of it. Everything the four marks say is a `data-` fact:
   *  `data-date`, `data-dated` (a node of the set is on it), `data-noted` (a
   *  document is named for it — the day's own note), `data-today`, `data-open`
   *  (this is the day being read) — never the colour it is painted, which is a
   *  styling decision a refactor may change. */
  calendarDay: "calendar-day",
  calendarPrev: "calendar-prev",
  calendarNext: "calendar-next",
  /** One day, as a page. `data-date` is the day it turned out to be, which
   *  `/today` does not spell. */
  dayPage: "day-page",
  /** The nodes of one outline dated that day; `data-file` is which. The same
   *  name on the agenda, which draws the same group under the same heading
   *  rule — one widget, so a scenario asks for it one way. */
  dayGroup: "day-group",
  /** THE day's note, drawn above those groups: a document named for the date
   *  itself. `data-file` is its path; its body carries `documentBody`, being
   *  the same pipeline drawn a third place. */
  dayNote: "day-note",
  /** The heading of that note — the way from the day to the document's own
   *  page. Its own name rather than the sidebar's or a node reference's, so a
   *  selector never has to say which of the three it meant. */
  dayNoteLink: "day-note-link",
  /** Said in place of the list when nothing is dated that day. */
  dayEmpty: "day-empty",
  /** The agenda, as a page: the same dates read forward. `data-date` is the
   *  day it was answered for, which `/agenda` does not spell. */
  agendaPage: "agenda-page",
  /** One of its three sections. `data-section` is WHICH — `overdue`, `today`,
   *  `upcoming` — never the words it is titled with, and a section with
   *  nothing in it is not drawn at all rather than drawn empty. */
  agendaSection: "agenda-section",
  /** One day inside the Upcoming section; `data-date` is which. Its heading is
   *  the link to that day's own page, where the note and the finished work the
   *  agenda leaves out are read. */
  agendaDay: "agenda-day",
  /** Said in place of all three when nothing is late, on today, or coming. */
  agendaEmpty: "agenda-empty",
  /** The way to the agenda from the directory column, above the month — the
   *  journal's two questions, side by side. */
  agendaLink: "agenda-link",
  /** Rail icon: the same way in when the column is collapsed. */
  railAgenda: "rail-agenda",
  doneToggle: "done-toggle",
  notFound: "not-found",
  errorView: "error-view",
  errorFileGroup: "error-file-group",
  error: "error",
  crossFileErrors: "cross-file-errors",
  stageNote: "stage-note",
  /** Over a last-good tree: the set on disk stopped validating. */
  staleBanner: "stale-banner",
  /** In one outline's place: that file could not be read, the rest are live. */
  outlineFailure: "outline-failure",
  /** The connection dot, always on screen. Its `data-connection` attribute
   *  carries the state itself — `live`, `lost`, `restarted`, `connecting` — so a
   *  scenario asserts on the state and never on the colour it is painted. */
  connection: "connection",
  /** Over everything: the server that served this page has been replaced. */
  restarted: "restarted",
  /** The button in that surface — the whole of the recovery. Shared with the
   *  fault card below, which recovers the same way and for the same reason. */
  reload: "reload",
  /** In the whole page's place: the CLIENT ITSELF threw while drawing, and the
   *  boundary around the shell caught it. The three above are errors as data;
   *  this one is a bug in this app. */
  fault: "fault",
  /** What threw, verbatim. Its own name because the claim worth asserting is
   *  that the fault is ON the card rather than summarised away. */
  faultDetail: "fault-detail",
  /** The card's second way out: off the page that faulted. A reload alone is a
   *  loop when the fault is deterministic for the route, which is the usual
   *  case. */
  faultHome: "fault-home",

  // ── the Commit button ────────────────────────────────────────────────
  /** The pill in the chrome, and the header's ONE answer to "what is git doing
   *  here" (`one-git-indicator` retired the `● git` readout that used to sit
   *  beside it). ALWAYS drawn — the feature is an audit trail, so "there is no
   *  audit trail here" is the most important thing it can say, and a control
   *  that disappeared is how nobody would ever find that out.
   *  `data-state` carries which face this is — `off`, `no-repo`, `error`,
   *  `never`, `committed`, `waiting`, `blocked`, and `unknown` for a page that
   *  has not heard from the server yet — `data-uncommitted` the count, and
   *  `data-repo` the repository's own state. What git SAID rides the tip and
   *  the `aria-label`, never a colour. */
  commitPill: "commit-pill",
  /** The panel it opens. One row per node, never a text diff. */
  commitPanel: "commit-panel",
  /** What olai last recorded here — message, writer, how long ago, short sha.
   *  Says so in words when there is nothing: "never committed here" is a fact a
   *  count of what is pending cannot express. */
  commitLast: "commit-last",
  /** One outline's worth of those rows; `data-file` is what the store calls it
   *  and `data-path` what the repository does — the second is what a tick
   *  names, because the two namespaces can collide. */
  commitGroup: "commit-group",
  /** One dirty file that is NOT a served outline: a document, a source file, an
   *  outline outside the served root. `data-path` is its repo-root-relative
   *  name and `data-how` what happened to it — `modified`, `untracked`,
   *  `deleted` — never the word it is rendered as. A path-level row and
   *  deliberately nothing more: there is no text diff here. */
  commitOther: "commit-other",
  /** The box that says whether a file is going into this commit. `data-path`
   *  is which file; ALL of them are ticked until somebody says otherwise. */
  commitTick: "commit-tick",
  /** What the list is a list OF — the whole repository, and which part of it
   *  olai serves. */
  commitScope: "commit-scope",
  /** What is committed here and nowhere else. `data-commits` is how many, and
   *  the line is absent when there is nothing to send or nowhere to send it. */
  commitUnpushed: "commit-unpushed",
  /** The Push button. One verb, current branch, no arguments. */
  commitPush: "commit-push",
  /** What a refused push said, in git's own words. */
  commitPushRefused: "commit-push-refused",
  /** One node that changed. `data-node-id` is which, and `data-sort` is what
   *  changed about it — `done`, `noted`, `archived` — never the word it is
   *  rendered as, which is the view's to reword. */
  commitChange: "commit-change",
  /** Dirty outlines whose working copy does not parse. */
  commitUnreadable: "commit-unreadable",
  /** Who has written since the last commit. Intent, not truth: empty after a
   *  restart, and blind to an edit made in an editor. */
  commitWriters: "commit-writers",
  /** Why the repository cannot take a commit right now. */
  commitBlocked: "commit-blocked",
  commitMessage: "commit-message",
  /** The button itself. */
  commitNow: "commit-now",
  /** What the last attempt refused with, when it left anything to say. */
  commitRefused: "commit-refused",

  // ── the agent panel ──────────────────────────────────────────────────
  /** The header's permanent agent toggle. Always on screen; `aria-pressed`
   *  says whether the panel is open, `data-busy` whether a turn is running
   *  (including while open). */
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
  /** Drag handle on the chat dock's left edge. */
  chatResize: "chat-resize",
  /** Mobile bottom-sheet host (scrim + sheet). */
  chatSheet: "chat-sheet",
  chatSheetScrim: "chat-sheet-scrim",
  chatSheetHandle: "chat-sheet-handle",
  // ── command palette (shell) ──────────────────────────────────────────
  palette: "palette",
  paletteScrim: "palette-scrim",
  paletteInput: "palette-input",
  paletteList: "palette-list",
  paletteItem: "palette-item",
  paletteAsk: "palette-ask",
  /** Refusal from a `>` ask that the palette surfaces instead of swallowing. */
  paletteAskError: "palette-ask-error",
  chatTitle: "chat-title",
  chatModel: "chat-model",
  chatNew: "chat-new",
  /** Drawn beside the model while a turn is running. Beside, not instead:
   *  what it runs on and whether it is running are two facts. */
  chatWorking: "chat-working",
  chatSessions: "chat-sessions",
  chatSessionList: "chat-session-list",
  chatSession: "chat-session",
  chatTranscript: "chat-transcript",
  /** The panel saying a dragged file would land HERE: drawn over the
   *  transcript and the composer while a drag carrying files is over them,
   *  and gone the moment it is not. */
  chatDrop: "chat-drop",
  /** Drawn in the transcript's place when no ACP agent is configured. The
   *  panel is NOT hidden in that state — this is what it says instead. */
  chatNoAgent: "chat-no-agent",
  /** The agent's finished prose, rendered as markdown. Its own name rather
   *  than a node note's: they are two different things on the page. */
  chatSaid: "chat-said",
  /** One row. `data-kind` is which of the six it is. */
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
  chatToolDetail: "chat-tool-detail",
  /** What a call is SAYING as it runs — the protocol's incremental content,
   *  drawn above the arguments because it is the live half. */
  chatToolProgress: "chat-tool-progress",
  /** Where it is working: the follow-along file locations, on the line. */
  chatToolLocations: "chat-tool-locations",
  /** One file the call REWROTE, drawn as a trimmed line diff. `data-path` is
   *  the file (root-relative when it is under the served directory) and
   *  `data-expanded` says whether the trim has been opened. */
  chatDiff: "chat-diff",
  /** One row of that diff. `data-kind` is `add` / `remove` / `same` / `gap` —
   *  the fact, never the colour it is painted in, which is the whole subject
   *  and so the last thing to assert on. */
  chatDiffLine: "chat-diff-line",
  /** The control that opens a trimmed diff in place, and shuts it again. */
  chatDiffExpand: "chat-diff-expand",
  /** One OUTLINE the call rewrote — its own name, because the whole claim is
   *  that this is never the row above: a `.jsonl` is one line per node, so it
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
  /** A refused write, with its structured detail drawn out. */
  chatRefusal: "chat-refusal",
  /** What the last VERB refused — an empty send, a turn already running. */
  chatRefused: "chat-refused",
  /** Why the picker has no conversations to offer. Its OWN answer rather than
   *  the panel's `chatRefused`, because the click that asked was here — and
   *  because a refusal that resolved to an empty list used to be drawn as "no
   *  stored conversations", which is a claim about the agent's disk. */
  chatSessionsRefused: "chat-sessions-refused",
  /** What went wrong where nobody was waiting: a boot, a dead agent. */
  chatTrouble: "chat-trouble",
  chatInput: "chat-input",
  /** How many messages are typed and waiting for the turn in flight. */
  chatQueued: "chat-queued",
  /** The composer saying the turn is stopped on YOU: the agent asked something
   *  and is waiting for the form above to be answered. */
  chatWaiting: "chat-waiting",
  chatSend: "chat-send",
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
  /** The file picker beside the input — a phone has no Ctrl+V. */
  chatAttachButton: "chat-attach",
  /** The button that opens the WHOLE command list. Drawn only when the agent
   *  offers commands. */
  chatCommands: "chat-commands",
  chatSlashMenu: "chat-slash-menu",
  chatSlashCommand: "chat-slash-command",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

/** `[data-testid="…"]`, for the side that writes selectors rather than
 *  attributes. */
export const selector = (id: TestId): string => `[data-testid="${id}"]`

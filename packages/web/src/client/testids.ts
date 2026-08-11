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
  /** The sidebar itself. Always drawn when the set loaded — which is what
   *  makes it, rather than anything inside it, the sign that the app has
   *  committed to a shape. */
  sidebar: "sidebar",
  /** The burger, below 48rem only: the whole sidebar is behind it. */
  sidebarToggle: "sidebar-toggle",
  /** Everything the burger reveals — the month, both lists, and the chrome. */
  sidebarBody: "sidebar-body",
  outlineList: "outline-list",
  outlineLink: "outline-link",
  outlineTree: "outline-tree",
  node: "node",
  nodeTitle: "node-title",
  tag: "tag",
  date: "date",
  desc: "desc",
  toggle: "toggle",
  /** The sidebar's second list: one entry per `.md` found. */
  documentList: "document-list",
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
  /** A node's free cross-references (`see`), wherever the node is drawn. */
  seeRefs: "see-refs",
  /** One link inside those references. The target id rides `data-see` on a
   *  child span (titles change; ids do not). */
  seeLink: "see-link",
  /** The document itself, rendered — on its own page, or inline under the node
   *  that attaches it. */
  documentBody: "document-body",
  /** The theme picker in the sidebar. What the DEFAULT theme is and where a
   *  pick is stored are not attributes on it: the browser tests import those
   *  from `theme/palettes.ts` the same way they import these names, which is
   *  a type error rather than a timeout when one is renamed — and markup that
   *  exists only to be read back by a test is markup every reader ships. */
  themePicker: "theme-picker",
  /** One chip of it. `data-value` is the theme it offers, `aria-pressed` says
   *  whether it is the one in force — never the colour it is painted, which is
   *  the whole subject here and so the last thing to assert on. */
  themeChip: "theme-chip",
  /** A row's own LINE: the controls in its gutter and the title beside them,
   *  and nothing belonging to a row nested under it. Rows nest, so "this
   *  node's checkbox" needs a handle on the line rather than on the subtree —
   *  without one, the absence of a box has to be asked of markup shape. */
  nodeGutter: "node-gutter",
  /** The bullet on every row: the link to that node's own page. */
  zoom: "zoom",
  /** The status box beside that bullet: checked for done, half for doing —
   *  and NOTHING carrying this testid on a node with no mark, which is how a
   *  bullet is told from a task. Read-only for now; the glyph is the
   *  assertion. */
  checkbox: "checkbox",
  /** The heading of a zoomed page — carries the CANONICAL node's id, which is
   *  what makes "a mirror lands on the node itself" an assertion. */
  zoomTitle: "zoom-title",
  breadcrumbs: "breadcrumbs",
  crumb: "crumb",
  /** The month in the sidebar. Its `data-month` is the month on screen, which
   *  paging moves and nothing else does. */
  calendar: "calendar",
  /** One day of it. Everything the three marks say is a `data-` fact:
   *  `data-date`, `data-dated` (something is on it), `data-today`,
   *  `data-open` (this is the day being read) — never the colour it is
   *  painted, which is a styling decision a refactor may change. */
  calendarDay: "calendar-day",
  calendarPrev: "calendar-prev",
  calendarNext: "calendar-next",
  /** One day, as a page. `data-date` is the day it turned out to be, which
   *  `/today` does not spell. */
  dayPage: "day-page",
  /** The nodes of one outline dated that day; `data-file` is which. */
  dayGroup: "day-group",
  /** Said in place of the list when nothing is dated that day. */
  dayEmpty: "day-empty",
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
  /** The pill in the chrome. ALWAYS drawn — the feature is an audit trail, so
   *  "there is no audit trail here" is the most important thing it can say, and
   *  a control that disappeared is how nobody would ever find that out.
   *  `data-state` carries which face this is — `off`, `no-repo`, `never`,
   *  `committed`, `waiting`, `blocked`, and `unknown` for a page that has not
   *  heard from the server yet — `data-uncommitted` the count, and `data-repo`
   *  the repository's own state. */
  commitPill: "commit-pill",
  /** The panel it opens. One row per node, never a text diff. */
  commitPanel: "commit-panel",
  /** What olai last recorded here — message, writer, how long ago, short sha.
   *  Says so in words when there is nothing: "never committed here" is a fact a
   *  count of what is pending cannot express. */
  commitLast: "commit-last",
  /** One outline's worth of those rows; `data-file` is which. */
  commitGroup: "commit-group",
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
  /** The shut panel's opener. Absent when no agent is configured. */
  chatToggle: "chat-toggle",
  /** The open panel. Its `data-status` carries the cell's own state —
   *  `booting` / `idle` / `thinking` / `gone` — so a scenario waits on the
   *  state rather than on a spinner's styling. */
  chatPanel: "chat-panel",
  chatClose: "chat-close",
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
  /** Drawn in the transcript's place when no ACP agent is configured. The
   *  panel is NOT hidden in that state — this is what it says instead. */
  chatNoAgent: "chat-no-agent",
  /** The agent's finished prose, rendered as markdown. Its own name rather
   *  than a node note's: they are two different things on the page. */
  chatSaid: "chat-said",
  /** One row. `data-kind` is which of the five it is. */
  chatEntry: "chat-entry",
  /** A tool call's row; `data-tool-status` is the agent's own status. */
  chatTool: "chat-tool",
  chatToolDetail: "chat-tool-detail",
  /** What a call is SAYING as it runs — the protocol's incremental content,
   *  drawn above the arguments because it is the live half. */
  chatToolProgress: "chat-tool-progress",
  /** Where it is working: the follow-along file locations, on the line. */
  chatToolLocations: "chat-tool-locations",
  /** A refused write, with its structured detail drawn out. */
  chatRefusal: "chat-refusal",
  chatUnfinished: "chat-unfinished",
  chatUnfinishedChild: "chat-unfinished-child",
  /** What the last VERB refused — an empty send, a turn already running. */
  chatRefused: "chat-refused",
  /** What went wrong where nobody was waiting: a boot, a dead agent. */
  chatTrouble: "chat-trouble",
  chatInput: "chat-input",
  /** How many messages are typed and waiting for the turn in flight. */
  chatQueued: "chat-queued",
  chatSend: "chat-send",
  chatCancel: "chat-cancel",
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

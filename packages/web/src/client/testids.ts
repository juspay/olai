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
  /** The app header: wordmark, connection, agent, theme. Always drawn — it is
   *  chrome about the APP, and every shape of the app (including the error
   *  report) gets it. */
  appHeader: "app-header",
  /** The sidebar itself. Always drawn when the set loaded — which is what
   *  makes it, rather than anything inside it, the sign that the app has
   *  committed to a shape. On a phone the BODY starts collapsed behind the
   *  burger; the nav stays attached so a settle probe does not have to open it. */
  sidebar: "sidebar",
  /** The burger, below 48rem only: lives in the header, opens the directory
   *  sheet (calendar + file tree). */
  sidebarToggle: "sidebar-toggle",
  /** Everything the burger reveals — the month and the file tree. App chrome
   *  is not in here; it lives in the header. */
  sidebarBody: "sidebar-body",
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
  date: "date",
  /** The rollup badge — `3/5` of the tasks under a node. An annotation beside
   *  the title, never the node's own mark, which is the checkbox. */
  progress: "progress",
  desc: "desc",
  toggle: "toggle",
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
  /** One line of it: a link to a heading in the same page. Its `href` is the
   *  fragment, which is the whole claim — the id it names is the one the
   *  rendered heading carries. */
  tocLink: "toc-link",
  /** The theme picker in the header: a compact pill that opens the chip strip.
   *  What the DEFAULT theme is and where a pick is stored are not attributes on
   *  it: the browser tests import those from `theme/palettes.ts` the same way
   *  they import these names, which is a type error rather than a timeout when
   *  one is renamed — and markup that exists only to be read back by a test is
   *  markup every reader ships. */
  themePicker: "theme-picker",
  /** The pill that opens the chip strip. Names the theme in force. */
  themeTrigger: "theme-trigger",
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
  /** The status box beside that bullet: checked for done, half for doing,
   *  EMPTY for todo — and NOTHING carrying this testid on a node with no mark,
   *  which is how a bullet is told from an unstarted task. Read-only for now;
   *  the glyph is the assertion. */
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

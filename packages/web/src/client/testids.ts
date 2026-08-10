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
  outlineList: "outline-list",
  outlineLink: "outline-link",
  outlineTree: "outline-tree",
  node: "node",
  nodeTitle: "node-title",
  tag: "tag",
  date: "date",
  desc: "desc",
  toggle: "toggle",
  /** The bullet on every row: the link to that node's own page. */
  zoom: "zoom",
  /** The heading of a zoomed page — carries the CANONICAL node's id, which is
   *  what makes "a mirror lands on the node itself" an assertion. */
  zoomTitle: "zoom-title",
  breadcrumbs: "breadcrumbs",
  crumb: "crumb",
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
  /** The button in that surface — the whole of the recovery. */
  reload: "reload",

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
  chatSessions: "chat-sessions",
  chatSessionList: "chat-session-list",
  chatSession: "chat-session",
  chatTranscript: "chat-transcript",
  /** The agent's finished prose, rendered as markdown. Its own name rather
   *  than a node note's: they are two different things on the page. */
  chatSaid: "chat-said",
  /** One row. `data-kind` is which of the five it is. */
  chatEntry: "chat-entry",
  /** A tool call's row; `data-tool-status` is the agent's own status. */
  chatTool: "chat-tool",
  chatToolDetail: "chat-tool-detail",
  /** A refused write, with its structured detail drawn out. */
  chatRefusal: "chat-refusal",
  chatUnfinished: "chat-unfinished",
  chatUnfinishedChild: "chat-unfinished-child",
  /** What the last VERB refused — an empty send, a turn already running. */
  chatRefused: "chat-refused",
  /** What went wrong where nobody was waiting: a boot, a dead agent. */
  chatTrouble: "chat-trouble",
  chatInput: "chat-input",
  chatSend: "chat-send",
  chatCancel: "chat-cancel",
  chatSlashMenu: "chat-slash-menu",
  chatSlashCommand: "chat-slash-command",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

/** `[data-testid="…"]`, for the side that writes selectors rather than
 *  attributes. */
export const selector = (id: TestId): string => `[data-testid="${id}"]`

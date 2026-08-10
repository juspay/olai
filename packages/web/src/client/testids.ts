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
  /** The button in that surface — the whole of the recovery. */
  reload: "reload",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

/** `[data-testid="…"]`, for the side that writes selectors rather than
 *  attributes. */
export const selector = (id: TestId): string => `[data-testid="${id}"]`

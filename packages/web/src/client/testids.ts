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
  errorView: "error-view",
  errorFileGroup: "error-file-group",
  error: "error",
  crossFileErrors: "cross-file-errors",
  stageNote: "stage-note",
  /** Over a last-good tree: the set on disk stopped validating. */
  staleBanner: "stale-banner",
  /** In one outline's place: that file could not be read, the rest are live. */
  outlineFailure: "outline-failure",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

/** `[data-testid="…"]`, for the side that writes selectors rather than
 *  attributes. */
export const selector = (id: TestId): string => `[data-testid="${id}"]`

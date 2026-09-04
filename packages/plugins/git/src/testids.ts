/**
 * THE COMMIT FACES' TEST IDS — this plugin's half of olai's testid table.
 *
 * Values did not change, which is what kept the move from also being a rename:
 * a testid is a promise to a scenario. Names only, no imports.
 */
export const TESTID = {
  commitPill: "commit-pill",
  commitPanel: "commit-panel",
  gitNews: "git-news",
  commitLast: "commit-last",
  commitGroup: "commit-group",
  commitOther: "commit-other",
  commitTick: "commit-tick",
  commitScope: "commit-scope",
  commitUnpushed: "commit-unpushed",
  commitPush: "commit-push",
  commitPushRefused: "commit-push-refused",
  commitChange: "commit-change",
  commitUnreadable: "commit-unreadable",
  commitWriters: "commit-writers",
  commitBlocked: "commit-blocked",
  commitMessage: "commit-message",
  commitNow: "commit-now",
  commitRefused: "commit-refused",
  commitCallRefused: "commit-call-refused",
  commitAutoPaused: "commit-auto-paused",
  commitAutoArmed: "commit-auto-armed",
  /** Start a stopped quiet-window loop again. On the commit panel, drawn only
   *  while the loop is actually paused — Resume used to sit on the preferences
   *  Git commit row, which left with the plugin. */
  commitResume: "commit-resume",
} as const

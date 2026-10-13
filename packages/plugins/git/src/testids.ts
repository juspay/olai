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
  /** Remove the stale `index.lock` git refused the last commit over. On the
   *  commit panel, drawn only while a refusal was about a lock file — the one
   *  refusal with a gesture behind it. */
  commitUnlock: "commit-unlock",
  /** ... and the sentence the unlock button is answered with when the lock is
   *  too young to touch: a git process may still be writing it. */
  commitLockHeld: "commit-lock-held",
  commitCallRefused: "commit-call-refused",
  /** What the SERVER would not take from the Resume press — its own line under
   *  its own button, so a call that never reached the server (or one it
   *  refused) is never silent. */
  commitResumeRefused: "commit-resume-refused",
  /** ... and the same for the unlock press: a call that failed, or a lock file
   *  that was there and could not be removed, whose errno is the whole of what
   *  a reader can act on. */
  commitUnlockRefused: "commit-unlock-refused",
  commitAutoPaused: "commit-auto-paused",
  commitAutoArmed: "commit-auto-armed",
  /** Start a stopped quiet-window loop again. On the commit panel, drawn only
   *  while the loop is actually paused — Resume used to sit on the preferences
   *  Git commit row, which left with the plugin. */
  commitResume: "commit-resume",
} as const

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/git": OwnedTestIds }
}

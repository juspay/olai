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
  commitUnlock: "commit-unlock",
  commitLockHeld: "commit-lock-held",
  commitCallRefused: "commit-call-refused",
  commitResumeRefused: "commit-resume-refused",
  commitUnlockRefused: "commit-unlock-refused",
  commitAutoPaused: "commit-auto-paused",
  commitAutoArmed: "commit-auto-armed",
  commitResume: "commit-resume",
} as const

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/git": OwnedTestIds }
}

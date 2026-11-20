import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

export const COMMIT_LAST = selector(TESTID.commitLast);
export const COMMIT_CHANGE = selector(TESTID.commitChange);
export const COMMIT_MESSAGE = selector(TESTID.commitMessage);
export const COMMIT_NOW = selector(TESTID.commitNow);
export const COMMIT_BLOCKED = selector(TESTID.commitBlocked);
export const COMMIT_OTHER = selector(TESTID.commitOther);
export const COMMIT_TICK = selector(TESTID.commitTick);
export const COMMIT_SCOPE = selector(TESTID.commitScope);
export const COMMIT_UNPUSHED = selector(TESTID.commitUnpushed);
export const COMMIT_PUSH = selector(TESTID.commitPush);
export const COMMIT_PUSH_REFUSED = selector(TESTID.commitPushRefused);
export const COMMIT_REFUSED = selector(TESTID.commitRefused);
export const COMMIT_UNLOCK = selector(TESTID.commitUnlock);
export const COMMIT_UNLOCK_REFUSED = selector(TESTID.commitUnlockRefused);
export const COMMIT_LOCK_HELD = selector(TESTID.commitLockHeld);
export const COMMIT_AUTO_PAUSED = selector(TESTID.commitAutoPaused);
export const COMMIT_AUTO_ARMED = selector(TESTID.commitAutoArmed);

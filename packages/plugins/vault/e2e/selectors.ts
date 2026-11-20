import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

export const STALE_BANNER = selector(TESTID.staleBanner);
export const BROKEN_FILE_LINE = selector(TESTID.brokenFileLine);
export const BROKEN_FILE_LINK = selector(TESTID.brokenFileLink);

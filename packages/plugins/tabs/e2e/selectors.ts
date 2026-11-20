import { TESTID as ALL } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

export const STRIP = selector(TESTID.tabsStrip);
export const TAB = selector(TESTID.tabsTab);
export const CLOSE = selector(TESTID.tabsClose);
export const NEW = selector(TESTID.tabsNew);
export const DOT = selector(TESTID.tabsDot);
export const TITLE = selector(TESTID.tabsTitle);
export const MENU = selector(TESTID.tabsMenu);
export const SHORTCUT = selector(ALL.shortcut);

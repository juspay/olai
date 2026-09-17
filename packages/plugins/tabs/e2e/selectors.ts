/**
 * THIS ROW'S SELECTORS — its own ids, spelled once, for its own steps. The one
 * id read here that is not this row's is the shortcuts sheet's row, which the
 * navigation row draws and these steps read to find the tab chords listed.
 */

import { TESTID as ALL } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

export const STRIP = selector(TESTID.tabsStrip);
export const TAB = selector(TESTID.tabsTab);
export const CLOSE = selector(TESTID.tabsClose);
export const NEW = selector(TESTID.tabsNew);
export const DOT = selector(TESTID.tabsDot);
export const ADDRESS = selector(TESTID.tabsAddress);
export const MENU = selector(TESTID.tabsMenu);
export const SHORTCUT = selector(ALL.shortcut);

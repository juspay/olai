import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

export const TRASH_PAGE = selector(TESTID.trashPage);
export const RAIL_TRASH = selector(TESTID.railTrash);
export const TRASH_ROW = selector(TESTID.trashRow);
export const TRASH_PUT_BACK = selector(TESTID.trashPutBack);
export const TRASH_SAID = selector(TESTID.trashSaid);
export const TRASH_EMPTY = selector(TESTID.trashEmpty);
export const TRASH_EMPTY_VERB = selector(TESTID.trashEmptyVerb);
export const TRASH_EMPTY_CONFIRM = selector(TESTID.trashEmptyConfirm);
export const TRASH_EMPTY_CANCEL = selector(TESTID.trashEmptyCancel);
export const TRASH_PAGE_SAID = selector(TESTID.trashPageSaid);

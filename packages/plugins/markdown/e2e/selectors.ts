import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

export const DOCUMENT_EDITOR = selector(TESTID.documentEditor);
export const DOCUMENT_SAVE = selector(TESTID.documentSave);
export const DOCUMENT_CANCEL = selector(TESTID.documentCancel);
export const DOCUMENT_SAID = selector(TESTID.documentSaid);
export const DOCUMENT_OVERWRITE = selector(TESTID.documentOverwrite);
export const DOCUMENT_DRIFTED = selector(TESTID.documentDrifted);
export const TOC = selector(TESTID.toc);
export const TOC_LINK = selector(TESTID.tocLink);
export const DOCUMENT_REFERRERS_SUMMARY = selector(TESTID.documentReferrersSummary);
export const DOCUMENT_REFERRER = selector(TESTID.documentReferrer);

import { yesNo } from "@olai/format"
export const INBOX_TYPE = "mail-inbox"
export const kinds = [{ kind: "inbox", takes: "`mail-inbox` (on/off, yes/no or true/false)", admits: (value: string) => yesNo(value) !== undefined }] as const
const own = new Map(kinds.map(kind => [INBOX_TYPE, { ...kind, kind: INBOX_TYPE, claims: INBOX_TYPE }]))
export const ownKinds = { built: own, enabled: own }

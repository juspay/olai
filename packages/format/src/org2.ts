/** The complete reversible mapping between OLAI record fields and Org2
 * properties. ID uses Org's native stable identity key; every other value is
 * JSON-encoded so the one-line drawer grammar can retain arbitrary strings. */
export const FIELD_PROPERTIES = {
  parent: "OLAI_PARENT",
  ord: "OLAI_ORD",
  title: "OLAI_TITLE",
  mirror: "OLAI_MIRROR",
  done: "OLAI_DONE",
  cancelled: "OLAI_CANCELLED",
  doing: "OLAI_DOING",
  todo: "OLAI_TODO",
  started: "OLAI_STARTED",
  worked: "OLAI_WORKED",
  date: "OLAI_DATE",
  repeat: "OLAI_REPEAT",
  desc: "OLAI_DESC",
  doc: "OLAI_DOC",
  after: "OLAI_AFTER",
  blocks: "OLAI_BLOCKS",
  see: "OLAI_SEE",
  created: "OLAI_CREATED",
  changed: "OLAI_CHANGED",
  custom: "OLAI_CUSTOM",
} as const

export const KIND_PROPERTY = "OLAI_KIND"

export const KNOWN_PROPERTIES = new Set<string>([
  "ID",
  KIND_PROPERTY,
  ...Object.values(FIELD_PROPERTIES),
])

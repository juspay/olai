import { InboxHeld, NO_INBOX, sameInboxHeld } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { editProcedures } from "@olai/surface/dispatch"
export const surface = defineSurface({
cells: {
    inbox: {
      schema: InboxHeld,
      default: NO_INBOX,
      verbs: ["get"],
      equals: sameInboxHeld,
    }
},
procedures: {
edit: editProcedures
}
})
export const dispatch = {
  "edit.apply": ["capture"],
} as const
export const faces = {
  "browser": {
    "inbox": "resource",
    "edit.apply": "tool"
  },
  "agent": {}
} as const

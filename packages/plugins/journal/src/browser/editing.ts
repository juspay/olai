import { heldService } from "@olai/ui-primitives/held.ts"
import type { DocumentActions } from "olai-plugin-markdown/contract"

const provider = heldService<DocumentActions>()

export const holdDocumentActions = provider.hold

export const useDocumentActions = provider.read

/** Chat spends the vault.files method held by its activation. Parsing belongs
 * to the vault; cancelling the drawing cancels this request too. */
import type { FileDiff } from "@olai/acp/wire"
import type { Directory } from "olai-plugin-vault/file-state"
export const outlineDiffOf = (vault: Directory, diff: FileDiff) =>
  vault.outlineDiff(diff.path, diff.oldText, diff.newText)

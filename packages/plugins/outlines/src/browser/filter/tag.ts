import { intentOf } from "@olai/surface"

export { TAG_ATTRIBUTE } from "@olai/markdown-ui/tag-contract.ts"
import { TAG_ATTRIBUTE } from "@olai/markdown-ui/tag-contract.ts"

export const tagPressed = (event: MouseEvent): string | null => {
  if (intentOf(event) !== "go") return null
  const target = event.target
  if (!(target instanceof Element)) return null
  const held = target.closest(`[${TAG_ATTRIBUTE}]`)
  if (held === null) return null
  if (held.closest("a") !== null) return null
  return held.getAttribute(TAG_ATTRIBUTE)
}

export const onATag = (event: MouseEvent): boolean => tagPressed(event) !== null

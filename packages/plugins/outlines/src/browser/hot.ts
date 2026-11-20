import { customText, type HasCustom, type Progress, type Status } from "@olai/format"

export const HOT_PROPERTY = "pr"

export type Hot =
  | { readonly kind: "progress"; readonly progress: Progress }
  | {
    readonly kind: "prop"
    readonly key: string
    readonly text: string
    readonly full?: string
  }

export const hotOf = (
  node: HasCustom | undefined,
  progress: Progress | undefined,
  status: Status | undefined,
): Hot | undefined => {
  if (progress !== undefined) return { kind: "progress", progress }
  if (node === undefined || status !== "done") return undefined
  const held = customText(node, HOT_PROPERTY)
  if (held === undefined || held === "") return undefined
  const short = shortened(held)
  return {
    kind: "prop",
    key: HOT_PROPERTY,
    text: short,
    full: short === held ? undefined : held,
  }
}

const shortened = (value: string): string => {
  if (!value.startsWith("https://") && !value.startsWith("http://")) return value
  const parts = value.split("?")[0]!.split("#")[0]!.split("/").filter((one) => one !== "")
  const last = parts[parts.length - 1]
  return last === undefined || parts.length <= 2 ? value : last
}

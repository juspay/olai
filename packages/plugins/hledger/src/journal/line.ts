import { DATE_SHAPE } from "./date.ts"
import { type Header, headerOf } from "./header.ts"

export type Line =
  | { readonly kind: "blank"; readonly raw: string }
  | { readonly kind: "comment"; readonly raw: string }
  | { readonly kind: "blockOpen"; readonly raw: string }
  | { readonly kind: "header"; readonly header: Header; readonly raw: string }
  | { readonly kind: "headerRefused"; readonly raw: string }
  | { readonly kind: "indentedComment"; readonly raw: string }
  | { readonly kind: "indented"; readonly raw: string }
  | { readonly kind: "directive"; readonly raw: string }

export const classify = (raw: string): Line => {
  if (/^\s*$/.test(raw)) return { kind: "blank", raw }
  if (raw.startsWith(";") || raw.startsWith("#") || raw.startsWith("*")) return { kind: "comment", raw }
  if (!/^\s/.test(raw)) {
    if (DATE_SHAPE.test(raw)) {
      const header = headerOf(raw)
      return header === null ? { kind: "headerRefused", raw } : { kind: "header", header, raw }
    }
    if (/^\s*comment\b/.test(raw)) return { kind: "blockOpen", raw }
    return { kind: "directive", raw }
  }
  const content = raw.trim()
  if (content.startsWith(";") || content.startsWith("#")) return { kind: "indentedComment", raw }
  return { kind: "indented", raw }
}

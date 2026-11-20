export const LINKS_ELSEWHERE = "data-links-elsewhere"

export const ELSEWHERE_SELECTOR = `[${LINKS_ELSEWHERE}]`

export type Elsewhere =
  | { readonly kind: "into"; readonly index: number }
  | { readonly kind: "beside"; readonly from: number }

export const elsewhereOf = (index: number): Elsewhere =>
  index > 0 ? { kind: "into", index: index - 1 } : { kind: "beside", from: index }

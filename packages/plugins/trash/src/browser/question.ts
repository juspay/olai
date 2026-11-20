export type Going =
  | { readonly kind: "row"; readonly title: string }
  | { readonly kind: "rows"; readonly count: number }

export const trashQuestion = (
  going: Going,
  under: number,
): string => {
  const named = going.kind === "row"
    ? `“${going.title}”`
    : going.count === 1
    ? "this row"
    : `these ${going.count} rows`
  const going_ = going.kind === "row" ? 1 : going.count
  const one = going_ === 1 && under === 0
  const beneath = under === 0
    ? ""
    : ` and the ${under === 1 ? "row" : `${under} rows`} under ${
      going_ === 1 ? "it" : "them"
    }`
  return `Move ${named}${beneath} to Trash? You can put ${one ? "it" : "them"} back from Trash in the sidebar.`
}

export const emptyQuestion = (
  count: number,
): string => {
  const one = count === 1
  const rows = one ? "the one row" : `all ${count} rows`
  const it = one ? "it" : "them"
  return `Permanently delete ${rows} in Trash? olai can't bring ${it} back. ` +
    `Only what git has already saved can be recovered.`
}

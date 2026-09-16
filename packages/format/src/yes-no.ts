/** The vault's case-insensitive yes/no spellings. Unknown text is not consent. */
export const yesNo = (value: string | undefined): boolean | undefined => {
  switch (value?.trim().toLowerCase()) {
    case "yes": case "on": case "true": return true
    case "no": case "off": case "false": return false
    default: return undefined
  }
}

import { type Decimal, isDigit, negate, parse, scan } from "./decimal.ts"

export interface Style {
  readonly sign: "leading" | "number"
  readonly side: "prefix" | "suffix"
  readonly spaced: boolean
}

export interface Amount {
  readonly commodity: string
  readonly value: Decimal
  readonly style: Style | null
  readonly written: string | null
}

const BARE = /^[^0-9\s+\-".@=;,#*!()[\]]+/

const commodityOf = (token: string): string | null => {
  if (token.startsWith('"')) {
    return token.length > 2 && token.endsWith('"') ? token.slice(1, -1) : null
  }
  const found = BARE.exec(token)
  return found !== null && found[0] === token ? token : null
}

export const parseAmount = (region: string): Amount | null => {
  let text = region.trim()
  if (text === "") return null
  let leading = false
  let negative = false
  if (text.startsWith("-") || text.startsWith("+")) {
    leading = true
    negative = text.startsWith("-")
    text = text.slice(1).trimStart()
  }

  let commodity = ""
  let side: "prefix" | "suffix" = "prefix"
  let spaced = false
  let written = ""

  const first = text[0]
  if (text.startsWith('"')) {
    const end = text.indexOf('"', 1)
    if (end < 0) return null
    commodity = text.slice(1, end)
    const rest = text.slice(end + 1)
    spaced = /^\s/.test(rest)
    const number = scan(rest.trimStart())
    if (number === null || number.rest.trim() !== "") return null
    written = number.written
  } else if (isDigit(first) || first === "." || first === ",") {
    const number = scan(text)
    if (number === null) return null
    written = number.written
    spaced = /^\s/.test(number.rest)
    const token = number.rest.trim()
    if (token !== "") {
      const named = commodityOf(token)
      if (named === null) return null
      commodity = named
    }
    side = "suffix"
  } else {
    const found = BARE.exec(text)
    if (found === null) return null
    commodity = found[0]
    const rest = text.slice(commodity.length)
    spaced = /^\s/.test(rest)
    const number = scan(rest.trimStart())
    if (number === null || number.rest.trim() !== "") return null
    written = number.written
  }

  if (written.startsWith("-") || written.startsWith("+")) {
    if (leading) return null
    negative = written.startsWith("-")
    written = written.slice(1)
    if (written.startsWith("-") || written.startsWith("+")) return null
  }
  const value = parse(written)
  if (value === null) return null
  const exact = negative ? negate(value) : value
  return {
    commodity,
    value: exact,
    written,
    style: {
      sign: leading && negative && side === "prefix" ? "leading" : "number",
      side,
      spaced,
    },
  }
}

import { type Address, addressOf, printAddress } from "./address.ts"
import { proseIn } from "./frontmatter.ts"
import { bodyKind, type Claims, isFetched } from "./kinds.ts"
import { isMirror, type Located } from "./node.ts"
import { headingText } from "./slug.ts"

export const resolveRelative = (from: string, to: string): string => {
  const segments = from.split("/").slice(0, -1)
  for (const segment of to.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return segments.join("/")
}

export const pictureOf = (claims: Claims, from: string, src: string): string | null => {
  const resolved = relativeTo(from, src)
  return resolved !== null && isPicture(claims, resolved) ? resolved : null
}

const relativeTo = (from: string, to: string): string | null => {
  if (refusedHref(to)) return null
  const decoded = decodeHref(to)
  if (decoded === null || (decoded !== to && refusedHref(decoded))) return null
  return resolveRelative(from, decoded)
}

const refusedHref = (href: string): boolean =>
  href === "" || href.startsWith("/") || href.startsWith("#") || SCHEME.test(href)

const decodeHref = (href: string): string | null => {
  if (!href.includes("%")) return href
  const segments = href.split("/").map(decodedSegment)
  return segments.includes(null) ? null : segments.join("/")
}

const decodedSegment = (segment: string): string | null => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}


export const pathedOf = (from: string, href: string): string | null =>
  relativeTo(from, href)

const SCHEME = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/

const suffixed = (path: string, extensions: ReadonlyArray<string>): boolean => {
  const lower = path.toLowerCase()
  return extensions.some((extension) => lower.endsWith(extension))
}

export const isPicture = (claims: Claims, path: string): boolean => {
  const lower = path.toLowerCase()
  return [...claims.byKind.values()].some(claim => claim.picture === true &&
    suffixed(lower, claim.exts) && !suffixed(lower, claim.inert ?? []))
}

export const servingOf = (claims: Claims, path: string): { sealed: boolean; inert: boolean } => {
  const claim = [...claims.byKind.values()].find(claim =>
    claim.exts.some(ext => path.endsWith(ext) || (claim.picture === true && path.toLowerCase().endsWith(ext))))
  return { sealed: claim?.serving === "sealed-frame", inert: suffixed(path, claim?.inert ?? []) }
}

const ASSET_EXTENSIONS: ReadonlyArray<string> = [
  ".css",
  ".js",
  ".mjs",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
]

export const isAsset = (claims: Claims, path: string): boolean =>
  isFetched(claims, path) || isPicture(claims, path) || suffixed(path, ASSET_EXTENSIONS)

export const firstLine = (text: string): string => {
  const body = proseIn(text)
  let at = 0
  while (at < body.length) {
    const end = body.indexOf("\n", at)
    const line = (end === -1 ? body.slice(at) : body.slice(at, end)).trim()
    if (line !== "") {
      const stripped = headingText(line)
      return stripped === null || stripped === "" ? line : stripped
    }
    if (end === -1) break
    at = end + 1
  }
  return ""
}

const UTF8 = new TextEncoder()

export const bytesOf = (text: string): number => UTF8.encode(text).length

const withoutCodeBlocks = (text: string): string => {
  let listIndent: number | undefined
  let fence: { marker: string; length: number } | undefined
  return text.split("\n").map(line => {
    const indent = /^( *)/.exec(line)![1]!.length
    if (fence === undefined) {
      const item = /^( *)(?:[-+*]|\d+[.)]) +/.exec(line)
      if (item && indent < (listIndent ?? 0) + 4) listIndent = item[0].length
      else if (line.trim() !== "" && listIndent !== undefined && indent < listIndent) listIndent = undefined
    }
    const content = listIndent === undefined ? line : line.slice(Math.min(indent, listIndent))
    const match = /^(?: {0,3}> ?)* {0,3}(`{3,}|~{3,})(.*)$/.exec(content)
    if (fence !== undefined) {
      if (match && match[1]![0] === fence.marker && match[1]!.length >= fence.length && match[2]!.trim() === "") fence = undefined
      return ""
    }
    if (match && (match[1]![0] !== "`" || !match[2]!.includes("`"))) {
      fence = { marker: match[1]![0]!, length: match[1]!.length }
      return ""
    }
    return /^( {4}|\t)/.test(content) ? "" : content
  }).join("\n")
}

const withoutCodeSpans = (lines: string): string => {
  let prose = ""
  for (let i = 0; i < lines.length;) {
    if (lines[i] === "\\") { prose += lines.slice(i, i + 2); i += 2; continue }
    if (lines[i] !== "`") { prose += lines[i++]; continue }
    let end = i
    while (lines[end] === "`") end++
    const marker = lines.slice(i, end)
    let close = lines.indexOf(marker, end)
    while (close !== -1 && (lines[close - 1] === "`" || lines[close + marker.length] === "`")) close = lines.indexOf(marker, close + marker.length)
    if (close === -1) { prose += marker; i = end }
    else { prose += " "; i = close + marker.length }
  }
  return prose
}

export const linksIn = (claims: Claims, from: string, text: string): ReadonlyArray<Address> => {
  let found: Array<Address> | undefined
  let seen: Set<string> | undefined
  for (const href of proseLinks(text)) {
    const address = linkTo(claims, from, href)
    if (address === null) continue
    const written = printAddress(address)
    if ((seen ??= new Set()).has(written)) continue
    seen.add(written)
    ;(found ??= []).push(address)
  }
  return found ?? NO_LINKS
}

export const writtenLinks = (text: string): ReadonlyArray<string> => {
  const found: Array<string> = []
  eachTarget(text, (target) => {
    found.push(destinationOf(target))
  })
  return found
}

export const proseLinks = (text: string): ReadonlyArray<string> =>
  text.includes("](") ? writtenLinks(withoutCodeSpans(withoutCodeBlocks(text))) : []

export const bracketSpacedLinks = (text: string): string => {
  if (!text.includes("](")) return text
  let out = ""
  let last = 0
  let changed = false
  eachTarget(text, (target, open, close) => {
    const dest = destinationOf(target)
    if (!SPACE.test(dest) || target.startsWith("<")) return
    out += text.slice(last, open) + `<${dest}>` + target.slice(dest.length)
    last = close
    changed = true
  })
  return changed ? out + text.slice(last) : text
}

const eachTarget = (
  text: string,
  visit: (target: string, open: number, close: number) => void,
): void => {
  let label = -1
  for (let at = 0; at < text.length; at++) {
    const char = text[at]
    if (char === "[") label = at
    else if (char === "]") {
      if (label !== -1 && text[at + 1] === "(") {
        const close = text.indexOf(")", at + 2)
        if (close !== -1) {
          visit(text.slice(at + 2, close), at + 2, close)
          at = close
        }
      }
      label = -1
    }
  }
}

const destinationOf = (target: string): string => {
  if (target.startsWith("<")) {
    const end = target.indexOf(">")
    return end === -1 ? target.slice(1) : target.slice(1, end)
  }
  const title = target.search(TITLE)
  return title === -1 ? target : target.slice(0, title)
}

const TITLE = /\s+["'(]/

const SPACE = /\s/

const NO_LINKS: ReadonlyArray<Address> = []

export const recordLinks = (claims: Claims, located: Located): ReadonlyArray<Address> =>
  recordContributions(claims, located).map((one) => one.address).filter(isAddress)

const isAddress = (address: Address | undefined): address is Address => address !== undefined

export const recordContributions = (
  claims: Claims,
  located: Located,
): ReadonlyArray<{ readonly way: "see" | "link"; readonly address: Address; readonly at: Located }> => {
  const found: Array<{ readonly way: "see" | "link"; readonly address: Address; readonly at: Located }> = []
  if (isMirror(located.node)) return found
  for (const id of located.node.see ?? []) {
    const address = addressOf(claims, null, id)
    if (address !== null) found.push({ way: "see", address, at: located })
  }
  for (const address of linksIn(claims, located.file, located.node.title)) found.push({ way: "link", address, at: located })
  if (located.node.desc !== undefined) {
    for (const address of linksIn(claims, located.file, located.node.desc)) found.push({ way: "link", address, at: located })
  }
  return found
}

const linkTo = (claims: Claims, from: string, href: string): Address | null => {
  const cut = href.indexOf("#")
  if (cut === 0) return addressOf(claims, null, href.slice(1))
  const path = cut === -1 ? href : href.slice(0, cut)
  const resolved = pathedOf(from, path)
  return resolved === null ? null : addressOf(claims, resolved, cut === -1 ? null : href.slice(cut + 1))
}

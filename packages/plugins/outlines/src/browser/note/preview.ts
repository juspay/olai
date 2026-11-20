export const plainLine = (desc: string): string => {
  let at = 0
  while (at < desc.length) {
    const end = desc.indexOf("\n", at)
    const line = (end === -1 ? desc.slice(at) : desc.slice(at, end)).trim()
    if (line !== "") return stripMarks(line)
    if (end === -1) break
    at = end + 1
  }
  return ""
}

export const measuredAt = (desc: string, at: number): number => {
  let start = 0
  while (start < desc.length) {
    const end = desc.indexOf("\n", start)
    const raw = end === -1 ? desc.slice(start) : desc.slice(start, end)
    const line = raw.trim()
    if (line === "") {
      if (end === -1) return 0
      start = end + 1
      continue
    }
    const view = stripMarks(line)
    const base = start + (raw.length - raw.trimStart().length)
    if (view.length === 0) return base
    let s = base
    while (s < desc.length && desc[s] !== view[0]) s++
    let i = 0
    const last = Math.min(at, view.length)
    while (i < last) {
      s++
      i++
      if (i < view.length) {
        while (s < desc.length && desc[s] !== view[i]) s++
      }
    }
    return Math.min(s, desc.length)
  }
  return 0
}

const stripMarks = (line: string): string => {
  let text = line
  text = text.replace(/^#{1,6}\s+/, "")
  text = text.replace(/^([-*+]|\d+[.)])\s+/, "")
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1")
  text = text.replace(/__([^_]+)__/g, "$1")
  text = text.replace(/\*([^*]+)\*/g, "$1")
  text = text.replace(/_([^_]+)_/g, "$1")
  text = text.replace(/`([^`]+)`/g, "$1")
  let end = text.length
  while (end > 0 && text[end - 1] === "#") end--
  if (end < text.length) {
    let before = end
    while (before > 0 && (text[before - 1] === " " || text[before - 1] === "\t")) before--
    if (before < end) text = text.slice(0, before)
  }
  return text.trim()
}

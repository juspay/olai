/** The first nonempty line names the node; the ellipsis fits inside 60 chars. */
export function newChatTitle(message: string): string {
  const line = message.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? ""
  if (line.length <= 60) return line
  const head = line.slice(0, 59)
  const boundary = /\s/.test(line[59]!) ? -1 : head.search(/\s+\S*$/)
  return `${(boundary > 0 ? head.slice(0, boundary) : head).trimEnd()}…`
}

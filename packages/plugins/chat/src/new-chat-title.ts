/** The first nonempty line names the node; the ellipsis fits inside 60 chars. */
export function newChatTitle(message: string): string {
  const line = message.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? ""
  const characters = Array.from(line)
  if (characters.length <= 60) return line
  const head = characters.slice(0, 59).join("")
  const boundary = /\s/.test(characters[59]!) ? -1 : head.search(/\s+\S*$/)
  return `${(boundary > 0 ? head.slice(0, boundary) : head).trimEnd()}…`
}

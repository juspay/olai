import { pinTitle } from "@olai/format"

/** The first nonempty line names the node; the ellipsis fits inside 60 chars. */
export function newChatTitle(message: string): string {
  const line = message.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? ""
  const characters = Array.from(line)
  if (characters.length <= 60) return line
  const head = characters.slice(0, 59).join("")
  const boundary = /\s/.test(characters[59]!) ? -1 : (/\s+\S*$/.exec(head)?.index ?? -1)
  return `${(boundary > 0 ? head.slice(0, boundary) : head).trimEnd()}…`
}

/**
 * THE TITLE OF A CHAT ABOUT A PLACE — `[plan](/notes/plan.md)`: the place's
 * name as a link's label around its address, which is how olai reads a row
 * that stands for a place (`@olai/format`'s `pinTitle`, the pin's own writer).
 *
 * The 60-character cut is the NAME's alone, so the address always survives
 * whole: an address cut short is a chat about some other place, or none. A
 * name that cannot be written as a label (a `]` in it) leaves the bare
 * address, which olai names by the place itself.
 */
export function aboutTitle(name: string, about: string): string {
  return pinTitle(about, newChatTitle(name)) ?? about.trim()
}

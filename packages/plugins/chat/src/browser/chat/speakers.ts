import type { ChatEntry } from "olai-plugin-chat/wire"
export type Speaker =
  | { readonly of: "human" }
  | { readonly of: "agent" }
  | { readonly of: "plugin"; readonly name: string }

export const speakerOf = (entry: ChatEntry | undefined): Speaker | null => {
  if (entry === undefined) return null
  switch (entry.kind) {
    case "user":
      return entry.rang === undefined ? { of: "human" } : { of: "plugin", name: entry.rang }
    case "agent":
    case "tool":
    case "ask":
      return { of: "agent" }
    case "refusal":
    case "notice":
      return null
  }
}

const sameSpeaker = (one: Speaker | null, other: Speaker | null): boolean => {
  if (one === null || other === null) return false
  if (one.of !== other.of) return false
  return one.of !== "plugin" || other.of !== "plugin" || one.name === other.name
}

export const facedAt = (
  entry: ChatEntry | undefined,
  above: ChatEntry | undefined,
): Speaker | null => {
  const speaker = speakerOf(entry)
  if (speaker === null) return null
  return sameSpeaker(speaker, speakerOf(above)) ? null : speaker
}

export const onTheRight = (speaker: Speaker): boolean => speaker.of === "human"

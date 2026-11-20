import type { Server } from "@kolu/acp/wire"
export const SAID: {
  readonly [K in Server["standing"]]: {
    readonly mark: { readonly glyph: string; readonly tint: string } | null
    readonly sentence: string
  }
} = {
  connected: {
    mark: { glyph: "✓", tint: "text-done" },
    sentence: "is connected",
  },
  handed: {
    mark: null,
    sentence: "was offered, not yet confirmed",
  },
  unattached: {
    mark: { glyph: "×", tint: "text-alarm" },
    sentence: "didn't connect to this chat",
  },
  missing: {
    mark: { glyph: "×", tint: "text-alarm" },
    sentence: "is missing from this chat",
  },
}

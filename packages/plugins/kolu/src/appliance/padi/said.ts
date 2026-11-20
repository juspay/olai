import { recencyText } from "@kolu/solid-dockrow/rowValues"
import type { KoluLink, WatchPulse } from "olai-plugin-kolu/appliance/wire"

export interface Beat {
  readonly kind: "none" | "fresh" | "quiet"
  readonly said: string | null
}

export const beatOf = (pulse: WatchPulse | null | undefined, now: number): Beat => {
  if (pulse === undefined || pulse === null) return { kind: "none", said: null }
  const at = new Date(pulse.at).getTime()
  const quiet = now - at > pulse.everyMs * 2
  const said = quiet
    ? `No check-in for ${recencyText("wait-chip", at, now)}`
    : `Checked in ${recencyText("ago", at, now)}`
  return { kind: quiet ? "quiet" : "fresh", said }
}

export interface Said {
  readonly tone: "healthy" | "quiet" | "notice" | "alarm"
  readonly label: string
  readonly detail: string
  readonly beat: Beat | null
}

const lookedAt = (link: KoluLink): string =>
  link.socket === ""
    ? "kolu isn't set up"
    : link.told
    ? `kolu isn't running at ${link.socket} (from $PADI_SOCKET)`
    : `kolu isn't running at ${link.socket}`

export const padiSaid = (link: KoluLink, pulse?: WatchPulse | null, now?: number): Said => {
  switch (link.status) {
    case "connected": {
      const beat = pulse === undefined || now === undefined ? { kind: "none" as const, said: null } : beatOf(pulse, now)
      return {
        tone: beat.kind === "quiet" ? "notice" : "healthy",
        label: "kolu",
        detail: beat.said === null
          ? "Connected. Terminals on this page are live."
          : `Connected · ${beat.said}`,
        beat: beat.kind === "none" ? null : beat,
      }
    }
    case "skew":
      return {
        tone: "alarm",
        label: "kolu: update needed",
        detail:
          `kolu and olai versions don't match (padi ${link.surfaceVersion ?? "?"}, olai ${link.speaks}). Update one of them to see terminals.`,
        beat: null,
      }
    case "absent":
      return {
        tone: "quiet",
        label: "No kolu",
        detail: lookedAt(link),
        beat: null,
      }
  }
}

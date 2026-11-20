import { grumble } from "@olai/web/client/grumble.ts"

export const createChime = (target: EventTarget = window, open: () => AudioContext = () => new AudioContext()) => {
let audio: AudioContext | undefined
let active = true

const NO_CHIME = "chime"

const noChime = (why: string, cause?: unknown): void => {
  grumble(NO_CHIME, `olai: no chime — ${why}`, cause)
}

const unlock = (): void => {
  target.removeEventListener("pointerdown", unlock, true)
  target.removeEventListener("keydown", unlock, true)
  if (!active || audio !== undefined) return
  try {
    audio = open()
  } catch (cause) {
    noChime("this browser would not open an audio context", cause)
    return
  }
  // Constructed inside a gesture it should already be `running`; a browser that
  // hands it back suspended anyway is what `resume` is for.
  void audio.resume().catch((cause: unknown) => {
    noChime("this browser would not start the audio context", cause)
  })
}

const arm = (): void => {
  target.addEventListener("pointerdown", unlock, true)
  target.addEventListener("keydown", unlock, true)
}

const NOTES = [880, 1318.5]

const NOTE = 0.28
const APART = 0.1

const PEAK = 0.12

const chime = (): void => {
  if (!active) return
  const ctx = audio
  if (ctx === undefined) {
    noChime("this page has not been touched yet, so the browser will not play one")
    return
  }
  try {
    const from = ctx.currentTime
    NOTES.forEach((hz, at) => {
      const start = from + at * APART
      const note = ctx.createOscillator()
      const level = ctx.createGain()
      note.type = "sine"
      note.frequency.setValueAtTime(hz, start)
      level.gain.setValueAtTime(0.0001, start)
      level.gain.exponentialRampToValueAtTime(PEAK, start + 0.012)
      level.gain.exponentialRampToValueAtTime(0.0001, start + NOTE)
      note.connect(level)
      level.connect(ctx.destination)
      note.start(start)
      note.stop(start + NOTE)
    })
  } catch (cause) {
    noChime("this browser refused to play it", cause)
  }
}

arm()
return { chime, dispose: () => {
  if (!active) return
  active = false
  target.removeEventListener("pointerdown", unlock, true)
  target.removeEventListener("keydown", unlock, true)
  const held = audio
  audio = undefined
  if (held) void held.close().catch(() => {})
} }
}

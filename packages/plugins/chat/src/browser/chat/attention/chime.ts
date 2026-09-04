/**
 * One short chime — two notes, a third of a second, and no file.
 *
 * SYNTHESISED rather than shipped, and that is a dependency decision as much as
 * an aesthetic one: olai requires nothing outside Nix, and an
 * audio asset is a binary in the bundle, a second content type for the static
 * layer to negotiate, and a thing to license. Two oscillator notes are eleven
 * lines and are the same sound in every browser.
 *
 * THE UNLOCK is the whole of the complexity here, and it is the platform's
 * rule rather than ours: an `AudioContext` created without a user gesture
 * starts suspended and stays that way, so a chime armed at boot would be
 * silent for exactly as long as the tab had never been touched. Nothing can be
 * done about that from here except to take the FIRST gesture there is —
 * whatever it was for — and open the context on it. By the time an agent is
 * waiting on an answer, somebody has pressed something to start the
 * conversation, so in practice the context is open long before it is needed.
 *
 * A tab that has never been touched and is chimed at anyway says so on the
 * console, once, and does not throw — `../../grumble.ts`, which is where that
 * whole argument lives. Nothing the reader asked for failed, the banner and
 * the badge both still landed, and a strip over somebody's outline saying
 * their browser would not make a noise is worse than the silence it reports.
 */

import { grumble } from "@olai/web/client/grumble.ts"

/** Open once, on the first gesture, and kept for the life of the document. */
let audio: AudioContext | undefined

/** The one key this module grumbles under: whatever went wrong, what a reader
 *  has lost is the same thing, and the first reason is the useful one. */
const NO_CHIME = "chime"

const noChime = (why: string, cause?: unknown): void => {
  grumble(NO_CHIME, `olai: no chime — ${why}`, cause)
}

const unlock = (): void => {
  window.removeEventListener("pointerdown", unlock, true)
  window.removeEventListener("keydown", unlock, true)
  if (audio !== undefined) return
  try {
    audio = new AudioContext()
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

/**
 * Take the first gesture this page gets, whatever it was for, and open the
 * audio context on it.
 *
 * `capture` so the listener runs before anything that stops propagation, and
 * on the WINDOW so it hears every press in the document. Removed by the first
 * one that fires — both of them, so a keyboard user does not leave a pointer
 * listener behind and the other way round.
 */
export const armChime = (): void => {
  window.addEventListener("pointerdown", unlock, true)
  window.addEventListener("keydown", unlock, true)
}

/** The two notes, as a fifth: A5 up to E6. Named because they are the sound. */
const NOTES = [880, 1318.5]

/** How long each note is held, and the gap between their starts. */
const NOTE = 0.28
const APART = 0.1

/** Loud enough to hear across a room, quiet enough not to be an alarm. */
const PEAK = 0.12

/** Ring, once. Never throws: a caller is telling somebody something, and the
 *  chime is the least of the three ways it says it. */
export const chime = (): void => {
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
      // An exponential ramp cannot touch zero, so the envelope runs between
      // near-silence and the peak — the shape that makes this a chime rather
      // than a click at each end.
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

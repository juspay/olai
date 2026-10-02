/** Maintained palette-levels fixture, disabled in every normal bundle. It
 * contributes rows that open levels through the public `paletteAdapters`
 * location and opens the palette at a path through the declared
 * `navigation.palette` service — nothing a real plugin could not do.
 *
 * The scenario's hand is `window.olaiTestPalette`: it may open the palette at
 * a path, withdraw and restore this fixture's adapter while the row stays on,
 * and read what was submitted. Held submits wait on gates kept in the PAGE
 * (`window.olaiTestPaletteGates`), not in this activation, so a scenario can
 * answer one after this row is gone and watch that nothing changes. */
import { definePlugin } from "@olai/plugin-api"
import { Effect, Exit, Scope } from "effect"
import { type Accessor, createMemo, createSignal, onCleanup } from "solid-js"
import {
  type LevelScope,
  type PaletteAdapter,
  type PaletteItem,
  type PaletteOption,
  type PaletteRunResult,
  paletteAdapters,
  paletteControl,
} from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { atOnce } from "@olai/web/client/settled.ts"
import { name } from "./index.ts"

interface Submitted { readonly text: string; readonly option: string | undefined }
interface Hand {
  readonly showAt: (path: ReadonlyArray<string>, text?: string) => void
  readonly withdraw: () => Promise<void>
  readonly restore: () => Promise<void>
  /** The adapter stays contributed but answers `available() === false`. */
  readonly setAvailable: (available: boolean) => void
  /** The adapter stays contributed and available but stops offering its
   *  root row. */
  readonly setOffered: (offered: boolean) => void
  readonly submitted: Array<Submitted>
}
interface Gate { readonly text: string; readonly answer: (result: PaletteRunResult) => void }
declare global {
  interface Window {
    olaiTestPalette?: Hand
    olaiTestPaletteGates?: Array<Gate>
  }
}

const row = (id: string, label: string, more: Partial<PaletteItem> = {}): PaletteItem => ({
  id,
  label,
  action: { kind: "run", run: () => Promise.resolve({ said: { tone: "aside", text: `Picked ${label}.` } }) },
  taking: atOnce,
  search: label.toLowerCase(),
  ...more,
})

const WORDS = ["amber", "anchor", "basil", "beacon", "cobalt", "copper"]
const TONES: ReadonlyArray<PaletteOption> = [
  { id: "plain", label: "Plain", section: "Tone" },
  { id: "urgent", label: "Urgent", hint: "loud", section: "Tone" },
  { id: "quiet", label: "Quiet", place: "whispered", section: "Tone" },
]

/** What a note's submit does is spelled by its first word, so a scenario
 *  chooses the answer by what it types. */
const submitNote = (submitted: Array<Submitted>) => (text: string, option: PaletteOption | undefined): Promise<PaletteRunResult> => {
  submitted.push({ text, option: option?.id })
  const said = { tone: "aside" as const, text: `Noted “${text}” as ${option?.label ?? "nothing"}.` }
  if (text.startsWith("hold")) {
    return new Promise((answer) => {
      const gates = (window.olaiTestPaletteGates ??= [])
      gates.push({ text, answer })
    })
  }
  if (text.startsWith("keep")) return Promise.resolve({ keepOpen: true })
  if (text.startsWith("say")) return Promise.resolve({ said })
  if (text.startsWith("fail")) return Promise.reject(new Error("the fixture's note failed on purpose"))
  return Promise.resolve({})
}

/** The note's value level — also opened from a row that arrives late. */
const noteLevel = (submitted: Array<Submitted>) => ({
  kind: "value" as const,
  placeholder: "Write a note…",
  initial: "draft",
  options: TONES,
  chosen: "urgent",
  submitLabel: "Save note",
  hint: "The tone is chosen with the arrows",
  validate: (text: string) => (text.trim() === "" ? "Type a note first." : null),
  submit: submitNote(submitted),
})

/** Rows that ANSWER LATER, the way a server search does: nothing at first,
 *  then one row that opens the note. The timer is the level's and stops with
 *  it. */
const lateRows = (submitted: Array<Submitted>) => (scope: LevelScope): Accessor<ReadonlyArray<PaletteItem>> => {
  const [rows, setRows] = createSignal<ReadonlyArray<PaletteItem>>([])
  const timer = setTimeout(() => {
    if (!scope.signal.aborted) {
      setRows([row("test-late-note", "Late note", { action: { kind: "level", level: noteLevel(submitted) } })])
    }
  }, 400)
  onCleanup(() => clearTimeout(timer))
  return rows
}

const adapterOf = (
  submitted: Array<Submitted>,
  available: Accessor<boolean>,
  offered: Accessor<boolean>,
): PaletteAdapter => ({
  available,
  items: () => !offered() ? [] : [{
    id: "test-levels",
    label: "Test levels",
    action: {
      kind: "level",
      level: {
        kind: "group",
        placeholder: "Pick a fixture row…",
        children: [
          row("test-apple", "Apple", { section: "Fruit", place: "orchard" }),
          row("test-banana", "Banana", { section: "Fruit", action: { kind: "run", run: () => Promise.resolve({}) } }),
          row("test-citrus", "Citrus", {
            section: "Nested",
            action: {
              kind: "level",
              level: {
                kind: "group",
                placeholder: "Pick a citrus…",
                children: [row("test-lemon", "Lemon"), row("test-lime", "Lime")],
              },
            },
          }),
          row("test-lookup", "Word lookup", {
            section: "Nested",
            action: {
              kind: "level",
              level: {
                kind: "group",
                placeholder: "Type a letter…",
                hint: "Type to find a word",
                // A function of the typed text, which does its own matching:
                // the motivating shape (a node search) in miniature.
                children: (scope) => createMemo(() => {
                  const typed = scope.typed().trim().toLowerCase()
                  return typed === "" ? [] : WORDS.filter((word) => word.startsWith(typed))
                    .map((word) => row(`test-word-${word}`, word, { section: "Words" }))
                }),
              },
            },
          }),
          row("test-note", "Write a note", {
            section: "Nested",
            action: { kind: "level", level: noteLevel(submitted) },
          }),
          row("test-late", "Late rows", {
            section: "Nested",
            action: {
              kind: "level",
              level: { kind: "group", placeholder: "Wait for a row…", hint: "Rows arrive shortly", children: lateRows(submitted) },
            },
          }),
        ],
      },
    },
    taking: atOnce,
    search: "test levels fixture",
  }],
})

export default definePlugin({ name, needs: [rendererSlots, paletteControl], apply: Effect.gen(function*() {
  const slots = yield* rendererSlots
  const palette = yield* paletteControl
  const submitted: Array<Submitted> = []
  const [available, setAvailable] = createSignal(true)
  const [offered, setOffered] = createSignal(true)
  const adapter = adapterOf(submitted, available, offered)
  // THE ADAPTER'S OWN SCOPE, inside this activation's: the scenario may close
  // it (a withdrawal while the row stays on) and open it again, and this
  // activation's release closes whatever is open.
  const held: { scope: Scope.Closeable | undefined } = { scope: undefined }
  const offer = Effect.gen(function*() {
    if (held.scope !== undefined) return
    const scope = yield* Scope.make()
    yield* Scope.provide(slots.contribute(paletteAdapters, adapter), scope)
    held.scope = scope
  })
  const withdraw = Effect.suspend(() => {
    const scope = held.scope
    held.scope = undefined
    return scope === undefined ? Effect.void : Scope.close(scope, Exit.void)
  })
  yield* Effect.acquireRelease(offer, () => withdraw)
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      const hand: Hand = {
        showAt: palette.showAt,
        withdraw: () => Effect.runPromise(withdraw),
        restore: () => Effect.runPromise(offer),
        setAvailable,
        setOffered,
        submitted,
      }
      window.olaiTestPalette = hand
      return hand
    }),
    (hand) => Effect.sync(() => { if (window.olaiTestPalette === hand) delete window.olaiTestPalette }),
  )
}) })

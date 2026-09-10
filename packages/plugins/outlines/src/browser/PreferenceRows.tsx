import { density, type Density, setDensity } from "./settings/density.ts"
import { doneHidden, setDoneHidden } from "./settings/done.ts"
import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Segmented } from "@olai/ui-primitives/Segmented.tsx"
/** Done: Visible / Hidden — the words the setting has always said, from the
 *  outline pill through the reader-wide row to this one. What changed with
 *  scoping is where the words point: at the page the hint names. */
const DONE_CHOICES = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
] as const

/** Notes: how much of a row this browser draws by default (./density.ts). The
 *  words are the three the design names, in the order they open up. */
const DENSITY_CHOICES: ReadonlyArray<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "cozy", label: "Cozy" },
  { value: "open", label: "Open" },
]


export function PreferenceRows() { return <>
      <Row label="Notes" pref="density" hint={densityHint()}>
        <Segmented
          choices={DENSITY_CHOICES}
          value={density()}
          onPick={setDensity}
        />
      </Row>

      <Row label="Done" pref="done" hint={doneHint()}>
        <Segmented
          choices={DONE_CHOICES}
          value={doneHidden() ? "hidden" : "visible"}
          onPick={(value) => setDoneHidden(value === "hidden")}
        />
      </Row>

</> }
/** What the density in force MEANS — the row's own promise (./Row.tsx): a
 *  sentence read off the choice rather than a label describing the switch. Each
 *  one ends by saying the fold is still there, because "Compact" reads as
 *  "olai is hiding my notes" until somebody says what opens them. */
const densityHint = (): string => {
  switch (density()) {
    case "compact":
      return "Rows show titles only. Press the ¶ to open one."
    case "cozy":
      return "Rows show the title and one line of the note. The ¶ opens the rest."
    case "open":
      return "Rows are already open, notes in full. The ¶ folds one back."
  }
}

/** What Done in force MEANS: the default, and the one way a page out-votes
 *  it — the flip beside its filter, not another row here. */
const doneHint = (): string =>
  doneHidden()
    ? "Finished work is hidden. A page can show it anyway from its own filter."
    : "Finished work is shown. A page can hide it from its own filter."

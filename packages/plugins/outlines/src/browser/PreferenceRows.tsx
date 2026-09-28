/** The Outlines rows of the preferences panel: how much of a row is drawn, and
 *  whether finished work is shown — the DEFAULT a page follows until its own
 *  `finished` box (./filter/DoneFlip.tsx) says otherwise. Same words as that
 *  box, same storage (./settings/done.ts), so nobody's pick moves. */
import { density, type Density, setDensity } from "./settings/density.ts"
import { doneHidden, setDoneHidden } from "./settings/done.ts"
import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Segmented } from "@olai/ui-primitives/Segmented.tsx"
import { Switch } from "@olai/ui-primitives/Switch.tsx"
import { TESTID } from "@olai/ui-primitives/testids.ts"

/** The three densities, in the order they open up (./settings/density.ts). */
const DENSITY_CHOICES: ReadonlyArray<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "cozy", label: "Cozy" },
  { value: "open", label: "Open" },
]

export function PreferenceRows() { return <>
  <Row label="Row density" pref="density">
    <Segmented choices={DENSITY_CHOICES} value={density()} onPick={setDensity} />
  </Row>
  <Row label="Show finished" pref="done" hint="Pages can override this">
    <Switch label="Show finished" on={!doneHidden()} testid={TESTID.prefsSwitch}
      onPick={(value) => setDoneHidden(value === "off")} />
  </Row>
</> }

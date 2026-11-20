import { density, type Density, setDensity } from "./settings/density.ts"
import { doneHidden, setDoneHidden } from "./settings/done.ts"
import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Segmented } from "@olai/ui-primitives/Segmented.tsx"
import { Switch } from "@olai/ui-primitives/Switch.tsx"
import { TESTID } from "@olai/ui-primitives/testids.ts"

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

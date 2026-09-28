import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Segmented } from "@olai/ui-primitives/Segmented.tsx"
import { SIZES, sizeNamed } from "@olai/appearance/sizes.ts"
import type { Appearance } from "./index.ts"
import { paletteLabel, ThemeChips } from "./Chips.tsx"
import { FontSelect } from "./FontSelect.tsx"

const SIZE_CHOICES = SIZES.map((size) => ({ value: size.name, label: size.label }))

/** Theme, Font and Size: each label says what its control sets, so no row
 *  carries a line under it. The theme in force is named once, beside its label. */
export function AppearanceRows(props: { readonly state: Appearance }) {
  return <>
    <Row label="Theme" pref="theme" value={paletteLabel(props.state.theme.current().name)} stacked>
      <ThemeChips state={props.state} />
    </Row>
    <Row label="Font" pref="font">
      <FontSelect state={props.state} />
    </Row>
    <Row label="Size" pref="size">
      <Segmented choices={SIZE_CHOICES} value={props.state.size.current().name} onPick={(name) => {
        const size = sizeNamed(name)
        if (size !== undefined) props.state.size.pick(size)
      }} />
    </Row>
  </>
}

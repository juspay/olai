import { Row } from "@olai/web/client/settings/Row.tsx"
import { Segmented } from "@olai/web/client/settings/Segmented.tsx"
import { SIZES, sizeNamed } from "@olai/web/client/theme/sizes.ts"
import type { Appearance } from "./index.ts"
import { ThemeChips } from "./Chips.tsx"
import { FontSelect } from "./FontSelect.tsx"

const SIZE_CHOICES = SIZES.map((size) => ({ value: size.name, label: size.label }))
export function AppearanceRows(props: { readonly state: Appearance }) {
  return <>
    <Row label="Theme" pref="theme" hint={`${props.state.theme.current().name} is in use. Every colour on the page comes from it.`}>
      <ThemeChips state={props.state} />
    </Row>
    <Row label="Font" pref="font" hint={props.state.font.current().hint}>
      <FontSelect state={props.state} />
    </Row>
    <Row label="Size" pref="size" hint={props.state.size.current().hint}>
      <Segmented choices={SIZE_CHOICES} value={props.state.size.current().name} onPick={(name) => {
        const size = sizeNamed(name)
        if (size !== undefined) props.state.size.pick(size)
      }} />
    </Row>
  </>
}

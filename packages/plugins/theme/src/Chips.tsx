import { TESTID } from "olai-plugin-theme/testids"
import { createSelector, For } from "solid-js"

import { PALETTES } from "@olai/appearance/palettes.ts"
import type { Appearance } from "./index.ts"

import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

export const paletteLabel = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1)

export const themeInForce = (state: Appearance): string =>
  state.theme.following()
    ? `System · ${paletteLabel(state.theme.current().name)}`
    : paletteLabel(state.theme.current().name)

const SWATCH =
  `${TARGET_BOX} group inline-flex flex-none items-center justify-center rounded-full [--olai-ring-radius:9999px] md:min-h-0 md:min-w-0 md:p-0`

const DISC =
  "olai-swatch-disc relative block size-7 rounded-full border ring-offset-2 ring-offset-panel group-hover:scale-105 " +
  "group-aria-pressed:ring-2 group-aria-pressed:ring-ink/60 " +
  "motion-safe:transition-transform md:size-6"

export function ThemeChips(props: { readonly state: Appearance }) {
  const isInForce = createSelector(() => props.state.theme.current().name)

  return (
    <>
      <Tip text="Follow the system">
        <button
          type="button"
          class={SWATCH}
          data-testid={TESTID.themeFollow}
          aria-label="Follow the system"
          aria-pressed={props.state.theme.following() ? "true" : "false"}
          onClick={() => props.state.theme.follow()}
        >
          <span
            aria-hidden="true"
            class={`${DISC} border-rule`}
            style={{
              background: `linear-gradient(90deg, ${PALETTES[0]!.colors.paper} 0 50%, ${PALETTES.find((p) => p.scheme === "dark")!.colors.paper} 50% 100%)`,
            }}
          />
        </button>
      </Tip>
      <span aria-hidden="true" class="mx-1 h-5 w-px self-center bg-rule" />
      <For each={PALETTES}>
        {(palette) => (
          <Tip text={paletteLabel(palette.name)}>
            <button
              type="button"
              class={SWATCH}
              data-testid={TESTID.themeChip}
              data-value={palette.name}
              aria-label={paletteLabel(palette.name)}
              aria-pressed={isInForce(palette.name) ? "true" : "false"}
              onClick={() => props.state.theme.pick(palette)}
            >
              <span
                aria-hidden="true"
                class={DISC}
                style={{
                  background: `linear-gradient(135deg, ${palette.colors.paper} 0 55%, ${palette.colors.accent} 55% 100%)`,
                  "border-color": palette.colors.rule,
                }}
              />
            </button>
          </Tip>
        )}
      </For>
    </>
  )
}

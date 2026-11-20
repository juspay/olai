import { TESTID } from "olai-plugin-layout/testids"
import { Show } from "solid-js"

import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { Indicator } from "./Indicator.tsx"
import { LAYER } from "@olai/web/client/layer.ts"
import { Leaf } from "@olai/web/client/Leaf.tsx"
import { WORDMARK } from "@olai/web/client/look.ts"
import { calledApp } from "./named.ts"
import { PluginHeaders } from "./Chrome.tsx"
import { Health } from "./Health.tsx"
import { PluginViewer } from "./Seats.tsx"

import { connectionReadout } from "@olai/web/client/wire.ts"
import { desktop } from "./layout/live.ts"
import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { Tools } from "./Tools.tsx"

export function Header(props: {
  readonly ref?: (element: HTMLElement) => void
  readonly slots: RendererSlots
  readonly menu?: {
    readonly open: boolean
    readonly onToggle: () => void
  }
  readonly docked?: boolean
}) {
  return (
    <>
    <header ref={props.ref}
      class={`sticky top-0 ${LAYER.header} olai-frame flex h-[var(--height-header)] shrink-0 items-center gap-2 px-2 font-sans shadow-[inset_0_-1px_0_var(--color-rule)] md:px-3`}
      data-testid={TESTID.appHeader}
      data-layout={props.docked ? "docked" : "chrome-only"}
    >
      <div class="flex shrink-0 items-center gap-2">
        <Show when={props.menu}>
          {(menu) => (
            <button
              type="button"
              class={`${TARGET_BOX} -ml-1 inline-flex items-center justify-center rounded-control text-muted hover:text-ink md:hidden`}
              data-testid={TESTID.sidebarToggle}
              data-open={menu().open}
              aria-expanded={menu().open}
              aria-label={menu().open ? "Hide sidebar" : "Show sidebar"}
              onClick={() => menu().onToggle()}
            >
              <span aria-hidden="true" class="text-title leading-none">☰</span>
            </button>
          )}
        </Show>
        <h1 class={`${WORDMARK} md:pl-1`}>
          <Leaf class="size-4 text-accent" />
          {calledApp() ?? "olai"}
        </h1>
      </div>

      <div
        class="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-1 sm:gap-2"
        data-testid={TESTID.appChrome}
      >
        <PluginHeaders place="lead" />
        <Show when={desktop()}>
          <Health slots={props.slots} />
          <Tools slots={props.slots} where="header" />
        </Show>
        <Show when={!desktop() && props.menu === undefined}>
          <Tools slots={props.slots} where="header" mobileWithoutSidebar />
        </Show>
        <PluginViewer />
      </div>
    </header>
    <Show when={!desktop()}>
      <Indicator readout={connectionReadout()} />
    </Show>
    </>
  )
}

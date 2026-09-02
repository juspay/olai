/**
 * THE APP'S FURNITURE, assembled once and handed to every plugin's browser
 * half.
 *
 * ## Why the app hands rather than the plugin reaches
 *
 * This client already had the rule and it already had a name for it. The
 * property drawer hands a face `BlockChrome` — the fact line every property in
 * the run wears — rather than letting the face spell `"prop"` for itself, and
 * the argument on that seam is the whole of this file: *a face that spelled the
 * app's contract itself would be a second spelling, free to drift the day the
 * app changed it, with the app's own suite still green because the face it broke
 * is in another package.*
 *
 * A dressing's testid was one string. What a plugin's browser half needs is
 * five: the app's CLOCK and the register it ticks in, the chrome PILL'S
 * geometry, the DESKTOP breakpoint, a POPOVER that shares the bar's one focus
 * cycle, and a DOOR onto a served file. Every one of them fails the same silent
 * way — a chip whose duration ladder drifted, a pill that wraps and pushes the
 * bar's first row off a phone, a panel at the wrong layer, a panel with no
 * vertical position, a link that reloads the app cold.
 *
 * The rejected alternative is worth naming because it is the obvious one: let a
 * plugin import `@olai/web` for the dozen names it wants. It is a CYCLE (this
 * package mounts every plugin) and `@olai/plugin-api`'s own fence would refuse it
 * before a reviewer had to notice — but the reason it would be wrong even if the
 * graph allowed it is the one above.
 *
 * ## What is composed here rather than passed through
 *
 * Two of the five are ASSEMBLED, and that is the difference between handing a
 * contract and handing a toolbox:
 *
 *   - {@link panelPopover} is `../popover.ts` WITH the portal, the layer, the
 *     anchor's five style keys and the panel's own box already spent. A plugin
 *     given the primitive alone would have restated four of this app's
 *     decisions, and two of them fail invisibly: a computed `top`/`bottom` key
 *     compiles away in Solid and leaves a panel just below the fold (it cost the
 *     Commit panel its placement once), and a panel below `LAYER.over` paints
 *     under the bar it hangs from.
 *   - {@link FileLink} is `../router.tsx`'s `Link` over `../routes.ts`'s
 *     `atFile`. A plugin handed both would hold two of this app's names to make
 *     one link; handed this, it holds none, and the split-pane press and the
 *     modifier rules stay entirely the router's.
 *
 * The other three are handed as they are, because they ARE the contract: the
 * clock, the pill's classes and the breakpoint have no composition to do.
 *
 * ## One value, minted once
 *
 * {@link FURNITURE} is a module constant rather than a call per mount. Nothing
 * in it is per-tab state — `createPopover` is a factory a face calls for itself,
 * inside its own owner, and the rest is arithmetic and strings — so a second
 * copy would only be a second thing to keep equal.
 */

import { Show } from "solid-js"
import { Portal } from "solid-js/web"

import type { AppClocks, AppPopover, FileLink } from "@olai/plugin-api"
import { Bar, Clocks, Links } from "@olai/plugin-api"

import { ctx } from "./runtime.ts"

import { styleOf } from "../anchor.ts"
import { createTicking, MINUTE, SECOND } from "../clock.ts"
import { LAYER } from "../layer.ts"
import { desktop } from "../layout/media.ts"
import { createNow, exactOf, tickingOf, wordsOf } from "../live/duration/took.ts"
import { createPopover } from "../popover.ts"
import {
  DOT,
  DOT_HOLLOW_ALARM,
  DOT_HOLLOW_WARN,
  PILL,
  PILL_ALARM_COAT,
  PILL_WARN_COAT,
  TEXT_ALARM,
  TEXT_WARN,
} from "../readout.ts"
import { Link } from "../router.tsx"
import { atFile } from "../routes.ts"

/** A door onto a served file — see the header on why the route and the anchor
 *  are composed here rather than handed over as two names. */
const FileDoor: FileLink = (props) => (
  <Link
    route={atFile(props.file)}
    class={props.class}
    testid={props.testid}
    label={props.label}
    title={props.title}
  >
    {props.children}
  </Link>
)

/**
 * A popover WITH ITS PANEL — the trigger half unchanged, and the portalled half
 * already wearing this app's box.
 *
 * The panel is the same shape `../commit/Panel.tsx` and `../settings/Panel.tsx`
 * wear, folded in here so a plugin cannot wear a fourth: no `w-*` (the anchor
 * writes the width inline, so a class could never beat it), `overflow-x-hidden`
 * beside it, focusable but never in the tab order, and `LAYER.over` — above the
 * page, below the modals that must cover the bar too.
 */
const panelPopover = (): AppPopover => {
  const popover = createPopover()
  return {
    open: popover.open,
    toggle: popover.toggle,
    close: popover.close,
    setTrigger: popover.setTrigger,
    Panel: (props) => (
      <Show when={popover.open() ? popover.at() : null}>
        {(at) => (
          <Portal>
            <section
              ref={popover.setPanel}
              class={`fixed ${LAYER.over} flex min-h-0 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border-0 bg-panel p-4 text-sm shadow-xl ring-1 ring-rule/40 focus:outline-none`}
              style={styleOf(at())}
              tabindex="-1"
              data-testid={props.testid}
              aria-label={props.label}
            >
              {props.children}
            </section>
          </Portal>
        )}
      </Show>
    ),
  }
}

/** THE APP'S CLOCK AND THE REGISTER IT TICKS IN, as `ctx.clocks` carries it. */
export const CLOCKS: AppClocks = {
  SECOND,
  MINUTE,
  createTicking,
  createNow,
  wordsOf,
  exactOf,
  tickingOf,
}

/** THE BAR — its breakpoint, its geometry and the panel that hangs off it, as
 *  `ctx.bar` carries them. */
export const BAR: Bar.Config = {
  desktop,
  pill: {
    PILL,
    DOT,
    PILL_WARN_COAT,
    DOT_HOLLOW_WARN,
    TEXT_WARN,
    PILL_ALARM_COAT,
    DOT_HOLLOW_ALARM,
    TEXT_ALARM,
  },
  createPopover: panelPopover,
}

/** ...and the door onto a served file, as `ctx.links` carries it. */
export const LINKS: Links.Config = { File: FileDoor }

/**
 * ...AND THE THREE, MOUNTED — the one thing this module does rather than
 * declares.
 *
 * They are hung here and not in `./runtime.ts` for a GRAPH reason and not a
 * tidiness one. This file is a `.tsx`: `FileDoor` and the popover's panel are
 * components. `./runtime.ts` is a `.ts` reached by `./marks.ts`, which is
 * reached by the chat panel, which is imported by suites that run under a
 * process with no Solid transform — so a static import of this module from
 * there puts a JSX factory on the graph of a test that only wanted a lookup,
 * and the failure is `Cannot find module 'react/jsx-dev-runtime'` at import
 * time, which is the same hazard `@olai/bundle`'s three doors have always been
 * about, one wall in.
 *
 * ORDER, said out loud: `./main.tsx` awaits this before it renders, and the
 * roster cannot arrive before it — the first frame is a network round trip
 * away. A plugin fiber that DID beat it would sit `PENDING` on the service it
 * injects and start when it arrived, which is Cordis's own guarantee rather
 * than something this ordering has to be careful about.
 */
export const provideFurniture = async (): Promise<void> => {
  await ctx.plugin(Clocks, CLOCKS)
  await ctx.plugin(Bar, BAR)
  await ctx.plugin(Links, LINKS)
}

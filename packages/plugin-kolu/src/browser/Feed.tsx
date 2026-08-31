/**
 * WHAT RECENTLY WANTED ATTENTION — the contents of the drawer off the Padi pill.
 *
 * THE ROWS ARE THE APPLIANCE'S (`@olai/kolu-ui`'s `EventsFeed`) and THE BOX IS
 * THE APP'S (`./app.ts`'s `Panel` — portalled, placed against the pill, layered,
 * and holding one half of the bar's focus cycle). What is left for this file is
 * the part that is neither: the heading, and the FOOT.
 *
 * That is a smaller file than it was, and the shrinkage is the extraction
 * working rather than something lost. It used to spell the panel's own geometry
 * — a `fixed` box, the layer class, five inline style keys off an anchor, a
 * `tabindex="-1"` — which was a second copy of the contract `../commit/Panel.tsx`
 * and `../settings/Panel.tsx` wear inside the app, kept in step by nobody. A
 * popover its trigger stops reaching is a bug the CHROME half writes, and the
 * chrome half is the app's.
 *
 * ## And under the log, the FOOT
 *
 * The drawer's last line is not an event: it is WHO THE WATCH CANNOT SAY and the
 * door onto the file that decides it. Two facts off the wire's `mutes` cell —
 * the mutes' own titles, and the `_olai/Kolu.olai` the convention read — so the
 * wrench's navigation is the opening of a page that exists and never a special
 * case. The register is the log's own: the seat is the foot's, the words are the
 * muted ink the rows already speak — a door drawn loud is an affordance reading
 * as an alarm, and a muted terminal is not news.
 *
 * The line NAMES, it does not count zero: nobody muted is the wrench alone,
 * because "0 muted" is noise about a noise that is not there. And DRAWN ONLY
 * WHEN THERE IS A CONFIG: a vault no `Kolu.olai` decides anything for runs the
 * watcher's defaults, and defaults have no page to open — the drawer is the log
 * alone (the events stay on top; config and status sit at the bottom).
 */

import { Show } from "solid-js"

import { EventsFeed, useFleet } from "@olai/kolu-ui"

import { TESTID } from "../testids.ts"
import type { KoluApp } from "./app.ts"

/**
 * THE FOOT — see the header. Read off the fleet context the drawer's rows
 * already read from (`@olai/kolu-ui`'s `fleet` holds the cell's fold): the vault
 * walk answers on the same frame the timers get their knobs from, so the line
 * here and the watcher's gate can never disagree about who is silenced — rename
 * a mute in the file and the name here moves with the revision, exactly as a
 * threshold edit moves the watch.
 */
function FeedFoot(props: {
  readonly app: KoluApp
  /** The drawer's escort out: a press on the wrench is a navigation, and the
   *  panel goes away — the caret belongs to the page it lands on. */
  readonly onLeave: () => void
}) {
  const fleet = useFleet()
  const mutes = () => fleet.mutes()
  return (
    <Show when={mutes().file}>
      {(file) => (
        <footer
          class="mt-1 flex items-baseline gap-2 border-t border-paper/15 pt-2"
          data-testid={TESTID.padiFeedFoot}
        >
          <Show when={mutes().names.length > 0}>
            <span
              class="min-w-0 flex-1 truncate text-[0.6875rem] text-muted"
              data-testid={TESTID.padiFeedMutes}
              title={mutes().names.join(", ")}
            >
              {`${mutes().names.length} muted · ${mutes().names.join(", ")}`}
            </span>
          </Show>
          {/* A plain press closes the drawer without handing the caret to the
              trigger (the dismissal's day job): the page the wrench opens is
              where the reader goes. A click held with ANY modifier aims the
              PAGE, not the drawer — the browser's own new-tab ask and the app's
              own split alike — so the leaving is conditional on the aim being
              the place itself. `onLeave` wraps the link rather than riding it
              because the app's door carries no press slot, and the click
              bubbles. */}
          <span
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              props.onLeave()
            }}
          >
            {/* THE DOOR IS THE APP'S — a served file, opened the way this app
                opens one. What a route spells in the URL, what a modifier press
                means and where a split pane lands are the router's decisions,
                and this face holds none of them (`./app.ts`). */}
            <props.app.FileLink
              file={file()}
              class="ml-auto flex shrink-0 items-center rounded p-0.5 text-muted hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              testid={TESTID.padiFeedWrench}
              label={`open the watch's config in ${file()}`}
              title={`${file()} — the watch's thresholds and mutes, an outline like any other`}
            >
              {/* A wrench, drawn here in the app's own stroked hand: the door
                  onto the watch's knobs, an affordance rather than an alarm. */}
              <svg
                class="size-3 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                aria-hidden="true"
              >
                {/* The jaw: three quarters of a circle, the mouth open up
                    and to the right. */}
                <path d="M8.5 5.2 A3.3 3.3 0 1 1 5.2 1.9" />
                <path d="M8.5 5.2 L6.4 5.1" />
                <path d="M5.2 1.9 L5.1 4.0" />
                {/* The handle, off the jaw's lower edge. */}
                <path d="M7.5 7.5 L13.6 13.6" />
              </svg>
            </props.app.FileLink>
          </span>
        </footer>
      )}
    </Show>
  )
}

export function Feed(props: {
  readonly app: KoluApp
  /** Shut the panel WITHOUT the caret walk — the wrench's press navigates. */
  readonly onLeave: () => void
}) {
  return (
    <>
      <h2 class="text-xs font-medium uppercase tracking-wider text-muted">
        recently wanted attention
      </h2>
      <EventsFeed />
      <FeedFoot app={props.app} onLeave={props.onLeave} />
    </>
  )
}

import { TESTID } from "olai-plugin-capture/testids"
import { CountChip } from "@olai/ui-primitives/CountChip.tsx"

import { CHIP_QUIET } from "olai-plugin-layout/chip"
import { ENTRY_SHAPE,ROW_GAP } from "olai-plugin-layout/entry"
import { atFile } from "olai-plugin-navigation/routes"
import { Link } from "olai-plugin-navigation/routing"
import { Tip } from "@olai/web/client/Tip.tsx"
import { Show } from "solid-js"
const ENTRY = `${ENTRY_SHAPE} ${ROW_GAP}`
export function Inbox(props: {
  readonly file: string
  readonly isActive: (file: string) => boolean
  readonly broken: boolean
  readonly count: number
}) {
  return (
    <div class="mb-1" data-testid={TESTID.inboxHeld} data-count={String(props.count)}>
      <Link
        route={atFile(props.file)}
        class={`${ENTRY_SHAPE} ${ROW_GAP}`}
        testid={TESTID.inboxLink}
        current={props.isActive(props.file)}
        broken={props.broken}
        tip={props.file}
        // WHICH FILE the inbox IS — the row draws the word "Inbox" and the
        // path was the anchor's `title`, which answered a pointer and nothing
        // else. The tip is the pointer's copy; this is the name everybody
        // reads, and it still opens with the word the row draws.
        label={`Inbox, ${props.file}`}
      >
        Inbox
        <Show when={props.broken}>
          {/* No margin of its own: the row has one gap and this is on it — the
              tree's own mark, said the same way (see `FileAnatomy` in
              `files/src/Files.tsx`). The ⚠ is the only visible sign and the
              row's name is spent on the file, so the sentence rides a
              `role="img"`: a tip reaches nobody who does not hover. */}
          <Tip text="Couldn't open this file">
            <span class="text-alarm" role="img" aria-label="Couldn't open this file">
              ⚠
            </span>
          </Tip>
        </Show>
        <CountChip
          count={props.count}
          paint={CHIP_QUIET}
          testid={TESTID.inboxCount}
        />
      </Link>
    </div>
  )
}

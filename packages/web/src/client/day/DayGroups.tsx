/**
 * The answer to a question asked of the whole set, drawn: dated nodes under
 * the outline each of them lives in.
 *
 * Grouped by outline because that is the only heading that is true — a `parent`
 * never crosses a file, so two nodes in two outlines have no shared ancestry to
 * draw them under — and within a group each node brings its own.
 *
 * THE DAY PAGES' — and, since `agenda-spine` (2026-08-18), theirs alone. The
 * agenda used to draw this too; it draws a spine now, and a spine has no file
 * headings on it (../agenda/Spine.tsx says why the chrome went). What the two
 * still share is the ROW (./DayNode.tsx), which is the part that matters: two
 * pages listing the set's dated nodes two ways would be two answers a reader
 * has to reconcile, and the grouping itself is the format's (`byOutline`)
 * either way.
 *
 * What DIFFERS between the day pages is where a group's heading sits in the
 * page's own outline of headings — a day's groups hang off its `h1` — so the
 * level is the caller's to name. It is a heading either way: moving by headings
 * is how a long page of these is skimmed at all.
 */

import type { DayGroup } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { Dynamic } from "solid-js/web"

import { CRUMB } from "../Breadcrumbs.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { DayNode } from "./DayNode.tsx"
import { placeOf } from "./place.ts"

/** Which heading level a group's file name is drawn as. */
export type Heading = "h2" | "h3" | "h4"

export function DayGroups(props: {
  readonly groups: ReadonlyArray<DayGroup>
  readonly heading: Heading
}) {
  return (
    // Keyed, like the tree is (../Tree.tsx): every frame the live store
    // publishes mints these afresh, and a group that is the same one as last
    // frame keeps its DOM — and its rendered notes — rather than being rebuilt.
    // A group IS its outline, so that is its key.
    <Key each={props.groups} by="file">
      {(group) => <Group group={group()} heading={props.heading} />}
    </Key>
  )
}

function Group(props: {
  readonly group: DayGroup
  readonly heading: Heading
}) {
  return (
    <section class="mb-6" data-testid={TESTID.dayGroup} data-file={props.group.file}>
      <Dynamic
        component={props.heading}
        class="m-0 mb-2 font-mono text-xs text-muted"
      >
        <Link route={{ kind: "outline", file: props.group.file }} class={CRUMB}>
          {props.group.file}
        </Link>
      </Dynamic>
      <ul class="m-0 list-none p-0">
        {/* An entry is one record of the set, which `file/id` names the same
            way `Row.key` names a place in a tree. */}
        <Key each={props.group.nodes} by={placeOf}>
          {/* The date, printed verbatim, and the trail above the row: a day
              page has said which outline this is in the heading over it, so
              the ancestry goes between the two. */}
          {(dated) => (
            <DayNode dated={dated()} trail="over" pill={dated().date} />
          )}
        </Key>
      </ul>
    </section>
  )
}

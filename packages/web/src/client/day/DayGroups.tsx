/**
 * The answer to a question asked of the whole set, drawn: dated nodes under
 * the outline each of them lives in.
 *
 * Grouped by outline because that is the only heading that is true — a `parent`
 * never crosses a file, so two nodes in two outlines have no shared ancestry to
 * draw them under — and within a group each node brings its own.
 *
 * ONE component for every page that draws that answer: a day (./DayPage.tsx)
 * and each of the agenda's sections (../agenda/AgendaPage.tsx), which is the
 * same question asked forward. The grouping itself is the format's
 * (`byOutline`), so what is shared here is only how it looks — and it is shared
 * rather than copied because two pages listing the set's dated nodes two ways
 * would be two answers a reader has to reconcile.
 *
 * What DIFFERS between them is where a group's heading sits in the page's own
 * outline of headings — a day's groups hang off its `h1`, the agenda's off a
 * section and, in Upcoming, off a day inside it — so the level is the caller's
 * to name. It is a heading either way: moving by headings is how a long page of
 * these is skimmed at all.
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
          {(dated) => <DayNode dated={dated()} />}
        </Key>
      </ul>
    </section>
  )
}

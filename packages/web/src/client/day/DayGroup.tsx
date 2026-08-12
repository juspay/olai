/**
 * The dated nodes of ONE outline, under the heading that names it.
 *
 * Grouped by outline because that is the only heading that is true: a `parent`
 * never crosses a file, so two nodes in two outlines have no shared ancestry to
 * draw them under, and within a group each node brings its own.
 *
 * One component rather than one per page, because two pages draw this list and
 * they are the same list — a day (./DayPage.tsx) and the agenda's sections
 * (../agenda/AgendaPage.tsx), which is the same question asked forward. The
 * grouping itself is the format's (`@olai/format`'s `byOutline`), so what is
 * shared here is only how it looks.
 *
 * What DOES differ between them is where the heading sits in the page's own
 * outline of headings — a day's groups hang off its `h1`, the agenda's hang off
 * a section and, in Upcoming, off a day inside it — so the level is the
 * caller's to name. It is a heading either way: a screen reader moving by
 * headings is how a long agenda is skimmed at all.
 */

import type { DayGroup as Group } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { Dynamic } from "solid-js/web"

import { CRUMB } from "../Breadcrumbs.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { DayNode } from "./DayNode.tsx"
import { placeOf } from "./place.ts"

export function DayGroup(props: {
  readonly group: Group
  /** Which heading level this group's file name is, in the page drawing it. */
  readonly heading: "h2" | "h3" | "h4"
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
        {/* Keyed, like the tree is (../Tree.tsx): every frame the live store
            publishes mints these afresh, and an entry that is the same one as
            last frame keeps its DOM — and its rendered note — rather than being
            rebuilt. An entry is one record of the set, which `file/id` names
            the same way `Row.key` names a place. */}
        <Key each={props.group.nodes} by={placeOf}>
          {(dated) => <DayNode dated={dated()} />}
        </Key>
      </ul>
    </section>
  )
}

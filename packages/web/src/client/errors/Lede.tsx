/**
 * The explanatory paragraph of the error surface.
 *
 * It has a home of its own because every one of the four views has one — the
 * page, the banner, the broken outline, the cross-file section — and what they
 * say is the whole point of those views: an error report that does not explain
 * itself is a stack trace with better manners. One component keeps them reading
 * as one voice.
 *
 * It is NOT an export of ./Report.tsx, which publishes ways to draw errors and
 * not a kit of layout parts, and it is not a second name for an arbitrary set
 * of utilities (which is what this project rejected `@apply` for). It is one
 * element with one job, in the one place that job exists.
 */

export function Lede(props: {
  readonly children: unknown
  readonly testid?: string
}) {
  return (
    <p class="mt-0 mb-4 max-w-3xl text-muted" data-testid={props.testid}>
      {props.children as never}
    </p>
  )
}

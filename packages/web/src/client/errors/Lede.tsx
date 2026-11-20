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

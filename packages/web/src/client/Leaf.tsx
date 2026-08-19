/**
 * The palm-leaf mark, at whatever size the caller is.
 *
 * One drawing: the wordmark, and the empty pages that have nothing else to
 * put on the paper. `currentColor`, so a wordmark takes the ink and an empty
 * state takes the muted it sits in.
 */

export function Leaf(props: { readonly class?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      class={props.class ?? "size-4"}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
    >
      <path d="M12 20V4" />
      <path d="M12 6C9 5 6.4 4.7 4.4 5.3" />
      <path d="M12 6C15 5 17.6 4.7 19.6 5.3" />
      <path d="M12 10C8.6 8.6 5.6 8.2 3.4 9" />
      <path d="M12 10C15.4 8.6 18.4 8.2 20.6 9" />
      <path d="M12 14.5C8.8 13.2 6 12.9 3.8 13.8" />
      <path d="M12 14.5C15.2 13.2 18 12.9 20.2 13.8" />
      <path d="M12 18.2C10 17.4 8.2 17.3 6.8 18" />
      <path d="M12 18.2C14 17.4 15.8 17.3 17.2 18" />
    </svg>
  )
}

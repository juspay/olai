/** Identity's no-picture silhouette, shared with consumers through
 * identity.viewer. The caller chooses its size; the surrounding label names
 * the person, so the drawing stays aria-hidden. Chat has its own anonymous
 * mark while the identity service is absent. */
export function UserIcon(props: { readonly class: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      class={props.class}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.2c1.3-3.2 3.6-4.7 6.5-4.7s5.2 1.5 6.5 4.7" />
    </svg>
  )
}

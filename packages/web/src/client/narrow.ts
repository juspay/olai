export const only = <T extends { readonly kind: string }, K extends T["kind"]>(
  value: T,
  kind: K,
): Extract<T, { readonly kind: K }> | undefined =>
  value.kind === kind ? (value as Extract<T, { readonly kind: K }>) : undefined

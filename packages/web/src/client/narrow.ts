/**
 * "This arm, if it is that one."
 *
 * Solid's `<Show>` and `<Match>` narrow to whatever their `when` returns, and
 * "this member of a union" is not something a JSX condition can express: the
 * condition is a boolean, and the value handed to the children is the original
 * union. Writing `page.kind === "node" ? page : undefined` at each site is the
 * workaround; this is the same thing with a name and one cast.
 *
 * It only works on arms whose `kind` is a single literal. An arm declared with
 * two — `Row`'s `"node" | "mirror"` — is not assignable to `{kind: "node"}`,
 * so `Extract` yields `never` and the compiler says so at the call site rather
 * than at runtime.
 */

export const only = <T extends { readonly kind: string }, K extends T["kind"]>(
  value: T,
  kind: K,
): Extract<T, { readonly kind: K }> | undefined =>
  value.kind === kind ? (value as Extract<T, { readonly kind: K }>) : undefined

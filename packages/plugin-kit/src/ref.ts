/**
 * AN OLAI NODE, WRITTEN THE WAY THE TRANSCRIPT ALREADY MAKES PRESSABLE.
 *
 * A plugin names the row it is ringing about by putting the node's id in
 * backticks. The panel splits those runs into `<code>` spans ({@link
 * @olai/web}'s `chat/quoted.ts`) and the set's ordinary lookup makes a span
 * whose text the vault declares into a link (`chat/refs.ts`). Nothing here
 * knows that, and nothing here has to: the composition is the SPELLING, and
 * inventing a second one — a markdown link, an HTML href, a `[[wiki]]` — is
 * how a third tenant's wake would draw as a different kind of reference in
 * the same column.
 *
 * THE HEAD CARRIES IT, not only the folded account. The transcript draws one
 * line until somebody opens the fold, and an id that only appeared once the
 * fold was open was a link behind the very fold it was the reason to open.
 * Kolu's doorbell settled that (`essenceOf`: `on \`<node>\``); this function
 * is that settlement, so odu — and a tenant that has not been written yet —
 * cannot miss it by writing a different sentence shape.
 *
 * A span is a reference only if the set declares the id. A recipe name, a
 * terminal prefix, a path, any other backticked literal, stays a literal.
 * This function does not care which: it is the spelling, not the lookup.
 */
export const nodeRef = (id: string): string => `\`${id}\``

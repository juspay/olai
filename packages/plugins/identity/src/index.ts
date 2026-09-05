/**
 * THE PLUGIN'S WORD, and the whole of this door.
 *
 * A tenant's root entry is its WIRE IDENTITY — the sibling surface it
 * composes and the faces it exposes on it. This row composes NONE, and the
 * reason is the one thing that makes identity different from every other
 * row with a face in the bar: who is looking is a property of the
 * CONNECTION, and the connection is core's. The upgrade is the request the
 * login arrives on, so the answer is minted where the socket is accepted
 * and read back through core's own `who.get` — one procedure, on the
 * browser face, answered per connection. A sibling surface here would be a
 * second door onto a value this row never holds.
 *
 * What this row holds is the READING behind that door (`./who/`, offered as
 * `Identity` by `./server.ts`) and the CHIP that draws its answer
 * (`./browser.tsx`). Core knows a login, a name and a picture URL; it does
 * not know a header name, a template, or that a picture is resolved down a
 * ladder at all.
 *
 * So what is left here is the name, and it is here rather than in either
 * half because BOTH halves need it and neither may be the other's source:
 * `./server.ts` is mounted by the row and `./browser.tsx` is the chunk the
 * tab fetches, and they share no graph at all. It IS the row's `id` — the
 * word the fiber is bound under, the word `--plugins` takes, the key the
 * tab's slot table stamps this chip with, and the address of this plugin's
 * docs page — and `@olai/bundle`'s `composition.test.ts` holds the two
 * equal by loading the module its row names and reading this.
 */

export const name = "identity"

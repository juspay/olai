/**
 * THE VIEWER CONTRACT BELONGS TO IDENTITY, NOT TO THE SHELL OR ITS CONSUMERS.
 *
 * who.get remains the shell's question about this socket. This kit turns its
 * answer into the shared viewer resource and the formatting and drawing that
 * accompany it. Identity hands the same object to its header chip and to the
 * identity.viewer service; a transcript with many speaker rows therefore does
 * not create one ask per row or invent another naming policy.
 *
 * Two lifetimes meet here. The connection epoch refreshes the answer inside an
 * activation; the identity fiber owns the Solid root that observes that epoch.
 * Turning identity off closes the root after dependent fibers have released
 * their readings. Turning it on creates a fresh resource. A tab-global lazy
 * singleton would keep observing after its provider disappeared and would make
 * the ownership claimed by Offers.own cosmetic.
 *
 * This is a package-private assembly door, not a library entry for chat to
 * import. Other plugins declare the service key and the shape they consume.
 * Their absent-provider behavior belongs to them: chat keeps its conversation
 * and anonymous mark while its speaker component waits for this contract.
 */
export { type Asking, type Who, createWho } from "./asking.ts"
export { openViewer, type Viewer } from "./mine.ts"
export { saying } from "./saying.ts"
export { UserIcon } from "./UserIcon.tsx"

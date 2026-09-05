/**
 * VIEWER FURNITURE, owned by the connection rather than by one plugin's chip.
 *
 * `who.get` is core's question about the current connection. This kit reads
 * its settled answer, formats a name and draws a silhouette. It knows none
 * of the provider's header names, avatar templates or picture-selection rules.
 * Those decisions can change in an identity provider without changing a
 * transcript or any other face that displays the answer.
 *
 * The header chip remains the identity plugin's contribution to `app.viewer`:
 * switching the row off removes that face. The question remains core's, and a
 * transcript still needs its answer, including nobody when no provider stands.
 * Importing the rendering kit from the plugin would make every such face
 * depend on a package whose runtime presence it neither needs nor controls.
 *
 * `whoAmI` shares one lazy resource across readers. Its lifetime is the tab's,
 * and it refreshes on the connection epoch, not on chip or transcript mounts.
 * Thus a provider flip can remove the chip while the surviving transcript
 * learns that the viewer is now nobody. The ask, its formatting and the chip's
 * placement remain separate decisions, with the connection as their data seam.
 */
export { type Asking, type Who, createWho } from "./asking.ts"
export { whoAmI } from "./mine.ts"
export { saying } from "./saying.ts"
export { UserIcon } from "./UserIcon.tsx"

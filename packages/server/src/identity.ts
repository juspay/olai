/**
 * Who this process is.
 *
 * One id, minted once, and the whole of its job is to be COMPARED. Two places
 * read it and they are the two halves of the same handshake:
 *
 *   - `runtime.ts` answers `identity.info` with it, so an open tab can see
 *     which process it is talking to and notice when that changes;
 *   - `listener.ts` hands it to the stale-tab gate, which closes a reconnecting
 *     tab that presents any OTHER id — a tab holding a bundle from a server
 *     that has since been replaced is told so rather than served against code
 *     it does not match.
 *
 * It lives in its own module because those two files must not disagree about
 * it, and neither is the obvious owner: the runtime does not listen and the
 * listener does not serve members.
 */

/** Short on purpose: it is a value a person reads in a log line ("stale tab
 *  rejected (claimed pid 3f9c1a02)"), never a key anything is looked up by. */
export const PROCESS_ID = crypto.randomUUID().slice(0, 8)

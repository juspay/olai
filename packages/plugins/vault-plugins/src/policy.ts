/**
 * `approved` IS NOT AN AGENT'S TO WRITE — reserved at olai's own write door,
 * in every build, whether or not this row is composed.
 *
 * It is the one property in the product that turns CODE ON. An agent that
 * could write it could write it on the plugin it had just finished writing,
 * and the whole boundary this lane has — *a person reads it and says yes* —
 * would be a formality an author could skip in one call.
 *
 * ## FILE-SCOPED, since consent moved into the settings file
 *
 * It used to be a bare key reservation, because approval was a property on the
 * plugin's own node wherever in the vault that node happened to be. It lives on
 * a node in `_olai/Settings.olai` now, beside `on`, which is where every row
 * this build shipped keeps its own — so the reservation is the file-scoped kind
 * (`@olai/ops`' `door.ts`), exactly like the settings row's `on`.
 *
 * That shape refuses four things a per-property comparison would miss, and
 * every one of them is a real way to approve code without writing the word:
 * renaming the plugin's node onto another one's, moving it, deleting it, and
 * adding a shallower `Settings.olai` that masks the deeper one the serve was
 * reading.
 *
 * ## It is a fence, not a lock, and the doc says so where a person can read it
 *
 * What this covers is writes through OLAI's door. The agents it is about are
 * processes on the same host with their own file tools; a vault is the owner's
 * directory and olai does not pretend to police what it does not serve.
 */
export const writeReservations = [{
  key: "approved",
  file: "settings.olai",
  says: "it is a person's approval of code that runs with this server's authority, "
    + "and the plugin's own page — with what it does, what it uses and the code itself "
    + "in front of them — is where that is decided",
}]

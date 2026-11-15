/**
 * `approved` IS NOT AN AGENT'S TO WRITE — reserved at olai's own write door,
 * in every build, whether or not this row is composed.
 *
 * It is the one property in the product that turns CODE ON. An agent that
 * could write it could write it on the plugin it had just finished writing,
 * and the whole boundary this lane has — *a person reads it and says yes* —
 * would be a formality an author could skip in one call.
 *
 * ## KEY-WIDE, not file-scoped, even though consent now lives in one file
 *
 * `approved` is read off a node in `_olai/Settings.olai`, so a reservation
 * scoped to that file would cover the place it is read FROM — and that is one
 * step short. A key-wide reservation refuses the write wherever it lands, which
 * closes three doors the narrow one leaves open: writing the property onto a
 * node in some other file and moving that file into place, CREATING a
 * shallower `Settings.olai` that masks the deeper one the serve is reading,
 * and writing it where this build does not look but the next one might.
 *
 * What it costs is one property name in a person's own notes that an agent
 * writing through olai cannot set. That is a price worth one sentence in the
 * doc and no argument at all beside the thing it buys.
 *
 * ## It is a fence, not a lock, and the doc says so where a person can read it
 *
 * What this covers is writes through OLAI's door. The agents it is about are
 * processes on the same host with their own file tools; a vault is the owner's
 * directory and olai does not pretend to police what it does not serve.
 */
export const writeReservations = [{
  key: "approved",
  says: "it is a person's approval of code that runs with this server's authority, "
    + "and the plugin's own page — with what it does, what it uses and the code itself "
    + "in front of them — is where that is decided",
}]

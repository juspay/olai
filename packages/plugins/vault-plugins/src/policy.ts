/** Reserved even when the runtime policy is disabled: code cannot become
 * approved through an agent write and execute when its provider returns. */
export const writeReservations = [{
  key: "approved",
  says: "it is a person's approval of code that runs with this server's authority, "
    + "and the plugins panel — with the source in front of them — is where that is decided",
}]


/** Locality policy shared by HTTP faces. */
export const fromLoopback = (address: string): boolean => {
  const host = address.replace(/^::ffff:/i, "")
  return host === "127.0.0.1" || host === "::1"
}

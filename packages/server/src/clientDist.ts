/**
 * Where the browser bundle is.
 *
 * Two callers, one answer. A nix-built binary is wrapped with
 * `OLAI_DIST_DIR` pointing at the bundle derivation; the dev loop leaves it
 * unset and gets the tree `just serve` just built. Either way the directory
 * must already exist and contain a shell — the server does not build, because
 * a server that quietly rebuilt would be a second, slower build with different
 * inputs from the one CI proves.
 */

import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** `packages/web/dist`, from this file's own location. */
const inTree = (): string =>
  fileURLToPath(new URL("../../web/dist", import.meta.url))

export const DIST_ENV_VAR = "OLAI_DIST_DIR"

export const clientDist = (): string => {
  const configured = process.env[DIST_ENV_VAR]
  const dist = configured === undefined || configured === "" ? inTree() : configured

  if (!existsSync(`${dist}/index.html`)) {
    throw new Error(
      `no browser bundle at ${dist} (looked for index.html).${
        configured === undefined
          ? " Build it with `just build-client`, or run `just serve <dir>`, which does."
          : ` ${DIST_ENV_VAR} points at an unbuilt directory.`
      }`,
    )
  }
  return dist
}

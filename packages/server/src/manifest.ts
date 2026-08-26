/**
 * What an installed olai is: the manifest a browser reads when someone adds
 * this page to a home screen or a dock.
 *
 * Its own file, beside `clientDist.ts` and `codec.ts`, because it has nothing
 * to do with the thing that serves it — which is now demonstrated rather than
 * asserted: the sequencing `listener.ts` used to spell out went upstream as
 * `serveSurfaceApp`, and the app's name and mark did not go with it.
 *
 * The NAME is not a constant: it carries the machine this server runs on
 * (`@olai/surface`'s `appName`), so two deployments on two boxes install as
 * two names a person can tell apart. The manifest is already SERVED — it is
 * the framework's own layer answering `/manifest.webmanifest` with whatever
 * this file hands `listen` — so carrying a per-machine truth in it costs a
 * function instead of the constant it used to be, and nothing more.
 *
 * Only what is olai's is here. `start_url` and `display: standalone` are the
 * framework's install-friendly defaults (`pwaManifestLayer`), and so is a
 * `short_name` that is just the name; restating any of them would be two
 * places to change one decision, and the spec's own defaults (`scope` from
 * `start_url`, `orientation: "any"`, `purpose: "any"`) are the same trap one
 * layer down.
 *
 * The icon FILES are the browser bundle's (`packages/web/src/client/public`,
 * copied to the dist root by its build) and the paths below are the URLs that
 * puts them at. They are the only two ends of this contract, they live in two
 * packages that do not import each other — deliberately, see
 * `clientDist.ts` — and what checks that they still agree is `serve.test.ts`,
 * which fetches every `src` this names against a dist assembled from the
 * client's public files. It has to be a test rather than a type: the static
 * layer answers an unmatched path with the HTML shell, so a stale path here
 * would 200 rather than 404, and only the content type would say otherwise.
 *
 * The colours are the DEFAULT palette's paper — `reef`, which is what a page
 * that has picked no theme reads in — because they are the chrome around the
 * window before it opens, and there is nothing else this file could know: a
 * theme is a pick stored in one browser, and a manifest is read once by an
 * installer. Once the page is up it repaints the chrome from whatever was
 * picked (`packages/web/src/client/theme/state.ts`). The value cannot be
 * imported — the server does not depend on the client, deliberately — so what
 * checks it still agrees is the browser test that compares it against the
 * paper an unpicked page actually paints
 * (`packages/tests/features/theming.feature`).
 */

import type { ManifestOptions } from "@kolu/surface-app/server"
import { appName } from "@olai/surface"

export const manifestOf = (hostname: string): ManifestOptions => ({
  name: appName(hostname),
  description: "Self-hosted outliner: your files, your agent, a live web view.",
  themeColor: "#D7F0E8",
  backgroundColor: "#D7F0E8",
  lang: "en",
  categories: ["productivity", "utilities"],
  icons: [
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    {
      src: "/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      // The one icon a platform may crop to its own shape: it carries the
      // padding that survives being cut into a circle or a squircle.
      purpose: "maskable",
    },
  ],
})
